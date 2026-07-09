using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

public class IngestionService
{
    private readonly ConnectOeeDbContext _db;
    private readonly SnapshotCache _cache;
    private readonly ProductionCounterService _counter;
    private readonly RecipeResolverService _recipes;
    private readonly DowntimeReasonResolverService _downtimeReasons;
    private readonly ChangeoverService _changeover;
    private readonly MachineRuntimeTracker _tracker;
    private readonly IShiftResolver _shiftResolver;
    private readonly IShiftScheduleService _shiftSchedule;

    private readonly LineAttainmentLoader _attainment;

    public IngestionService(
        ConnectOeeDbContext db,
        SnapshotCache cache,
        ProductionCounterService counter,
        RecipeResolverService recipes,
        DowntimeReasonResolverService downtimeReasons,
        ChangeoverService changeover,
        MachineRuntimeTracker tracker,
        IShiftResolver shiftResolver,
        IShiftScheduleService shiftSchedule,
        LineAttainmentLoader attainment)
    {
        _db = db;
        _cache = cache;
        _counter = counter;
        _recipes = recipes;
        _downtimeReasons = downtimeReasons;
        _changeover = changeover;
        _tracker = tracker;
        _shiftResolver = shiftResolver;
        _shiftSchedule = shiftSchedule;
        _attainment = attainment;
    }

    public async Task<IngestResult> IngestAsync(
        IReadOnlyList<SignalReading> readings,
        IReadOnlyDictionary<Guid, string> machineNames,
        IReadOnlyDictionary<Guid, LineKpiConfig> lineConfig,
        string connectionState,
        CancellationToken ct = default)
    {
        var snapshots = new List<MachineSnapshot>();
        var recipeChangedLines = new HashSet<Guid>();

        var machineIds = readings.Select(r => r.MachineId).Distinct().ToList();
        var operatorReasonByMachine = await _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.MachineId != null && machineIds.Contains(e.MachineId.Value)
                && e.EndUtc == null && e.Reason != null && e.ReasonEnteredByUserId != null)
            .Select(e => new { MachineId = e.MachineId!.Value, e.Reason })
            .ToDictionaryAsync(x => x.MachineId, x => x.Reason!, ct);
        var signals = await _db.LogicalSignals.AsNoTracking()
            .Where(s => s.MachineId != null && machineIds.Contains(s.MachineId.Value))
            .ToListAsync(ct);

        var reworkMappedLineIds = await (
            from s in _db.LogicalSignals.AsNoTracking()
            join m in _db.Machines.AsNoTracking() on s.MachineId equals m.Id
            where s.Role == SignalRole.ReworkCount && s.Mapping != null
            select m.LineId).Distinct().ToListAsync(ct);
        var reworkMappedLines = reworkMappedLineIds.ToHashSet();

        var attainmentCache = new Dictionary<Guid, (ResolvedQuantityTarget Run, ResolvedQuantityTarget Shift)>();
        var recipeIdByLine = new Dictionary<Guid, Guid?>();

