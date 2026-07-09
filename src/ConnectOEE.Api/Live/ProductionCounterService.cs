using System.Collections.Concurrent;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Authoritative software-owned production counters. PLC tags are inputs only;
/// shift totals reset on shift boundary, not when the PLC counter is reset.
/// </summary>
public class ProductionCounterService
{
    public sealed record CountSample(
        long GoodDelta,
        long RejectDelta,
        long ReworkDelta,
        long ShiftGood,
        long ShiftReject,
        long ShiftRework,
        bool PlcResetDetected);

    private sealed class CounterState
    {
        public Guid LineId;
        public Guid ShiftInstanceId;
        public long ShiftGood;
        public long ShiftReject;
        public long ShiftRework;
        public long LifetimeGood;
        public long LifetimeReject;
        public long LifetimeRework;
        public long? LastRawGood;
        public long? LastRawReject;
        public long? LastRawRework;
        public bool? LastPulseGood;
        public bool? LastPulseReject;
        public bool? LastPulseRework;
        public bool IsHydrated;
    }

    private readonly ConcurrentDictionary<Guid, CounterState> _state = new();
    private readonly ILogger<ProductionCounterService> _logger;

    public ProductionCounterService(ILogger<ProductionCounterService> logger) => _logger = logger;

    public bool IsHydrated(Guid machineId) =>
        _state.TryGetValue(machineId, out var s) && s.IsHydrated;

    public void Hydrate(MachineProductionState persisted)
    {
        _state[persisted.MachineId] = new CounterState
        {
            LineId = persisted.LineId,
            ShiftInstanceId = persisted.ShiftInstanceId,
            ShiftGood = persisted.ShiftGood,
            ShiftReject = persisted.ShiftReject,
            ShiftRework = persisted.ShiftRework,
            LifetimeGood = persisted.LifetimeGood,
            LifetimeReject = persisted.LifetimeReject,
            LifetimeRework = persisted.LifetimeRework,
            LastRawGood = persisted.LastRawGood,
            LastRawReject = persisted.LastRawReject,
            LastRawRework = persisted.LastRawRework,
            LastPulseGood = persisted.LastPulseGood,
            LastPulseReject = persisted.LastPulseReject,
            LastPulseRework = persisted.LastPulseRework,
            IsHydrated = true,
        };
    }

    public void HydrateFromShiftTotals(
        Guid machineId,
        Guid lineId,
        ShiftInstance shift,
        long shiftGood,
        long shiftReject,
        long shiftRework,
        long lifetimeGood,
        long lifetimeReject,
        long lifetimeRework)
    {
        _state[machineId] = new CounterState
        {
            LineId = lineId,
            ShiftInstanceId = shift.Id,
            ShiftGood = shiftGood,
            ShiftReject = shiftReject,
            ShiftRework = shiftRework,
            LifetimeGood = lifetimeGood,
            LifetimeReject = lifetimeReject,
            LifetimeRework = lifetimeRework,
            IsHydrated = true,
        };
    }

    public MachineProductionState ToPersisted(Guid machineId, DateTimeOffset updatedUtc)
    {
        var s = _state[machineId];
        return new MachineProductionState
        {
            MachineId = machineId,
            LineId = s.LineId,
            ShiftInstanceId = s.ShiftInstanceId,
            ShiftGood = s.ShiftGood,
            ShiftReject = s.ShiftReject,
            ShiftRework = s.ShiftRework,
            LifetimeGood = s.LifetimeGood,
            LifetimeReject = s.LifetimeReject,
            LifetimeRework = s.LifetimeRework,
            LastRawGood = s.LastRawGood,
            LastRawReject = s.LastRawReject,
            LastRawRework = s.LastRawRework,
            LastPulseGood = s.LastPulseGood,
            LastPulseReject = s.LastPulseReject,
            LastPulseRework = s.LastPulseRework,
            UpdatedUtc = updatedUtc,
        };
    }

