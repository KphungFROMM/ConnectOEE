namespace ConnectOEE.Core.Oee;

/// <summary>
/// Decides whether rework counters and FPY apply for a line. Keeps simple discrete
/// lines clean while supporting rework-heavy industries when mapped.
/// </summary>
public static class ReworkTrackingPolicy
{
    public static bool IsActive(ReworkTrackingMode mode, bool anyReworkMappedOnLine) =>
        mode switch
        {
            ReworkTrackingMode.Off => false,
            ReworkTrackingMode.On => true,
            _ => anyReworkMappedOnLine,
        };

    public static long EffectiveReworkCount(long rawRework, bool active) =>
        active ? Math.Max(0, rawRework) : 0;

    /// <summary>When rework is off, FPY should match yield (good / total) not first-pass math.</summary>
    public static double EffectiveFpyPct(OeeResult oee, bool reworkActive) =>
        reworkActive ? oee.FpyPct : oee.YieldPct;
}