        foreach (var group in readings.GroupBy(r => r.MachineId))
        {
            var machineId = group.Key;
            var lineId = group.First().LineId;
            var ts = group.First().TimestampUtc;

            long? rawGood = null, rawReject = null, rawRework = null;
            bool? pulseGood = null, pulseReject = null, pulseRework = null;
            double? runPrimary = null;
            bool? runRunning = null, runIdle = null, runFaulted = null;
            int? downtimeReasonCode = null;
            string? partId = null;

            var runMode = signals.FirstOrDefault(s => s.MachineId == machineId && s.Role == SignalRole.RunState)?.RunStateIngestMode
                ?? RunStateIngestMode.DirectEnum;
            var goodMode = signals.FirstOrDefault(s => s.MachineId == machineId && s.Role == SignalRole.GoodCount)?.CountIngestMode
                ?? CountIngestMode.CumulativeDelta;
            var rejectMode = signals.FirstOrDefault(s => s.MachineId == machineId && s.Role == SignalRole.RejectCount)?.CountIngestMode
                ?? CountIngestMode.CumulativeDelta;
            var reworkMode = signals.FirstOrDefault(s => s.MachineId == machineId && s.Role == SignalRole.ReworkCount)?.CountIngestMode
                ?? CountIngestMode.CumulativeDelta;

            foreach (var r in group)
            {
                switch (r.Role)
                {
                    case SignalRole.GoodCount:
                        if (goodMode == CountIngestMode.PulseRisingEdge) pulseGood = r.Value >= 0.5;
                        else rawGood = (long)r.Value;
                        break;
                    case SignalRole.RejectCount:
                        if (rejectMode == CountIngestMode.PulseRisingEdge) pulseReject = r.Value >= 0.5;
                        else rawReject = (long)r.Value;
                        break;
                    case SignalRole.ReworkCount:
                        if (reworkMode == CountIngestMode.PulseRisingEdge) pulseRework = r.Value >= 0.5;
                        else rawRework = (long)r.Value;
                        break;
                    case SignalRole.RunState: runPrimary = r.Value; break;
                    case SignalRole.RunStateRunning: runRunning = r.Value >= 0.5; break;
                    case SignalRole.RunStateIdle: runIdle = r.Value >= 0.5; break;
                    case SignalRole.RunStateFaulted: runFaulted = r.Value >= 0.5; break;
                    case SignalRole.DowntimeReason:
                        downtimeReasonCode = r.FaultCode ?? (int)r.Value;
                        break;
                    case SignalRole.PartId:
                        partId = !string.IsNullOrWhiteSpace(r.TextValue)
                            ? r.TextValue.Trim()
                            : r.Value >= 0 && r.Value == Math.Floor(r.Value)
                                ? ((long)r.Value).ToString()
                                : r.Value.ToString(System.Globalization.CultureInfo.InvariantCulture);
                        break;
                }
            }

            var state = RunStateDeriver.Derive(runMode, runPrimary, runRunning, runIdle, runFaulted);

            var resolvedReason = await _downtimeReasons.ResolveAsync(
                _db, machineId, lineId, downtimeReasonCode, ct);

            var shift = await _shiftResolver.ResolveAsync(lineId, ts, ct);
            await EnsureCounterHydratedAsync(machineId, lineId, shift, ct);

            var counts = _counter.Process(machineId, lineId, shift, rawGood, rawReject, rawRework, pulseGood, pulseReject, pulseRework, goodMode, rejectMode, reworkMode, ts);

            var resolve = await _recipes.ResolveAsync(_db, machineId, lineId, partId, ts, ct);
            var recipeCtx = resolve.Context;
            if (resolve.RecipeChanged) recipeChangedLines.Add(lineId);
            if (resolve.RunToClose is not null) _db.ProductionRuns.Update(resolve.RunToClose);
            if (resolve.RunToAdd is not null) _db.ProductionRuns.Add(resolve.RunToAdd);
            recipeIdByLine[lineId] = recipeCtx.RecipeId;

            var kpiCfg = lineConfig.TryGetValue(lineId, out var lc) ? lc : LineKpiConfig.Default;
            if (resolve.RecipeChanged && kpiCfg.ChangeoverMode == ChangeoverMode.SetupTracked)
            {
                var changeover = _changeover.StartChangeover(
                    lineId, machineId, shift.Id, resolve.PreviousRecipeCode, recipeCtx.RecipeCode, ts);
                if (changeover is not null) _db.DowntimeEvents.Add(changeover);
            }

            _db.TsCounts.Add(new TsCount
            {
                MachineId = machineId, LineId = lineId, TimestampUtc = ts,
                GoodCount = counts.GoodDelta, RejectCount = counts.RejectDelta,
                TotalCount = counts.GoodDelta + counts.RejectDelta,
            });
            _db.TsStates.Add(new TsState
            {
                MachineId = machineId, LineId = lineId, TimestampUtc = ts, State = state,
                FaultCode = downtimeReasonCode,
            });

            var idealCycle = recipeCtx.IdealCycleSec > 0 ? recipeCtx.IdealCycleSec : kpiCfg.IdealCycleSec;
            var timeBalance = await _shiftSchedule.GetTimeBalanceAsync(lineId, shift, ts, ct);

            await EnsureRuntimeHydratedAsync(machineId, lineId, shift, state, ts, timeBalance, kpiCfg.MicroStopSec, ct);

            var reworkActive = ReworkTrackingPolicy.IsActive(kpiCfg.ReworkTracking, reworkMappedLines.Contains(lineId));
            var effectiveRework = ReworkTrackingPolicy.EffectiveReworkCount(counts.ShiftRework, reworkActive);

            var update = _tracker.Process(
                machineId, lineId, shift, state,
                counts.ShiftGood, counts.ShiftReject, effectiveRework,
                downtimeReasonCode, ts, idealCycle, kpiCfg.MicroStopSec, timeBalance);

            if (update.Transition is { } tr && kpiCfg.ChangeoverMode == ChangeoverMode.SetupTracked)
            {
                var changeoverClose = _changeover.TryCloseOnRunningTransition(
                    lineId, tr.FromState, tr.ToState, ts, kpiCfg.MicroStopSec);
                if (changeoverClose is not null)
                {
                    await _db.DowntimeEvents.Where(e => e.Id == changeoverClose.Id).ExecuteUpdateAsync(s => s
                        .SetProperty(e => e.EndUtc, changeoverClose.EndUtc)
                        .SetProperty(e => e.DurationSec, changeoverClose.DurationSec)
                        .SetProperty(e => e.IsMicroStop, changeoverClose.IsMicro)
                        .SetProperty(e => e.Category, changeoverClose.Category), ct);
                }
            }

            await PersistCounterStateAsync(machineId, ts, ct);

            if (update.Transition is not null) _db.StateTransitions.Add(update.Transition);
            if (update.DowntimeToAdd is { } add)
            {
                ApplyResolvedReason(add, resolvedReason);
                _db.DowntimeEvents.Add(add);
            }
            if (update.DowntimeToAdd2 is { } add2)
            {
                ApplyResolvedReason(add2, resolvedReason);
                _db.DowntimeEvents.Add(add2);
            }
            if (update.FaultToAdd is { } faultAdd)
            {
                if (resolvedReason is not null)
                    faultAdd.MappedReason = resolvedReason.Reason;
                _db.FaultOccurrences.Add(faultAdd);
            }

            if (update.DowntimeToClose is { } dc)
            {
                var category = resolvedReason?.Category ?? dc.Category;
                await _db.DowntimeEvents.Where(e => e.Id == dc.Id).ExecuteUpdateAsync(s => s
                    .SetProperty(e => e.EndUtc, dc.EndUtc)
                    .SetProperty(e => e.DurationSec, dc.DurationSec)
                    .SetProperty(e => e.IsMicroStop, dc.IsMicro)
                    .SetProperty(e => e.Category, category), ct);
            }
            if (update.FaultToClose is { } fc)
            {
                await _db.FaultOccurrences.Where(e => e.Id == fc.Id)
                    .ExecuteUpdateAsync(s => s.SetProperty(e => e.EndUtc, fc.EndUtc), ct);
            }

            var total = counts.ShiftGood + counts.ShiftReject;
            var rel = update.Reliability;
            var idealRate = idealCycle > 0 ? 3600.0 / idealCycle : 0;
            var actualRate = update.RunSec > 0 && total > 0 ? total / (update.RunSec / 3600.0) : 0;
            var rateVariance = idealRate > 0 ? Math.Round((actualRate - idealRate) / idealRate * 100.0, 2) : 0;
            var timeTotal = update.UptimeMin + update.DowntimeMin;
            var uptimePct = timeTotal > 0 ? Math.Round(update.UptimeMin / timeTotal * 100.0, 2) : 0;

            if (!attainmentCache.TryGetValue(lineId, out var attainmentTargets))
            {
                var attainmentData = await _attainment.LoadAsync(
                    new[] { lineId },
                    new Dictionary<Guid, Guid?> { [lineId] = recipeCtx.RecipeId },
                    shift.StartUtc, shift.EndUtc, ct);
                attainmentTargets = LineAttainmentLoader.Resolve(attainmentData[lineId]);
                attainmentCache[lineId] = attainmentTargets;
            }

            var balanced = timeBalance.IsCalendarExcluded
                ? new ShiftWindowCalculator.TimeBalanceResult(0, 0)
                : ShiftWindowCalculator.ComputeTimeBalance(
                    timeBalance.AllTimeSec, timeBalance.BreakOverlapSec,
                    update.StateTimes.PlannedDownSec, update.StateTimes.RunSec);
            var oeeInputs = new OeeInputs(
                timeBalance.AllTimeSec, balanced.PlannedTimeSec, balanced.RunTimeSec,
                idealCycle, counts.ShiftGood, counts.ShiftReject, effectiveRework);
            var shiftElapsedSec = Math.Max(0, (ts - shift.StartUtc).TotalSeconds);
            var ext = ExtendedKpiCalculator.Compute(
                update.Oee, oeeInputs, kpiCfg.ToTargets(),
                counts.ShiftGood, effectiveRework, reworkActive,
                attainmentTargets.Run, attainmentTargets.Shift, update.StateTimes,
                shiftElapsedSec);
            var displayFpy = ext.EffectiveFpyPct;
            var stateTimes = ext.StateTimes;
            var parts = ext.PartsLoss;

            var reasonText = resolvedReason?.Reason;
            if (operatorReasonByMachine.TryGetValue(machineId, out var operatorReason)
                && !string.IsNullOrWhiteSpace(operatorReason)
                && (string.IsNullOrWhiteSpace(reasonText)
                    || (downtimeReasonCode.GetValueOrDefault() > 0
                        && DowntimeReasonResolverService.IsPlaceholderReason(reasonText, downtimeReasonCode.GetValueOrDefault()))))
                reasonText = operatorReason;
            var snapshot = new MachineSnapshot(
                machineId, lineId,
                machineNames.TryGetValue(machineId, out var name) ? name : machineId.ToString(),
                state.ToString(), counts.ShiftGood, counts.ShiftReject, effectiveRework, Math.Round(actualRate, 2),
                downtimeReasonCode == 0 ? null : downtimeReasonCode,
                reasonText,
                connectionState, ts,
                update.Oee.OeePct, update.Oee.AvailabilityPct, update.Oee.PerformancePct,
                update.Oee.QualityPct, update.Oee.TeepPct,
                update.ShiftName, update.ShiftStartUtc, update.ShiftEndUtc,
                rel.MttrMin, rel.MtbfMin, rel.MttfMin, rel.MttdMin, rel.MeanLostTimePerDowntimeMin,
                rel.FailureRatePerHour, rel.StopsPerHour, rel.AvailabilityFromReliabilityPct,
                rel.DowntimeCount, update.MicroStopCount, rel.FailureCount,
                update.UptimeMin, update.DowntimeMin, update.PlannedDowntimeMin, update.UnplannedDowntimeMin, uptimePct,
                update.Oee.AvailabilityLossMin, update.Oee.PerformanceLossMin, update.Oee.QualityLossMin,
                update.Oee.ActualCycleTimeSec, idealCycle,
                Math.Round(actualRate, 2), Math.Round(idealRate, 2), rateVariance,
                update.Oee.ScrapPct, update.Oee.YieldPct, displayFpy,
                recipeCtx.RecipeCode, recipeCtx.RecipeName, recipeCtx.IsAutoCreated,
                recipeCtx.IdealCycleSource,
                ext.Targets.TargetOeePct, ext.Targets.TargetAvailabilityPct,
                ext.Targets.TargetPerformancePct, ext.Targets.TargetQualityPct,
                ext.OeeGapPct, ext.AvailabilityGapPct, ext.PerformanceGapPct, ext.QualityGapPct,
                ext.UtilizationPct, ext.CycleVariancePct, ext.ReworkPct, ext.ReworkTrackingActive,
                ext.RunTarget.Quantity, ext.RunTarget.Source,
                ext.RunAttainmentPct, ext.RunPartsRemaining,
                ext.ShiftTarget.Quantity, ext.ShiftTarget.Source,
                ext.ShiftAttainmentPct, ext.ShiftPartsRemaining,
                ext.TheoreticalOutput, ext.OutputGap,
                parts.MaxPossibleParts, parts.ExpectedPartsPace,
                parts.PartsLostAvailability, parts.PartsLostPerformance,
                parts.PartsLostQuality, parts.PartsLostBreakdown, parts.PartsCouldHaveMade,
                stateTimes.IdleMin, stateTimes.DownMin, stateTimes.SetupMin,
                stateTimes.StarvedMin, stateTimes.BlockedMin, stateTimes.UnknownMin,
                stateTimes.IdlePct, stateTimes.DownPct, stateTimes.SetupPct,
                stateTimes.StarvedPct, stateTimes.BlockedPct, stateTimes.UnknownPct);

            _cache.Set(snapshot);
            snapshots.Add(snapshot);
        }

