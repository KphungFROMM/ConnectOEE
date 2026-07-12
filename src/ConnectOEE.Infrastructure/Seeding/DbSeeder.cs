using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace ConnectOEE.Infrastructure.Seeding;

/// <summary>
/// Idempotent seeding: roles, permissions, role-permission map, and system templates.
/// Admin users and sample hierarchy are created by the setup wizard (not seeded).
/// </summary>
public static class DbSeeder
{
    public const string DefaultAdminUserName = "admin";
    public const string DefaultAdminPassword = "ChangeMe!123";

    public static async Task SeedAsync(IServiceProvider services, bool seedSampleData)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var db = sp.GetRequiredService<ConnectOeeDbContext>();
        var roleManager = sp.GetRequiredService<RoleManager<AppRole>>();
        var logger = sp.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder");

        await SeedRolesAsync(roleManager);
        await SeedPermissionsAsync(db);
        await SeedRolePermissionsAsync(db, roleManager);

        var userManager = sp.GetRequiredService<UserManager<AppUser>>();
        if (await userManager.GetUsersInRoleAsync(RoleNames.Admin) is { Count: > 0 })
            await SeedCommissionUsersAsync(userManager, logger);

        if (seedSampleData)
        {
            await SeedSampleHierarchyAsync(db, logger);
            await SeedShiftsAsync(db, logger);
        }

        await SeedDashboardTemplatesAsync(db, logger);
        await SeedReportTemplatesAsync(db, logger);
        await ProductCatalogSeeder.SeedAsync(db, logger);
        await SeedDefaultOperatorReasonsAsync(db, logger);

