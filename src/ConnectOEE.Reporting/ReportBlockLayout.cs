using System.Text.Json;
using System.Text.Json.Serialization;
using ConnectOEE.Core;

namespace ConnectOEE.Reporting;

/// <summary>One block in a Custom report template layout (shared with the designer).</summary>
public sealed class ReportBlock
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("type")]
    public string Type { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string? Title { get; set; }

    [JsonPropertyName("options")]
    public Dictionary<string, JsonElement>? Options { get; set; }
}

/// <summary>Known block types for Custom report layouts.</summary>
public static class ReportBlockTypes
{
    public const string Cover = "cover";
    public const string KpiHero = "kpi-hero";
    public const string ApqBars = "apq-bars";
    public const string SecondaryMetrics = "secondary-metrics";
    public const string OeeTrend = "oee-trend";
    public const string Pareto = "pareto";
    public const string ProductionChart = "production-chart";
    public const string ShiftTable = "shift-table";
    public const string TrendTable = "trend-table";
    public const string ProductionTable = "production-table";
    public const string ReasonTable = "reason-table";
    public const string FaultTable = "fault-table";
    public const string BreakdownTable = "breakdown-table";
    public const string Reliability = "reliability";
    public const string SectionTitle = "section-title";
    public const string PageBreak = "page-break";
    public const string RichText = "rich-text";

    public static readonly HashSet<string> All = new(StringComparer.OrdinalIgnoreCase)
    {
        Cover, KpiHero, ApqBars, SecondaryMetrics, OeeTrend, Pareto, ProductionChart,
        ShiftTable, TrendTable, ProductionTable, ReasonTable, FaultTable, BreakdownTable,
        Reliability, SectionTitle, PageBreak, RichText,
    };
}

/// <summary>Parse / validate Custom template LayoutJson.</summary>
public static class ReportBlockLayout
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true,
    };

    public static IReadOnlyList<ReportBlock> Parse(string? layoutJson)
    {
        if (string.IsNullOrWhiteSpace(layoutJson)) return Array.Empty<ReportBlock>();
        var trimmed = layoutJson.Trim();
        if (trimmed is "{}" or "null") return Array.Empty<ReportBlock>();

        try
        {
            using var doc = JsonDocument.Parse(trimmed);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<ReportBlock>>(trimmed, JsonOptions) ?? new List<ReportBlock>();

            // Legacy / object wrapper: { "blocks": [...] }
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("blocks", out var blocks)
                && blocks.ValueKind == JsonValueKind.Array)
                return JsonSerializer.Deserialize<List<ReportBlock>>(blocks.GetRawText(), JsonOptions) ?? new List<ReportBlock>();
        }
        catch (JsonException)
        {
            return Array.Empty<ReportBlock>();
        }

        return Array.Empty<ReportBlock>();
    }

    /// <summary>Validate layout JSON. Returns null on success, or an error message.</summary>
    public static string? Validate(string? layoutJson)
    {
        if (string.IsNullOrWhiteSpace(layoutJson)) return null;
        var trimmed = layoutJson.Trim();
        if (trimmed is "[]" or "{}" or "null") return null;

        List<ReportBlock>? blocks;
        try
        {
            using var doc = JsonDocument.Parse(trimmed);
            if (doc.RootElement.ValueKind == JsonValueKind.Array)
                blocks = JsonSerializer.Deserialize<List<ReportBlock>>(trimmed, JsonOptions);
            else if (doc.RootElement.ValueKind == JsonValueKind.Object
                     && doc.RootElement.TryGetProperty("blocks", out var arr)
                     && arr.ValueKind == JsonValueKind.Array)
                blocks = JsonSerializer.Deserialize<List<ReportBlock>>(arr.GetRawText(), JsonOptions);
            else
                return "LayoutJson must be a JSON array of blocks (or { \"blocks\": [...] }).";
        }
        catch (JsonException ex)
        {
            return $"Invalid JSON: {ex.Message}";
        }

        if (blocks is null) return "LayoutJson could not be parsed.";

        var ids = new HashSet<string>(StringComparer.Ordinal);
        foreach (var b in blocks)
        {
            if (string.IsNullOrWhiteSpace(b.Type))
                return "Each block requires a type.";
            if (!ReportBlockTypes.All.Contains(b.Type))
                return $"Unknown block type '{b.Type}'.";
            if (string.IsNullOrWhiteSpace(b.Id))
                return "Each block requires an id.";
            if (!ids.Add(b.Id))
                return $"Duplicate block id '{b.Id}'.";
        }

        return null;
    }

    public static string Serialize(IEnumerable<ReportBlock> blocks)
        => JsonSerializer.Serialize(blocks, JsonOptions);

    /// <summary>Preset block lists matching current system ReportType layouts (for fork).</summary>
    public static IReadOnlyList<ReportBlock> PresetFor(ReportType type) => type switch
    {
        ReportType.ShiftReport or ReportType.DailyOee => new[]
        {
            Block("kpi-hero", "KPI hero"),
            Block("shift-table", "Shift comparison"),
            Block("oee-trend", "OEE trend"),
            Block("trend-table", "OEE detail"),
            Block("reason-table", "Downtime by reason"),
            Block("fault-table", "Top faults"),
        },
        ReportType.DowntimePareto => new[]
        {
            Block("pareto", "Downtime Pareto"),
            Block("reason-table", "Reasons"),
            Block("reliability", "Reliability"),
            Block("fault-table", "Top faults"),
        },
        ReportType.ProductionVsTarget => new[]
        {
            Block("production-chart", "Production vs target"),
            Block("production-table", "Production detail"),
            Block("oee-trend", "OEE trend"),
        },
        ReportType.FaultMaintenance => new[]
        {
            Block("reliability", "Reliability"),
            Block("fault-table", "Top faults"),
            Block("reason-table", "Downtime by reason"),
        },
        ReportType.ExecutiveSummary => new[]
        {
            Block("cover", "Cover"),
            Block("breakdown-table", "Breakdown"),
            Block("oee-trend", "OEE trend"),
            Block("reason-table", "Top losses"),
        },
        ReportType.WeeklySummary or ReportType.MonthlySummary => new[]
        {
            Block("oee-trend", "OEE trend"),
            Block("breakdown-table", "Breakdown"),
            Block("reason-table", "Top losses"),
            Block("reliability", "Reliability"),
        },
        _ => new[]
        {
            Block("kpi-hero", "KPI hero"),
            Block("oee-trend", "OEE trend"),
            Block("reason-table", "Downtime by reason"),
        },
    };

    private static ReportBlock Block(string type, string title) => new()
    {
        Id = Guid.NewGuid().ToString("N")[..12],
        Type = type,
        Title = title,
    };
}