        await _db.SaveChangesAsync(ct);
        return new IngestResult(snapshots, recipeChangedLines.ToList());
    }

    private async Task EnsureCounterHydratedAsync(Guid machineId, Guid lineId, ShiftInstance shift, CancellationToken ct)
    {
        if (_counter.IsHydrated(machineId)) return;
        var persisted = await _db.MachineProductionStates.AsNoTracking().FirstOrDefaultAsync(s => s.MachineId == machineId, ct);
        if (persisted is not null && persisted.ShiftInstanceId == shift.Id)
        {
            _counter.Hydrate(persisted);
            return;
        }
        if (persisted is not null && persisted.ShiftInstanceId != shift.Id)
        {
            _counter.HydrateFromShiftTotals(machineId, lineId, shift, 0, 0, 0, persisted.LifetimeGood, persisted.LifetimeReject, persisted.LifetimeRework);
            return;
        }
        var good = await _db.TsCounts.Where(c => c.MachineId == machineId && c.TimestampUtc >= shift.StartUtc && c.TimestampUtc < shift.EndUtc)
            .SumAsync(c => (long?)c.GoodCount, ct) ?? 0;
        var reject = await _db.TsCounts.Where(c => c.MachineId == machineId && c.TimestampUtc >= shift.StartUtc && c.TimestampUtc < shift.EndUtc)
            .SumAsync(c => (long?)c.RejectCount, ct) ?? 0;
        _counter.HydrateFromShiftTotals(machineId, lineId, shift, good, reject, 0, good, reject, 0);
    }

    private async Task PersistCounterStateAsync(Guid machineId, DateTimeOffset ts, CancellationToken ct)
    {
        var row = _counter.ToPersisted(machineId, ts);
        var existing = await _db.MachineProductionStates.FirstOrDefaultAsync(s => s.MachineId == machineId, ct);
        if (existing is null) { _db.MachineProductionStates.Add(row); return; }
        existing.LineId = row.LineId;
        existing.ShiftInstanceId = row.ShiftInstanceId;
        existing.ShiftGood = row.ShiftGood;
        existing.ShiftReject = row.ShiftReject;
        existing.ShiftRework = row.ShiftRework;
        existing.LifetimeGood = row.LifetimeGood;
        existing.LifetimeReject = row.LifetimeReject;
        existing.LifetimeRework = row.LifetimeRework;
        existing.LastRawGood = row.LastRawGood;
        existing.LastRawReject = row.LastRawReject;
        existing.LastRawRework = row.LastRawRework;
        existing.LastPulseGood = row.LastPulseGood;
        existing.LastPulseReject = row.LastPulseReject;
        existing.LastPulseRework = row.LastPulseRework;
        existing.UpdatedUtc = row.UpdatedUtc;
    }

    private async Task EnsureRuntimeHydratedAsync(
        Guid machineId,
        Guid lineId,
        ShiftInstance shift,
        RunState currentState,
        DateTimeOffset nowUtc,
        ShiftTimeBalance timeBalance,
        int microStopThresholdSec,
        CancellationToken ct)
    {
        if (_tracker.IsHydrated(machineId, shift.Id)) return;

        var effectiveEnd = nowUtc < shift.EndUtc ? nowUtc : shift.EndUtc;
        var stateRows = await _db.TsStates.AsNoTracking()
            .Where(s => s.MachineId == machineId
                && s.LineId == lineId
                && s.TimestampUtc >= shift.StartUtc
                && s.TimestampUtc <= effectiveEnd)
            .OrderBy(s => s.TimestampUtc)
            .Select(s => new { s.TimestampUtc, s.State })
            .ToListAsync(ct);

        var downtimeRows = await _db.DowntimeEvents.AsNoTracking()
            .Where(e => e.MachineId == machineId
                && e.LineId == lineId
                && e.StartUtc >= shift.StartUtc
                && e.StartUtc < shift.EndUtc)
            .OrderBy(e => e.StartUtc)
            .ToListAsync(ct);

        var completed = new List<DowntimeStat>(downtimeRows.Count);
        MachineRuntimeTracker.OpenDowntimeRestore? open = null;
        var microCount = 0;

        foreach (var e in downtimeRows)
        {
            if (e.EndUtc is null)
            {
                open = new MachineRuntimeTracker.OpenDowntimeRestore(
                    e.Id, e.StartUtc, e.Kind == DowntimeKind.Planned, e.FaultCode);
                continue;
            }

            var detectSec = e.AcknowledgedUtc is { } ack ? (ack - e.StartUtc).TotalSeconds : (double?)null;
            completed.Add(new DowntimeStat(e.DurationSec, detectSec, e.Kind == DowntimeKind.Unplanned));
            if (e.IsMicroStop) microCount++;
        }

        var samples = stateRows
            .Select(s => (s.TimestampUtc, s.State))
            .ToList();

        _tracker.RestoreShiftHistory(
            machineId,
            shift.Id,
            shift.StartUtc,
            shift.EndUtc,
            shift.ShiftName,
            samples,
            completed,
            microCount,
            open,
            currentState,
            nowUtc,
            timeBalance.BreakIntervalsUtc);
    }

    private static void ApplyResolvedReason(DowntimeEvent ev, DowntimeReasonResolverService.ResolvedReason? resolved)
    {
        if (resolved is null || ev.FaultCode is null or 0) return;
        ev.Reason = resolved.Reason;
        ev.Category = resolved.Category;
        ev.Kind = resolved.Kind;
    }
}
