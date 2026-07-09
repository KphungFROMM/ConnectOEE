using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>
/// Persisted software-owned production counters for a machine. Survives API restarts
/// so shift totals remain authoritative even when PLC cumulatives are reset.
/// </summary>
public class MachineProductionState
{
    [Key]
    public Guid MachineId { get; set; }
    public Guid LineId { get; set; }

    public Guid ShiftInstanceId { get; set; }
    public long ShiftGood { get; set; }
    public long ShiftReject { get; set; }
    public long ShiftRework { get; set; }
    public long LifetimeGood { get; set; }
    public long LifetimeReject { get; set; }
    public long LifetimeRework { get; set; }

    /// <summary>Last raw PLC cumulative for good (CumulativeDelta mode).</summary>
    public long? LastRawGood { get; set; }
    /// <summary>Last raw PLC cumulative for reject (CumulativeDelta mode).</summary>
    public long? LastRawReject { get; set; }
    /// <summary>Last raw PLC cumulative for rework (CumulativeDelta mode).</summary>
    public long? LastRawRework { get; set; }
    /// <summary>Last BOOL level for good pulse detection.</summary>
    public bool? LastPulseGood { get; set; }
    /// <summary>Last BOOL level for reject pulse detection.</summary>
    public bool? LastPulseReject { get; set; }
    /// <summary>Last BOOL level for rework pulse detection.</summary>
    public bool? LastPulseRework { get; set; }

    /// <summary>Active recipe from PLC or software selection.</summary>
    public Guid? ActiveRecipeId { get; set; }
    public Guid? ActiveProductionRunId { get; set; }
    [MaxLength(100)]
    public string? ActiveRecipeCode { get; set; }
    /// <summary>Software-selected recipe when no PLC tag (operator override).</summary>
    public Guid? SoftwareRecipeId { get; set; }

    public DateTimeOffset UpdatedUtc { get; set; } = DateTimeOffset.UtcNow;
}
