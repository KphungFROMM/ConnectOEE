using ConnectOEE.Core;
using ConnectOEE.Core.Oee;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Reporting;

/// <summary>
/// Assembles a <see cref="ReportModel"/> from the historian query engine plus the
/// event tables. One builder serves every report type; the renderers pick the
/// sections they need.
/// </summary>
public class ReportDataService
{
    private readonly IHistorianQueryService _historian;
    private readonly ConnectOeeDbContext _db;

    public ReportDataService(IHistorianQueryService historian, ConnectOeeDbContext db)
    {
        _historian = historian;
        _db = db;
    }

    public async Task<ReportModel> BuildAsync(ReportParams p, CancellationToken ct = default)
    {
        var gran = GranularityFor(p.ReportType, p.From, p.To);
        Guid? machineId = p.Level == EntityLevel.Machine ? p.EntityId : null;

        var snapshot = await _historian.GetSnapshotAsync(p.Level, p.EntityId, p.From, p.To, ct);
        var trend = await _historian.GetTrendAsync(new TrendQuery(p.Level, p.EntityId, p.From, p.To, gran), ct);
        var production = await _historian.GetProductionTrendAsync(
            new TrendQuery(p.Level, p.EntityId, p.From, p.To, gran), ct);

        var model = new ReportModel
        {
            ReportType = p.ReportType,
            Title = TitleFor(p.ReportType),
            ScopeName = snapshot.EntityName,
            ScopeLevel = p.Level.ToString(),
            From = p.From,
            To = p.To,
            Oee = snapshot.Oee,
            GoodCount = snapshot.GoodCount,
            RejectCount = snapshot.RejectCount,
            TotalCount = snapshot.TotalCount,
            DowntimeMin = snapshot.DowntimeMin,
            UptimeMin = snapshot.UptimeMin,
            DowntimeCount = snapshot.DowntimeCount,
            TargetOeePct = snapshot.TargetOeePct,
            Trend = trend.Points,
            Production = production,
        };

        var lineIds = await ResolveLineIdsAsync(p.Level, p.EntityId, ct);

        if (lineIds.Count > 0)
        {
            model.Reliability = await ComputeReliabilityAsync(lineIds, machineId, p.From, p.To, ct);
            if (model.UptimeMin <= 0 && model.Reliability.PlannedDowntimeMin + model.Reliability.UnplannedDowntimeMin > 0)
            {
                var periodMin = (p.To - p.From).TotalMinutes;
                model.UptimeMin = Math.Max(0, periodMin - model.Reliability.PlannedDowntimeMin - model.Reliability.UnplannedDowntimeMin);
            }

            model.TopFaults = await TopFaultsAsync(lineIds, machineId, p.From, p.To, ct);
            model.Shifts = await ShiftRowsAsync(lineIds, p.From, p.To, ct);

            if (machineId is { } mid)
                model.Reasons = await ReasonsForMachineAsync(lineIds, mid, p.From, p.To, ct);
            else
            {
                var reasons = new List<ReasonBucket>();
                foreach (var lineId in lineIds)
                    reasons.AddRange(await _historian.DrillThroughReasonsAsync(lineId, p.From, p.To, null, ct));
                model.Reasons = reasons
                    .GroupBy(r => new { r.Category, r.Reason })
                    .Select(g => new ReasonBucket(g.Key.Category, g.First().Kind, g.Key.Reason,
                        g.Sum(x => x.Count), Math.Round(g.Sum(x => x.TotalMin), 2)))
                    .OrderByDescending(r => r.TotalMin)
                    .ToList();
            }
        }

        if (p.Level != EntityLevel.Machine)
            model.Breakdown = await _historian.DrillDownAsync(p.Level, p.EntityId, p.From, p.To, ct);

        return model;
    }

    private async Task<List<ReasonBucket>> ReasonsForMachineAsync(
        List<Guid> lineIds, Guid machineId, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var raw = await _db.DowntimeEvents.AsNoTracking()
            .Where(e => lineIds.Contains(e.LineId) && e.MachineId == machineId
                && e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null)
            .Select(e => new { e.Category, e.Kind, e.Reason, e.DurationSec })
            .ToListAsync(ct);

        return raw
            .GroupBy(e => new { e.Category, e.Kind, Reason = e.Reason ?? "(unattributed)" })
            .Select(g => new ReasonBucket(
                g.Key.Category.ToString(),
                g.Key.Kind.ToString(),
                g.Key.Reason,
                g.Count(),
                Math.Round(g.Sum(x => x.DurationSec) / 60.0, 2)))
            .OrderByDescending(r => r.TotalMin)
            .ToList();
    }

