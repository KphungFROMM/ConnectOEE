using System.ComponentModel.DataAnnotations;

namespace ConnectOEE.Core.Entities;

/// <summary>A dashboard with scope, draft/published state, and version history.</summary>
public class Dashboard : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    public DashboardScope Scope { get; set; } = DashboardScope.Private;
    public bool IsPublished { get; set; }
    public int Version { get; set; } = 1;

    /// <summary>Owner (Supervisors can delete only dashboards they created).</summary>
    public Guid? OwnerUserId { get; set; }
    /// <summary>Optional binding context for placeholder remapping.</summary>
    public Guid? PlantId { get; set; }
    public Guid? LineId { get; set; }
    public Guid? MachineId { get; set; }

    public List<Widget> Widgets { get; set; } = new();
}

/// <summary>Immutable snapshot of a dashboard layout for autosave/rollback.</summary>
public class DashboardVersion : EntityBase
{
    public Guid DashboardId { get; set; }
    public int Version { get; set; }
    /// <summary>Full layout + widget binding JSON at this version.</summary>
    public string LayoutJson { get; set; } = "{}";
    public bool IsAutosave { get; set; }
}

/// <summary>A placed widget with type, grid layout, and data binding.</summary>
public class Widget : EntityBase
{
    public Guid DashboardId { get; set; }
    [MaxLength(100)]
    public string Type { get; set; } = string.Empty;
    [MaxLength(200)]
    public string? Title { get; set; }

    public int X { get; set; }
    public int Y { get; set; }
    public int W { get; set; } = 2;
    public int H { get; set; } = 2;

    /// <summary>Parent container/tab widget id; null = root grid. One nesting level only.</summary>
    public Guid? ParentId { get; set; }
    /// <summary>For tabbed-panel children: tab key matching options.tabs index (e.g. "0").</summary>
    [MaxLength(64)]
    public string? TabKey { get; set; }

    /// <summary>Binding descriptor (logical signal / KPI / aggregate) as JSON.</summary>
    public string BindingJson { get; set; } = "{}";
    /// <summary>Threshold/alarm/units/colors config as JSON.</summary>
    public string OptionsJson { get; set; } = "{}";
}

/// <summary>A prebuilt or user-saved dashboard template with placeholder bindings.</summary>
public class DashboardTemplate : EntityBase
{
    [MaxLength(200)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(100)]
    public string Category { get; set; } = "General";
    public bool IsSystem { get; set; }
    [MaxLength(500)]
    public string? Description { get; set; }
    /// <summary>Layout JSON using {{placeholder}} bindings remapped on instantiation.</summary>
    public string LayoutJson { get; set; } = "{}";
}
