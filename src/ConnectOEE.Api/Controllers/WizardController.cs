using System.Text.Json;
using ConnectOEE.Api.Auth;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// Backs the re-runnable startup wizard. Progress is derived from existing data (no
/// duplicate state), so re-running edits config rather than recreating it. Step 1
/// creates the admin account; step 10 generates the default dashboard set.
/// </summary>
[ApiController]
[Route("api/wizard")]
[Authorize]
public class WizardController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;

    public WizardController(ConnectOeeDbContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public record WizardStatus(
        int Plants, int Departments, int Lines, int Machines, int PlcConnections,
        bool RequiredTagsMapped, int OptionalTagsMapped, bool ShiftsAssigned,
        bool HasAdminUser, int Dashboards, int CurrentStep);

    [HttpGet("status")]
    public async Task<ActionResult<WizardStatus>> Status()
    {
        var plants = await _db.Plants.CountAsync();
        var depts = await _db.Departments.CountAsync();
        var lines = await _db.Lines.CountAsync();
        var machines = await _db.Machines.CountAsync();
        var plcs = await _db.PlcConnections.CountAsync();

        // Required tags = RunState + GoodCount on every machine must be mapped.
        var requiredRoles = new[] { SignalRole.RunState, SignalRole.GoodCount };
        var requiredSignals = await _db.LogicalSignals
            .Where(s => s.MachineId != null && requiredRoles.Contains(s.Role))
            .Select(s => new { s.Id, Mapped = s.Mapping != null })
            .ToListAsync();
        var requiredTagsMapped = machines > 0 && requiredSignals.Count > 0 && requiredSignals.All(s => s.Mapped);

        var optionalMapped = await _db.LogicalSignals
            .CountAsync(s => s.MachineId != null && !requiredRoles.Contains(s.Role) && s.Mapping != null);

        var shiftsAssigned = await _db.ShiftAssignments.AnyAsync();
        var hasAdmin = await _db.Users.AnyAsync();
        var dashboards = await _db.Dashboards.CountAsync();

        // First incomplete step (1-based, matches docs/13). Admin account is step 1.
        int step =
            !hasAdmin ? 1 :
            plants == 0 ? 2 :
            depts == 0 ? 3 :
            lines == 0 ? 4 :
            machines == 0 ? 5 :
            plcs == 0 ? 6 :
            !requiredTagsMapped ? 7 :
            optionalMapped == 0 ? 8 :
            !shiftsAssigned ? 9 :
            dashboards == 0 ? 10 : 10;

        return Ok(new WizardStatus(plants, depts, lines, machines, plcs, requiredTagsMapped,
            optionalMapped, shiftsAssigned, hasAdmin, dashboards, step));
    }

    public record GenerateResult(int Created, List<string> Names);

    /// <summary>Step 10: generate the ready-to-go dashboard set bound to each line/machine.</summary>
    [HttpPost("generate-dashboards")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<GenerateResult>> GenerateDashboards()
    {
        var templates = await _db.DashboardTemplates.ToListAsync();
        var byName = templates.ToDictionary(t => t.Name);

        var existingNames = (await _db.Dashboards.Select(d => d.Name).ToListAsync()).ToHashSet();
        var created = new List<string>();
        var me = User.GetUserId();

        var lines = await _db.Lines
            .Include(l => l.Machines)
            .Include(l => l.Department)
            .ToListAsync();

        var plantId = lines.FirstOrDefault()?.Department?.PlantId
            ?? await _db.Plants.OrderBy(p => p.Name).Select(p => p.Id).FirstOrDefaultAsync();

        foreach (var line in lines)
        {
            var firstMachine = line.Machines.OrderBy(m => m.SequenceIndex).FirstOrDefault();
            var linePlantId = line.Department?.PlantId ?? plantId;
            var lineDashboards = new (string Template, string Suffix, bool Kiosk)[]
            {
                ("Line Performance Board", "Overview", false),
                ("Shift Huddle Board", "Shift", false),
                ("Machine Station Detail", "Detail", false),
                ("Downtime Detective", "Downtime", false),
                ("Production & Pace", "Production", false),
                ("Quality & Yield Lab", "Quality", false),
                ("Supervisor Cockpit", "Supervisor", false),
                ("Setup & Changeover", "Setup", false),
                ("Operator Kiosk", "Operator Kiosk", true),
                ("Line Andon Wall", "Andon", true),
            };
            foreach (var (template, suffix, kiosk) in lineDashboards)
            {
                if (!byName.TryGetValue(template, out var tpl)) continue;
                var machineId = template is "Machine Station Detail" or "Operator Kiosk" or "Supervisor Cockpit" or "Setup & Changeover"
                    ? firstMachine?.Id
                    : null;
                TryCreate($"{line.Name} — {suffix}", tpl, linePlantId, line.Id, machineId, kiosk);
            }
        }

        foreach (var tplName in new[] { "Plant Command Center", "Executive Briefing", "Plant Reliability Hub", "TEEP & Utilization" })
        {
            if (byName.TryGetValue(tplName, out var tpl) && plantId != Guid.Empty)
                TryCreate(tplName, tpl, plantId, null, null, false);
        }

        if (byName.TryGetValue("Maintenance Wallboard", out var wallboardTpl) && plantId != Guid.Empty)
        {
            var wallboardLineId = lines.FirstOrDefault()?.Id;
            TryCreate("Maintenance Wallboard", wallboardTpl, plantId, wallboardLineId, null, true);
        }

        var multiUnit = lines.Count >= 2 || lines.Any(l => l.Machines.Count >= 2);
        if (multiUnit && byName.TryGetValue("Floor At-a-Glance", out var multiTpl) && plantId != Guid.Empty)
            TryCreate("Floor At-a-Glance", multiTpl, plantId, null, null, false);

        await _db.SaveChangesAsync();
        await _audit.LogAsync("wizard.generate-dashboards", me, User.GetUserName(), details: new { created.Count });
        return Ok(new GenerateResult(created.Count, created));

        void TryCreate(string name, DashboardTemplate tpl, Guid? plantId, Guid? lineId, Guid? machineId, bool kiosk)
        {
            if (existingNames.Contains(name)) return;
            var dashboard = new Dashboard
            {
                Name = name,
                Scope = kiosk ? DashboardScope.PublicKiosk : DashboardScope.Private,
                OwnerUserId = me,
                PlantId = plantId,
                LineId = lineId,
                MachineId = machineId,
                IsPublished = kiosk,
            };
            foreach (var w in ParseWidgets(tpl.LayoutJson))
                dashboard.Widgets.Add(new Widget
                {
                    DashboardId = dashboard.Id,
                    Type = w.Type, Title = w.Title, X = w.X, Y = w.Y, W = w.W, H = w.H,
                    BindingJson = w.Binding?.GetRawText() ?? "{}",
                    OptionsJson = w.Options?.GetRawText() ?? "{}",
                });
            _db.Dashboards.Add(dashboard);
            existingNames.Add(name);
            created.Add(name);
        }
    }

    private record WidgetSeed(string Type, string? Title, int X, int Y, int W, int H, JsonElement? Binding, JsonElement? Options);

    private static List<WidgetSeed> ParseWidgets(string layoutJson)
    {
        try
        {
            return JsonSerializer.Deserialize<List<WidgetSeed>>(layoutJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }
        catch { return new(); }
    }
}
