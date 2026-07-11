using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Reporting;

/// <summary>Where generated report artifacts are written for download/re-delivery.</summary>
public class ReportingOptions
{
    public string OutputDirectory { get; set; } = "reports";
    public string? ContentRootPath { get; set; }
}

/// <summary>Supplies header/footer branding (logos) to the PDF renderer.</summary>
public interface IReportBrandingProvider
{
    ReportBranding Get();
}

/// <summary>Result of generating a report: the bytes plus download metadata.</summary>
public record GeneratedReport(byte[] Content, string FileName, string ContentType, Guid RunId, ReportModel Model);

/// <summary>
/// Orchestrates report generation: resolve range -> build model -> render (PDF/CSV)
/// -> optionally persist artifact + a <see cref="ReportRun"/> row.
/// </summary>
public class ReportService
{
    private readonly ConnectOeeDbContext _db;
    private readonly ReportDataService _data;
    private readonly ReportRangeResolver _ranges;
    private readonly PdfReportRenderer _pdf;
    private readonly CsvReportExporter _csv;
    private readonly ReportChartRenderer _charts;
    private readonly IReportBrandingProvider _branding;
    private readonly ReportingOptions _options;

    public ReportService(
        ConnectOeeDbContext db,
        ReportDataService data,
        ReportRangeResolver ranges,
        PdfReportRenderer pdf,
        CsvReportExporter csv,
        ReportChartRenderer charts,
        IReportBrandingProvider branding,
        ReportingOptions options)
    {
        _db = db;
        _data = data;
        _ranges = ranges;
        _pdf = pdf;
        _csv = csv;
        _charts = charts;
        _branding = branding;
        _options = options;
    }

    public async Task<GeneratedReport> GenerateAsync(
        Guid templateId,
        EntityLevel level,
        Guid scopeId,
        ReportRangeKind rangeKind,
        ReportFormat format,
        string? triggeredBy,
        Guid? scheduleId,
        DateTimeOffset? customFrom = null,
        DateTimeOffset? customTo = null,
        bool persist = true,
        CancellationToken ct = default)
    {
        var template = await _db.ReportTemplates.AsNoTracking().FirstOrDefaultAsync(t => t.Id == templateId, ct)
            ?? throw new KeyNotFoundException($"Report template {templateId} not found");

        var (from, to) = await _ranges.ResolveAsync(rangeKind, level, scopeId, customFrom, customTo, ct);
        var model = await _data.BuildAsync(
            new ReportParams(template.ReportType, level, scopeId, from, to), ct);

        model.OeeTrendChart = _charts.RenderOeeTrend(model.Trend);
        model.ParetoChart = _charts.RenderPareto(model.Reasons);
        model.ProductionChart = _charts.RenderProductionVsTarget(model.Production);
        model.OeeRingChart = _charts.RenderPercentRing(model.Oee.OeePct, model.TargetOeePct);
        model.OeeSparkline = _charts.RenderOeeSparkline(model.Trend);
        model.AvailabilitySparkline = _charts.RenderAvailabilitySparkline(model.Trend);
        model.PerformanceSparkline = _charts.RenderPerformanceSparkline(model.Trend);
        model.QualitySparkline = _charts.RenderQualitySparkline(model.Trend);

        var branding = await BuildBrandingAsync(level, scopeId, ct);

        IReadOnlyList<ReportBlock>? customBlocks = null;
        if (template.ReportType == ReportType.Custom)
        {
            customBlocks = ReportBlockLayout.Parse(template.LayoutJson);
            if (customBlocks.Count == 0)
                customBlocks = ReportBlockLayout.PresetFor(ReportType.WeeklySummary);
        }

        byte[] content;
        string ext, contentType;
        if (format == ReportFormat.Csv)
        {
            content = _csv.Export(model);
            ext = "csv";
            contentType = "text/csv";
        }
        else
        {
            content = _pdf.Render(model, branding, customBlocks);
            ext = "pdf";
            contentType = "application/pdf";
        }

        var stamp = DateTimeOffset.Now.ToString("yyyyMMdd-HHmmss");
        var safeScope = Sanitize(model.ScopeName);
        var fileName = $"{Sanitize(template.Name)}_{safeScope}_{stamp}.{ext}";

        if (!persist)
            return new GeneratedReport(content, fileName, contentType, Guid.Empty, model);

        var run = new ReportRun
        {
            ReportTemplateId = templateId,
            ReportScheduleId = scheduleId,
            Title = $"{model.Title} — {model.ScopeName}",
            Format = format,
            GeneratedUtc = DateTimeOffset.UtcNow,
            Status = ReportRunStatus.Success,
            TriggeredBy = triggeredBy,
        };

        try
        {
            Directory.CreateDirectory(_options.OutputDirectory);
            var path = Path.Combine(_options.OutputDirectory, $"{run.Id}.{ext}");
            await File.WriteAllBytesAsync(path, content, ct);
            run.FilePath = path;
        }
        catch (Exception ex)
        {
            run.Status = ReportRunStatus.Failed;
            run.Error = $"artifact store failed: {ex.Message}";
        }

        _db.ReportRuns.Add(run);
        await _db.SaveChangesAsync(ct);

        return new GeneratedReport(content, fileName, contentType, run.Id, model);
    }

