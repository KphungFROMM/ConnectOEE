using System.Text.Json;

using ConnectOEE.Core;
using ConnectOEE.Core.Entities;

using Microsoft.EntityFrameworkCore;

using Microsoft.Extensions.Logging;

namespace ConnectOEE.Infrastructure.Seeding;

/// <summary>Built-in dashboard template widget layouts (v7.1 — wall-fit, no scroll on 1080p).</summary>
public static class DashboardTemplateLayouts
{
    private static readonly string[] V6RetiredNames =
    [
        "Line Overview",
        "Machine Detail",
        "Plant Overview",
        "Multi-Line Overview",
        "Shift Summary",
        "Downtime Analysis",
        "Maintenance / Fault Focus",
        "Executive Summary",
        "Operator Station",
        "Andon / Big Screen",
        "Production Analysis",
        "Quality / Yield Analysis",
        "Supervisor Station",
        "Setup & Changeover",
        "TEEP Utilization",
        "Maintenance Wallboard",
    ];

    private static object W(string type, string? title, int x, int y, int w, int h, object? binding = null, object? options = null)
        => new { type, title, x, y, w, h, binding = binding ?? new { }, options = options ?? new { } };

    private static object L(string content, int y)
        => W("text-label", null, 0, y, 12, 1, null, new { content, fontSize = "sm", align = "left" });

    private static object Logo(int x, int y, int w = 2, int h = 2)
        => W("image-logo", "ConnectOEE", x, y, w, h, null, new { url = "/app-icon.png", alt = "ConnectOEE" });

