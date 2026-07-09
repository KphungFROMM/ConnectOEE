using System.Collections.Concurrent;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Per-machine running state and within-shift accumulators. Singleton so state
/// survives across poll ticks. Pure of EF: it returns entities/instructions and the
/// ingestion service persists them. Computes live OEE and detects downtime events.
/// Production counts are software-owned and passed in as shift totals.
/// </summary>
public class MachineRuntimeTracker
{
    public sealed record OpenDowntimeRestore(
        Guid Id,
        DateTimeOffset StartUtc,
        bool Planned,
        int? FaultCode);

    private sealed class Runtime
    {
        public Guid ShiftInstanceId = Guid.NewGuid();
        public DateTimeOffset ShiftStartUtc;
        public DateTimeOffset ShiftEndUtc;
        public string ShiftName = "";
        public DateTimeOffset LastSampleUtc;
        public RunState CurrentState = RunState.Unknown;
        public Guid? HydratedShiftId;

        public StateTimeSeconds StateTimes = StateTimeSeconds.Empty;
        /// <summary>Legacy total stopped seconds (sum of all non-running states).</summary>
        public double DownSec;
        public double UptimeSec;

        public Guid? OpenDowntimeId;
        public DateTimeOffset OpenDowntimeStart;
        public bool OpenDowntimePlanned;
        public int? OpenDowntimeFault;

        public Guid? OpenFaultId;
        public int? OpenFaultCode;

        public readonly List<DowntimeStat> Downtimes = new();
        public int MicroStopCount;

        public double RunSec => StateTimes.RunSec;
        public double PlannedDownSec => StateTimes.PlannedDownSec;
    }

    public bool IsHydrated(Guid machineId, Guid shiftId) =>
        _state.TryGetValue(machineId, out var rt) && rt.HydratedShiftId == shiftId;

    public void RestoreShiftHistory(
        Guid machineId,
        Guid shiftId,
        DateTimeOffset shiftStartUtc,
        DateTimeOffset shiftEndUtc,
        string shiftName,
        IReadOnlyList<(DateTimeOffset TimestampUtc, RunState State)> stateSamples,
        IReadOnlyList<DowntimeStat> completedDowntimes,
        int microStopCount,
        OpenDowntimeRestore? openDowntime,
        RunState fallbackState,
        DateTimeOffset hydrationUtc,
        IReadOnlyList<ShiftWindowCalculator.TimeInterval> breakIntervals)
    {
        var rt = _state.GetOrAdd(machineId, _ => new Runtime());
        if (rt.HydratedShiftId == shiftId) return;

        rt.ShiftInstanceId = shiftId;
        rt.ShiftStartUtc = shiftStartUtc;
        rt.ShiftEndUtc = shiftEndUtc;
        rt.ShiftName = shiftName;
        rt.StateTimes = StateTimeSeconds.Empty;
        rt.DownSec = rt.UptimeSec = 0;
        rt.Downtimes.Clear();
        rt.MicroStopCount = microStopCount;
        rt.OpenDowntimeId = null;
        rt.OpenDowntimePlanned = false;
        rt.OpenDowntimeFault = null;

        if (stateSamples.Count == 0)
        {
            rt.CurrentState = fallbackState;
            rt.LastSampleUtc = hydrationUtc;
        }
        else
        {
            rt.CurrentState = stateSamples[0].State;
            rt.LastSampleUtc = shiftStartUtc;
            AccrueInterval(rt, shiftStartUtc, stateSamples[0].TimestampUtc, breakIntervals);

            for (var i = 0; i < stateSamples.Count - 1; i++)
            {
                rt.CurrentState = stateSamples[i].State;
                AccrueInterval(rt, stateSamples[i].TimestampUtc, stateSamples[i + 1].TimestampUtc, breakIntervals);
            }

            rt.CurrentState = stateSamples[^1].State;
            rt.LastSampleUtc = stateSamples[^1].TimestampUtc;
        }

        foreach (var d in completedDowntimes)
            rt.Downtimes.Add(d);

        if (openDowntime is { } od)
        {
            rt.OpenDowntimeId = od.Id;
            rt.OpenDowntimeStart = od.StartUtc;
            rt.OpenDowntimePlanned = od.Planned;
            rt.OpenDowntimeFault = od.FaultCode;
        }

        rt.HydratedShiftId = shiftId;
    }

