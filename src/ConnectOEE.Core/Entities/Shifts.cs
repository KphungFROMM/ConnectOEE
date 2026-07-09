using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>A reusable shift pattern template (3x8, 2x12, DuPont, 24/7, etc.).</summary>
public class ShiftPattern : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(500)]
    public string? Description { get; set; }
    public List<ShiftDefinition> Definitions { get; set; } = new();
}

/// <summary>A single shift slot within a pattern.</summary>
public class ShiftDefinition : EntityBase
{
    public Guid ShiftPatternId { get; set; }
    public ShiftPattern? ShiftPattern { get; set; }

    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    /// <summary>Start time-of-day (local plant tz).</summary>
    public TimeOnly StartTime { get; set; }
    /// <summary>End time-of-day (local plant tz).</summary>
    public TimeOnly EndTime { get; set; }
    /// <summary>True when EndTime is on the following day (e.g. 22:00 -> 06:00).</summary>
    public bool CrossesMidnight { get; set; }
    [MaxLength(20)]
    public string? Color { get; set; }
    public int OrderIndex { get; set; }

    /// <summary>Break windows (JSON array of {start,end}) excluded from available time.</summary>
    public string BreakWindowsJson { get; set; } = "[]";
}

/// <summary>Assigns a pattern to a plant or line for an effective date range.</summary>
public class ShiftAssignment : EntityBase
{
    public Guid ShiftPatternId { get; set; }
    public ShiftPattern? ShiftPattern { get; set; }

    public Guid? PlantId { get; set; }
    /// <summary>When set, overrides the plant default for this line.</summary>
    public Guid? LineId { get; set; }

    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
}

/// <summary>Working-day / holiday / no-production calendar for a plant.</summary>
public class ShiftCalendar : EntityBase
{
    public Guid PlantId { get; set; }
    public DateOnly Date { get; set; }
    public bool IsWorkingDay { get; set; } = true;
    public bool IsHoliday { get; set; }
    /// <summary>Planned no-production window excluded from the availability denominator.</summary>
    public bool IsPlannedDown { get; set; }
    [MaxLength(200)]
    public string? Note { get; set; }
}

/// <summary>A materialized concrete shift occurrence used to bucket data.</summary>
public class ShiftInstance : EntityBase
{
    public Guid LineId { get; set; }
    public Line? Line { get; set; }
    public Guid ShiftDefinitionId { get; set; }

    [MaxLength(100)]
    public string ShiftName { get; set; } = string.Empty;
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset EndUtc { get; set; }
    /// <summary>Set once the boundary worker finalizes the shift's aggregates.</summary>
    public bool IsClosed { get; set; }

    // Finalized shift aggregates (populated at close by the OEE engine).
    public double? OeePct { get; set; }
    public double? AvailabilityPct { get; set; }
    public double? PerformancePct { get; set; }
    public double? QualityPct { get; set; }
    public long GoodCount { get; set; }
    public long RejectCount { get; set; }
    public double DowntimeMinutes { get; set; }
}
