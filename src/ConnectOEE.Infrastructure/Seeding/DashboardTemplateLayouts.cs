using System.Text.Json;
using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ConnectOEE.Infrastructure.Seeding;

/// <summary>Built-in dashboard template widget layouts (v8 — fresh curated catalog, wall visual language).</summary>
public static class DashboardTemplateLayouts
{
    private static object W(
        string type,
        string? title,
        int x,
        int y,
        int w,
        int h,
        object? binding = null,
        object? options = null,
        string? id = null,
        string? parentId = null,
        string? tabKey = null)
        => new
        {
            id,
            type,
            title,
            x,
            y,
            w,
            h,
            parentId,
            tabKey,
            binding = binding ?? new { },
            options = options ?? new { },
        };

    public static IReadOnlyList<DashboardTemplate> All => new List<DashboardTemplate>
    {
        // --- Kiosk / wall (1080p, fill kioskWall 8 rows) ---

        T("Operator Floor", "Kiosk",
            "Identity strip, nested KPI section, run state, pace, downtime pad — operator wall with nesting",
            [
                W("shift-context-strip", "Shift", 0, 0, 6, 1, new { source = "machine" }),
                W("clock-date", "Clock", 6, 0, 3, 1, new { }),
                W("connection-stale", "Link", 9, 0, 3, 1, new { source = "machine" }),
                W("container-panel", "Live KPIs", 0, 1, 12, 3, new { }, new { title = "Live KPIs" }, id: "a1000000-0000-4000-8000-000000000001"),
                W("oee-hero", "OEE", 0, 0, 5, 3, new { source = "machine", field = "oeePct" }, new { frameVariant = "kiosk", presentation = "ring" }, parentId: "a1000000-0000-4000-8000-000000000001"),
                W("run-state-badge", "Run State", 5, 0, 3, 3, new { source = "machine" }, new { frameVariant = "kiosk" }, parentId: "a1000000-0000-4000-8000-000000000001"),
                W("pace-gauge", "Pace", 8, 0, 4, 3, new { source = "machine" }, new { target = 5500, frameVariant = "kiosk" }, parentId: "a1000000-0000-4000-8000-000000000001"),
                W("count-to-go", "Count to Go", 0, 4, 4, 1, new { source = "machine" }),
                W("attainment-tile", "Attainment", 4, 4, 4, 1, new { source = "machine" }),
                W("recipe-product-strip", "Product", 8, 4, 4, 1, new { source = "machine" }),
                W("active-downtime-timer", "Active Downtime", 0, 5, 6, 1, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("fault-banner", "Fault", 6, 5, 6, 1, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("operator-downtime-pad", "Downtime Entry", 0, 6, 8, 2, new { source = "line" }, new { frameVariant = "kiosk" }),
                W("fault-ack-button", "Ack Fault", 8, 6, 4, 2, new { source = "machine" }, new { frameVariant = "kiosk" }),
            ]),

        T("Line Andon", "Kiosk",
            "Identity strip, Andon + nested OEE cluster, line status — andon wall with nesting",
            [
                W("shift-context-strip", "Shift", 0, 0, 6, 1, new { source = "line" }),
                W("clock-date", "Clock", 6, 0, 3, 1, new { }),
                W("connection-stale", "Link", 9, 0, 3, 1, new { source = "line" }),
                W("andon-stack", "Andon", 0, 1, 5, 4, new { source = "machine" }, new { frameVariant = "kiosk", statusStyle = "tower" }),
                W("container-panel", "OEE Cluster", 5, 1, 7, 4, new { }, new { title = "OEE" }, id: "a1000000-0000-4000-8000-000000000002"),
                W("oee-hero", "OEE", 0, 0, 7, 3, new { source = "machine", field = "oeePct" }, new { frameVariant = "kiosk", presentation = "ring" }, parentId: "a1000000-0000-4000-8000-000000000002"),
                W("apq-cluster", "A/P/Q", 0, 3, 7, 1, new { source = "machine" }, new { }, parentId: "a1000000-0000-4000-8000-000000000002"),
                W("active-downtime-timer", "Active Downtime", 0, 5, 6, 1, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("fault-banner", "Fault", 6, 5, 6, 1, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("line-status-strip", "Line Status", 0, 6, 12, 1, new { source = "line" }),
                W("unassigned-stops-banner", "Unassigned", 0, 7, 12, 1, new { source = "line" }),
            ]),

        T("Maintenance Wall", "Kiosk",
            "Identity, MTTR/MTBF/stops, unassigned stops, reliability trend — maintenance walk wall",
            [
                W("clock-date", "Clock", 0, 0, 4, 1, new { }),
                W("connection-stale", "Link", 4, 0, 4, 1, new { source = "plant" }),
                W("shift-context-strip", "Shift", 8, 0, 4, 1, new { source = "plant" }),
                W("mttr-tile", "MTTR", 0, 1, 3, 2, new { source = "plant" }, new { presentation = "bar", frameVariant = "kiosk" }),
                W("mtbf-tile", "MTBF", 3, 1, 3, 2, new { source = "plant" }, new { presentation = "bar", frameVariant = "kiosk" }),
                W("stops-per-hour", "Stops / Hour", 6, 1, 3, 2, new { source = "plant" }, new { presentation = "number", frameVariant = "kiosk" }),
                W("failure-rate", "Failure Rate", 9, 1, 3, 2, new { source = "plant" }, new { presentation = "number", frameVariant = "kiosk" }),
                W("unassigned-stops-banner", "Unassigned Stops", 0, 3, 12, 2, new { source = "plant" }),
                W("reliability-trend", "Reliability Trend", 0, 5, 8, 3, new { source = "plant" }),
                W("pareto", "Loss Pareto", 8, 5, 4, 3, new { source = "plant" }),
            ]),

        // --- Plant / signed-in wall ---

        T("Plant Overview", "Plant",
            "Plant hero, line status, plant grid, leaderboard — multi-line leadership wall",
            [
                W("plant-summary-hero", "Plant KPIs", 0, 0, 12, 2, new { source = "plant" }, new { frameVariant = "hero" }),
                W("line-status-strip", "Line Status", 0, 2, 12, 1, new { source = "plant" }),
                W("gap-cluster", "Gap vs Target", 0, 3, 6, 2, new { source = "plant" }),
                W("kpi-tile-group", "A / P / Q", 6, 3, 6, 2, new { source = "plant" }, new { fields = new[] { "oeePct", "availabilityPct", "performancePct", "qualityPct" } }),
                W("plant-grid", "Lines", 0, 5, 8, 4, new { source = "plant" }),
                W("line-leaderboard", "OEE Ranking", 8, 5, 4, 4, new { source = "plant" }),
            ]),

        T("Shift Supervisor", "Shift",
            "Shift progress, losses, reason queue, production vs target — supervisor huddle board",
            [
                W("shift-context-strip", "Shift", 0, 0, 8, 1, new { source = "line" }),
                W("connection-stale", "Link", 8, 0, 4, 1, new { source = "line" }),
                W("shift-summary", "Current Shift", 0, 1, 4, 2, new { source = "line" }),
                W("shift-progress-bar", "Shift Progress", 4, 1, 4, 2, new { source = "machine" }),
                W("kpi-tile-group", "Line KPIs", 8, 1, 4, 2, new { source = "line" }, new { fields = new[] { "oeePct", "availabilityPct", "performancePct", "qualityPct" } }),
                W("production-vs-target", "Production vs Target", 0, 3, 7, 3, new { source = "line" }),
                W("pareto", "Downtime Pareto", 7, 3, 5, 3, new { source = "line" }),
                W("unassigned-stops-banner", "Reason Queue", 0, 6, 5, 2, new { source = "line" }),
                W("operator-downtime-pad", "Downtime Entry", 5, 6, 7, 2, new { source = "line" }),
            ]),

        T("Quality Pulse", "Analysis",
            "Scrap / FPY / yield focus with scrap trend and quality pareto",
            [
                W("scrap-tile", "Scrap %", 0, 0, 3, 2, new { source = "line", field = "scrapPct" }, new { presentation = "ring" }),
                W("yield-tile", "Yield %", 3, 0, 3, 2, new { source = "line", field = "yieldPct" }, new { presentation = "ring" }),
                W("fpy-tile", "FPY %", 6, 0, 3, 2, new { source = "line", field = "fpyPct" }, new { presentation = "ring" }),
                W("kpi-stat-card", "Reject", 9, 0, 3, 2, new { source = "line", field = "rejectCount" }, new { kind = "number", tone = "bad", presentation = "number" }),
                W("scrap-trend", "Scrap Trend", 0, 2, 7, 3, new { source = "line" }),
                W("losses-donut", "Six Big Losses", 7, 2, 5, 3, new { source = "line" }),
                W("pareto", "Quality Loss Pareto", 0, 5, 12, 3, new { source = "line" }),
            ]),

        T("Production Board", "Production",
            "Counts, pace, product, hourly production — production floor board",
            [
                W("recipe-product-strip", "Product", 0, 0, 8, 1, new { source = "machine" }),
                W("shift-context-strip", "Shift", 8, 0, 4, 1, new { source = "line" }),
                W("pace-gauge", "Pace", 0, 1, 4, 3, new { source = "line" }, new { target = 5500 }),
                W("attainment-tile", "Attainment", 4, 1, 4, 3, new { source = "line" }),
                W("gap-cluster", "Gap vs Target", 8, 1, 4, 3, new { source = "line" }),
                W("production-vs-target", "Production vs Target", 0, 4, 7, 2, new { source = "line" }),
                W("count-to-go", "Count to Go", 7, 4, 5, 2, new { source = "line" }),
                W("hourly-production-bar", "Hourly Production", 0, 6, 12, 2, new { source = "line" }),
            ]),

        T("Analytics Starter", "Analysis",
            "Chart-heavy starter for signed-in analysis — OEE trend, losses, reliability",
            [
                W("kpi-tile-group", "Plant KPIs", 0, 0, 12, 2, new { source = "plant" }, new { fields = new[] { "oeePct", "availabilityPct", "performancePct", "qualityPct" } }),
                W("multi-trend", "OEE Trend", 0, 2, 7, 3, new { source = "plant", field = "oeePct" }),
                W("losses-donut", "Six Big Losses", 7, 2, 5, 3, new { source = "plant" }),
                W("reliability-trend", "Reliability", 0, 5, 6, 3, new { source = "plant" }),
                W("pareto", "Loss Pareto", 6, 5, 6, 3, new { source = "plant" }),
            ]),
    };

    private static DashboardTemplate T(string name, string category, string description, object[] widgets)
        => new()
        {
            Name = name,
            Category = category,
            Description = description,
            IsSystem = true,
            LayoutJson = JsonSerializer.Serialize(widgets),
        };

    public static async Task UpsertAsync(ConnectOeeDbContext db, ILogger? logger = null, CancellationToken ct = default)
    {
        var existing = await db.DashboardTemplates.ToListAsync(ct);
        var keepNames = new HashSet<string>(All.Select(t => t.Name), StringComparer.OrdinalIgnoreCase);
        var byName = existing.ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);
        var added = 0;
        var updated = 0;
        var removed = 0;

        // Retire any system template not in the current catalog (blow up v7.2 + older).
        foreach (var row in existing.Where(t => t.IsSystem && !keepNames.Contains(t.Name)).ToList())
        {
            db.DashboardTemplates.Remove(row);
            byName.Remove(row.Name);
            removed++;
        }

        foreach (var tpl in All)
        {
            if (byName.TryGetValue(tpl.Name, out var row))
            {
                row.Category = tpl.Category;
                row.Description = tpl.Description;
                row.LayoutJson = tpl.LayoutJson;
                row.IsSystem = true;
                row.UpdatedUtc = DateTimeOffset.UtcNow;
                updated++;
            }
            else
            {
                db.DashboardTemplates.Add(new DashboardTemplate
                {
                    Name = tpl.Name,
                    Category = tpl.Category,
                    Description = tpl.Description,
                    IsSystem = true,
                    LayoutJson = tpl.LayoutJson,
                });
                added++;
            }
        }

        if (added > 0 || updated > 0 || removed > 0)
        {
            await db.SaveChangesAsync(ct);
            logger?.LogInformation(
                "Dashboard templates upserted: {Added} added, {Updated} updated, {Removed} retired removed",
                added, updated, removed);
        }
    }

    public static string? GetLayoutJsonByName(string templateName)
        => All.FirstOrDefault(t => t.Name.Equals(templateName, StringComparison.OrdinalIgnoreCase))?.LayoutJson;

    /// <summary>Map dashboard / legacy names onto the v8 catalog.</summary>
    public static string? ResolveTemplateName(string dashboardName)
    {
        if (All.Any(t => t.Name.Equals(dashboardName, StringComparison.OrdinalIgnoreCase)))
            return dashboardName;

        var legacyFullName = dashboardName switch
        {
            "Line Overview" or "Line Performance Board" => "Shift Supervisor",
            "Machine Detail" or "Machine Station Detail" => "Production Board",
            "Plant Overview" or "Plant Command Center" or "Floor At-a-Glance" => "Plant Overview",
            "Multi-Line Overview" => "Plant Overview",
            "Shift Summary" or "Shift Huddle Board" or "Shift Compare" => "Shift Supervisor",
            "Downtime Analysis" or "Downtime Detective" => "Shift Supervisor",
            "Maintenance / Fault Focus" or "Plant Reliability Hub" or "Maintenance Wallboard" => "Maintenance Wall",
            "Executive Summary" or "Executive Briefing" or "TEEP Utilization" or "TEEP & Utilization" => "Plant Overview",
            "Operator Station" or "Operator Kiosk" => "Operator Floor",
            "Andon / Big Screen" or "Line Andon Wall" => "Line Andon",
            "Production Analysis" or "Production & Pace" or "Attainment Tracker" => "Production Board",
            "Quality / Yield Analysis" or "Quality & Yield Lab" => "Quality Pulse",
            "Supervisor Station" or "Supervisor Cockpit" => "Shift Supervisor",
            "Setup & Changeover" => "Shift Supervisor",
            "Analytics Starter" => "Analytics Starter",
            _ => null,
        };
        if (legacyFullName is not null)
            return legacyFullName;

        // Wizard names use " — " (em dash); tolerate ASCII " - " as well.
        string? suffix = null;
        const string sepEm = " — ";
        const string sepAscii = " - ";
        var idxEm = dashboardName.LastIndexOf(sepEm, StringComparison.Ordinal);
        var idxAscii = dashboardName.LastIndexOf(sepAscii, StringComparison.Ordinal);
        if (idxEm >= 0)
            suffix = dashboardName[(idxEm + sepEm.Length)..];
        else if (idxAscii >= 0)
            suffix = dashboardName[(idxAscii + sepAscii.Length)..];
        if (suffix is null) return null;
        return suffix switch
        {
            "Overview" or "Supervisor" or "Shift" or "Downtime" or "Setup" or "Shift Compare" => "Shift Supervisor",
            "Detail" => "Production Board",
            "Operator Kiosk" or "Operator Floor" => "Operator Floor",
            "Production" or "Attainment" => "Production Board",
            "Quality" => "Quality Pulse",
            "Andon" => "Line Andon",
            "Maintenance Board" => "Maintenance Wall",
            _ => null,
        };
    }

    /// <summary>Infers display category from dashboard name suffix or built-in template match.</summary>
    public static string InferCategory(string dashboardName, DashboardScope scope)
    {
        if (scope == DashboardScope.PublicKiosk) return "Kiosk";

        var exact = All.FirstOrDefault(t => t.Name.Equals(dashboardName, StringComparison.OrdinalIgnoreCase));
        if (exact is not null) return exact.Category;

        string? suffix = null;
        const string sepEm = " — ";
        const string sepAscii = " - ";
        var idxEm = dashboardName.LastIndexOf(sepEm, StringComparison.Ordinal);
        var idxAscii = dashboardName.LastIndexOf(sepAscii, StringComparison.Ordinal);
        if (idxEm >= 0)
            suffix = dashboardName[(idxEm + sepEm.Length)..];
        else if (idxAscii >= 0)
            suffix = dashboardName[(idxAscii + sepAscii.Length)..];
        if (suffix is null) return "General";

        return suffix switch
        {
            "Overview" or "Supervisor" => "Shift",
            "Shift" or "Shift Compare" => "Shift",
            "Detail" => "Production",
            "Operator Floor" or "Operator Kiosk" => "Kiosk",
            "Downtime" or "Quality" or "Setup" => "Analysis",
            "Production" or "Attainment" => "Production",
            "Andon" or "Maintenance Board" => "Kiosk",
            _ => "General",
        };
    }
}