    private async Task<List<Guid>> ResolveLineIdsAsync(EntityLevel level, Guid id, CancellationToken ct) => level switch
    {
        EntityLevel.Line => new List<Guid> { id },
        EntityLevel.Machine => await _db.Machines.AsNoTracking()
            .Where(m => m.Id == id).Select(m => m.LineId).ToListAsync(ct),
        EntityLevel.Department => await _db.Lines.AsNoTracking()
            .Where(l => l.DepartmentId == id).Select(l => l.Id).ToListAsync(ct),
        _ => await (from l in _db.Lines.AsNoTracking()
                    join d in _db.Departments.AsNoTracking() on l.DepartmentId equals d.Id
                    where d.PlantId == id
                    select l.Id).ToListAsync(ct),
    };

    private async Task<ReliabilityResult> ComputeReliabilityAsync(
        List<Guid> lineIds, Guid? machineId, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var periodSec = (to - from).TotalSeconds;
        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => lineIds.Contains(e.LineId) && e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);
        if (machineId is { } mid)
            q = q.Where(e => e.MachineId == mid);

        var downs = await q
            .Select(e => new { e.DurationSec, e.Kind, e.StartUtc, e.AcknowledgedUtc })
            .ToListAsync(ct);

        var totalDownSec = downs.Sum(d => d.DurationSec);
        var uptimeSec = Math.Max(0, periodSec - totalDownSec);
        var stats = downs.Select(d => new DowntimeStat(
            d.DurationSec,
            d.AcknowledgedUtc is { } ack ? (ack - d.StartUtc).TotalSeconds : null,
            d.Kind == DowntimeKind.Unplanned)).ToList();

        return ReliabilityCalculator.Compute(new ReliabilityInputs(periodSec, uptimeSec, stats));
    }

    private async Task<List<FaultRow>> TopFaultsAsync(
        List<Guid> lineIds, Guid? machineId, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var q = _db.FaultOccurrences.AsNoTracking()
            .Where(f => lineIds.Contains(f.LineId) && f.StartUtc >= from && f.StartUtc < to);
        if (machineId is { } mid)
            q = q.Where(f => f.MachineId == mid);

        var faults = await q
            .Select(f => new { f.Code, f.MappedReason, f.StartUtc, f.EndUtc })
            .ToListAsync(ct);

        return faults
            .GroupBy(f => f.Code)
            .Select(g => new FaultRow(
                g.Key,
                g.Select(x => x.MappedReason).FirstOrDefault(r => !string.IsNullOrEmpty(r)) ?? $"Fault {g.Key}",
                g.Count(),
                Math.Round(g.Sum(x => x.EndUtc is { } e ? (e - x.StartUtc).TotalMinutes : 0), 2)))
            .OrderByDescending(f => f.Count)
            .Take(15)
            .ToList();
    }

    private async Task<List<ShiftRow>> ShiftRowsAsync(
        List<Guid> lineIds, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var shifts = await _db.ShiftInstances.AsNoTracking()
            .Where(s => lineIds.Contains(s.LineId) && s.StartUtc < to && s.EndUtc > from)
            .OrderBy(s => s.StartUtc)
            .ToListAsync(ct);

        return shifts.Select(s => new ShiftRow(
            s.ShiftName, s.StartUtc, s.EndUtc,
            s.OeePct ?? 0, s.AvailabilityPct ?? 0, s.PerformancePct ?? 0, s.QualityPct ?? 0,
            s.GoodCount, s.RejectCount, s.DowntimeMinutes)).ToList();
    }

    private static Granularity GranularityFor(ReportType type, DateTimeOffset from, DateTimeOffset to) => type switch
    {
        ReportType.ShiftReport => Granularity.Hour,
        ReportType.DailyOee => Granularity.Hour,
        ReportType.WeeklySummary => Granularity.Day,
        ReportType.MonthlySummary => Granularity.Day,
        ReportType.ExecutiveSummary => (to - from) > TimeSpan.FromDays(31) ? Granularity.Week : Granularity.Day,
        _ => Granularity.Auto,
    };

    private static string TitleFor(ReportType type) => type switch
    {
        ReportType.ShiftReport => "Shift Report",
        ReportType.DailyOee => "Daily OEE Report",
        ReportType.DowntimePareto => "Downtime Pareto Report",
        ReportType.ProductionVsTarget => "Production vs Target Report",
        ReportType.WeeklySummary => "Weekly Summary",
        ReportType.MonthlySummary => "Monthly Summary",
        ReportType.ExecutiveSummary => "Executive Summary",
        ReportType.FaultMaintenance => "Fault / Maintenance Report",
        _ => "Report",
    };
}