    public sealed record Update(
        OeeResult Oee,
        Guid ShiftInstanceId,
        string ShiftName,
        DateTimeOffset ShiftStartUtc,
        DateTimeOffset ShiftEndUtc,
        StateTransition? Transition,
        DowntimeEvent? DowntimeToAdd,
        DowntimeEvent? DowntimeToAdd2,
        DowntimeClose? DowntimeToClose,
        FaultOccurrence? FaultToAdd,
        FaultClose? FaultToClose,
        ReliabilityResult Reliability,
        double RunSec,
        StateTimeSeconds StateTimes,
        double UptimeMin,
        double DowntimeMin,
        double PlannedDowntimeMin,
        double UnplannedDowntimeMin,
        int MicroStopCount);

    public sealed record DowntimeClose(Guid Id, DateTimeOffset EndUtc, double DurationSec, bool IsMicro, LossCategory Category, int? FaultCode);
    public sealed record FaultClose(Guid Id, DateTimeOffset EndUtc);

    private readonly ConcurrentDictionary<Guid, Runtime> _state = new();

    public Update Process(
        Guid machineId,
        Guid lineId,
        ShiftInstance shift,
        RunState state,
        long shiftGood,
        long shiftReject,
        long shiftRework,
        int? faultCode,
        DateTimeOffset nowUtc,
        double idealCycleSec,
        int microStopThresholdSec,
        ShiftTimeBalance timeBalance)
    {
        var rt = _state.GetOrAdd(machineId, _ => new Runtime
        {
            ShiftInstanceId = shift.Id,
            ShiftStartUtc = shift.StartUtc,
            ShiftEndUtc = shift.EndUtc,
            ShiftName = shift.ShiftName,
            LastSampleUtc = nowUtc,
            CurrentState = state,
        });

        StateTransition? transition = null;
        DowntimeEvent? downtimeToAdd = null;
        DowntimeEvent? downtimeToAdd2 = null;
        DowntimeClose? downtimeToClose = null;
        FaultOccurrence? faultToAdd = null;
        FaultClose? faultToClose = null;

        if (rt.ShiftInstanceId != shift.Id)
        {
            if (rt.OpenDowntimeId is Guid carryId)
            {
                var dur = (nowUtc - rt.OpenDowntimeStart).TotalSeconds;
                downtimeToClose = new DowntimeClose(carryId, nowUtc, dur,
                    dur <= microStopThresholdSec, CategoryFor(rt.OpenDowntimePlanned, rt.OpenDowntimeFault, dur, microStopThresholdSec),
                    rt.OpenDowntimeFault);
                rt.Downtimes.Add(new DowntimeStat(dur, null, !rt.OpenDowntimePlanned));
                if (dur <= microStopThresholdSec) rt.MicroStopCount++;
                rt.OpenDowntimeId = null;
            }

            rt.ShiftInstanceId = shift.Id;
            rt.ShiftStartUtc = shift.StartUtc;
            rt.ShiftEndUtc = shift.EndUtc;
            rt.ShiftName = shift.ShiftName;
            rt.StateTimes = StateTimeSeconds.Empty;
            rt.DownSec = rt.UptimeSec = 0;
            rt.Downtimes.Clear();
            rt.MicroStopCount = 0;
            rt.HydratedShiftId = null;
            rt.LastSampleUtc = nowUtc;

            if (!IsRunning(state))
            {
                var ev = NewDowntime(machineId, lineId, shift.Id, nowUtc, state, faultCode);
                rt.OpenDowntimeId = ev.Id;
                rt.OpenDowntimeStart = nowUtc;
                rt.OpenDowntimePlanned = state == RunState.PlannedDown;
                rt.OpenDowntimeFault = faultCode;
                downtimeToAdd2 = ev;
            }
        }

        AccrueInterval(rt, rt.LastSampleUtc, nowUtc, timeBalance.BreakIntervalsUtc);
        rt.LastSampleUtc = nowUtc;

        if (state != rt.CurrentState)
        {
            transition = new StateTransition
            {
                LineId = lineId,
                MachineId = machineId,
                FromState = rt.CurrentState,
                ToState = state,
                TimestampUtc = nowUtc,
            };

            var wasRunning = IsRunning(rt.CurrentState);
            var nowRunning = IsRunning(state);

            if (wasRunning && !nowRunning)
            {
                var ev = NewDowntime(machineId, lineId, shift.Id, nowUtc, state, faultCode);
                rt.OpenDowntimeId = ev.Id;
                rt.OpenDowntimeStart = nowUtc;
                rt.OpenDowntimePlanned = state == RunState.PlannedDown;
                rt.OpenDowntimeFault = faultCode;
                downtimeToAdd = ev;
            }
            else if (!wasRunning && nowRunning && rt.OpenDowntimeId is Guid openId)
            {
                var dur = (nowUtc - rt.OpenDowntimeStart).TotalSeconds;
                var isMicro = dur <= microStopThresholdSec;
                downtimeToClose = new DowntimeClose(openId, nowUtc, dur, isMicro,
                    CategoryFor(rt.OpenDowntimePlanned, rt.OpenDowntimeFault, dur, microStopThresholdSec),
                    rt.OpenDowntimeFault);
                rt.Downtimes.Add(new DowntimeStat(dur, null, !rt.OpenDowntimePlanned));
                if (isMicro) rt.MicroStopCount++;
                rt.OpenDowntimeId = null;
            }

            rt.CurrentState = state;
        }

        var normFault = faultCode is null or 0 ? (int?)null : faultCode;
        if (normFault != rt.OpenFaultCode)
        {
            if (rt.OpenFaultId is Guid fid)
            {
                faultToClose = new FaultClose(fid, nowUtc);
                rt.OpenFaultId = null;
                rt.OpenFaultCode = null;
            }
            if (normFault is int code)
            {
                var fo = new FaultOccurrence
                {
                    LineId = lineId,
                    MachineId = machineId,
                    Code = code,
                    StartUtc = nowUtc,
                };
                rt.OpenFaultId = fo.Id;
                rt.OpenFaultCode = code;
                faultToAdd = fo;
            }
        }

        var good = Math.Max(0, shiftGood);
        var reject = Math.Max(0, shiftReject);
        var rework = Math.Max(0, shiftRework);

        OeeResult oee;
        if (timeBalance.IsCalendarExcluded)
        {
            oee = OeeResult.Empty;
        }
        else
        {
            var balanced = ShiftWindowCalculator.ComputeTimeBalance(
                timeBalance.AllTimeSec, timeBalance.BreakOverlapSec, rt.PlannedDownSec, rt.RunSec);
            oee = OeeCalculator.Compute(new OeeInputs(
                timeBalance.AllTimeSec, balanced.PlannedTimeSec, balanced.RunTimeSec,
                idealCycleSec, good, reject, rework));
        }

        var reliabilityAllTime = timeBalance.IsCalendarExcluded ? 0 : timeBalance.AllTimeSec;

        var reliability = ReliabilityCalculator.Compute(
            new ReliabilityInputs(reliabilityAllTime, rt.UptimeSec, rt.Downtimes.ToList()));

        static double ToMin(double sec) => Math.Round(sec / 60.0, 2);
        var uptimeMin = ToMin(rt.UptimeSec);
        var downtimeMin = ToMin(rt.DownSec);
        var plannedMin = ToMin(rt.PlannedDownSec);
        var unplannedMin = ToMin(Math.Max(0, rt.DownSec - rt.PlannedDownSec));

        return new Update(oee, shift.Id, rt.ShiftName, rt.ShiftStartUtc, rt.ShiftEndUtc,
            transition, downtimeToAdd, downtimeToAdd2, downtimeToClose, faultToAdd, faultToClose, reliability,
            rt.RunSec, rt.StateTimes, uptimeMin, downtimeMin, plannedMin, unplannedMin, rt.MicroStopCount);
    }

