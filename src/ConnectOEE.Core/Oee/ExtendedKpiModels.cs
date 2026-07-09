namespace ConnectOEE.Core.Oee;

/// <summary>Line-level OEE factor targets from <c>OeeConfig</c>.</summary>
public record OeeTargets(
    double TargetOeePct,
    double TargetAvailabilityPct,
    double TargetPerformancePct,
    double TargetQualityPct);

/// <summary>Per-state elapsed seconds within a shift window (break-aware accrual).</summary>
public record StateTimeSeconds(
    double RunSec,
    double PlannedDownSec,
    double IdleSec,
    double DownSec,
    double SetupSec,
    double StarvedSec,
    double BlockedSec,
    double UnknownSec)
{
    public static readonly StateTimeSeconds Empty = new(0, 0, 0, 0, 0, 0, 0, 0);

    /// <summary>All non-running time (matches legacy total downtime accumulator).</summary>
    public double TotalStoppedSec =>
        PlannedDownSec + IdleSec + DownSec + SetupSec + StarvedSec + BlockedSec + UnknownSec;
}

/// <summary>Resolved production quantity targets for attainment KPIs.</summary>
public record ResolvedQuantityTarget(double? Quantity, string? Source);

/// <summary>Extended KPI bundle computed alongside canonical OEE.</summary>
public record ExtendedKpiResult(
    OeeTargets Targets,
    double OeeGapPct,
    double AvailabilityGapPct,
    double PerformanceGapPct,
    double QualityGapPct,
    double UtilizationPct,
    double CycleVariancePct,
    double? ReworkPct,
    bool ReworkTrackingActive,
    double EffectiveFpyPct,
    ResolvedQuantityTarget RunTarget,
    double? RunAttainmentPct,
    double? RunPartsRemaining,
    ResolvedQuantityTarget ShiftTarget,
    double? ShiftAttainmentPct,
    double? ShiftPartsRemaining,
    long TheoreticalOutput,
    long OutputGap,
    ProductionPartsLoss PartsLoss,
    StateTimeMinutes StateTimes);

/// <summary>State time buckets in minutes with optional share-of-shift percentages.</summary>
public record StateTimeMinutes(
    double IdleMin,
    double DownMin,
    double SetupMin,
    double StarvedMin,
    double BlockedMin,
    double UnknownMin,
    double? IdlePct,
    double? DownPct,
    double? SetupPct,
    double? StarvedPct,
    double? BlockedPct,
    double? UnknownPct);