    private async Task<ReportBranding> BuildBrandingAsync(EntityLevel level, Guid scopeId, CancellationToken ct)
    {
        var baseBranding = _branding.Get();
        var plantId = await ResolvePlantIdAsync(level, scopeId, ct);
        if (plantId is null || string.IsNullOrEmpty(_options.ContentRootPath)) return baseBranding;

        var logoPath = Path.Combine(_options.ContentRootPath, "Assets", "plants", $"{plantId}.png");
        if (!File.Exists(logoPath)) return baseBranding;

        try
        {
            var plantLogo = await File.ReadAllBytesAsync(logoPath, ct);
            return baseBranding with { PlantLogo = plantLogo };
        }
        catch
        {
            return baseBranding;
        }
    }

    private async Task<Guid?> ResolvePlantIdAsync(EntityLevel level, Guid id, CancellationToken ct) => level switch
    {
        EntityLevel.Plant => id,
        EntityLevel.Department => await _db.Departments.AsNoTracking()
            .Where(d => d.Id == id).Select(d => (Guid?)d.PlantId).FirstOrDefaultAsync(ct),
        EntityLevel.Line => await _db.Lines.AsNoTracking()
            .Where(l => l.Id == id).Select(l => l.Department!.PlantId).FirstOrDefaultAsync(ct),
        EntityLevel.Machine => await _db.Machines.AsNoTracking()
            .Where(m => m.Id == id).Select(m => m.Line!.Department!.PlantId).FirstOrDefaultAsync(ct),
        _ => null,
    };

    /// <summary>
    /// Resolves a relative range to a concrete UTC window. Day/shift boundaries use the
    /// server local time zone (the on-prem host sits at the plant per AGENTS.md).
    /// </summary>
    public static (DateTimeOffset from, DateTimeOffset to) ResolveRangeStatic(ReportRangeKind kind, DateTimeOffset now)
    {
        var localNow = now.ToLocalTime();
        var todayStart = new DateTimeOffset(localNow.Year, localNow.Month, localNow.Day, 0, 0, 0, localNow.Offset);

        var (from, to) = kind switch
        {
            ReportRangeKind.Today => (todayStart, now),
            ReportRangeKind.Yesterday => (todayStart.AddDays(-1), todayStart),
            ReportRangeKind.PreviousShift => (now.AddHours(-8), now),
            ReportRangeKind.Last24h => (now.AddHours(-24), now),
            ReportRangeKind.Last7d => (now.AddDays(-7), now),
            ReportRangeKind.Last30d => (now.AddDays(-30), now),
            ReportRangeKind.PreviousWeek => PreviousWeek(todayStart),
            ReportRangeKind.PreviousMonth => PreviousMonth(todayStart),
            _ => (now.AddHours(-24), now),
        };

        return (from.ToUniversalTime(), to.ToUniversalTime());
    }

    private static (DateTimeOffset, DateTimeOffset) PreviousWeek(DateTimeOffset todayStart)
    {
        int diff = (7 + (int)todayStart.DayOfWeek - (int)DayOfWeek.Monday) % 7;
        var thisWeekStart = todayStart.AddDays(-diff);
        return (thisWeekStart.AddDays(-7), thisWeekStart);
    }

    private static (DateTimeOffset, DateTimeOffset) PreviousMonth(DateTimeOffset todayStart)
    {
        var thisMonthStart = new DateTimeOffset(todayStart.Year, todayStart.Month, 1, 0, 0, 0, todayStart.Offset);
        return (thisMonthStart.AddMonths(-1), thisMonthStart);
    }

    private static string Sanitize(string s)
    {
        var clean = new string(s.Select(ch => char.IsLetterOrDigit(ch) ? ch : '-').ToArray());
        return clean.Trim('-');
    }
}
