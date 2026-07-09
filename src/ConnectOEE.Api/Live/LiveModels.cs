namespace ConnectOEE.Api.Live;



/// <summary>Live snapshot for a machine, broadcast over SignalR and served via REST.</summary>

public record MachineSnapshot(

    Guid MachineId,

    Guid LineId,

    string MachineName,

    string State,

    long GoodCount,

    long RejectCount,

    long ReworkCount,

    double Speed,

    int? FaultCode,

    string? DowntimeReasonText,

    string ConnectionState,

    DateTimeOffset TimestampUtc,

    double OeePct,

    double AvailabilityPct,

    double PerformancePct,

    double QualityPct,

    double TeepPct,

    string ShiftName,

    DateTimeOffset ShiftStartUtc,

    DateTimeOffset ShiftEndUtc,

    double MttrMin,

    double MtbfMin,

    double MttfMin,

    double MttdMin,

    double MeanLostTimePerDowntimeMin,

    double FailureRatePerHour,

    double StopsPerHour,

    double AvailabilityFromReliabilityPct,

    int DowntimeCount,

    int MicroStopCount,

    int FailureCount,

    double UptimeMin,

    double DowntimeMin,

    double PlannedDowntimeMin,

    double UnplannedDowntimeMin,

    double UptimePct,

    double AvailabilityLossMin,

    double PerformanceLossMin,

    double QualityLossMin,

    double ActualCycleTimeSec,

    double IdealCycleTimeSec,

    double ActualRatePph,

    double IdealRatePph,

    double RateVariancePct,

    double ScrapPct,

    double YieldPct,

    double FpyPct,

    string? ActiveRecipeCode,

    string? ActiveRecipeName,

    bool RecipeIsAutoCreated,

    string IdealCycleSource,

    // Extended KPIs — targets

    double TargetOeePct,

    double TargetAvailabilityPct,

    double TargetPerformancePct,

    double TargetQualityPct,

    // Target gaps

    double OeeGapPct,

    double AvailabilityGapPct,

    double PerformanceGapPct,

    double QualityGapPct,

    // Derived rates

    double UtilizationPct,

    double CycleVariancePct,

    double? ReworkPct,

    bool ReworkTrackingActive,

    // Attainment — run

    double? RunTargetQuantity,

    string? RunTargetQuantitySource,

    double? RunAttainmentPct,

    double? RunPartsRemaining,

    // Attainment — shift

    double? ShiftTargetQuantity,

    string? ShiftTargetQuantitySource,

    double? ShiftAttainmentPct,

    double? ShiftPartsRemaining,

    // Output diagnostics

    long TheoreticalOutput,

    long OutputGap,

    long MaxPossibleParts,

    long? ExpectedPartsPace,

    long PartsLostAvailability,

    long PartsLostPerformance,

    long PartsLostQuality,

    long PartsLostBreakdown,

    long PartsCouldHaveMade,

    // Per-state time (minutes) — downMin is RunState.Down only; downtimeMin is total stopped

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


