using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Oee;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Oee;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Closes shift instances whose window has ended: finalizes OEE/counts/downtime from
/// persisted data so closed shifts are immutable, then emits a SignalR "shiftChanged"
/// so dashboards reset their shift tiles. The resolver opens the next instance lazily.
/// </summary>
public class ShiftBoundaryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IHubContext<LiveHub> _hub;
    private readonly ILogger<ShiftBoundaryWorker> _logger;
    private readonly TimeSpan _interval = TimeSpan.FromSeconds(30);

    public ShiftBoundaryWorker(IServiceScopeFactory scopeFactory, IHubContext<LiveHub> hub, ILogger<ShiftBoundaryWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _hub = hub;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await FinalizeEndedShiftsAsync(stoppingToken);
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex) { _logger.LogError(ex, "Shift finalize failed"); }

            await Task.Delay(_interval, stoppingToken);
        }
    }

    private async Task FinalizeEndedShiftsAsync(CancellationToken ct)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConnectOeeDbContext>();
        var schedule = scope.ServiceProvider.GetRequiredService<IShiftScheduleService>();
        var now = DateTimeOffset.UtcNow;

        var ended = await db.ShiftInstances
            .Where(s => !s.IsClosed && s.EndUtc <= now)
            .OrderBy(s => s.EndUtc)
            .Take(50)
            .ToListAsync(ct);

        foreach (var shift in ended)
        {
            var idealCycle = await IdealCycleResolver.ResolveForLineWindowAsync(
                db, shift.LineId, shift.StartUtc, shift.EndUtc, ct);

            var oeeCfg = await db.OeeConfigs.AsNoTracking()
                .FirstOrDefaultAsync(c => c.LineId == shift.LineId, ct);
            var machinesBySequence = await db.Machines.AsNoTracking()
                .Where(m => m.LineId == shift.LineId)
                .OrderBy(m => m.SequenceIndex)
                .Select(m => m.Id)
                .ToListAsync(ct);
            var topology = LineTopologyResolver.FromConfig(oeeCfg, machinesBySequence);

            var countsQuery = db.TsCounts
                .Where(c => c.LineId == shift.LineId && c.TimestampUtc >= shift.StartUtc && c.TimestampUtc < shift.EndUtc);
            if (topology.Topology == LineTopology.Continuous
                && topology.OutputMachineId is Guid outputId)
                countsQuery = countsQuery.Where(c => c.MachineId == outputId);

            var good = await countsQuery.SumAsync(c => (long?)c.GoodCount, ct) ?? 0;
            var reject = await countsQuery.SumAsync(c => (long?)c.RejectCount, ct) ?? 0;

            var downtimes = await db.DowntimeEvents
                .Where(e => e.LineId == shift.LineId && e.StartUtc >= shift.StartUtc && e.StartUtc < shift.EndUtc && e.EndUtc != null)
                .Select(e => new { e.DurationSec, e.Kind })
                .ToListAsync(ct);

            var plannedDownSec = downtimes.Where(d => d.Kind == Core.DowntimeKind.Planned).Sum(d => d.DurationSec);
            var unplannedDownSec = downtimes.Where(d => d.Kind == Core.DowntimeKind.Unplanned).Sum(d => d.DurationSec);

            var balance = await schedule.GetTimeBalanceAsync(shift.LineId, shift, shift.EndUtc, ct);
            OeeResult oee;
            if (balance.IsCalendarExcluded)
            {
                oee = OeeResult.Empty;
            }
            else
            {
                var plannedTime = Math.Max(0, balance.AllTimeSec - balance.BreakOverlapSec - plannedDownSec);
                var runTime = Math.Max(0, plannedTime - unplannedDownSec);
                oee = OeeCalculator.Compute(new OeeInputs(
                    balance.AllTimeSec, plannedTime, runTime, idealCycle, good, reject));
            }

            shift.OeePct = oee.OeePct;
            shift.AvailabilityPct = oee.AvailabilityPct;
            shift.PerformancePct = oee.PerformancePct;
            shift.QualityPct = oee.QualityPct;
            shift.GoodCount = good;
            shift.RejectCount = reject;
            shift.DowntimeMinutes = (plannedDownSec + unplannedDownSec) / 60.0;
            shift.IsClosed = true;
            shift.UpdatedUtc = now;

            await db.SaveChangesAsync(ct);

            await _hub.Clients.Group(LiveHub.LineGroup(shift.LineId))
                .SendAsync("shiftChanged", new
                {
                    shift.LineId,
                    shift.ShiftName,
                    ClosedShiftId = shift.Id,
                    shift.OeePct,
                    shift.GoodCount,
                    shift.RejectCount,
                }, ct);

            _logger.LogInformation("Closed shift {Shift} on line {Line}: OEE {Oee}%", shift.ShiftName, shift.LineId, shift.OeePct);
        }
    }
}
