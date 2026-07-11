using ConnectOEE.Core;
using ConnectOEE.Core.Oee;
using ConnectOEE.Historian;

namespace ConnectOEE.Reporting;

/// <summary>Resolved parameters for a report (scope + concrete date window).</summary>
public record ReportParams(
    ReportType ReportType,
    EntityLevel Level,
    Guid EntityId,
    DateTimeOffset From,
    DateTimeOffset To);

/// <summary>A fault-frequency row for fault/maintenance reports.</summary>
public record FaultRow(int Code, string Reason, int Count, double TotalMin);

/// <summary>A closed-shift summary row for shift/daily reports.</summary>
public record ShiftRow(
    string ShiftName,
    DateTimeOffset StartUtc,
    DateTimeOffset EndUtc,
    double OeePct,
    double AvailabilityPct,
    double PerformancePct,
    double QualityPct,
    long GoodCount,
    long RejectCount,
    double DowntimeMinutes);

/// <summary>
/// Fully resolved data backing a rendered report. The PDF/CSV renderers select the
/// sections relevant to <see cref="ReportType"/>; the data service fills whatever is
/// available so one model serves every report type.
/// </summary>
public class ReportModel
{
    public ReportType ReportType { get; set; }
    public string Title { get; set; } = string.Empty;
    public string ScopeName { get; set; } = string.Empty;
    public string ScopeLevel { get; set; } = string.Empty;
    public DateTimeOffset From { get; set; }
    public DateTimeOffset To { get; set; }
    public DateTimeOffset GeneratedUtc { get; set; } = DateTimeOffset.UtcNow;

    public OeeResult Oee { get; set; } = OeeResult.Empty;
    public long GoodCount { get; set; }
    public long RejectCount { get; set; }
    public long TotalCount { get; set; }
    public double DowntimeMin { get; set; }
    public double UptimeMin { get; set; }
    public int DowntimeCount { get; set; }
    public double TargetOeePct { get; set; } = 85;

    public ReliabilityResult Reliability { get; set; } = ReliabilityResult.Empty;

    public IReadOnlyList<TrendPoint> Trend { get; set; } = Array.Empty<TrendPoint>();
    public IReadOnlyList<ProductionPoint> Production { get; set; } = Array.Empty<ProductionPoint>();
    public IReadOnlyList<ReasonBucket> Reasons { get; set; } = Array.Empty<ReasonBucket>();
    public IReadOnlyList<DrillNode> Breakdown { get; set; } = Array.Empty<DrillNode>();
    public IReadOnlyList<FaultRow> TopFaults { get; set; } = Array.Empty<FaultRow>();
    public IReadOnlyList<ShiftRow> Shifts { get; set; } = Array.Empty<ShiftRow>();

    public byte[]? OeeTrendChart { get; set; }
    public byte[]? ParetoChart { get; set; }
    public byte[]? ProductionChart { get; set; }

    /// <summary>Hero OEE ring for KPI band (small PNG).</summary>
    public byte[]? OeeRingChart { get; set; }
    /// <summary>Compact OEE sparkline under the hero ring.</summary>
    public byte[]? OeeSparkline { get; set; }
    public byte[]? AvailabilitySparkline { get; set; }
    public byte[]? PerformanceSparkline { get; set; }
    public byte[]? QualitySparkline { get; set; }
}
