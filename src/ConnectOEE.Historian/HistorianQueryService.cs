using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Oee;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using NpgsqlTypes;

namespace ConnectOEE.Historian;

/// <summary>
/// Default historian query engine. Count roll-ups use TimescaleDB <c>time_bucket</c>
/// (raw hypertable for fine buckets) so a month of seconds never lands in memory;
/// downtime events are sparse so they are bucketed in process. OEE per bucket reuses
/// <see cref="OeeCalculator"/> with planned/run time derived from the bucket span and
/// the attributed downtime (planned downtime leaves loading time, unplanned reduces
/// run time) so the math matches the live engine and the shift roll-ups.
/// </summary>
public class HistorianQueryService : IHistorianQueryService
{
    private readonly ConnectOeeDbContext _db;
    private readonly IShiftScheduleService _shiftSchedule;

    public HistorianQueryService(ConnectOeeDbContext db, IShiftScheduleService shiftSchedule)
    {
        _db = db;
        _shiftSchedule = shiftSchedule;
    }

    // ----- Scope resolution -------------------------------------------------

    private sealed record Scope(
        string Name,
        IReadOnlyList<Guid> LineIds,
        IReadOnlyList<Guid> MachineIds,
        int CapacityUnits,
        double IdealCycleSec,
        double TargetOeePct,
        bool MachineLevel);

