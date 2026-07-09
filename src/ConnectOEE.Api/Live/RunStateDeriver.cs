using ConnectOEE.Core;

namespace ConnectOEE.Api.Live;

/// <summary>Derives canonical <see cref="RunState"/> from raw PLC readings and ingest mode.</summary>
public static class RunStateDeriver
{
    public static RunState Derive(
        RunStateIngestMode mode,
        double? primaryValue,
        bool? running,
        bool? idle,
        bool? faulted)
    {
        return mode switch
        {
            RunStateIngestMode.SingleBool => primaryValue is >= 0.5 ? RunState.Running : RunState.Idle,
            RunStateIngestMode.MultiBool => DeriveMultiBool(running, idle, faulted, primaryValue),
            _ => DeriveDirectEnum(primaryValue),
        };
    }

    private static RunState DeriveDirectEnum(double? value)
    {
        if (value is null) return RunState.Unknown;
        var v = (int)value.Value;
        return Enum.IsDefined(typeof(RunState), v) ? (RunState)v : RunState.Unknown;
    }

    private static RunState DeriveMultiBool(bool? running, bool? idle, bool? faulted, double? primaryFallback)
    {
        if (faulted == true) return RunState.Down;
        if (running == true) return RunState.Running;
        if (idle == true) return RunState.Idle;
        // Fall back to primary tag as SingleBool when aux not mapped.
        if (primaryFallback is not null)
            return primaryFallback >= 0.5 ? RunState.Running : RunState.Idle;
        return RunState.Unknown;
    }
}
