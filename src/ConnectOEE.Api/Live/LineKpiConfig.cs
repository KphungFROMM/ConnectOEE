using ConnectOEE.Core;
using ConnectOEE.Core.Oee;

namespace ConnectOEE.Api.Live;

/// <summary>Per-line OEE settings passed from DriverFactory into ingestion.</summary>
public record LineKpiConfig(
    double IdealCycleSec,
    int MicroStopSec,
    ChangeoverMode ChangeoverMode,
    double TargetOeePct,
    double TargetAvailabilityPct,
    double TargetPerformancePct,
    double TargetQualityPct,
    ReworkTrackingMode ReworkTracking)
{
    public static LineKpiConfig Default { get; } = new(2.0, 120, ChangeoverMode.SetupTracked, 85, 90, 95, 99, ReworkTrackingMode.Auto);

    public OeeTargets ToTargets() => new(TargetOeePct, TargetAvailabilityPct, TargetPerformancePct, TargetQualityPct);
}
