using ConnectOEE.Core.Oee;

namespace ConnectOEE.Historian;

/// <summary>Which level of the plant hierarchy a historian query targets.</summary>
public enum EntityLevel
{
    Plant,
    Department,
    Line,
    Machine,
}

/// <summary>
/// Roll-up tier for a trend query. Auto picks a sensible bucket from the range so
/// the chart never returns thousands of points.
/// </summary>
public enum Granularity
{
    Auto,
    Hour,
    Shift,
    Day,
    Week,
    Month,
}

/// <summary>A time-range query against the historian for a single hierarchy node.</summary>
public record TrendQuery(
    EntityLevel Level,
    Guid EntityId,
    DateTimeOffset From,
    DateTimeOffset To,
    Granularity Granularity = Granularity.Auto);

/// <summary>One bucket of a trend: OEE result for the period plus the raw counts/downtime.</summary>
public record TrendPoint(
    DateTimeOffset BucketUtc,
    string Label,
    OeeResult Oee,
    long GoodCount,
    long RejectCount,
    long TotalCount,
    double DowntimeMin,
    double TargetOeePct,
    double UptimeMin = 0,
    double PlannedDowntimeMin = 0,
    double UnplannedDowntimeMin = 0,
    int MicroStopCount = 0);

/// <summary>Whole-trend response carrying the resolved bucket so the UI can label axes.</summary>
public record TrendResult(
    EntityLevel Level,
    Guid EntityId,
    string EntityName,
    Granularity ResolvedGranularity,
    DateTimeOffset From,
    DateTimeOffset To,
    IReadOnlyList<TrendPoint> Points);

/// <summary>Aggregate KPI snapshot for a node over a range (no bucketing).</summary>
public record KpiSnapshot(
    EntityLevel Level,
    Guid EntityId,
    string EntityName,
    DateTimeOffset From,
    DateTimeOffset To,
    OeeResult Oee,
    long GoodCount,
    long RejectCount,
    long TotalCount,
    double DowntimeMin,
    int DowntimeCount,
    double TargetOeePct,
    double UptimeMin = 0,
    double PlannedDowntimeMin = 0,
    double UnplannedDowntimeMin = 0,
    int MicroStopCount = 0,
    double TargetAvailabilityPct = 90,
    double TargetPerformancePct = 95,
    double TargetQualityPct = 99,
    double OeeGapPct = 0,
    double AvailabilityGapPct = 0,
    double PerformanceGapPct = 0,
    double QualityGapPct = 0,
    double UtilizationPct = 0,
    double CycleVariancePct = 0,
    StateTimeMinutes? StateTimes = null,
    ProductionPartsLoss? PartsLoss = null);

/// <summary>Parts lost by Six Big Loss category over a historian range.</summary>
public record ProductionPartsLossByCategory(string Category, double TotalSec, long PartsLost);

/// <summary>Parts-based production loss summary for a hierarchy scope.</summary>
public record ProductionPartsLossResult(
    EntityLevel Level,
    Guid EntityId,
    string EntityName,
    DateTimeOffset From,
    DateTimeOffset To,
    ProductionPartsLoss Summary,
    IReadOnlyList<ProductionPartsLossByCategory> ByCategory);

/// <summary>Run-state time breakdown for a hierarchy scope over a range.</summary>
public record StateTimeBreakdownResult(
    EntityLevel Level,
    Guid EntityId,
    string EntityName,
    DateTimeOffset From,
    DateTimeOffset To,
    StateTimeMinutes StateTimes);

/// <summary>A child node KPI used for plant -&gt; dept -&gt; line -&gt; machine drill-down.</summary>
public record DrillNode(
    EntityLevel Level,
    Guid Id,
    string Name,
    OeeResult Oee,
    long GoodCount,
    long RejectCount,
    double DowntimeMin,
    int DowntimeCount,
    double UptimeMin = 0);

/// <summary>A downtime reason/category bucket for line -&gt; reason drill-through.</summary>
public record ReasonBucket(
    string Category,
    string Kind,
    string Reason,
    int Count,
    double TotalMin);

/// <summary>Hourly (or bucketed) production vs target for production-analysis charts.</summary>
public record ProductionPoint(
    DateTimeOffset BucketUtc,
    string Label,
    long GoodCount,
    long RejectCount,
    long TotalCount,
    double TargetCount,
    double ScrapPct);

/// <summary>Reliability metrics for one historian bucket.</summary>
public record ReliabilityTrendPoint(
    DateTimeOffset BucketUtc,
    string Label,
    double MttrMin,
    double MtbfMin,
    double StopsPerHour,
    double DowntimeMin,
    double UptimeMin);

/// <summary>Bucketed reliability trend for charts.</summary>
public record ReliabilityTrendResult(
    EntityLevel Level,
    Guid EntityId,
    string EntityName,
    Granularity ResolvedGranularity,
    DateTimeOffset From,
    DateTimeOffset To,
    IReadOnlyList<ReliabilityTrendPoint> Points);

/// <summary>Six Big Losses bucket for historian scope queries.</summary>
public record HistorianLossBucket(string Category, int Count, double TotalSec);

/// <summary>Downtime event row for analytics drill-through.</summary>
public record HistorianEvent(
    Guid Id,
    Guid LineId,
    Guid? MachineId,
    string? MachineName,
    DateTimeOffset StartUtc,
    DateTimeOffset? EndUtc,
    double DurationSec,
    string Category,
    string Kind,
    string? Reason,
    int? FaultCode,
    bool IsMicroStop);
