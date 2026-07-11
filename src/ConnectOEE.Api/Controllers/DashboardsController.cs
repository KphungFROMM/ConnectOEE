using System.Text.Json;
using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Api.Services;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Core.Licensing;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Seeding;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/dashboards")]
[Authorize]
public class DashboardsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;
    private readonly SnapshotCache _cache;
    private readonly KioskTokenService _kioskTokens;
    private readonly SecurityOptions _security;
    private readonly ILicenseService _license;

    public DashboardsController(ConnectOeeDbContext db, IAuditService audit, SnapshotCache cache,
        KioskTokenService kioskTokens, Microsoft.Extensions.Options.IOptions<SecurityOptions> security,
        ILicenseService license)
    {
        _db = db;
        _audit = audit;
        _cache = cache;
        _kioskTokens = kioskTokens;
        _security = security.Value;
        _license = license;
    }

    public record WidgetDto(Guid Id, string Type, string? Title, int X, int Y, int W, int H,
        JsonElement Binding, JsonElement Options, Guid? ParentId, string? TabKey);
    public record DashboardDto(Guid Id, string Name, string Scope, bool IsPublished, int Version,
        Guid? PlantId, Guid? LineId, Guid? MachineId, List<WidgetDto> Widgets);
    public record DashboardSummary(Guid Id, string Name, string Scope, bool IsPublished, Guid? PlantId, Guid? LineId, Guid? MachineId,
        string? PlantName, string? LineName, string? MachineName, string InferredCategory);
    public record TemplateDto(Guid Id, string Name, string Category, string? Description, string? LayoutJson, int? WidgetCount);
    public record ApplyTemplateRequest(Guid TemplateId, string? Name, Guid? PlantId, Guid? LineId, Guid? MachineId);
    public record SaveWidget(string Type, string? Title, int X, int Y, int W, int H, JsonElement? Binding, JsonElement? Options,
        Guid? Id = null, Guid? ParentId = null, string? TabKey = null);
    public record SaveDashboardRequest(string Name, string? Scope, bool? IsPublished, Guid? PlantId, Guid? LineId, Guid? MachineId, List<SaveWidget> Widgets);
    public record VersionDto(int Version, bool IsAutosave, DateTimeOffset SavedUtc);
    public record SaveAsTemplateRequest(string Name, string? Category, string? Description);
    public record RefreshDashboardDetail(string Name, IReadOnlyList<string> WidgetTypes);
    public record RefreshSystemLayoutsResult(int Refreshed, IReadOnlyList<string> DashboardNames, IReadOnlyList<RefreshDashboardDetail> Details);

    /// <summary>
    /// Re-applies the latest system template layouts to wizard-generated dashboards
    /// (matched by naming convention). Preserves dashboard id, scope, and plant/line/machine bindings.
    /// </summary>
    [HttpPost("refresh-system-layouts")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<RefreshSystemLayoutsResult>> RefreshSystemLayouts()
    {
        await DashboardTemplateLayouts.UpsertAsync(_db);

        var dashboards = await _db.Dashboards.ToListAsync();
        var refreshed = new List<string>();
        var details = new List<RefreshDashboardDetail>();

        var linePlantIds = await _db.Lines.AsNoTracking()
            .Where(l => l.Department != null)
            .Select(l => new { l.Id, PlantId = l.Department!.PlantId })
            .ToDictionaryAsync(x => x.Id, x => x.PlantId);

        var defaultPlantId = await _db.Plants.OrderBy(p => p.Name).Select(p => (Guid?)p.Id).FirstOrDefaultAsync();

        var plantTemplateNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Plant Overview", "Analytics Starter", "Maintenance Wall",
            // legacy resolved names still seen on old dashboards during refresh
            "Plant Command Center", "Floor At-a-Glance", "Executive Briefing", "Plant Reliability Hub", "TEEP & Utilization",
        };

        var kioskTemplateNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Operator Floor", "Line Andon", "Maintenance Wall",
            "Operator Kiosk", "Line Andon Wall", "Maintenance Wallboard",
            "Andon / Big Screen", "Operator Station",
        };

        foreach (var d in dashboards)
        {
            var templateName = DashboardTemplateLayouts.ResolveTemplateName(d.Name);
            if (templateName is null) continue;

            var layoutJson = DashboardTemplateLayouts.GetLayoutJsonByName(templateName);
            if (layoutJson is null) continue;

            if (d.PlantId is null)
            {
                if (plantTemplateNames.Contains(templateName))
                    d.PlantId = defaultPlantId;
                else if (d.LineId is { } lid && linePlantIds.TryGetValue(lid, out var pid))
                    d.PlantId = pid;
            }

            // Force kiosk only from dashboard identity — not from resolved template
            // (e.g. legacy "— Detail" remaps layout to a kiosk-capable template but stays private).
            var name = d.Name;
            static bool EndsWithSuffix(string n, string suffix) =>
                n.EndsWith(" — " + suffix, StringComparison.OrdinalIgnoreCase)
                || n.EndsWith(" - " + suffix, StringComparison.OrdinalIgnoreCase);

            var forceKiosk =
                d.Scope == DashboardScope.PublicKiosk
                || kioskTemplateNames.Contains(name)
                || EndsWithSuffix(name, "Andon")
                || EndsWithSuffix(name, "Operator Kiosk")
                || EndsWithSuffix(name, "Operator Floor")
                || name.Equals("Maintenance Wall", StringComparison.OrdinalIgnoreCase)
                || name.Equals("Maintenance Wallboard", StringComparison.OrdinalIgnoreCase);
            // Only keep force-kiosk for true kiosk boards — demote wizard analysis boards.
            var isKioskBoard =
                kioskTemplateNames.Contains(name)
                || EndsWithSuffix(name, "Andon")
                || EndsWithSuffix(name, "Operator Kiosk")
                || EndsWithSuffix(name, "Operator Floor")
                || name.Equals("Maintenance Wall", StringComparison.OrdinalIgnoreCase)
                || name.Equals("Maintenance Wallboard", StringComparison.OrdinalIgnoreCase)
                || name.Equals("Andon / Big Screen", StringComparison.OrdinalIgnoreCase)
                || name.Equals("Operator Station", StringComparison.OrdinalIgnoreCase);

            if (isKioskBoard)
            {
                d.Scope = DashboardScope.PublicKiosk;
                d.IsPublished = true;
            }
            else if (
                d.Scope == DashboardScope.PublicKiosk
                && (EndsWithSuffix(name, "Detail")
                    || EndsWithSuffix(name, "Setup")
                    || EndsWithSuffix(name, "Shift")
                    || EndsWithSuffix(name, "Overview")
                    || EndsWithSuffix(name, "Downtime")
                    || EndsWithSuffix(name, "Production")
                    || EndsWithSuffix(name, "Quality")
                    || EndsWithSuffix(name, "Supervisor")
                    || name.Equals("Maintenance / Fault Focus", StringComparison.OrdinalIgnoreCase)))
            {
                d.Scope = DashboardScope.Private;
                d.IsPublished = false;
            }

            var widgets = ParseWidgets(layoutJson);
            await _db.Widgets.Where(w => w.DashboardId == d.Id).ExecuteDeleteAsync();
            foreach (var w in widgets)
            {
                _db.Widgets.Add(new Widget
                {
                    DashboardId = d.Id,
                    Type = w.Type,
                    Title = w.Title,
                    X = w.X, Y = w.Y, W = w.W, H = w.H,
                    BindingJson = w.Binding?.GetRawText() ?? "{}",
                    OptionsJson = w.Options?.GetRawText() ?? "{}",
                });
            }

            d.Version += 1;
            d.UpdatedUtc = DateTimeOffset.UtcNow;
            _db.DashboardVersions.Add(new DashboardVersion
            {
                DashboardId = d.Id,
                Version = d.Version,
                LayoutJson = layoutJson,
                IsAutosave = false,
            });
            refreshed.Add(d.Name);
            details.Add(new RefreshDashboardDetail(d.Name, widgets.Select(w => w.Type).ToList()));
        }

        if (refreshed.Count > 0)
            await _db.SaveChangesAsync();

        await _audit.LogAsync("dashboard.refresh-system-layouts", User.GetUserId(), User.GetUserName(),
            details: new { count = refreshed.Count, names = refreshed });

        return Ok(new RefreshSystemLayoutsResult(refreshed.Count, refreshed, details));
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<DashboardSummary>>> List()
    {
        var me = User.GetUserId();
        var rows = await (
            from d in _db.Dashboards
            join plant in _db.Plants on d.PlantId equals plant.Id into plants
            from plant in plants.DefaultIfEmpty()
            join line in _db.Lines on d.LineId equals line.Id into lines
            from line in lines.DefaultIfEmpty()
            join machine in _db.Machines on d.MachineId equals machine.Id into machines
            from machine in machines.DefaultIfEmpty()
            where d.Scope == DashboardScope.PublicKiosk || d.Scope == DashboardScope.RoleRestricted || d.OwnerUserId == me
            orderby d.Name
            select new { d, plant, line, machine }
        ).ToListAsync();

        var items = rows.Select(x => new DashboardSummary(
            x.d.Id,
            x.d.Name,
            x.d.Scope.ToString(),
            x.d.IsPublished,
            x.d.PlantId,
            x.d.LineId,
            x.d.MachineId,
            x.plant?.Name,
            x.line?.Name,
            x.machine?.Name,
            DashboardTemplateLayouts.InferCategory(x.d.Name, x.d.Scope)
        )).ToList();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<DashboardDto>> Get(Guid id)
    {
        var d = await _db.Dashboards.Include(x => x.Widgets).FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        return Ok(ToDto(d));
    }

    [HttpGet("templates")]
    public async Task<ActionResult<IEnumerable<TemplateDto>>> Templates()
    {
        var includeLayout = User.HasClaim(ConnectClaimTypes.Permission, PermissionKeys.BuildDashboards);
        var rows = await _db.DashboardTemplates
            .OrderBy(t => t.Category).ThenBy(t => t.Name)
            .ToListAsync();
        var items = rows.Select(t =>
        {
            var widgetCount = CountLayoutWidgets(t.LayoutJson);
            return new TemplateDto(
                t.Id,
                t.Name,
                t.Category,
                t.Description,
                includeLayout ? t.LayoutJson : null,
                widgetCount);
        }).ToList();
        return Ok(items);
    }

    /// <summary>Instantiates a template into a new dashboard bound to the chosen line/machine.</summary>
    [HttpPost("apply-template")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<DashboardDto>> ApplyTemplate([FromBody] ApplyTemplateRequest req)
    {
        var tpl = await _db.DashboardTemplates.FirstOrDefaultAsync(t => t.Id == req.TemplateId);
        if (tpl is null) return NotFound(new { message = "Template not found" });

        var dashboard = new Dashboard
        {
            Name = string.IsNullOrWhiteSpace(req.Name) ? tpl.Name : req.Name.Trim(),
            Scope = DashboardScope.Private,
            OwnerUserId = User.GetUserId(),
            LineId = req.LineId,
            MachineId = req.MachineId,
            PlantId = req.PlantId,
            IsPublished = true,
        };

        foreach (var entity in BuildWidgetEntities(dashboard.Id, ParseWidgets(tpl.LayoutJson)))
            dashboard.Widgets.Add(entity);

        _db.Dashboards.Add(dashboard);
        await _db.SaveChangesAsync();

        await _audit.LogAsync("dashboard.apply-template", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Dashboard), entityId: dashboard.Id.ToString(),
            details: new { tpl.Name, req.LineId, req.MachineId });

        return Ok(ToDto(dashboard));
    }

    [HttpPost]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<DashboardDto>> Create([FromBody] SaveDashboardRequest req)
    {
        if (Enum.TryParse<DashboardScope>(req.Scope, out var createScope) && createScope == DashboardScope.PublicKiosk)
        {
            var kioskLimit = await LicenseEnforcement.CheckKioskLimitAsync(_db, _license);
            if (kioskLimit is not null) return kioskLimit;
        }

        var dashboard = new Dashboard
        {
            Name = req.Name.Trim(),
            Scope = Enum.TryParse<DashboardScope>(req.Scope, out var sc) ? sc : DashboardScope.Private,
            OwnerUserId = User.GetUserId(),
            LineId = req.LineId,
            MachineId = req.MachineId,
            PlantId = req.PlantId,
            IsPublished = req.IsPublished ?? false,
        };
        ApplyWidgets(dashboard, req.Widgets);
        _db.Dashboards.Add(dashboard);
        await _db.SaveChangesAsync();
        return Ok(ToDto(dashboard));
    }

    [HttpPut("{id:guid}")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<DashboardDto>> Update(Guid id, [FromBody] SaveDashboardRequest req)
        => await SaveExisting(id, req, isAutosave: false);

    /// <summary>
    /// Autosave from the builder: persists the working layout and records an autosave
    /// version snapshot (kept separate from explicit saves in the history list).
    /// </summary>
    [HttpPost("{id:guid}/autosave")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<DashboardDto>> Autosave(Guid id, [FromBody] SaveDashboardRequest req)
        => await SaveExisting(id, req, isAutosave: true);

    private async Task<ActionResult<DashboardDto>> SaveExisting(Guid id, SaveDashboardRequest req, bool isAutosave)
    {
        var d = await _db.Dashboards.FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();

        d.Name = req.Name.Trim();
        if (Enum.TryParse<DashboardScope>(req.Scope, out var sc))
        {
            if (sc == DashboardScope.PublicKiosk && d.Scope != DashboardScope.PublicKiosk)
            {
                var kioskLimit = await LicenseEnforcement.CheckKioskLimitAsync(_db, _license);
                if (kioskLimit is not null) return kioskLimit;
            }
            d.Scope = sc;
        }
        if (req.IsPublished.HasValue) d.IsPublished = req.IsPublished.Value;
        if (d.Scope == DashboardScope.PublicKiosk && req.IsPublished == true && req.LineId is null)
            return BadRequest(new { message = "Public kiosk dashboards require a line binding before publish." });
        d.LineId = req.LineId;
        d.MachineId = req.MachineId;
        d.PlantId = req.PlantId;
        d.Version += 1;
        d.UpdatedUtc = DateTimeOffset.UtcNow;

        // Replace the widget set with a bulk delete + insert (avoids tracked-collection
        // churn and the associated concurrency pitfalls for a full-layout save).
        await _db.Widgets.Where(w => w.DashboardId == id).ExecuteDeleteAsync();
        foreach (var entity in BuildWidgetEntities(id, req.Widgets ?? new()))
            _db.Widgets.Add(entity);

        // Snapshot the layout for rollback; autosaves are flagged so the history UI can
        // distinguish them from explicit saves.
        _db.DashboardVersions.Add(new DashboardVersion
        {
            DashboardId = d.Id,
            Version = d.Version,
            LayoutJson = JsonSerializer.Serialize(req.Widgets),
            IsAutosave = isAutosave,
        });

        await _db.SaveChangesAsync();
        await _db.Entry(d).Collection(x => x.Widgets).LoadAsync();
        return Ok(ToDto(d));
    }

    /// <summary>Lists saved/autosaved versions (newest first) for rollback.</summary>
    [HttpGet("{id:guid}/versions")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<IEnumerable<VersionDto>>> Versions(Guid id)
    {
        var items = await _db.DashboardVersions
            .Where(v => v.DashboardId == id)
            .OrderByDescending(v => v.Version)
            .Select(v => new VersionDto(v.Version, v.IsAutosave, v.CreatedUtc))
            .ToListAsync();
        return Ok(items);
    }

    /// <summary>Restores a prior version's layout as a new current version.</summary>
    [HttpPost("{id:guid}/rollback/{version:int}")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<DashboardDto>> Rollback(Guid id, int version)
    {
        var d = await _db.Dashboards.FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        var snap = await _db.DashboardVersions.FirstOrDefaultAsync(v => v.DashboardId == id && v.Version == version);
        if (snap is null) return NotFound(new { message = "Version not found" });

        var widgets = ParseWidgets(snap.LayoutJson);
        await _db.Widgets.Where(w => w.DashboardId == id).ExecuteDeleteAsync();
        foreach (var w in widgets)
        {
            _db.Widgets.Add(new Widget
            {
                DashboardId = id,
                Type = w.Type,
                Title = w.Title,
                X = w.X, Y = w.Y, W = w.W, H = w.H,
                BindingJson = w.Binding?.GetRawText() ?? "{}",
                OptionsJson = w.Options?.GetRawText() ?? "{}",
            });
        }
        d.Version += 1;
        d.UpdatedUtc = DateTimeOffset.UtcNow;
        _db.DashboardVersions.Add(new DashboardVersion
        {
            DashboardId = d.Id,
            Version = d.Version,
            LayoutJson = snap.LayoutJson,
            IsAutosave = false,
        });
        await _db.SaveChangesAsync();
        await _db.Entry(d).Collection(x => x.Widgets).LoadAsync();
        await _audit.LogAsync("dashboard.rollback", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Dashboard), entityId: d.Id.ToString(), details: new { restoredFrom = version });
        return Ok(ToDto(d));
    }

    /// <summary>Saves the current dashboard layout as a reusable (user) template.</summary>
    [HttpPost("{id:guid}/save-as-template")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<ActionResult<TemplateDto>> SaveAsTemplate(Guid id, [FromBody] SaveAsTemplateRequest req)
    {
        var d = await _db.Dashboards.Include(x => x.Widgets).FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Template name is required" });

        // Widgets bind by source+field (not hard IDs), so they re-bind to the target
        // line/machine automatically when the template is applied.
        var layout = d.Widgets
            .OrderBy(w => w.Y).ThenBy(w => w.X)
            .Select(w => new SaveWidget(w.Type, w.Title, w.X, w.Y, w.W, w.H, Parse(w.BindingJson), Parse(w.OptionsJson)))
            .ToList();

        var tpl = new DashboardTemplate
        {
            Name = req.Name.Trim(),
            Category = string.IsNullOrWhiteSpace(req.Category) ? "Custom" : req.Category!.Trim(),
            Description = req.Description?.Trim(),
            IsSystem = false,
            LayoutJson = JsonSerializer.Serialize(layout),
        };
        _db.DashboardTemplates.Add(tpl);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("dashboard.save-as-template", User.GetUserId(), User.GetUserName(),
            entityType: nameof(DashboardTemplate), entityId: tpl.Id.ToString(), details: new { tpl.Name });
        return Ok(new TemplateDto(tpl.Id, tpl.Name, tpl.Category, tpl.Description, tpl.LayoutJson, CountLayoutWidgets(tpl.LayoutJson)));
    }

    /// <summary>
    /// Anonymous list of published kiosk dashboards for the login display picker.
    /// </summary>
    [HttpGet("kiosk-list")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<KioskListItemDto>>> KioskList(CancellationToken ct)
    {
        var dashboards = await _db.Dashboards.AsNoTracking()
            .Where(d => d.Scope == DashboardScope.PublicKiosk && d.IsPublished && d.LineId != null)
            .OrderBy(d => d.Name)
            .Select(d => new { d.Id, d.Name, d.LineId })
            .ToListAsync(ct);

        var lineIds = dashboards.Select(d => d.LineId!.Value).Distinct().ToList();
        var lineNames = await _db.Lines.AsNoTracking()
            .Where(l => lineIds.Contains(l.Id))
            .ToDictionaryAsync(l => l.Id, l => l.Name, ct);

        var items = dashboards.Select(d => new KioskListItemDto(
            d.Id,
            d.Name,
            d.LineId!.Value,
            lineNames.GetValueOrDefault(d.LineId.Value, "Line"))).ToList();

        return Ok(items);
    }

    public record KioskListItemDto(Guid Id, string Name, Guid LineId, string LineName);

    /// <summary>
    /// Establishes a signed kiosk session (httpOnly cookie) for wall displays.
    /// </summary>
    [HttpPost("kiosk/{id:guid}/session")]
    [AllowAnonymous]
    public async Task<IActionResult> KioskSession(Guid id, CancellationToken ct)
    {
        var d = await _db.Dashboards.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (d is null || d.Scope != DashboardScope.PublicKiosk || !d.IsPublished || d.LineId is null)
            return NotFound();

        var token = _kioskTokens.CreateToken(d.Id, d.LineId.Value);
        Response.Cookies.Append(_security.KioskCookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = "/",
            MaxAge = TimeSpan.FromHours(_security.KioskTokenHours),
        });
        return NoContent();
    }

    /// <summary>
    /// Anonymous kiosk endpoint: returns a dashboard only if it is published and scoped
    /// PublicKiosk, so wall displays can render without a login (see docs/11 kiosk mode).
    /// </summary>
    [HttpGet("kiosk/{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<DashboardDto>> Kiosk(Guid id)
    {
        if (!ValidateKioskAccess(id))
            return Unauthorized(new { message = "Kiosk session required. POST /api/dashboards/kiosk/{id}/session first." });

        var d = await _db.Dashboards.Include(x => x.Widgets).FirstOrDefaultAsync(x => x.Id == id);
        if (d is null || d.Scope != DashboardScope.PublicKiosk || !d.IsPublished)
            return NotFound();
        if (d.LineId is null)
            return BadRequest(new { message = "Kiosk dashboard is not bound to a line." });
        return Ok(ToDto(d));
    }

    /// <summary>
    /// Anonymous live snapshots scoped to a kiosk dashboard's line so wall displays can
    /// render real-time values without a login. Validates the dashboard is a published
    /// kiosk before exposing any data.
    /// </summary>
    [HttpGet("kiosk/{id:guid}/live")]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<MachineSnapshot>>> KioskLive(Guid id)
    {
        if (!ValidateKioskAccess(id))
            return Unauthorized(new { message = "Kiosk session required." });

        var d = await _db.Dashboards.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
        if (d is null || d.Scope != DashboardScope.PublicKiosk || !d.IsPublished)
            return NotFound();
        if (d.LineId is null)
            return BadRequest(new { message = "Kiosk dashboard is not bound to a line." });
        var snaps = _cache.ForLine(d.LineId.Value);
        return Ok(snaps);
    }

    private bool ValidateKioskAccess(Guid dashboardId)
    {
        var token = Request.Cookies[_security.KioskCookieName];
        return _kioskTokens.TryValidate(token, dashboardId, out _);
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.BuildDashboards)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var d = await _db.Dashboards.FirstOrDefaultAsync(x => x.Id == id);
        if (d is null) return NotFound();

        // Supervisors may delete only their own dashboards; admins may delete any.
        if (!User.IsInRole(RoleNames.Admin) && d.OwnerUserId != User.GetUserId())
            return Forbid();

        _db.Dashboards.Remove(d);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("dashboard.delete", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Dashboard), entityId: id.ToString());
        return NoContent();
    }

    private static void ApplyWidgets(Dashboard d, List<SaveWidget>? widgets)
    {
        foreach (var entity in BuildWidgetEntities(d.Id, widgets ?? new()))
            d.Widgets.Add(entity);
    }

    private static List<Widget> BuildWidgetEntities(Guid dashboardId, List<SaveWidget> widgets)
    {
        var knownIds = new HashSet<Guid>();
        foreach (var w in widgets)
        {
            if (w.Id is { } id && id != Guid.Empty)
                knownIds.Add(id);
        }

        return widgets.Select(w =>
        {
            Guid? parentId = w.ParentId;
            if (parentId is { } pid && !knownIds.Contains(pid))
                parentId = null;

            var entity = new Widget
            {
                DashboardId = dashboardId,
                Type = w.Type,
                Title = w.Title,
                X = w.X,
                Y = w.Y,
                W = w.W,
                H = w.H,
                ParentId = parentId,
                TabKey = string.IsNullOrWhiteSpace(w.TabKey) ? null : w.TabKey.Trim(),
                BindingJson = w.Binding?.GetRawText() ?? "{}",
                OptionsJson = w.Options?.GetRawText() ?? "{}",
            };
            if (w.Id is { } preserveId && preserveId != Guid.Empty)
                entity.Id = preserveId;
            return entity;
        }).ToList();
    }

    private static DashboardDto ToDto(Dashboard d)
    {
        var idSet = d.Widgets.Select(w => w.Id).ToHashSet();
        return new(
            d.Id, d.Name, d.Scope.ToString(), d.IsPublished, d.Version, d.PlantId, d.LineId, d.MachineId,
            d.Widgets.OrderBy(w => w.Y).ThenBy(w => w.X).Select(w => new WidgetDto(
                w.Id, w.Type, w.Title, w.X, w.Y, w.W, w.H,
                Parse(w.BindingJson), Parse(w.OptionsJson),
                w.ParentId is { } p && idSet.Contains(p) ? p : null,
                w.TabKey)).ToList());
    }

    private static JsonElement Parse(string json)
    {
        try { return JsonDocument.Parse(string.IsNullOrWhiteSpace(json) ? "{}" : json).RootElement.Clone(); }
        catch { return JsonDocument.Parse("{}").RootElement.Clone(); }
    }

    private static int CountLayoutWidgets(string layoutJson)
    {
        try
        {
            var widgets = JsonSerializer.Deserialize<List<SaveWidget>>(layoutJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            return widgets?.Count(w => !string.Equals(w.Type, "text-label", StringComparison.OrdinalIgnoreCase)) ?? 0;
        }
        catch
        {
            return 0;
        }
    }

    private static List<SaveWidget> ParseWidgets(string layoutJson)
    {
        try
        {
            return JsonSerializer.Deserialize<List<SaveWidget>>(layoutJson,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? new();
        }
        catch { return new(); }
    }
}