    private async Task<Scope> ResolveScopeAsync(EntityLevel level, Guid id,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        switch (level)
        {
            case EntityLevel.Machine:
            {
                var m = await _db.Machines.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
                        ?? throw new KeyNotFoundException($"Machine {id} not found");
                var cfg = await OeeCfgAsync(new[] { m.LineId }, from, to, ct);
                return new Scope(m.Name, new[] { m.LineId }, new[] { m.Id }, 1, cfg.ideal, cfg.target, true);
            }
            case EntityLevel.Line:
            {
                var line = await _db.Lines.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
                           ?? throw new KeyNotFoundException($"Line {id} not found");
                var oeeCfg = await _db.OeeConfigs.AsNoTracking()
                    .FirstOrDefaultAsync(c => c.LineId == id, ct);
                var machineIds = await _db.Machines.AsNoTracking()
                    .Where(x => x.LineId == id)
                    .OrderBy(x => x.SequenceIndex)
                    .Select(x => x.Id)
                    .ToListAsync(ct);
                var topology = LineTopologyResolver.FromConfig(oeeCfg, machineIds);
                if (topology.Topology == LineTopology.Continuous
                    && topology.OutputMachineId is Guid outputId)
                    machineIds = new List<Guid> { outputId };
                var cfg = await OeeCfgAsync(new[] { id }, from, to, ct);
                return new Scope(line.Name, new[] { id }, machineIds, 1, cfg.ideal, cfg.target, false);
            }
            case EntityLevel.Department:
            {
                var dept = await _db.Departments.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
                           ?? throw new KeyNotFoundException($"Department {id} not found");
                var lineIds = await _db.Lines.AsNoTracking()
                    .Where(x => x.DepartmentId == id).Select(x => x.Id).ToListAsync(ct);
                var machineIds = await _db.Machines.AsNoTracking()
                    .Where(x => lineIds.Contains(x.LineId)).Select(x => x.Id).ToListAsync(ct);
                var cfg = await OeeCfgAsync(lineIds, from, to, ct);
                return new Scope(dept.Name, lineIds, machineIds, Math.Max(1, lineIds.Count), cfg.ideal, cfg.target, false);
            }
            case EntityLevel.Plant:
            default:
            {
                var plant = await _db.Plants.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct)
                            ?? throw new KeyNotFoundException($"Plant {id} not found");
                var deptIds = await _db.Departments.AsNoTracking()
                    .Where(x => x.PlantId == id).Select(x => x.Id).ToListAsync(ct);
                var lineIds = await _db.Lines.AsNoTracking()
                    .Where(x => deptIds.Contains(x.DepartmentId)).Select(x => x.Id).ToListAsync(ct);
                var machineIds = await _db.Machines.AsNoTracking()
                    .Where(x => lineIds.Contains(x.LineId)).Select(x => x.Id).ToListAsync(ct);
                var cfg = await OeeCfgAsync(lineIds, from, to, ct);
                return new Scope(plant.Name, lineIds, machineIds, Math.Max(1, lineIds.Count), cfg.ideal, cfg.target, false);
            }
        }
    }

    private async Task<(double ideal, double target)> OeeCfgAsync(
        IReadOnlyList<Guid> lineIds, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        if (lineIds.Count == 0) return (1.0, 85.0);
        var cfgs = await _db.OeeConfigs.AsNoTracking()
            .Where(c => lineIds.Contains(c.LineId))
            .Select(c => new { c.IdealCycleTimeSec, c.TargetOeePct })
            .ToListAsync(ct);
        if (cfgs.Count == 0) return (1.0, 85.0);

        var ideal = await IdealCycleResolver.ResolveForLinesWindowAsync(_db, lineIds, from, to, ct);
        if (ideal <= 0) ideal = cfgs.Average(c => c.IdealCycleTimeSec <= 0 ? 1.0 : c.IdealCycleTimeSec);

        return (ideal, cfgs.Average(c => c.TargetOeePct <= 0 ? 85.0 : c.TargetOeePct));
    }

    // ----- Trend ------------------------------------------------------------

    public async Task<TrendResult> GetTrendAsync(TrendQuery query, CancellationToken ct = default)
    {
        var (from, to) = Normalize(query.From, query.To);
        var scope = await ResolveScopeAsync(query.Level, query.EntityId, from, to, ct);
        var gran = Resolve(query.Granularity, from, to);

        if (gran == Granularity.Shift)
            return await ShiftTrendAsync(query, scope, from, to, ct);

        var buckets = EnumerateBuckets(from, to, gran);
        var counts = await BucketCountsAsync(scope.MachineIds, from, to, gran, ct);
        var down = await BucketDowntimeAsync(scope, from, to, gran, ct);

        var points = new List<TrendPoint>(buckets.Count);
        foreach (var b in buckets)
        {
            counts.TryGetValue(b.Start, out var c);
            down.TryGetValue(b.Start, out var d);

            var spanSec = (Math.Min(b.End.ToUnixTimeSeconds(), to.ToUnixTimeSeconds())
                           - Math.Max(b.Start.ToUnixTimeSeconds(), from.ToUnixTimeSeconds()));
            var allSec = Math.Max(0, spanSec) * scope.CapacityUnits;
            var oee = ComputeOee(allSec, d.planned, d.unplanned, scope.IdealCycleSec, c.good, c.reject);

            var downMin = Math.Round((d.planned + d.unplanned) / 60.0, 2);
            var uptimeMin = Math.Round(Math.Max(0, allSec - d.planned - d.unplanned) / 60.0, 2);
            points.Add(new TrendPoint(b.Start, b.Label, oee, c.good, c.reject, c.good + c.reject,
                downMin, scope.TargetOeePct,
                uptimeMin,
                Math.Round(d.planned / 60.0, 2),
                Math.Round(d.unplanned / 60.0, 2),
                d.micro));
        }

        return new TrendResult(query.Level, query.EntityId, scope.Name, gran, from, to, points);
    }

    /// <summary>Shift trend uses finalized <see cref="ShiftInstance"/> roll-ups or live recompute for open shifts.</summary>
    private async Task<TrendResult> ShiftTrendAsync(TrendQuery query, Scope scope,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var instances = await _db.ShiftInstances.AsNoTracking()
            .Where(s => scope.LineIds.Contains(s.LineId) && s.StartUtc < to && s.EndUtc > from)
            .OrderBy(s => s.StartUtc)
            .ToListAsync(ct);

        var points = new List<TrendPoint>(instances.Count);
        foreach (var s in instances)
        {
            OeeResult oee;
            if (s.IsClosed && s.OeePct is not null)
            {
                oee = new OeeResult(
                    s.AvailabilityPct ?? 0, s.PerformancePct ?? 0, s.QualityPct ?? 0, s.OeePct ?? 0,
                    0, s.RejectCount + s.GoodCount > 0 ? Math.Round(100.0 * s.RejectCount / (s.GoodCount + s.RejectCount), 2) : 0,
                    s.QualityPct ?? 0, s.QualityPct ?? 0, s.DowntimeMinutes, 0, 0, 0, scope.IdealCycleSec);
            }
            else
            {
                oee = await ComputeOpenShiftOeeAsync(s, scope.IdealCycleSec, ct);
            }

            points.Add(new TrendPoint(s.StartUtc, $"{s.ShiftName} {s.StartUtc.LocalDateTime:MM/dd}", oee,
                s.GoodCount, s.RejectCount, s.GoodCount + s.RejectCount, s.DowntimeMinutes, scope.TargetOeePct));
        }

        return new TrendResult(query.Level, query.EntityId, scope.Name, Granularity.Shift, from, to, points);
    }

    private async Task<OeeResult> ComputeOpenShiftOeeAsync(ShiftInstance shift, double idealCycleSec, CancellationToken ct)
    {
        var balance = await _shiftSchedule.GetTimeBalanceAsync(shift.LineId, shift, DateTimeOffset.UtcNow, ct);
        if (balance.IsCalendarExcluded) return OeeResult.Empty;

        var good = await _db.TsCounts.AsNoTracking()
            .Where(c => c.LineId == shift.LineId && c.TimestampUtc >= shift.StartUtc && c.TimestampUtc < shift.EndUtc)
            .SumAsync(c => (long?)c.GoodCount, ct) ?? 0;
        var reject = await _db.TsCounts.AsNoTracking()
            .Where(c => c.LineId == shift.LineId && c.TimestampUtc >= shift.StartUtc && c.TimestampUtc < shift.EndUtc)
            .SumAsync(c => (long?)c.RejectCount, ct) ?? 0;

        var downtimes = await _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.LineId == shift.LineId && e.StartUtc >= shift.StartUtc && e.StartUtc < shift.EndUtc && e.EndUtc != null)
            .Select(e => new { e.DurationSec, e.Kind })
            .ToListAsync(ct);

        var plannedDownSec = downtimes.Where(d => d.Kind == DowntimeKind.Planned).Sum(d => d.DurationSec);
        var unplannedDownSec = downtimes.Where(d => d.Kind == DowntimeKind.Unplanned).Sum(d => d.DurationSec);
        var plannedTime = Math.Max(0, balance.AllTimeSec - balance.BreakOverlapSec - plannedDownSec);
        var runTime = Math.Max(0, plannedTime - unplannedDownSec);

        return OeeCalculator.Compute(new OeeInputs(balance.AllTimeSec, plannedTime, runTime, idealCycleSec, good, reject));
    }

    // ----- KPI snapshot -----------------------------------------------------

    public async Task<KpiSnapshot> GetSnapshotAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var scope = await ResolveScopeAsync(level, entityId, from, to, ct);
        var agg = await AggregateAsync(scope, scope.MachineIds, scope.LineIds, scope.MachineLevel, from, to, ct);
        var targets = await TargetsAsync(scope.LineIds, ct);

        var periodSec = Math.Max(0, (to - from).TotalSeconds) * scope.CapacityUnits;
        var plannedDownSec = agg.PlannedDowntimeMin * 60.0;
        var unplannedDownSec = agg.UnplannedDowntimeMin * 60.0;
        var plannedTime = Math.Max(0, periodSec - plannedDownSec);
        var runTime = Math.Max(0, plannedTime - unplannedDownSec);
        var inputs = new OeeInputs(periodSec, plannedTime, runTime, scope.IdealCycleSec, agg.Good, agg.Reject);
        var stateTimes = await AggregateStateTimesAsync(scope.MachineIds, from, to, ct);
        var categorySec = await CategoryDowntimeSecAsync(scope, from, to, ct);
        var elapsedSec = Math.Max(0, ((DateTimeOffset.UtcNow < to ? DateTimeOffset.UtcNow : to) - from).TotalSeconds);
        var ext = ExtendedKpiCalculator.Compute(
            agg.Oee, inputs, targets, agg.Good, 0, false,
            new ResolvedQuantityTarget(null, null), new ResolvedQuantityTarget(null, null), stateTimes,
            elapsedSec, categorySec);

        return new KpiSnapshot(level, entityId, scope.Name, from, to, agg.Oee,
            agg.Good, agg.Reject, agg.Good + agg.Reject, agg.DowntimeMin, agg.DowntimeCount, targets.TargetOeePct,
            agg.UptimeMin, agg.PlannedDowntimeMin, agg.UnplannedDowntimeMin, agg.MicroStopCount,
            ext.Targets.TargetAvailabilityPct, ext.Targets.TargetPerformancePct, ext.Targets.TargetQualityPct,
            ext.OeeGapPct, ext.AvailabilityGapPct, ext.PerformanceGapPct, ext.QualityGapPct,
            ext.UtilizationPct, ext.CycleVariancePct, StateTimeAccrual.ToMinutes(stateTimes), ext.PartsLoss);
    }

    public async Task<ProductionPartsLossResult> GetProductionPartsLossAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var scope = await ResolveScopeAsync(level, entityId, from, to, ct);
        var agg = await AggregateAsync(scope, scope.MachineIds, scope.LineIds, scope.MachineLevel, from, to, ct);
        var targets = await TargetsAsync(scope.LineIds, ct);

        var periodSec = Math.Max(0, (to - from).TotalSeconds) * scope.CapacityUnits;
        var plannedDownSec = agg.PlannedDowntimeMin * 60.0;
        var unplannedDownSec = agg.UnplannedDowntimeMin * 60.0;
        var plannedTime = Math.Max(0, periodSec - plannedDownSec);
        var runTime = Math.Max(0, plannedTime - unplannedDownSec);
        var inputs = new OeeInputs(periodSec, plannedTime, runTime, scope.IdealCycleSec, agg.Good, agg.Reject);
        var stateTimes = await AggregateStateTimesAsync(scope.MachineIds, from, to, ct);
        var categorySec = await CategoryDowntimeSecAsync(scope, from, to, ct);
        var elapsedSec = Math.Max(0, ((DateTimeOffset.UtcNow < to ? DateTimeOffset.UtcNow : to) - from).TotalSeconds);
        var ext = ExtendedKpiCalculator.Compute(
            agg.Oee, inputs, targets, agg.Good, 0, false,
            new ResolvedQuantityTarget(null, null), new ResolvedQuantityTarget(null, null), stateTimes,
            elapsedSec, categorySec);

        var byCategory = categorySec
            .Where(kv => kv.Value > 0 && scope.IdealCycleSec > 0)
            .Select(kv => new ProductionPartsLossByCategory(
                kv.Key,
                kv.Value,
                (long)Math.Floor(kv.Value / scope.IdealCycleSec)))
            .OrderByDescending(x => x.PartsLost)
            .ToList();

        return new ProductionPartsLossResult(level, entityId, scope.Name, from, to, ext.PartsLoss, byCategory);
    }

    private async Task<Dictionary<string, double>> CategoryDowntimeSecAsync(
        Scope scope, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);
        q = scope.MachineLevel
            ? q.Where(e => e.MachineId != null && scope.MachineIds.Contains(e.MachineId.Value))
            : q.Where(e => scope.LineIds.Contains(e.LineId));

        var raw = await q.Select(e => new { e.Category, e.DurationSec }).ToListAsync(ct);
        return raw
            .GroupBy(e => e.Category)
            .ToDictionary(g => g.Key.ToString(), g => (double)g.Sum(x => x.DurationSec));
    }

    public async Task<StateTimeBreakdownResult> GetStateBreakdownAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var scope = await ResolveScopeAsync(level, entityId, from, to, ct);
        var stateTimes = await AggregateStateTimesAsync(scope.MachineIds, from, to, ct);
        return new StateTimeBreakdownResult(level, entityId, scope.Name, from, to, StateTimeAccrual.ToMinutes(stateTimes));
    }

    // ----- Drill-down -------------------------------------------------------

    public async Task<IReadOnlyList<DrillNode>> DrillDownAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var result = new List<DrillNode>();

        switch (level)
        {
            case EntityLevel.Plant:
            {
                var depts = await _db.Departments.AsNoTracking()
                    .Where(d => d.PlantId == entityId).OrderBy(d => d.Name).ToListAsync(ct);
                foreach (var d in depts)
                    result.Add(await ChildNodeAsync(EntityLevel.Department, d.Id, d.Name, from, to, ct));
                break;
            }
            case EntityLevel.Department:
            {
                var lines = await _db.Lines.AsNoTracking()
                    .Where(l => l.DepartmentId == entityId).OrderBy(l => l.Name).ToListAsync(ct);
                foreach (var l in lines)
                    result.Add(await ChildNodeAsync(EntityLevel.Line, l.Id, l.Name, from, to, ct));
                break;
            }
            case EntityLevel.Line:
            {
                var machines = await _db.Machines.AsNoTracking()
                    .Where(m => m.LineId == entityId).OrderBy(m => m.SequenceIndex).ToListAsync(ct);
                foreach (var m in machines)
                    result.Add(await ChildNodeAsync(EntityLevel.Machine, m.Id, m.Name, from, to, ct));
                break;
            }
        }
        return result;
    }

    private async Task<DrillNode> ChildNodeAsync(EntityLevel level, Guid id, string name,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var scope = await ResolveScopeAsync(level, id, from, to, ct);
        var agg = await AggregateAsync(scope, scope.MachineIds, scope.LineIds, scope.MachineLevel, from, to, ct);
        return new DrillNode(level, id, name, agg.Oee, agg.Good, agg.Reject, agg.DowntimeMin, agg.DowntimeCount, agg.UptimeMin);
    }

    // ----- Drill-through (reasons) -----------------------------------------

    public async Task<IReadOnlyList<ReasonBucket>> DrillThroughReasonsAsync(Guid lineId,
        DateTimeOffset from, DateTimeOffset to, string? category = null, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.LineId == lineId && e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);

        if (!string.IsNullOrWhiteSpace(category) &&
            Enum.TryParse<LossCategory>(category, ignoreCase: true, out var cat))
            q = q.Where(e => e.Category == cat);

        // Materialize then group in memory: the enum ToString()/null-coalesce/rounding
        // in the projection don't translate to SQL GROUP BY.
        var raw = await q
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

    public async Task<IReadOnlyList<ReasonBucket>> DrillThroughReasonsScopedAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, string? category = null, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var scope = await ResolveScopeAsync(level, entityId, from, to, ct);
        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);

        q = scope.MachineLevel
            ? q.Where(e => e.MachineId != null && scope.MachineIds.Contains(e.MachineId.Value))
            : q.Where(e => scope.LineIds.Contains(e.LineId));

        if (!string.IsNullOrWhiteSpace(category) &&
            Enum.TryParse<LossCategory>(category, ignoreCase: true, out var cat))
            q = q.Where(e => e.Category == cat);

        var raw = await q.Select(e => new { e.Category, e.Kind, e.Reason, e.DurationSec }).ToListAsync(ct);
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

    public async Task<IReadOnlyList<HistorianLossBucket>> GetLossesScopedAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        var scope = await ResolveScopeAsync(level, entityId, from, to, ct);
        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);

        q = scope.MachineLevel
            ? q.Where(e => e.MachineId != null && scope.MachineIds.Contains(e.MachineId.Value))
            : q.Where(e => scope.LineIds.Contains(e.LineId));

        var raw = await q.Select(e => new { e.Category, e.DurationSec }).ToListAsync(ct);
        return raw
            .GroupBy(e => e.Category)
            .Select(g => new HistorianLossBucket(g.Key.ToString(), g.Count(), g.Sum(x => x.DurationSec)))
            .OrderByDescending(x => x.TotalSec)
            .ToList();
    }

    public async Task<IReadOnlyList<HistorianEvent>> GetEventsScopedAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, int take = 100, Guid? machineId = null,
        string? category = null, CancellationToken ct = default)
    {
        (from, to) = Normalize(from, to);
        take = Math.Clamp(take, 1, 500);
        var scope = await ResolveScopeAsync(level, entityId, from, to, ct);

        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);

        q = scope.MachineLevel
            ? q.Where(e => e.MachineId != null && scope.MachineIds.Contains(e.MachineId.Value))
            : q.Where(e => scope.LineIds.Contains(e.LineId));

        if (machineId is { } mid)
            q = q.Where(e => e.MachineId == mid);

        if (!string.IsNullOrWhiteSpace(category) &&
            Enum.TryParse<LossCategory>(category, ignoreCase: true, out var cat))
            q = q.Where(e => e.Category == cat);

        var rows = await q
            .OrderByDescending(e => e.StartUtc)
            .Take(take)
            .Select(e => new
            {
                e.Id,
                e.LineId,
                e.MachineId,
                MachineName = e.MachineId != null
                    ? _db.Machines.Where(m => m.Id == e.MachineId).Select(m => m.Name).FirstOrDefault()
                    : null,
                e.StartUtc,
                e.EndUtc,
                e.DurationSec,
                e.Category,
                e.Kind,
                e.Reason,
                e.FaultCode,
                e.IsMicroStop,
            })
            .ToListAsync(ct);

        return rows.Select(e => new HistorianEvent(
            e.Id, e.LineId, e.MachineId, e.MachineName,
            e.StartUtc, e.EndUtc, e.DurationSec,
            e.Category.ToString(), e.Kind.ToString(),
            e.Reason, e.FaultCode, e.IsMicroStop)).ToList();
    }

    // ----- Production trend -------------------------------------------------

    public async Task<IReadOnlyList<ProductionPoint>> GetProductionTrendAsync(TrendQuery query, CancellationToken ct = default)
    {
        var (from, to) = Normalize(query.From, query.To);
        var scope = await ResolveScopeAsync(query.Level, query.EntityId, from, to, ct);
        var gran = Resolve(query.Granularity, from, to);
        if (gran == Granularity.Shift) gran = Granularity.Hour;

        var buckets = EnumerateBuckets(from, to, gran);
        var counts = await BucketCountsAsync(scope.MachineIds, from, to, gran, ct);

        var points = new List<ProductionPoint>(buckets.Count);
        foreach (var b in buckets)
        {
            counts.TryGetValue(b.Start, out var c);
            var spanSec = Math.Max(0, Math.Min(b.End.ToUnixTimeSeconds(), to.ToUnixTimeSeconds())
                                       - Math.Max(b.Start.ToUnixTimeSeconds(), from.ToUnixTimeSeconds()));
            // Target output for the bucket = ideal throughput across capacity units.
            var target = scope.IdealCycleSec > 0 ? spanSec / scope.IdealCycleSec * scope.CapacityUnits : 0;
            var total = c.good + c.reject;
            var scrap = total > 0 ? Math.Round(100.0 * c.reject / total, 2) : 0;
            points.Add(new ProductionPoint(b.Start, b.Label, c.good, c.reject, total, Math.Round(target, 0), scrap));
        }
        return points;
    }

    // ----- Aggregation core -------------------------------------------------

    private sealed record Agg(
        OeeResult Oee, long Good, long Reject, double DowntimeMin, int DowntimeCount,
        double UptimeMin, double PlannedDowntimeMin, double UnplannedDowntimeMin, int MicroStopCount);

    private async Task<Agg> AggregateAsync(Scope scope, IReadOnlyList<Guid> machineIds,
        IReadOnlyList<Guid> lineIds, bool machineLevel, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        var counts = await TotalCountsAsync(machineIds, from, to, ct);

        var downQuery = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);
        downQuery = machineLevel
            ? downQuery.Where(e => machineIds.Contains(e.MachineId!.Value))
            : downQuery.Where(e => lineIds.Contains(e.LineId));

        var downs = await downQuery
            .Select(e => new { e.DurationSec, e.Kind, e.IsMicroStop })
            .ToListAsync(ct);

        var plannedSec = downs.Where(d => d.Kind == DowntimeKind.Planned).Sum(d => d.DurationSec);
        var unplannedSec = downs.Where(d => d.Kind != DowntimeKind.Planned).Sum(d => d.DurationSec);

        if (counts.good + counts.reject == 0 && downs.Count == 0)
        {
            return new Agg(OeeResult.Empty, 0, 0, 0, 0, 0, 0, 0, 0);
        }

        var allSec = (to.ToUnixTimeSeconds() - from.ToUnixTimeSeconds()) * scope.CapacityUnits;
        var oee = ComputeOee(allSec, plannedSec, unplannedSec, scope.IdealCycleSec, counts.good, counts.reject);
        var downMin = Math.Round((plannedSec + unplannedSec) / 60.0, 2);
        var uptimeMin = Math.Round(Math.Max(0, allSec - plannedSec - unplannedSec) / 60.0, 2);
        var micro = downs.Count(d => d.IsMicroStop);

        return new Agg(oee, counts.good, counts.reject, downMin, downs.Count,
            uptimeMin, Math.Round(plannedSec / 60.0, 2), Math.Round(unplannedSec / 60.0, 2), micro);
    }

    private static OeeResult ComputeOee(double allSec, double plannedDownSec, double unplannedDownSec,
        double idealCycleSec, long good, long reject)
    {
        if (allSec <= 0) return OeeResult.Empty;
        if (good + reject == 0 && plannedDownSec + unplannedDownSec <= 0) return OeeResult.Empty;
        var plannedTime = Math.Max(0, allSec - plannedDownSec);
        var runTime = Math.Max(0, plannedTime - unplannedDownSec);
        if (good + reject == 0)
        {
            // Downtime exists but no production — availability only, no phantom performance loss.
            var avail = plannedTime > 0 ? Math.Max(0, plannedTime - unplannedDownSec) / plannedTime : 0;
            return new OeeResult(
                Math.Round(avail * 100, 2), 0, 0, 0, 0, 0, 0, 0,
                Math.Max(0, plannedTime - runTime) / 60.0, 0, 0, 0, idealCycleSec);
        }
        return OeeCalculator.Compute(new OeeInputs(allSec, plannedTime, runTime, idealCycleSec, good, reject));
    }

    // ----- Raw SQL count roll-ups ------------------------------------------

    private async Task<(long good, long reject)> TotalCountsAsync(
        IReadOnlyCollection<Guid> machineIds, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        if (machineIds.Count == 0) return (0, 0);

        if (!_db.Database.IsRelational())
        {
            var good = await _db.TsCounts.AsNoTracking()
                .Where(c => machineIds.Contains(c.MachineId) && c.TimestampUtc >= from && c.TimestampUtc < to)
                .SumAsync(c => (long?)c.GoodCount, ct) ?? 0;
            var reject = await _db.TsCounts.AsNoTracking()
                .Where(c => machineIds.Contains(c.MachineId) && c.TimestampUtc >= from && c.TimestampUtc < to)
                .SumAsync(c => (long?)c.RejectCount, ct) ?? 0;
            return (good, reject);
        }

        const string sql = @"SELECT COALESCE(SUM(""GoodCount""),0), COALESCE(SUM(""RejectCount""),0)
FROM ts_counts WHERE ""MachineId"" = ANY(@ids) AND ""TimestampUtc"" >= @from AND ""TimestampUtc"" < @to;";

        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        var close = conn.State != System.Data.ConnectionState.Open;
        if (close) await conn.OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.Add(new NpgsqlParameter("ids", NpgsqlDbType.Array | NpgsqlDbType.Uuid) { Value = machineIds.ToArray() });
            cmd.Parameters.AddWithValue("from", from);
            cmd.Parameters.AddWithValue("to", to);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
                return (r.GetInt64(0), r.GetInt64(1));
            return (0, 0);
        }
        finally { if (close) await conn.CloseAsync(); }
    }

    private async Task<Dictionary<DateTimeOffset, (long good, long reject, long total)>> BucketCountsAsync(
        IReadOnlyCollection<Guid> machineIds, DateTimeOffset from, DateTimeOffset to, Granularity gran, CancellationToken ct)
    {
        var map = new Dictionary<DateTimeOffset, (long good, long reject, long total)>();
        if (machineIds.Count == 0) return map;

        const string sql = @"SELECT time_bucket(@bucket::interval, ""TimestampUtc"") AS b,
       COALESCE(SUM(""GoodCount""),0), COALESCE(SUM(""RejectCount""),0), COALESCE(SUM(""TotalCount""),0)
FROM ts_counts
WHERE ""MachineId"" = ANY(@ids) AND ""TimestampUtc"" >= @from AND ""TimestampUtc"" < @to
GROUP BY b ORDER BY b;";

        var conn = (NpgsqlConnection)_db.Database.GetDbConnection();
        var close = conn.State != System.Data.ConnectionState.Open;
        if (close) await conn.OpenAsync(ct);
        try
        {
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("bucket", SqlInterval(gran));
            cmd.Parameters.Add(new NpgsqlParameter("ids", NpgsqlDbType.Array | NpgsqlDbType.Uuid) { Value = machineIds.ToArray() });
            cmd.Parameters.AddWithValue("from", from);
            cmd.Parameters.AddWithValue("to", to);
            await using var r = await cmd.ExecuteReaderAsync(ct);
            while (await r.ReadAsync(ct))
            {
                // Month buckets are produced as daily rows in SQL then folded into the
                // calendar month so the keys line up with the C# bucket enumerator.
                var raw = r.GetFieldValue<DateTimeOffset>(0).ToUniversalTime();
                var key = BucketKey(raw, gran);
                map.TryGetValue(key, out var cur);
                map[key] = (cur.good + r.GetInt64(1), cur.reject + r.GetInt64(2), cur.total + r.GetInt64(3));
            }
        }
        finally { if (close) await conn.CloseAsync(); }
        return map;
    }

    // ----- In-process downtime bucketing -----------------------------------

    private async Task<Dictionary<DateTimeOffset, (double planned, double unplanned, int micro)>> BucketDowntimeAsync(
        Scope scope, DateTimeOffset from, DateTimeOffset to, Granularity gran, CancellationToken ct)
    {
        var q = _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.StartUtc >= from && e.StartUtc < to && e.EndUtc != null);
        q = scope.MachineLevel
            ? q.Where(e => scope.MachineIds.Contains(e.MachineId!.Value))
            : q.Where(e => scope.LineIds.Contains(e.LineId));

        var events = await q.Select(e => new { e.StartUtc, e.DurationSec, e.Kind, e.IsMicroStop }).ToListAsync(ct);

        var map = new Dictionary<DateTimeOffset, (double planned, double unplanned, int micro)>();
        foreach (var e in events)
        {
            var key = FloorToBucket(e.StartUtc.ToUniversalTime(), gran);
            map.TryGetValue(key, out var cur);
            if (e.Kind == DowntimeKind.Planned) cur.planned += e.DurationSec;
            else cur.unplanned += e.DurationSec;
            if (e.IsMicroStop) cur.micro++;
            map[key] = cur;
        }
        return map;
    }

    public async Task<ReliabilityTrendResult> GetReliabilityTrendAsync(TrendQuery query, CancellationToken ct = default)
    {
        var (from, to) = Normalize(query.From, query.To);
        var scope = await ResolveScopeAsync(query.Level, query.EntityId, from, to, ct);
        var gran = Resolve(query.Granularity, from, to);
        if (gran == Granularity.Shift) gran = Granularity.Hour;

        var buckets = EnumerateBuckets(from, to, gran);
        var down = await BucketDowntimeAsync(scope, from, to, gran, ct);

        var points = new List<ReliabilityTrendPoint>(buckets.Count);
        foreach (var b in buckets)
        {
            down.TryGetValue(b.Start, out var d);
            var spanSec = Math.Max(0, Math.Min(b.End.ToUnixTimeSeconds(), to.ToUnixTimeSeconds())
                                      - Math.Max(b.Start.ToUnixTimeSeconds(), from.ToUnixTimeSeconds()));
            var periodSec = spanSec * scope.CapacityUnits;
            var downSec = d.planned + d.unplanned;
            var uptimeSec = Math.Max(0, periodSec - downSec);

            var bucketFrom = DateTimeOffset.FromUnixTimeSeconds(Math.Max(b.Start.ToUnixTimeSeconds(), from.ToUnixTimeSeconds()));
            var bucketTo = DateTimeOffset.FromUnixTimeSeconds(Math.Min(b.End.ToUnixTimeSeconds(), to.ToUnixTimeSeconds()));
            var events = await _db.DowntimeEvents.AsNoTracking()
                .Where(e => scope.LineIds.Contains(e.LineId)
                    && e.StartUtc >= bucketFrom && e.StartUtc < bucketTo && e.EndUtc != null)
                .Select(e => new { e.DurationSec, e.Kind, e.StartUtc, e.AcknowledgedUtc })
                .ToListAsync(ct);

            var stats = events.Select(e => new DowntimeStat(
                e.DurationSec,
                e.AcknowledgedUtc is { } ack ? (ack - e.StartUtc).TotalSeconds : null,
                e.Kind == DowntimeKind.Unplanned)).ToList();

            var rel = ReliabilityCalculator.Compute(new ReliabilityInputs(periodSec, uptimeSec, stats));
            points.Add(new ReliabilityTrendPoint(
                b.Start, b.Label, rel.MttrMin, rel.MtbfMin, rel.StopsPerHour,
                Math.Round(downSec / 60.0, 2), Math.Round(uptimeSec / 60.0, 2)));
        }

        return new ReliabilityTrendResult(query.Level, query.EntityId, scope.Name, gran, from, to, points);
    }

    // ----- Bucket helpers ---------------------------------------------------

    private sealed record Bucket(DateTimeOffset Start, DateTimeOffset End, string Label);

    private static (DateTimeOffset from, DateTimeOffset to) Normalize(DateTimeOffset from, DateTimeOffset to)
    {
        from = from.ToUniversalTime();
        to = to.ToUniversalTime();
        if (to <= from) to = from.AddHours(1);
        return (from, to);
    }

    private static Granularity Resolve(Granularity requested, DateTimeOffset from, DateTimeOffset to)
    {
        if (requested != Granularity.Auto) return requested;
        var span = to - from;
        if (span <= TimeSpan.FromDays(2)) return Granularity.Hour;
        if (span <= TimeSpan.FromDays(62)) return Granularity.Day;
        if (span <= TimeSpan.FromDays(366)) return Granularity.Week;
        return Granularity.Month;
    }

    private static string SqlInterval(Granularity g) => g switch
    {
        Granularity.Hour => "1 hour",
        Granularity.Day => "1 day",
        Granularity.Week => "7 days",
        // Month buckets at day granularity in SQL; the C# enumerator regroups by month.
        Granularity.Month => "1 day",
        _ => "1 hour",
    };

    private static readonly DateTimeOffset Epoch = new(1970, 1, 1, 0, 0, 0, TimeSpan.Zero);

    private static DateTimeOffset BucketKey(DateTimeOffset ts, Granularity g) =>
        FloorToBucket(ts.ToUniversalTime(), g);

    private static DateTimeOffset FloorToBucket(DateTimeOffset ts, Granularity g)
    {
        ts = ts.ToUniversalTime();
        switch (g)
        {
            case Granularity.Hour:
                return new DateTimeOffset(ts.Year, ts.Month, ts.Day, ts.Hour, 0, 0, TimeSpan.Zero);
            case Granularity.Day:
                return new DateTimeOffset(ts.Year, ts.Month, ts.Day, 0, 0, 0, TimeSpan.Zero);
            case Granularity.Week:
            {
                var weeks = (long)Math.Floor((ts - Epoch).TotalDays / 7.0);
                return Epoch.AddDays(weeks * 7);
            }
            case Granularity.Month:
                return new DateTimeOffset(ts.Year, ts.Month, 1, 0, 0, 0, TimeSpan.Zero);
            default:
                return new DateTimeOffset(ts.Year, ts.Month, ts.Day, ts.Hour, 0, 0, TimeSpan.Zero);
        }
    }

    private static List<Bucket> EnumerateBuckets(DateTimeOffset from, DateTimeOffset to, Granularity g)
    {
        var list = new List<Bucket>();
        var cursor = FloorToBucket(from, g);
        var guard = 0;
        while (cursor < to && guard++ < 100_000)
        {
            DateTimeOffset next = g switch
            {
                Granularity.Hour => cursor.AddHours(1),
                Granularity.Day => cursor.AddDays(1),
                Granularity.Week => cursor.AddDays(7),
                Granularity.Month => cursor.AddMonths(1),
                _ => cursor.AddHours(1),
            };
            list.Add(new Bucket(cursor, next, LabelFor(cursor, g)));
            cursor = next;
        }
        return list;
    }

    private async Task<OeeTargets> TargetsAsync(IReadOnlyList<Guid> lineIds, CancellationToken ct)
    {
        if (lineIds.Count == 0) return new OeeTargets(85, 90, 95, 99);
        var cfgs = await _db.OeeConfigs.AsNoTracking()
            .Where(c => lineIds.Contains(c.LineId))
            .ToListAsync(ct);
        if (cfgs.Count == 0) return new OeeTargets(85, 90, 95, 99);
        double Avg(Func<OeeConfig, double> sel, double fallback) =>
            Math.Round(cfgs.Average(c => { var v = sel(c); return v <= 0 ? fallback : v; }), 2);
        return new OeeTargets(
            Avg(c => c.TargetOeePct, 85),
            Avg(c => c.TargetAvailabilityPct, 90),
            Avg(c => c.TargetPerformancePct, 95),
            Avg(c => c.TargetQualityPct, 99));
    }

    private async Task<StateTimeSeconds> AggregateStateTimesAsync(
        IReadOnlyCollection<Guid> machineIds, DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        if (machineIds.Count == 0) return StateTimeSeconds.Empty;

        var rows = await _db.TsStates.AsNoTracking()
            .Where(s => machineIds.Contains(s.MachineId) && s.TimestampUtc >= from && s.TimestampUtc < to)
            .OrderBy(s => s.MachineId).ThenBy(s => s.TimestampUtc)
            .Select(s => new { s.MachineId, s.TimestampUtc, s.State })
            .ToListAsync(ct);

        var total = StateTimeSeconds.Empty;
        foreach (var grp in rows.GroupBy(r => r.MachineId))
        {
            var machineTimes = StateTimeSeconds.Empty;
            var samples = grp.ToList();
            for (var i = 0; i < samples.Count; i++)
            {
                var start = samples[i].TimestampUtc < from ? from : samples[i].TimestampUtc;
                var end = i < samples.Count - 1
                    ? (samples[i + 1].TimestampUtc > to ? to : samples[i + 1].TimestampUtc)
                    : to;
                var elapsed = Math.Max(0, (end - start).TotalSeconds);
                var t = machineTimes;
                StateTimeAccrual.Accrue(ref t, samples[i].State, elapsed);
                machineTimes = t;
            }
            total = AddStateTimes(total, machineTimes);
        }

        return total;
    }

    private static StateTimeSeconds AddStateTimes(StateTimeSeconds a, StateTimeSeconds b) =>
        new(
            a.RunSec + b.RunSec,
            a.PlannedDownSec + b.PlannedDownSec,
            a.IdleSec + b.IdleSec,
            a.DownSec + b.DownSec,
            a.SetupSec + b.SetupSec,
            a.StarvedSec + b.StarvedSec,
            a.BlockedSec + b.BlockedSec,
            a.UnknownSec + b.UnknownSec);

    private static string LabelFor(DateTimeOffset b, Granularity g)
    {
        var local = b.ToLocalTime();
        return g switch
        {
            Granularity.Hour => local.ToString("MM/dd HH:00"),
            Granularity.Day => local.ToString("MM/dd"),
            Granularity.Week => $"wk {local:MM/dd}",
            Granularity.Month => local.ToString("MMM yyyy"),
            _ => local.ToString("MM/dd HH:00"),
        };
    }
}
