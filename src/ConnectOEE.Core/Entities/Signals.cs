using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>
/// A logical signal (run state, good count, etc.) for a machine/line. Tag mappings
/// bind physical tags to these so the OEE engine is driver-agnostic.
/// </summary>
public class LogicalSignal : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public SignalRole Role { get; set; }
    public TagDataType ExpectedType { get; set; } = TagDataType.Unknown;
    /// <summary>How production increments are derived from the mapped tag (count roles only).</summary>
    public CountIngestMode CountIngestMode { get; set; } = CountIngestMode.CumulativeDelta;
    /// <summary>How the run-state tag is interpreted (RunState role only).</summary>
    public RunStateIngestMode RunStateIngestMode { get; set; } = RunStateIngestMode.DirectEnum;
    [MaxLength(50)]
    public string? Unit { get; set; }

    public Guid? MachineId { get; set; }
    public Machine? Machine { get; set; }
    public Guid? LineId { get; set; }
    public Line? Line { get; set; }

    public TagMapping? Mapping { get; set; }
}

/// <summary>Ideal-rate and target configuration used by the OEE engine.</summary>
public class OeeConfig : EntityBase
{
    public Guid LineId { get; set; }
    public Line? Line { get; set; }

    /// <summary>Ideal cycle time in seconds per part (basis for performance).</summary>
    public double IdealCycleTimeSec { get; set; } = 1.0;
    /// <summary>Ideal run rate in parts/hour (derived alt to cycle time).</summary>
    public double IdealRatePerHour { get; set; }
    /// <summary>Target OEE percentage (0-100) for target-vs-actual widgets.</summary>
    public double TargetOeePct { get; set; } = 85.0;
    /// <summary>Target availability % for gap KPIs and target-vs-actual.</summary>
    public double TargetAvailabilityPct { get; set; } = 90.0;
    /// <summary>Target performance % for gap KPIs and target-vs-actual.</summary>
    public double TargetPerformancePct { get; set; } = 95.0;
    /// <summary>Target quality % for gap KPIs and target-vs-actual.</summary>
    public double TargetQualityPct { get; set; } = 99.0;
    /// <summary>Whether rework counters and FPY apply on this line.</summary>
    public ReworkTrackingMode ReworkTracking { get; set; } = ReworkTrackingMode.Auto;
    /// <summary>Stops at/under this many seconds are micro-stops (small stops).</summary>
    public int MicroStopThresholdSec { get; set; } = 120;
    /// <summary>How ideal rate is chosen when products are (or are not) tracked on this line.</summary>
    public LineProductionMode ProductionMode { get; set; } = LineProductionMode.MultiProduct;
    /// <summary>SetupTracked = auto changeover downtime on product change; LogOnly = ProductionRun log only.</summary>
    public ChangeoverMode ChangeoverMode { get; set; } = ChangeoverMode.SetupTracked;
}

/// <summary>Maps a numeric PLC downtime reason code to a human-readable label per machine/line.</summary>
public class FaultCodeMap : EntityBase
{
    public Guid? MachineId { get; set; }
    public Guid? LineId { get; set; }
    public int Code { get; set; }
    [MaxLength(300)]
    public string Reason { get; set; } = string.Empty;
    public LossCategory Category { get; set; } = LossCategory.Breakdown;
    public DowntimeKind Kind { get; set; } = DowntimeKind.Unplanned;
    /// <summary>True when auto-created from first PLC sighting of an unknown code.</summary>
    public bool IsAutoCreated { get; set; }
    /// <summary>True until a supervisor completes the description and loss attribution.</summary>
    public bool NeedsReview { get; set; }
}