    public CountSample Process(
        Guid machineId,
        Guid lineId,
        ShiftInstance shift,
        long? rawGood,
        long? rawReject,
        long? rawRework,
        bool? pulseGood,
        bool? pulseReject,
        bool? pulseRework,
        CountIngestMode goodMode,
        CountIngestMode rejectMode,
        CountIngestMode reworkMode,
        DateTimeOffset ts)
    {
        var st = _state.GetOrAdd(machineId, _ => new CounterState { LineId = lineId, IsHydrated = true });
        st.LineId = lineId;

        if (st.ShiftInstanceId != shift.Id)
        {
            st.ShiftInstanceId = shift.Id;
            st.ShiftGood = 0;
            st.ShiftReject = 0;
            st.ShiftRework = 0;
        }

        var plcReset = false;
        var goodDelta = ApplyGood(st, rawGood, pulseGood, goodMode, ref plcReset);
        var rejectDelta = ApplyReject(st, rawReject, pulseReject, rejectMode, ref plcReset);
        var reworkDelta = ApplyRework(st, rawRework, pulseRework, reworkMode, ref plcReset);

        if (goodDelta > 0 || rejectDelta > 0 || reworkDelta > 0)
        {
            st.ShiftGood += goodDelta;
            st.ShiftReject += rejectDelta;
            st.ShiftRework += reworkDelta;
            st.LifetimeGood += goodDelta;
            st.LifetimeReject += rejectDelta;
            st.LifetimeRework += reworkDelta;
        }

        if (plcReset)
        {
            _logger.LogInformation(
                "PLC count reset detected for machine {MachineId} at {Timestamp}; shift totals preserved (good={ShiftGood}, reject={ShiftReject}, rework={ShiftRework})",
                machineId, ts, st.ShiftGood, st.ShiftReject, st.ShiftRework);
        }

        return new CountSample(goodDelta, rejectDelta, reworkDelta, st.ShiftGood, st.ShiftReject, st.ShiftRework, plcReset);
    }

    private static long ApplyGood(CounterState st, long? raw, bool? pulse, CountIngestMode mode, ref bool plcReset)
        => mode switch
        {
            CountIngestMode.PulseRisingEdge => ApplyPulse(pulse, ref st.LastPulseGood),
            _ => ApplyCumulative(raw, ref st.LastRawGood, ref plcReset),
        };

    private static long ApplyReject(CounterState st, long? raw, bool? pulse, CountIngestMode mode, ref bool plcReset)
        => mode switch
        {
            CountIngestMode.PulseRisingEdge => ApplyPulse(pulse, ref st.LastPulseReject),
            _ => ApplyCumulative(raw, ref st.LastRawReject, ref plcReset),
        };

    private static long ApplyRework(CounterState st, long? raw, bool? pulse, CountIngestMode mode, ref bool plcReset)
        => mode switch
        {
            CountIngestMode.PulseRisingEdge => ApplyPulse(pulse, ref st.LastPulseRework),
            _ => ApplyCumulative(raw, ref st.LastRawRework, ref plcReset),
        };

    private static long ApplyCumulative(long? raw, ref long? lastRaw, ref bool plcReset)
    {
        if (raw is null) return 0;
        if (lastRaw is null)
        {
            lastRaw = raw.Value;
            return 0;
        }

        long delta;
        if (raw.Value >= lastRaw.Value)
            delta = raw.Value - lastRaw.Value;
        else
        {
            delta = raw.Value;
            plcReset = true;
        }

        lastRaw = raw.Value;
        return Math.Max(0, delta);
    }

    private static long ApplyPulse(bool? pulse, ref bool? lastPulse)
    {
        if (pulse is null) return 0;
        var level = pulse.Value;
        if (lastPulse is false && level)
        {
            lastPulse = level;
            return 1;
        }

        lastPulse = level;
        return 0;
    }
}