    public static IReadOnlyList<DashboardTemplate> All => new List<DashboardTemplate>
    {
        T("Plant Command Center", "Plant",
            "Plant hero, line status strip, gap cluster, andon, TEEP/uptime, plant grid, OEE leaderboard — wall-fit 1080p",
            [
                W("plant-summary-hero", "Plant KPIs", 0, 0, 10, 2, new { source = "plant" }, new { frameVariant = "hero" }),
                W("oee-traffic-light", "Plant OEE", 10, 0, 2, 2, new { source = "plant" }, new { greenThreshold = 85, amberThreshold = 65 }),
                W("line-status-strip", "Line Status", 0, 2, 12, 1, new { source = "plant" }),
                W("gap-cluster", "Gap vs Target", 0, 3, 6, 2, new { source = "plant" }),
                W("andon-stack", "Plant Andon", 6, 3, 2, 2, new { source = "plant" }, new { frameVariant = "kiosk" }),
                W("kpi-stat-card", "TEEP", 8, 3, 2, 2, new { source = "plant", field = "teepPct" }, new { kind = "percent" }),
                W("kpi-stat-card", "Uptime", 10, 3, 2, 2, new { source = "plant", field = "uptimeMin" }, new { kind = "number", unit = "min" }),
                W("plant-grid", "Lines", 0, 5, 8, 4, new { source = "plant" }),
                W("line-leaderboard", "OEE Ranking", 8, 5, 4, 4, new { source = "plant" }),
            ]),

        T("Executive Briefing", "Executive",
            "Executive plant hero, gap cluster, traffic light, TEEP, KPI roll-up, production vs target, line leaderboard — wall-fit 1080p",
            [
                W("plant-summary-hero", "Executive KPIs", 0, 0, 12, 2, new { source = "plant" }, new { frameVariant = "hero" }),
                W("gap-cluster", "Gap vs Target", 0, 2, 8, 2, new { source = "plant" }),
                W("oee-traffic-light", "Plant OEE", 8, 2, 2, 2, new { source = "plant" }, new { greenThreshold = 85, amberThreshold = 65 }),
                W("teep-tile", "TEEP", 10, 2, 2, 2, new { source = "plant" }),
                W("kpi-tile-group", "Plant KPIs", 0, 4, 12, 2, new { source = "plant" }, new { fields = new[] { "oeePct", "availabilityPct", "performancePct", "qualityPct" } }),
                W("production-vs-target", "Production vs Target", 0, 6, 7, 3, new { source = "plant" }),
                W("line-leaderboard", "Line Ranking", 7, 6, 5, 3, new { source = "plant" }),
            ]),

        T("Floor At-a-Glance", "Plant",
            "Plant hero, andon, line status strip, all-machines grid — floor-wide visibility, wall-fit 1080p",
            [
                W("plant-summary-hero", "Plant KPIs", 0, 0, 10, 2, new { source = "plant" }, new { frameVariant = "hero" }),
                W("andon-stack", "Plant Andon", 10, 0, 2, 2, new { source = "plant" }, new { frameVariant = "kiosk" }),
                W("line-status-strip", "Line Status", 0, 2, 12, 1, new { source = "plant" }),
                W("machine-grid", "All Machines", 0, 3, 12, 6, new { source = "plant" }, new { groupByLine = true, sortBy = "name", frameVariant = "compact" }),
            ]),

        T("Plant Reliability Hub", "Analysis",
            "MTTR/MTBF/stops/failure/downtime KPIs, active timer, unassigned stops, reliability trend, loss pareto — wall-fit 1080p",
            [
                W("mttr-tile", "MTTR", 0, 0, 2, 2, new { source = "plant" }),
                W("mtbf-tile", "MTBF", 2, 0, 2, 2, new { source = "plant" }),
                W("stops-per-hour", "Stops / Hour", 4, 0, 2, 2, new { source = "plant" }),
                W("failure-rate", "Failure Rate", 6, 0, 2, 2, new { source = "plant" }),
                W("kpi-stat-card", "Downtime", 8, 0, 2, 2, new { source = "plant", field = "downtimeMin" }, new { kind = "number", unit = "min" }),
                W("kpi-stat-card", "Uptime", 10, 0, 2, 2, new { source = "plant", field = "uptimeMin" }, new { kind = "number", unit = "min" }),
                W("active-downtime-timer", "Active Downtime", 0, 2, 4, 2, new { source = "plant" }),
                W("unassigned-stops-banner", "Unassigned Stops", 4, 2, 8, 2, new { source = "plant" }),
                W("reliability-trend", "Reliability Trend", 0, 4, 8, 3, new { source = "plant" }),
                W("pareto", "Loss Pareto", 8, 4, 4, 3, new { source = "plant" }),
            ]),

        T("TEEP & Utilization", "Executive",
            "TEEP tile, time balance, OEE by shift, loss trend, hourly production — compact 6-row wall-fit",
            [
                W("teep-tile", "TEEP", 0, 0, 4, 3, new { source = "plant" }),
                W("time-balance", "Time Balance", 4, 0, 4, 3, new { source = "plant" }),
                W("oee-by-shift", "OEE by Shift", 8, 0, 4, 3, new { source = "plant" }),
                W("loss-trend", "Loss Trend", 0, 3, 6, 3, new { source = "plant" }),
                W("hourly-production-bar", "Hourly Production", 6, 3, 6, 3, new { source = "plant" }),
            ]),

        T("Line Performance Board", "Line",
            "OEE hero, gap cluster, attainment, A/P/Q KPI group, state timeline, multi-trend — wall-fit 7 rows",
            [
                W("oee-hero", "OEE", 0, 0, 6, 2, new { source = "machine", field = "oeePct" }, new { frameVariant = "hero" }),
                W("gap-cluster", "Gap vs Target", 6, 0, 6, 2, new { source = "line" }),
                W("attainment-tile", "Attainment", 0, 2, 4, 2, new { source = "line" }),
                W("kpi-tile-group", "A / P / Q", 4, 2, 8, 2, new { source = "machine" }, new { fields = new[] { "availabilityPct", "performancePct", "qualityPct" } }),
                W("state-timeline", "State Timeline", 0, 4, 7, 3, new { source = "machine" }),
                W("multi-trend", "OEE Trend", 7, 4, 5, 3, new { source = "line", field = "oeePct" }),
            ]),

        T("Shift Huddle Board", "Shift",
            "Shift summary, pace gauge, shift progress, hourly production, downtime pareto — compact 6-row wall-fit",
            [
                W("shift-summary", "Current Shift", 0, 0, 4, 3, new { source = "line" }),
                W("pace-gauge", "Pace", 4, 0, 4, 3, new { source = "line" }, new { target = 5500 }),
                W("shift-progress-bar", "Shift Progress", 8, 0, 4, 3, new { source = "machine" }),
                W("hourly-production-bar", "Hourly Production", 0, 3, 8, 3, new { source = "line" }),
                W("pareto", "Downtime Pareto", 8, 3, 4, 3, new { source = "line" }),
            ]),

        T("Machine Station Detail", "Machine",
            "Run state, recipe strip, speed trend, reliability cluster, fault banner, event feed — wall-fit 7 rows",
            [
                W("run-state-badge", "Run State", 0, 0, 3, 2, new { source = "machine" }),
                W("recipe-product-strip", "Recipe / Product", 3, 0, 9, 2, new { source = "machine" }),
                W("speed-trend", "Speed Trend", 0, 2, 6, 3, new { source = "machine", field = "speed" }),
                W("reliability-cluster", "Reliability", 6, 2, 6, 3, new { source = "machine" }),
                W("fault-banner", "Active Fault", 0, 5, 6, 2, new { source = "machine" }),
                W("event-feed", "Recent Stops", 6, 5, 6, 2, new { source = "line" }),
            ]),

        T("Production & Pace", "Analysis",
            "Production vs target, hourly bars, takt vs actual, rate variance — wall-fit 8 rows",
            [
                W("production-vs-target", "Production vs Target", 0, 0, 12, 3, new { source = "line" }),
                W("hourly-production-bar", "Hourly Production", 0, 3, 7, 3, new { source = "line" }),
                W("takt-vs-actual", "Takt vs Actual", 7, 3, 5, 3, new { source = "line" }),
                W("rate-variance", "Rate Variance", 0, 6, 12, 2, new { source = "line" }),
            ]),

        T("Quality & Yield Lab", "Analysis",
            "Scrap/yield/FPY/good/reject KPIs, scrap trend, Six Big Losses donut, quality pareto — wall-fit 8 rows",
            [
                W("scrap-tile", "Scrap %", 0, 0, 2, 2, new { source = "line", field = "scrapPct" }),
                W("yield-tile", "Yield %", 2, 0, 2, 2, new { source = "line", field = "yieldPct" }),
                W("fpy-tile", "FPY %", 4, 0, 2, 2, new { source = "line", field = "fpyPct" }),
                W("kpi-stat-card", "Good", 6, 0, 2, 2, new { source = "line", field = "goodCount" }, new { kind = "number" }),
                W("kpi-stat-card", "Reject", 8, 0, 2, 2, new { source = "line", field = "rejectCount" }, new { kind = "number", tone = "bad" }),
                W("kpi-stat-card", "Rework", 10, 0, 2, 2, new { source = "line", field = "reworkCount" }, new { kind = "number" }),
                W("scrap-trend", "Scrap Trend", 0, 2, 6, 3, new { source = "line" }),
                W("losses-donut", "Six Big Losses", 6, 2, 6, 3, new { source = "line" }),
                W("pareto", "Quality Loss Pareto", 0, 5, 12, 3, new { source = "line" }),
            ]),

        T("Downtime Detective", "Analysis",
            "Active downtime timer, unassigned stops, pareto, heatmap, event feed — wall-fit 8 rows",
            [
                W("active-downtime-timer", "Active Downtime", 0, 0, 4, 2, new { source = "line" }),
                W("unassigned-stops-banner", "Unassigned Stops", 4, 0, 8, 2, new { source = "line" }),
                W("pareto", "Downtime Pareto", 0, 2, 6, 4, new { source = "line" }),
                W("downtime-heatmap", "Downtime Heatmap", 6, 2, 6, 4, new { source = "line" }),
                W("event-feed", "Event List", 0, 6, 12, 2, new { source = "line" }),
            ]),

        T("Setup & Changeover", "Analysis",
            "State distribution, state timeline, setup pareto — compact 6-row wall-fit",
            [
                W("state-distribution", "State Mix", 0, 0, 6, 3, new { source = "line" }),
                W("state-timeline", "State Timeline", 6, 0, 6, 3, new { source = "machine" }),
                W("pareto", "Setup Pareto", 0, 3, 12, 3, new { source = "line" }),
            ]),

        T("Supervisor Cockpit", "Line",
            "Line KPI group, unassigned stops, downtime pad, top-N table, worst lines — compact 6-row wall-fit",
            [
                W("kpi-tile-group", "Line KPIs", 0, 0, 8, 2, new { source = "line" }, new { fields = new[] { "oeePct", "availabilityPct", "performancePct", "qualityPct" } }),
                W("unassigned-stops-banner", "Unassigned Stops", 8, 0, 4, 2, new { source = "line" }),
                W("operator-downtime-pad", "Downtime Entry", 0, 2, 5, 4, new { source = "line" }),
                W("top-n-table", "Top Lines by OEE", 5, 2, 4, 4, new { source = "plant", field = "oeePct" }, new { limit = 8 }),
                W("worst-lines", "Needs Attention", 9, 2, 3, 4, new { source = "plant" }),
            ]),

        T("Operator Kiosk", "Kiosk",
            "OEE hero, pace gauge, traffic light, shift context, active downtime timer, downtime pad — kiosk wall-fit 7 rows",
            [
                W("oee-hero", "OEE", 0, 0, 5, 2, new { source = "machine", field = "oeePct" }, new { frameVariant = "kiosk" }),
                W("pace-gauge", "Pace", 5, 0, 4, 2, new { source = "machine" }, new { target = 5500, frameVariant = "kiosk" }),
                W("oee-traffic-light", "OEE Light", 9, 0, 3, 2, new { source = "machine" }, new { greenThreshold = 85, amberThreshold = 65, frameVariant = "kiosk" }),
                W("shift-context-strip", "Shift Context", 0, 2, 12, 1, new { source = "line" }),
                W("active-downtime-timer", "Active Downtime", 0, 3, 5, 2, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("operator-downtime-pad", "Downtime Entry", 0, 5, 12, 2, new { source = "line" }, new { frameVariant = "kiosk" }),
            ]),

        T("Line Andon Wall", "Kiosk",
            "Marquee alerts, andon stack, OEE hero, traffic light, shift context, active downtime, fault banner — kiosk wall-fit 7 rows",
            [
                W("marquee-ticker", "Alerts", 0, 0, 12, 1, new { source = "line" }),
                W("andon-stack", "Andon", 0, 1, 3, 3, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("oee-hero", "OEE", 3, 1, 6, 3, new { source = "machine", field = "oeePct" }, new { frameVariant = "kiosk" }),
                W("oee-traffic-light", "OEE Light", 9, 1, 3, 3, new { source = "machine" }, new { greenThreshold = 85, amberThreshold = 65, frameVariant = "kiosk" }),
                W("shift-context-strip", "Shift Context", 0, 4, 12, 1, new { source = "line" }),
                W("active-downtime-timer", "Active Downtime", 0, 5, 6, 2, new { source = "machine" }, new { frameVariant = "kiosk" }),
                W("fault-banner", "Fault", 6, 5, 6, 2, new { source = "machine" }, new { frameVariant = "kiosk" }),
            ]),

        T("Maintenance Wallboard", "Kiosk",
            "Marquee alerts, MTTR/MTBF/reliability KPIs, reliability trend, top faults, event feed — kiosk wall-fit 8 rows",
            [
                W("marquee-ticker", "Maintenance Alerts", 0, 0, 12, 1, new { source = "plant" }),
                W("mttr-tile", "MTTR", 0, 1, 4, 2, new { source = "plant" }),
                W("mtbf-tile", "MTBF", 4, 1, 4, 2, new { source = "plant" }),
                W("reliability-cluster", "Reliability", 8, 1, 4, 2, new { source = "plant" }),
                W("reliability-trend", "Reliability Trend", 0, 3, 8, 3, new { source = "plant" }),
                W("top-fault-codes", "Top Faults", 8, 3, 4, 3, new { source = "plant" }),
                W("event-feed", "Recent Stops", 0, 6, 12, 2, new { source = "plant" }),
            ]),

        T("Attainment Tracker", "Production",
            "Attainment tile, pace gauge, gap cluster, production vs target, hourly production — compact 6-row wall-fit",
            [
                W("attainment-tile", "Production Attainment", 0, 0, 4, 3, new { source = "line" }),
                W("pace-gauge", "Pace", 4, 0, 4, 3, new { source = "line" }, new { target = 5500 }),
                W("gap-cluster", "Gap vs Target", 8, 0, 4, 3, new { source = "line" }),
                W("production-vs-target", "Production vs Target", 0, 3, 8, 3, new { source = "line" }),
                W("hourly-production-bar", "Hourly Production", 8, 3, 4, 3, new { source = "line" }),
            ]),

        T("Shift Compare", "Shift",
            "Shift summary, gap cluster, OEE hero, OEE by shift, hourly production, multi-trend — wall-fit 9 rows",
            [
                W("shift-summary", "Current Shift", 0, 0, 4, 3, new { source = "line" }),
                W("gap-cluster", "Gap vs Target", 4, 0, 4, 3, new { source = "line" }),
                W("oee-hero", "Shift OEE", 8, 0, 4, 3, new { source = "machine", field = "oeePct" }, new { frameVariant = "hero" }),
                W("oee-by-shift", "OEE by Shift", 0, 3, 12, 3, new { source = "line" }),
                W("hourly-production-bar", "Hourly Production", 0, 6, 7, 3, new { source = "line" }),
                W("multi-trend", "OEE Trend", 7, 6, 5, 3, new { source = "line", field = "oeePct" }),
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
        var byName = existing.ToDictionary(t => t.Name, StringComparer.OrdinalIgnoreCase);
        var added = 0;
        var updated = 0;
        var removed = 0;

        foreach (var row in existing.Where(t => t.IsSystem && V6RetiredNames.Contains(t.Name, StringComparer.OrdinalIgnoreCase)).ToList())
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

    public static string? ResolveTemplateName(string dashboardName)
    {
        if (All.Any(t => t.Name.Equals(dashboardName, StringComparison.OrdinalIgnoreCase)))
            return dashboardName;

        var legacyFullName = dashboardName switch
        {
            "Line Overview" => "Line Performance Board",
            "Machine Detail" => "Machine Station Detail",
            "Plant Overview" => "Plant Command Center",
            "Multi-Line Overview" => "Floor At-a-Glance",
            "Shift Summary" => "Shift Huddle Board",
            "Downtime Analysis" => "Downtime Detective",
            "Maintenance / Fault Focus" => "Plant Reliability Hub",
            "Executive Summary" => "Executive Briefing",
            "Operator Station" => "Operator Kiosk",
            "Andon / Big Screen" => "Line Andon Wall",
            "Production Analysis" => "Production & Pace",
            "Quality / Yield Analysis" => "Quality & Yield Lab",
            "Supervisor Station" => "Supervisor Cockpit",
            "Setup & Changeover" => "Setup & Changeover",
            "TEEP Utilization" => "TEEP & Utilization",
            "Maintenance Wallboard" => "Maintenance Wallboard",
            _ => null,
        };
        if (legacyFullName is not null)
            return legacyFullName;

        const string sep = " — ";
        var idx = dashboardName.LastIndexOf(sep, StringComparison.Ordinal);
        if (idx < 0) return null;
        var suffix = dashboardName[(idx + sep.Length)..];
        return suffix switch
        {
            "Overview" => "Line Performance Board",
            "Shift" => "Shift Huddle Board",
            "Detail" => "Machine Station Detail",
            "Downtime" => "Downtime Detective",
            "Production" => "Production & Pace",
            "Quality" => "Quality & Yield Lab",
            "Supervisor" => "Supervisor Cockpit",
            "Setup" => "Setup & Changeover",
            "Operator Kiosk" => "Operator Kiosk",
            "Andon" => "Line Andon Wall",
            "Maintenance Board" => "Maintenance Wallboard",
            "Attainment" => "Attainment Tracker",
            "Shift Compare" => "Shift Compare",
            _ => null,
        };
    }

    /// <summary>Infers display category from dashboard name suffix or built-in template match.</summary>
    public static string InferCategory(string dashboardName, DashboardScope scope)
    {
        if (scope == DashboardScope.PublicKiosk) return "Kiosk";

        var exact = All.FirstOrDefault(t => t.Name.Equals(dashboardName, StringComparison.OrdinalIgnoreCase));
        if (exact is not null) return exact.Category;

        const string sep = " — ";
        var idx = dashboardName.LastIndexOf(sep, StringComparison.Ordinal);
        if (idx < 0) return "General";

        var suffix = dashboardName[(idx + sep.Length)..];
        return suffix switch
        {
            "Overview" => "Line",
            "Shift" or "Shift Compare" => "Shift",
            "Detail" => "Machine",
            "Downtime" or "Production" or "Quality" or "Setup" => "Analysis",
            "Supervisor" => "Line",
            "Attainment" => "Production",
            "Operator Kiosk" or "Andon" or "Maintenance Board" => "Kiosk",
            _ => "General",
        };
    }
}