    private static DowntimeEvent NewDowntime(Guid machineId, Guid lineId, Guid shiftId, DateTimeOffset start, RunState state, int? fault)
        => new()
        {
            LineId = lineId,
            MachineId = machineId,
            ShiftInstanceId = shiftId == Guid.Empty ? null : shiftId,
            StartUtc = start,
            Kind = state == RunState.PlannedDown ? DowntimeKind.Planned : DowntimeKind.Unplanned,
            FaultCode = fault is null or 0 ? null : fault,
            Category = LossCategory.Unattributed,
        };

    private static void AccrueInterval(
        Runtime rt,
        DateTimeOffset fromUtc,
        DateTimeOffset toUtc,
        IReadOnlyList<ShiftWindowCalculator.TimeInterval> breakIntervals)
    {
        var elapsed = ShiftWindowCalculator.AccrualSecExcludingBreaks(fromUtc, toUtc, breakIntervals);
        if (elapsed <= 0) return;

        if (IsRunning(rt.CurrentState))
            rt.UptimeSec += elapsed;
        else
            rt.DownSec += elapsed;

        var times = rt.StateTimes;
        StateTimeAccrual.Accrue(ref times, rt.CurrentState, elapsed);
        rt.StateTimes = times;
    }

    private static bool IsRunning(RunState s) => s == RunState.Running;

    private static LossCategory CategoryFor(bool planned, int? fault, double durSec, int microThreshold)
    {
        if (planned) return LossCategory.SetupAndAdjustment;
        if (fault is not null and not 0) return LossCategory.Breakdown;
        return durSec <= microThreshold ? LossCategory.SmallStop : LossCategory.Breakdown;
    }
}
