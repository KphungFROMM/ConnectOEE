using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>A production run (job/product) on a line, used for counts and pacing.</summary>
public class ProductionRun : EntityBase
{
    public Guid LineId { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset? EndUtc { get; set; }
    [MaxLength(200)]
    public string? ProductId { get; set; }
    public long GoodCount { get; set; }
    public long RejectCount { get; set; }
    public double? TargetQuantity { get; set; }
}

/// <summary>A detected stop with reason/category and optional operator entry.</summary>
public class DowntimeEvent : EntityBase
{
    public Guid LineId { get; set; }
    public Guid? MachineId { get; set; }
    public Guid? ShiftInstanceId { get; set; }

    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset? EndUtc { get; set; }
    public double DurationSec { get; set; }

    public LossCategory Category { get; set; } = LossCategory.Unattributed;
    public DowntimeKind Kind { get; set; } = DowntimeKind.Unplanned;
    [MaxLength(300)]
    public string? Reason { get; set; }
    public int? FaultCode { get; set; }

    /// <summary>True for stops at/under the configured micro-stop threshold.</summary>
    public bool IsMicroStop { get; set; }
    /// <summary>Operator who entered the reason (null if unattributed).</summary>
    public Guid? ReasonEnteredByUserId { get; set; }
    public DateTimeOffset? ReasonEnteredUtc { get; set; }
    /// <summary>When the operator acknowledged the stop (drives MTTD).</summary>
    public DateTimeOffset? AcknowledgedUtc { get; set; }
}

/// <summary>A fault-code occurrence raised by a machine.</summary>
public class FaultOccurrence : EntityBase
{
    public Guid LineId { get; set; }
    public Guid? MachineId { get; set; }
    public int Code { get; set; }
    [MaxLength(300)]
    public string? MappedReason { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset? EndUtc { get; set; }
    public DateTimeOffset? AcknowledgedUtc { get; set; }
}

/// <summary>A run-state transition for the machine state timeline.</summary>
public class StateTransition : EntityBase
{
    public Guid LineId { get; set; }
    public Guid? MachineId { get; set; }
    public RunState FromState { get; set; }
    public RunState ToState { get; set; }
    public DateTimeOffset TimestampUtc { get; set; }
}