        await db.SaveChangesAsync();
    }

    /// <summary>
    /// Seeds the six default Operator Station quick reasons (synthetic codes ≥ 9000) when none exist yet.
    /// Idempotent: skipped once any synthetic-band reason is present so admin deletes stay deleted.
    /// </summary>
    private static async Task SeedDefaultOperatorReasonsAsync(ConnectOeeDbContext db, ILogger logger)
    {
        const int syntheticMin = 9000;
        if (await db.FaultCodeMaps.AnyAsync(f => f.Code >= syntheticMin))
            return;

        var defaults = new (string Reason, LossCategory Category, DowntimeKind Kind)[]
        {
            ("Changeover", LossCategory.SetupAndAdjustment, DowntimeKind.Planned),
            ("Planned break", LossCategory.SetupAndAdjustment, DowntimeKind.Planned),
            ("Material shortage", LossCategory.SmallStop, DowntimeKind.Unplanned),
            ("Quality check", LossCategory.SmallStop, DowntimeKind.Unplanned),
            ("Mechanical jam", LossCategory.Breakdown, DowntimeKind.Unplanned),
            ("Maintenance", LossCategory.Breakdown, DowntimeKind.Unplanned),
        };

        var code = syntheticMin;
        foreach (var d in defaults)
        {
            db.FaultCodeMaps.Add(new FaultCodeMap
            {
                Code = code++,
                Reason = d.Reason,
                Category = d.Category,
                Kind = d.Kind,
                LineId = null,
                MachineId = null,
                IsAutoCreated = false,
                NeedsReview = false,
            });
        }

        logger.LogInformation("Seeded {Count} default Operator Station quick reasons (codes {Min}+).", defaults.Length, syntheticMin);
    }

    /// <summary>Seeds the built-in report templates (one per prebuilt ReportType, see docs/12).</summary>
    private static async Task SeedReportTemplatesAsync(ConnectOeeDbContext db, ILogger logger)
    {
        var defaults = new (ReportType Type, string Name, string Description)[]
        {
            (ReportType.ShiftReport, "Shift Report", "OEE + A/P/Q, good/reject/scrap, downtime by reason and top faults for a single shift."),
            (ReportType.DailyOee, "Daily OEE Report", "Day roll-up across shifts with trend and shift comparison."),
            (ReportType.DowntimePareto, "Downtime Pareto Report", "Pareto of downtime reasons/categories plus reliability metrics."),
            (ReportType.ProductionVsTarget, "Production vs Target Report", "Production vs target with reject/scrap trends."),
            (ReportType.WeeklySummary, "Weekly Summary", "Weekly KPI roll-up with trends and breakdown."),
            (ReportType.MonthlySummary, "Monthly Summary", "Monthly KPI roll-up with trends and breakdown."),
            (ReportType.ExecutiveSummary, "Executive Summary", "Multi-line/plant KPI overview for management."),
            (ReportType.FaultMaintenance, "Fault / Maintenance Report", "Fault frequency, MTBF/MTTR and top fault codes with mapped reasons."),
        };

        var existing = await db.ReportTemplates
            .Where(t => t.IsSystem)
            .Select(t => t.ReportType)
            .ToListAsync();

        var added = 0;
        foreach (var d in defaults)
        {
            if (existing.Contains(d.Type)) continue;
            db.ReportTemplates.Add(new ReportTemplate
            {
                Name = d.Name,
                Description = d.Description,
                ReportType = d.Type,
                IsSystem = true,
                IsPublished = true,
            });
            added++;
        }
        if (added > 0)
        {
            await db.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} built-in report templates", added);
        }
    }

    private static async Task SeedRolesAsync(RoleManager<AppRole> roleManager)
    {
        foreach (var role in RoleNames.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
                await roleManager.CreateAsync(new AppRole(role) { Description = $"{role} role" });
        }
    }

    private static async Task SeedPermissionsAsync(ConnectOeeDbContext db)
    {
        var existing = await db.Permissions.Select(p => p.Key).ToListAsync();
        foreach (var key in PermissionKeys.All.Except(existing))
            db.Permissions.Add(new Permission { Key = key, Description = key });
        await db.SaveChangesAsync();
    }

    /// <summary>Maps the documented role-to-permission matrix (see docs/05).</summary>
    private static async Task SeedRolePermissionsAsync(ConnectOeeDbContext db, RoleManager<AppRole> roleManager)
    {
        var map = new Dictionary<string, string[]>
        {
            [RoleNames.Admin] = PermissionKeys.All,
            [RoleNames.Supervisor] = new[]
            {
                PermissionKeys.BrowseTags, PermissionKeys.MapTags, PermissionKeys.PlcWrite,
                PermissionKeys.BuildDashboards, PermissionKeys.ViewPlantExplorer,
                PermissionKeys.ViewReports, PermissionKeys.ManageReports,
                PermissionKeys.EnterDowntimeReason, PermissionKeys.ManageProducts, PermissionKeys.SelectProduct
            },
            [RoleNames.Manager] = new[]
            {
                PermissionKeys.ViewPlantExplorer, PermissionKeys.ViewReports,
                PermissionKeys.ManageProducts, PermissionKeys.SelectProduct,
                PermissionKeys.EnterDowntimeReason,
            },
            [RoleNames.Operator] = new[] { PermissionKeys.EnterDowntimeReason, PermissionKeys.SelectProduct },
            [RoleNames.Kiosk] = Array.Empty<string>(),
        };

        var permsByKey = await db.Permissions.ToDictionaryAsync(p => p.Key, p => p.Id);

        foreach (var (roleName, keys) in map)
        {
            var role = await roleManager.FindByNameAsync(roleName);
            if (role is null) continue;

            var current = await db.RolePermissions
                .Where(rp => rp.RoleId == role.Id)
                .Select(rp => rp.PermissionId)
                .ToListAsync();

            foreach (var key in keys)
            {
                if (!permsByKey.TryGetValue(key, out var permId)) continue;
                if (!current.Contains(permId))
                    db.RolePermissions.Add(new RolePermission { RoleId = role.Id, PermissionId = permId });
            }
        }
        await db.SaveChangesAsync();
    }

    private static async Task SeedAdminAsync(UserManager<AppUser> userManager, ILogger logger)
    {
        if (await userManager.FindByNameAsync(DefaultAdminUserName) is not null) return;

        var admin = new AppUser
        {
            UserName = DefaultAdminUserName,
            DisplayName = "Administrator",
            Email = "admin@connectoee.local",
            EmailConfirmed = true,
        };
        var result = await userManager.CreateAsync(admin, DefaultAdminPassword);
        if (result.Succeeded)
        {
            await userManager.AddToRoleAsync(admin, RoleNames.Admin);
            logger.LogWarning("Seeded default admin '{User}'. Change the password after first login.", DefaultAdminUserName);
        }
        else
        {
            logger.LogError("Failed to seed admin: {Errors}", string.Join("; ", result.Errors.Select(e => e.Description)));
        }
    }

    /// <summary>Demo/commission accounts for each RBAC role (password matches admin default).</summary>
    /// <summary>Idempotent RBAC test accounts for commissioning (supervisor/manager/operator).</summary>
    public static async Task SeedCommissionUsersAsync(UserManager<AppUser> userManager, ILogger logger)
    {
        var accounts = new[]
        {
            (UserName: "supervisor", DisplayName: "Line Supervisor", Role: RoleNames.Supervisor),
            (UserName: "manager", DisplayName: "Plant Manager", Role: RoleNames.Manager),
            (UserName: "operator", DisplayName: "Line Operator", Role: RoleNames.Operator),
        };
        foreach (var (userName, displayName, role) in accounts)
        {
            if (await userManager.FindByNameAsync(userName) is not null) continue;
            var user = new AppUser
            {
                UserName = userName,
                DisplayName = displayName,
                Email = $"{userName}@connectoee.local",
                EmailConfirmed = true,
                MustChangePassword = true,
            };
            var result = await userManager.CreateAsync(user, DefaultAdminPassword);
            if (result.Succeeded)
            {
                await userManager.AddToRoleAsync(user, role);
                logger.LogInformation("Seeded commission user '{User}' ({Role})", userName, role);
            }
        }
    }

    private static async Task SeedSampleHierarchyAsync(ConnectOeeDbContext db, ILogger logger)
    {
        if (await db.Plants.AnyAsync()) return;

        var plant = new Plant { Name = "Main Plant", Code = "PL1", TimeZoneId = "UTC", Location = "On-prem" };
        var dept = new Department { Name = "Assembly", Plant = plant };
        var line = new Line { Name = "Line 1", Department = dept };
        var machine = new Machine { Name = "Filler", Line = line, SequenceIndex = 0 };

        line.OeeConfig = new OeeConfig
        {
            Line = line,
            IdealCycleTimeSec = 2.0,
            IdealRatePerHour = 1800,
            TargetOeePct = 85,
            MicroStopThresholdSec = 120,
        };

        line.Machines.Add(machine);
        dept.Lines.Add(line);
        plant.Departments.Add(dept);

        db.Plants.Add(plant);

        // Logical signals for the sample machine (bound to mock tags in Phase 3).
        db.LogicalSignals.AddRange(
            new LogicalSignal { Name = "Run State", Role = SignalRole.RunState, Machine = machine, Line = line, ExpectedType = TagDataType.Int },
            new LogicalSignal { Name = "Good Count", Role = SignalRole.GoodCount, Machine = machine, Line = line, ExpectedType = TagDataType.Dint, Unit = "parts" },
            new LogicalSignal { Name = "Reject Count", Role = SignalRole.RejectCount, Machine = machine, Line = line, ExpectedType = TagDataType.Dint, Unit = "parts" },
            new LogicalSignal { Name = "Rework Count", Role = SignalRole.ReworkCount, Machine = machine, Line = line, ExpectedType = TagDataType.Dint, Unit = "parts" },
            new LogicalSignal { Name = "Downtime Reason", Role = SignalRole.DowntimeReason, Machine = machine, Line = line, ExpectedType = TagDataType.Int });

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded sample hierarchy: {Plant} / {Dept} / {Line} / {Machine}",
            plant.Name, dept.Name, line.Name, machine.Name);
    }

    /// <summary>
    /// Seeds a default 3x8 shift pattern + plant assignment. Independently idempotent so
    /// it also applies to databases seeded before shifts existed.
    /// </summary>
    private static async Task SeedShiftsAsync(ConnectOeeDbContext db, ILogger logger)
    {
        if (await db.ShiftPatterns.AnyAsync()) return;

        var plant = await db.Plants.OrderBy(p => p.Name).FirstOrDefaultAsync();
        if (plant is null) return;

        var pattern = new ShiftPattern { Name = "3x8 Fixed", Description = "Three fixed 8-hour shifts" };
        pattern.Definitions.Add(new ShiftDefinition { ShiftPattern = pattern, Name = "Day", StartTime = new TimeOnly(6, 0), EndTime = new TimeOnly(14, 0), OrderIndex = 0, Color = "#2E9E5B" });
        pattern.Definitions.Add(new ShiftDefinition { ShiftPattern = pattern, Name = "Swing", StartTime = new TimeOnly(14, 0), EndTime = new TimeOnly(22, 0), OrderIndex = 1, Color = "#E0A800" });
        pattern.Definitions.Add(new ShiftDefinition { ShiftPattern = pattern, Name = "Night", StartTime = new TimeOnly(22, 0), EndTime = new TimeOnly(6, 0), CrossesMidnight = true, OrderIndex = 2, Color = "#4C8DFF" });
        db.ShiftPatterns.Add(pattern);
        db.ShiftAssignments.Add(new ShiftAssignment
        {
            ShiftPatternId = pattern.Id,
            PlantId = plant.Id,
            EffectiveFrom = DateOnly.FromDateTime(DateTime.UtcNow.AddYears(-1)),
        });

        await db.SaveChangesAsync();
        logger.LogInformation("Seeded default 3x8 shift pattern for plant {Plant}", plant.Name);
    }

    /// <summary>
    /// Seeds the built-in, system dashboard templates (read-only, cloneable). Widget
    /// bindings use a {source, field, factor} convention remapped to the dashboard's
    /// line/machine on instantiation. Idempotent.
    /// </summary>
    private static async Task SeedDashboardTemplatesAsync(ConnectOeeDbContext db, ILogger logger)
    {
        await DashboardTemplateLayouts.UpsertAsync(db, logger);
    }
}
