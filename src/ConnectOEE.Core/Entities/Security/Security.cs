using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;

namespace ConnectOEE.Core.Entities.Security;

/// <summary>Application user. Extends Identity with display metadata.</summary>
public class AppUser : IdentityUser<Guid>
{
    [MaxLength(200)]
    public string? DisplayName { get; set; }
    public DateTimeOffset CreatedUtc { get; set; } = DateTimeOffset.UtcNow;
    public bool IsActive { get; set; } = true;
    /// <summary>When true, login is blocked until the user sets a new password.</summary>
    public bool MustChangePassword { get; set; }
}

/// <summary>Application role (Admin, Supervisor, Manager, Operator, Kiosk).</summary>
public class AppRole : IdentityRole<Guid>
{
    public AppRole() { }
    public AppRole(string name) : base(name) { }

    [MaxLength(300)]
    public string? Description { get; set; }
}

/// <summary>Well-known role names used across RBAC checks.</summary>
public static class RoleNames
{
    public const string Admin = "Admin";
    public const string Supervisor = "Supervisor";
    public const string Manager = "Manager";
    public const string Operator = "Operator";
    public const string Kiosk = "Kiosk";

    public static readonly string[] All = { Admin, Supervisor, Manager, Operator, Kiosk };
}

/// <summary>A granular permission that roles map to via RolePermission.</summary>
public class Permission : EntityBase
{
    [MaxLength(150)]
    public string Key { get; set; } = string.Empty;
    [MaxLength(300)]
    public string? Description { get; set; }
}

/// <summary>Well-known permission keys enforced server-side.</summary>
public static class PermissionKeys
{
    public const string ManageHierarchy = "hierarchy.manage";
    public const string BrowseTags = "tags.browse";
    public const string MapTags = "tags.map";
    public const string PlcWrite = "plc.write";
    public const string BuildDashboards = "dashboards.build";
    public const string ViewPlantExplorer = "plantexplorer.view";
    public const string EnterDowntimeReason = "downtime.enter";
    public const string ManageShifts = "shifts.manage";
    public const string ManageUsers = "users.manage";
    public const string ViewReports = "reports.view";
    public const string ManageReports = "reports.manage";
    public const string RunWizard = "wizard.run";
    public const string ManageProducts = "products.manage";
    public const string SelectProduct = "products.select";

    public static readonly string[] All =
    {
        ManageHierarchy, BrowseTags, MapTags, PlcWrite, BuildDashboards,
        ViewPlantExplorer, EnterDowntimeReason, ManageShifts, ManageUsers,
        ViewReports, ManageReports, RunWizard, ManageProducts, SelectProduct
    };
}

public class RolePermission : EntityBase
{
    public Guid RoleId { get; set; }
    public Guid PermissionId { get; set; }
    public Permission? Permission { get; set; }
}

/// <summary>Restricts a user to a plant (and optionally a line) per RBAC scoping.</summary>
public class UserPlantScope : EntityBase
{
    public Guid UserId { get; set; }
    public Guid PlantId { get; set; }
    /// <summary>When set, the user is scoped to a single line within the plant.</summary>
    public Guid? LineId { get; set; }
}
