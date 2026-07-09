namespace ConnectOEE.Core.Oee;

/// <summary>
/// Inputs for an OEE computation over a window (shift, hour, day...). All times in
/// seconds. Definitions follow standard OEE convention:
///   AllTime         = calendar time of the window (for TEEP)
///   PlannedTimeSec  = loading time = AllTime - planned downtime - excluded breaks
///   RunTimeSec      = operating time = PlannedTime - unplanned downtime
/// </summary>
public record OeeInputs(
    double AllTimeSec,
    double PlannedTimeSec,
    double RunTimeSec,
    double IdealCycleTimeSec,
    long GoodCount,
    long RejectCount,
    long ReworkCount = 0)
{
    public long TotalCount => GoodCount + RejectCount;
}

/// <summary>Full OEE + loss result. Percentages are 0-100.</summary>
public record OeeResult(
    double AvailabilityPct,
    double PerformancePct,
    double QualityPct,
    double OeePct,
    double TeepPct,
    double ScrapPct,
    double YieldPct,
    double FpyPct,
    double AvailabilityLossMin,
    double PerformanceLossMin,
    double QualityLossMin,
    double ActualCycleTimeSec,
    double IdealCycleTimeSec)
{
    public static readonly OeeResult Empty =
        new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
}
