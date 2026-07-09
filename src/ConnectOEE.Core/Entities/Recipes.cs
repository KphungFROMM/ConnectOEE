using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>Software recipe catalog — ideal cycle and targets per product/SKU.</summary>
public class ProductRecipe : EntityBase
{
    public Guid? LineId { get; set; }
    public Line? Line { get; set; }

    [MaxLength(100)]
    public string Code { get; set; } = string.Empty;
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    /// <summary>Optional alternate match for PLC tag values (string or numeric as text).</summary>
    [MaxLength(100)]
    public string? PlcAlias { get; set; }

    public double IdealCycleTimeSec { get; set; } = 2.0;
    public double? TargetQuantity { get; set; }
    public bool IsActive { get; set; } = true;
    /// <summary>True when auto-created from an unknown PLC PartId — needs supervisor review.</summary>
    public bool IsAutoCreated { get; set; }
}

/// <summary>Per-line ideal cycle override for a catalog product (same SKU, different line speeds).</summary>
public class LineProductRate : EntityBase
{
    public Guid LineId { get; set; }
    public Line? Line { get; set; }
    public Guid ProductRecipeId { get; set; }
    public ProductRecipe? ProductRecipe { get; set; }
    public double IdealCycleTimeSec { get; set; } = 2.0;
    public double? TargetQuantity { get; set; }
}

/// <summary>Scheduled production job (optional auto-start of ProductionRun).</summary>
public class ProductionSchedule : EntityBase
{
    public Guid LineId { get; set; }
    public Guid? ProductRecipeId { get; set; }
    public DateTimeOffset StartUtc { get; set; }
    public DateTimeOffset? EndUtc { get; set; }
    public double? TargetQuantity { get; set; }
    [MaxLength(300)]
    public string? Note { get; set; }
}

/// <summary>Optional crew for operator/crew attribution.</summary>
public class Crew : EntityBase
{
    [MaxLength(100)]
    public string Name { get; set; } = string.Empty;
    public Guid? PlantId { get; set; }
}

/// <summary>Assigns a crew to a shift instance.</summary>
public class ShiftCrew : EntityBase
{
    public Guid ShiftInstanceId { get; set; }
    public Guid CrewId { get; set; }
    public Guid LineId { get; set; }
}
