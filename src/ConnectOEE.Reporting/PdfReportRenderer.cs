using ConnectOEE.Core;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ConnectOEE.Reporting;

/// <summary>Branding inputs for the PDF header/footer (logo bytes + accent color).</summary>
public record ReportBranding(byte[]? AppLogo, byte[]? PlantLogo, string ProductName = "ConnectOEE", string AccentHex = "#1c7ed6");

/// <summary>
/// Renders a <see cref="ReportModel"/> to a branded, print-friendly PDF with QuestPDF.
/// Professional OEE layouts: KPI cards, distinct per-type sections, ConnectOEE tokens.
/// </summary>
public class PdfReportRenderer
{
    static PdfReportRenderer()
    {
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private const string Ink = "#212529";
    private const string Muted = "#868e96";
    private const string Border = "#dee2e6";
    private const string Surface = "#f8f9fa";
    private const string SurfaceAlt = "#f1f3f5";
    private const string Green = "#2f9e44";
    private const string Amber = "#f08c00";
    private const string Red = "#e03131";

    public byte[] Render(ReportModel m, ReportBranding branding, IReadOnlyList<ReportBlock>? customBlocks = null)
    {
        if (customBlocks is { Count: > 0 })
            return RenderCustom(m, branding, customBlocks);

        return Document.Create(doc =>
        {
            if (NeedsCover(m.ReportType))
                doc.Page(page => CoverPage(page, m, branding));

            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(26);
                page.DefaultTextStyle(t => t.FontSize(9).FontColor(Ink));

                page.Header().Element(c => Header(c, m, branding));
                page.Content().PaddingVertical(12).Element(c => Content(c, m, branding));
                page.Footer().Element(c => Footer(c, m, branding));
            });
        }).GeneratePdf();
    }

    /// <summary>Compose a Custom template from ordered designer blocks (page-flow + optional page breaks).</summary>
    public byte[] RenderCustom(ReportModel m, ReportBranding branding, IReadOnlyList<ReportBlock> blocks)
    {
        var pages = SplitIntoPages(blocks);
        return Document.Create(doc =>
        {
            foreach (var pageBlocks in pages)
            {
                var coverOnly = pageBlocks.Count == 1
                    && string.Equals(pageBlocks[0].Type, ReportBlockTypes.Cover, StringComparison.OrdinalIgnoreCase);
                if (coverOnly || (pageBlocks.Count > 0
                    && string.Equals(pageBlocks[0].Type, ReportBlockTypes.Cover, StringComparison.OrdinalIgnoreCase)
                    && pageBlocks.All(b => string.Equals(b.Type, ReportBlockTypes.Cover, StringComparison.OrdinalIgnoreCase))))
                {
                    doc.Page(page => CoverPage(page, m, branding));
                    continue;
                }

                // Leading cover on a mixed page → dedicated cover, then body without the cover block
                var body = pageBlocks;
                if (pageBlocks.Count > 0
                    && string.Equals(pageBlocks[0].Type, ReportBlockTypes.Cover, StringComparison.OrdinalIgnoreCase))
                {
                    doc.Page(page => CoverPage(page, m, branding));
                    body = pageBlocks.Skip(1).ToList();
                    if (body.Count == 0) continue;
                }

                doc.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(26);
                    page.DefaultTextStyle(t => t.FontSize(9).FontColor(Ink));
                    page.Header().Element(c => Header(c, m, branding));
                    page.Content().PaddingVertical(12).Element(c => ComposeBlocks(c, m, branding, body));
                    page.Footer().Element(c => Footer(c, m, branding));
                });
            }
        }).GeneratePdf();
    }

    private static List<List<ReportBlock>> SplitIntoPages(IReadOnlyList<ReportBlock> blocks)
    {
        var pages = new List<List<ReportBlock>>();
        var current = new List<ReportBlock>();
        foreach (var b in blocks)
        {
            if (string.Equals(b.Type, ReportBlockTypes.PageBreak, StringComparison.OrdinalIgnoreCase))
            {
                if (current.Count > 0) pages.Add(current);
                current = new List<ReportBlock>();
                continue;
            }
            current.Add(b);
        }
        if (current.Count > 0) pages.Add(current);
        if (pages.Count == 0) pages.Add(new List<ReportBlock>());
        return pages;
    }

    private void ComposeBlocks(IContainer c, ReportModel m, ReportBranding b, IReadOnlyList<ReportBlock> blocks)
    {
        c.Column(col =>
        {
            col.Spacing(16);
            foreach (var block in blocks)
                col.Item().Element(x => RenderBlock(x, m, b, block));
        });
    }

    private void RenderBlock(IContainer c, ReportModel m, ReportBranding b, ReportBlock block)
    {
        var type = block.Type?.Trim() ?? "";
        var title = string.IsNullOrWhiteSpace(block.Title) ? DefaultTitle(type) : block.Title!;
        var showIfEmpty = GetOptionBool(block, "showIfEmpty", false);
        var maxRows = GetOptionInt(block, "maxRows", 0);
        var showSparklines = GetOptionBool(block, "showSparklines", true);
        var includeSecondary = GetOptionBool(block, "includeSecondary", true);

        switch (type.ToLowerInvariant())
        {
            case ReportBlockTypes.Cover:
                // Cover is handled at page level; ignore if it appears mid-flow
                c.Text("").FontSize(1);
                break;
            case ReportBlockTypes.KpiHero:
                c.Element(x => ShiftHeroKpis(x, m, b, showSparklines, includeSecondary));
                break;
            case ReportBlockTypes.ApqBars:
                c.Border(1).BorderColor(Border).Background(Surface).Padding(10)
                    .Element(x => ApqFactorStack(x, m, b, showSparklines));
                break;
            case ReportBlockTypes.SecondaryMetrics:
                c.Element(x => SecondaryMetricsStrip(x, m));
                break;
            case ReportBlockTypes.OeeTrend:
                c.Element(x => SectionCard(x, title, y => ChartSection(y, m.OeeTrendChart, title), b));
                break;
            case ReportBlockTypes.Pareto:
                c.Element(x => SectionCard(x, title, y => ChartSection(y, m.ParetoChart, title), b));
                break;
            case ReportBlockTypes.ProductionChart:
                c.Column(col =>
                {
                    col.Spacing(8);
                    col.Item().Element(x => ProductionSummaryStrip(x, m));
                    col.Item().Element(x => SectionCard(x, title, y => ChartSection(y, m.ProductionChart, title), b));
                });
                break;
            case ReportBlockTypes.ShiftTable:
                if (m.Shifts.Count == 0)
                {
                    if (showIfEmpty) c.Element(x => SectionCard(x, title, EmptyState, b));
                    else EmptySkip(c);
                    return;
                }
                c.Element(x => SectionCard(x, title, y => ShiftTable(y, m, maxRows > 0 ? maxRows : 50), b));
                break;
            case ReportBlockTypes.TrendTable:
                c.Element(x => SectionCard(x, title, y => TrendTable(y, m, maxRows > 0 ? maxRows : 40, showIfEmpty), b));
                break;
            case ReportBlockTypes.ProductionTable:
                c.Element(x => SectionCard(x, title, y => ProductionTable(y, m, maxRows > 0 ? maxRows : 40, showIfEmpty), b));
                break;
            case ReportBlockTypes.ReasonTable:
                if (m.Reasons.Count == 0)
                {
                    if (showIfEmpty) c.Element(x => SectionCard(x, title, EmptyState, b));
                    else EmptySkip(c);
                    return;
                }
                c.Element(x => SectionCard(x, title, y => ReasonTable(y, m, b, maxRows > 0 ? maxRows : 20), b));
                break;
            case ReportBlockTypes.FaultTable:
                if (m.TopFaults.Count == 0)
                {
                    if (showIfEmpty) c.Element(x => SectionCard(x, title, EmptyState, b));
                    else EmptySkip(c);
                    return;
                }
                c.Element(x => SectionCard(x, title, y => FaultTable(y, m, maxRows > 0 ? maxRows : 20), b));
                break;
            case ReportBlockTypes.BreakdownTable:
                if (m.Breakdown.Count == 0)
                {
                    if (showIfEmpty) c.Element(x => SectionCard(x, title, EmptyState, b));
                    else EmptySkip(c);
                    return;
                }
                c.Element(x => SectionCard(x, title, y => BreakdownTable(y, m, b, maxRows > 0 ? maxRows : 50), b));
                break;
            case ReportBlockTypes.Reliability:
                c.Element(x => ReliabilityHero(x, m, b));
                break;
            case ReportBlockTypes.SectionTitle:
                c.PaddingTop(4).PaddingBottom(2)
                    .Text(title).FontSize(12).Bold().FontColor(b.AccentHex);
                break;
            case ReportBlockTypes.RichText:
                var body = GetOptionString(block, "text") ?? title;
                c.Border(1).BorderColor(Border).Background(Surface).Padding(10)
                    .Text(body).FontSize(9).FontColor(Ink);
                break;
            case ReportBlockTypes.PageBreak:
                EmptySkip(c);
                break;
            default:
                EmptySkip(c);
                break;
        }
    }

    private static void EmptySkip(IContainer c) => c.Text("").FontSize(1);

    private static void EmptyState(IContainer c) =>
        c.PaddingVertical(6).Text("No data for this section.").FontSize(8).FontColor(Muted).Italic();

    private static string? GetOptionString(ReportBlock block, string key)
    {
        if (block.Options is null || !block.Options.TryGetValue(key, out var el)) return null;
        return el.ValueKind == System.Text.Json.JsonValueKind.String ? el.GetString() : el.ToString();
    }

    private static bool GetOptionBool(ReportBlock block, string key, bool fallback)
    {
        if (block.Options is null || !block.Options.TryGetValue(key, out var el)) return fallback;
        return el.ValueKind switch
        {
            System.Text.Json.JsonValueKind.True => true,
            System.Text.Json.JsonValueKind.False => false,
            System.Text.Json.JsonValueKind.String when bool.TryParse(el.GetString(), out var b) => b,
            _ => fallback,
        };
    }

    private static int GetOptionInt(ReportBlock block, string key, int fallback)
    {
        if (block.Options is null || !block.Options.TryGetValue(key, out var el)) return fallback;
        if (el.ValueKind == System.Text.Json.JsonValueKind.Number && el.TryGetInt32(out var n)) return Math.Clamp(n, 1, 200);
        if (el.ValueKind == System.Text.Json.JsonValueKind.String && int.TryParse(el.GetString(), out var s))
            return Math.Clamp(s, 1, 200);
        return fallback;
    }

    private static string DefaultTitle(string type) => type.ToLowerInvariant() switch
    {
        ReportBlockTypes.KpiHero => "KPIs",
        ReportBlockTypes.ApqBars => "Availability / Performance / Quality",
        ReportBlockTypes.SecondaryMetrics => "Secondary metrics",
        ReportBlockTypes.OeeTrend => "OEE trend",
        ReportBlockTypes.Pareto => "Downtime Pareto",
        ReportBlockTypes.ProductionChart => "Production vs target",
        ReportBlockTypes.ShiftTable => "Shift comparison",
        ReportBlockTypes.TrendTable => "OEE detail",
        ReportBlockTypes.ProductionTable => "Production detail",
        ReportBlockTypes.ReasonTable => "Downtime by reason",
        ReportBlockTypes.FaultTable => "Top faults",
        ReportBlockTypes.BreakdownTable => "Breakdown",
        ReportBlockTypes.Reliability => "Reliability",
        ReportBlockTypes.SectionTitle => "Section",
        ReportBlockTypes.RichText => "Notes",
        _ => type,
    };

    private static bool NeedsCover(ReportType type) =>
        type is ReportType.ExecutiveSummary or ReportType.WeeklySummary or ReportType.MonthlySummary;

    private void CoverPage(PageDescriptor page, ReportModel m, ReportBranding b)
    {
        page.Size(PageSizes.A4);
        page.Margin(40);
        page.Content().Column(col =>
        {
            col.Item().Height(6).Background(b.AccentHex);
            col.Item().PaddingTop(48).AlignMiddle().Column(inner =>
            {
                inner.Spacing(14);
                if (b.PlantLogo is { Length: > 0 })
                    inner.Item().AlignCenter().Height(56).Image(b.PlantLogo).FitHeight();
                else if (b.AppLogo is { Length: > 0 })
                    inner.Item().AlignCenter().Height(56).Image(b.AppLogo).FitHeight();

                inner.Item().AlignCenter().Text(b.ProductName).FontSize(11).FontColor(Muted).LetterSpacing(0.5f);
                inner.Item().AlignCenter().Text(m.Title).FontSize(30).Bold().FontColor(Ink);
                inner.Item().AlignCenter().Text($"{m.ScopeLevel} · {m.ScopeName}").FontSize(13).FontColor(Muted);
                inner.Item().AlignCenter().Text(
                        $"{Local(m.From):MMM d, yyyy} – {Local(m.To):MMM d, yyyy}")
                    .FontSize(11).FontColor(Muted);

                inner.Item().PaddingTop(28).Element(x => CoverKpiStrip(x, m, b));

                inner.Item().PaddingTop(36).AlignCenter().Text($"Generated {Local(m.GeneratedUtc):f}")
                    .FontSize(9).FontColor(Muted);
            });
        });
    }

    private void CoverKpiStrip(IContainer c, ReportModel m, ReportBranding b)
    {
        c.Border(1).BorderColor(Border).Background(Surface).Padding(10).Row(row =>
        {
            row.Spacing(12);
            row.ConstantItem(120).Element(x => CompactOeeRing(x, m));
            row.RelativeItem().Element(x => ApqFactorStack(x, m, b));
        });
    }

    private void CoverKpi(IContainer c, string label, string value, string valueColor, ReportBranding b)
    {
        c.AlignCenter().Column(col =>
        {
            col.Item().AlignCenter().Text(label).FontSize(8).FontColor(Muted);
            col.Item().AlignCenter().Text(value).FontSize(20).Bold().FontColor(valueColor);
        });
    }

    private void Header(IContainer c, ReportModel m, ReportBranding b)
    {
        c.BorderBottom(2).BorderColor(b.AccentHex).PaddingBottom(10).Row(row =>
        {
            if (b.AppLogo is { Length: > 0 })
                row.ConstantItem(36).Height(36).Image(b.AppLogo).FitArea();

            row.RelativeItem().PaddingLeft(10).Column(col =>
            {
                col.Item().Text(m.Title).FontSize(16).Bold().FontColor(Ink);
                col.Item().Text($"{m.ScopeLevel} › {m.ScopeName}").FontSize(9).FontColor(Muted);
                col.Item().Text($"{Local(m.From):ddd MMM d HH:mm} – {Local(m.To):ddd MMM d HH:mm}")
                    .FontSize(8).FontColor(Muted);
            });

            row.ConstantItem(140).Column(col =>
            {
                if (b.PlantLogo is { Length: > 0 })
                    col.Item().AlignRight().Height(32).Image(b.PlantLogo).FitHeight();
                col.Item().AlignRight().Text(b.ProductName).FontSize(8).Bold().FontColor(b.AccentHex);
            });
        });
    }

    private void Footer(IContainer c, ReportModel m, ReportBranding b)
    {
        c.BorderTop(1).BorderColor(Border).PaddingTop(6).Row(row =>
        {
            row.RelativeItem().Text($"{b.ProductName} · on-prem OEE · Generated {Local(m.GeneratedUtc):g}")
                .FontSize(7).FontColor(Muted);
            row.RelativeItem().AlignRight().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(7).FontColor(Muted));
                t.Span("Page ");
                t.CurrentPageNumber();
                t.Span(" of ");
                t.TotalPages();
            });
        });
    }

    private void Content(IContainer c, ReportModel m, ReportBranding b)
    {
        c.Column(col =>
        {
            col.Spacing(16);

            switch (m.ReportType)
            {
                case ReportType.ShiftReport:
                case ReportType.DailyOee:
                    col.Item().Element(x => ShiftHeroKpis(x, m, b));
                    // Secondary metrics already included in ShiftHeroKpis
                    if (m.Shifts.Count > 0) col.Item().Element(x => SectionCard(x, "Shift comparison", y => ShiftTable(y, m), b));
                    col.Item().Element(x => SectionCard(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend"), b));
                    col.Item().Element(x => SectionCard(x, "OEE detail", y => TrendTable(y, m), b));
                    col.Item().Element(x => SectionCard(x, "Downtime by reason", y => ReasonTable(y, m, b), b));
                    if (m.TopFaults.Count > 0) col.Item().Element(x => SectionCard(x, "Top faults", y => FaultTable(y, m), b));
                    break;

                case ReportType.DowntimePareto:
                    col.Item().Element(x => SectionCard(x, "Downtime Pareto", y => ChartSection(y, m.ParetoChart, "Pareto"), b));
                    col.Item().Element(x => SectionCard(x, "Reasons", y => ReasonTable(y, m, b), b));
                    col.Item().Element(x => ReliabilityHero(x, m, b));
                    if (m.TopFaults.Count > 0) col.Item().Element(x => SectionCard(x, "Top faults", y => FaultTable(y, m), b));
                    break;

                case ReportType.ProductionVsTarget:
                    col.Item().Element(x => ProductionSummaryStrip(x, m));
                    col.Item().Element(x => SectionCard(x, "Production vs target", y => ChartSection(y, m.ProductionChart, "Production"), b));
                    col.Item().Element(x => SectionCard(x, "Production detail", y => ProductionTable(y, m), b));
                    col.Item().Element(x => SectionCard(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend"), b));
                    break;

                case ReportType.FaultMaintenance:
                    col.Item().Element(x => ReliabilityHero(x, m, b));
                    col.Item().Element(x => SectionCard(x, "Top faults", y => FaultTable(y, m), b));
                    col.Item().Element(x => SectionCard(x, "Downtime by reason", y => ReasonTable(y, m, b), b));
                    break;

                case ReportType.ExecutiveSummary:
                    // Cover already has headline KPIs — body focuses on breakdown + losses.
                    if (m.Breakdown.Count > 0) col.Item().Element(x => SectionCard(x, "Breakdown", y => BreakdownTable(y, m, b), b));
                    col.Item().Element(x => SectionCard(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend"), b));
                    col.Item().Element(x => SectionCard(x, "Top losses", y => ReasonTable(y, m, b), b));
                    break;

                case ReportType.WeeklySummary:
                case ReportType.MonthlySummary:
                default:
                    col.Item().Element(x => SectionCard(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend"), b));
                    if (m.Breakdown.Count > 0) col.Item().Element(x => SectionCard(x, "Breakdown", y => BreakdownTable(y, m, b), b));
                    col.Item().Element(x => SectionCard(x, "Top losses", y => ReasonTable(y, m, b), b));
                    col.Item().Element(x => ReliabilityHero(x, m, b));
                    break;
            }
        });
    }

    private void ShiftHeroKpis(IContainer c, ReportModel m, ReportBranding b, bool showSparklines = true, bool includeSecondary = true)
    {
        c.Column(col =>
        {
            col.Spacing(8);
            // Ring left + stacked A/P/Q right — no Height+FitWidth conflicts
            col.Item().Border(1).BorderColor(Border).Background(Surface).Padding(10).Row(row =>
            {
                row.Spacing(12);
                row.ConstantItem(120).Element(x => CompactOeeRing(x, m, showSparklines));
                row.RelativeItem().Element(x => ApqFactorStack(x, m, b, showSparklines));
            });
            if (includeSecondary)
                col.Item().Element(x => SecondaryMetricsStrip(x, m));
        });
    }

    private void CompactOeeRing(IContainer c, ReportModel m, bool showSparklines = true)
    {
        var oeeColor = OeeColor(m.Oee.OeePct, m.TargetOeePct);
        c.Column(col =>
        {
            col.Spacing(2);
            if (m.OeeRingChart is { Length: > 0 })
                col.Item().Height(96).Image(m.OeeRingChart).FitArea();
            else
            {
                col.Item().AlignCenter().Text("OEE").FontSize(8).FontColor(Muted);
                col.Item().AlignCenter().Text($"{m.Oee.OeePct:0.0}%").FontSize(22).Bold().FontColor(oeeColor);
            }
            col.Item().AlignCenter().Text($"Target {m.TargetOeePct:0}%").FontSize(7).FontColor(Muted);
            // Full width of the ring column
            if (showSparklines && m.OeeSparkline is { Length: > 0 })
                col.Item().PaddingTop(2).Height(22).Image(m.OeeSparkline).FitUnproportionally();
        });
    }

    private void ApqFactorStack(IContainer c, ReportModel m, ReportBranding b, bool showSparklines = true)
    {
        c.Column(col =>
        {
            col.Spacing(6);
            col.Item().Element(x => FactorBarRow(x, "Availability", m.Oee.AvailabilityPct, showSparklines ? m.AvailabilitySparkline : null, Green));
            col.Item().Element(x => FactorBarRow(x, "Performance", m.Oee.PerformancePct, showSparklines ? m.PerformanceSparkline : null, b.AccentHex));
            col.Item().Element(x => FactorBarRow(x, "Quality", m.Oee.QualityPct, showSparklines ? m.QualitySparkline : null, "#7048e8"));
        });
    }

    private void FactorBarRow(IContainer c, string label, double pct, byte[]? sparkline, string barColor)
    {
        var clamped = (float)Math.Clamp(pct / 100.0, 0, 1);
        c.Column(col =>
        {
            col.Spacing(2);
            col.Item().Row(row =>
            {
                row.RelativeItem().Text(label).FontSize(8).FontColor(Muted);
                row.ConstantItem(44).AlignRight().Text($"{pct:0.0}%").FontSize(11).Bold().FontColor(Ink);
            });
            col.Item().Height(6).Row(bar =>
            {
                if (clamped > 0.001f)
                    bar.RelativeItem(clamped).Background(barColor);
                if (1 - clamped > 0.001f)
                    bar.RelativeItem(1 - clamped).Background(SurfaceAlt);
            });
            // Stretch sparkline to full width of the bar column
            if (sparkline is { Length: > 0 })
                col.Item().PaddingTop(1).Height(18).Image(sparkline).FitUnproportionally();
        });
    }

    private void SecondaryMetricsStrip(IContainer c, ReportModel m)
    {
        c.Border(1).BorderColor(Border).Background(Surface).Padding(8).Column(col =>
        {
            col.Spacing(6);
            col.Item().Row(row =>
            {
                row.RelativeItem().Element(x => InlineStat(x, "Scrap", $"{m.Oee.ScrapPct:0.0}%"));
                row.RelativeItem().Element(x => InlineStat(x, "FPY", $"{m.Oee.FpyPct:0.0}%"));
                row.RelativeItem().Element(x => InlineStat(x, "Uptime", ReportDurationFormat.Minutes(m.UptimeMin)));
                row.RelativeItem().Element(x => InlineStat(x, "Downtime", ReportDurationFormat.Minutes(m.DowntimeMin)));
            });
            col.Item().Row(row =>
            {
                row.RelativeItem().Element(x => InlineStat(x, "Good", $"{m.GoodCount:n0}"));
                row.RelativeItem().Element(x => InlineStat(x, "Reject", $"{m.RejectCount:n0}"));
                row.RelativeItem().Element(x => InlineStat(x, "Total", $"{m.TotalCount:n0}"));
                row.RelativeItem().Element(x => InlineStat(x, "Stops", $"{m.DowntimeCount}"));
            });
        });
    }

    private void ProductionSummaryStrip(IContainer c, ReportModel m)
    {
        c.Border(1).BorderColor(Border).Background(Surface).Padding(8).Row(row =>
        {
            row.RelativeItem().Element(x => InlineStat(x, "Good", $"{m.GoodCount:n0}"));
            row.RelativeItem().Element(x => InlineStat(x, "Reject", $"{m.RejectCount:n0}"));
            row.RelativeItem().Element(x => InlineStat(x, "Total", $"{m.TotalCount:n0}"));
            row.RelativeItem().Element(x => InlineStat(x, "Stops", $"{m.DowntimeCount}"));
        });
    }

    private void InlineStat(IContainer c, string label, string value)
    {
        c.Column(col =>
        {
            col.Item().Text(label).FontSize(7).FontColor(Muted);
            col.Item().Text(value).FontSize(11).Bold();
        });
    }

    private void ReliabilityHero(IContainer c, ReportModel m, ReportBranding b)
    {
        var r = m.Reliability;
        c.Column(col =>
        {
            col.Item().PaddingBottom(6).Text("Reliability").FontSize(11).Bold().FontColor(Ink);
            col.Item().Row(row =>
            {
                row.Spacing(8);
                row.RelativeItem().Element(x => MiniKpi(x, "MTTR", ReportDurationFormat.Minutes(r.MttrMin)));
                row.RelativeItem().Element(x => MiniKpi(x, "MTBF", ReportDurationFormat.Minutes(r.MtbfMin)));
                row.RelativeItem().Element(x => MiniKpi(x, "Stops/hr", $"{r.StopsPerHour:0.00}"));
                row.RelativeItem().Element(x => MiniKpi(x, "Failures", $"{r.FailureCount}"));
            });
        });
    }

    private static string OeeColor(double oeePct, double targetPct)
    {
        if (oeePct >= targetPct) return Green;
        if (oeePct >= targetPct * 0.7) return Amber;
        return Red;
    }

    private void ChartSection(IContainer c, byte[]? png, string fallbackTitle)
    {
        if (png is { Length: > 0 })
            c.Image(png).FitWidth();
        else
            c.Padding(8).Text($"{fallbackTitle}: insufficient data for chart.").FontColor(Muted).Italic();
    }

    private void BigKpi(IContainer c, string label, string value, string color, string sub, ReportBranding b)
    {
        c.Border(1).BorderColor(Border).Background(Surface).Padding(12).Column(col =>
        {
            col.Item().Text(label).FontSize(8).Bold().FontColor(Muted);
            col.Item().Text(value).FontSize(28).Bold().FontColor(color);
            col.Item().Text(sub).FontSize(8).FontColor(Muted);
            col.Item().PaddingTop(4).Height(3).Background(color);
        });
    }

    private void MiniKpi(IContainer c, string label, string value)
    {
        c.Border(1).BorderColor(Border).Background(Surface).Padding(10).Column(col =>
        {
            col.Item().Text(label).FontSize(7).FontColor(Muted);
            col.Item().Text(value).FontSize(14).Bold();
        });
    }

    private void SectionCard(IContainer c, string title, Action<IContainer> body, ReportBranding b)
    {
        c.Column(col =>
        {
            col.Item().Row(row =>
            {
                row.ConstantItem(3).Height(14).Background(b.AccentHex);
                row.RelativeItem().PaddingLeft(8).AlignMiddle().Text(title).FontSize(11).Bold().FontColor(Ink);
            });
            col.Item().PaddingTop(8).Element(body);
        });
    }

    private void TrendTable(IContainer c, ReportModel m, int maxRows = 40, bool showIfEmpty = false)
    {
        var rows = m.Trend.Where(p => p.TotalCount > 0 || p.DowntimeMin > 0 || p.Oee.OeePct > 0).ToList();
        if (rows.Count == 0)
        {
            if (showIfEmpty) EmptyState(c);
            else Empty(c);
            return;
        }

        c.Table(t =>
        {
            t.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn();
                cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn();
            });
            HeaderRow(t, "Period", "OEE%", "A%", "P%", "Q%", "Good", "Downtime");
            var i = 0;
            foreach (var p in rows.TakeLast(Math.Max(1, maxRows)))
            {
                BodyRow(t, i++ % 2 == 0, p.Label, $"{p.Oee.OeePct:0.0}", $"{p.Oee.AvailabilityPct:0}",
                    $"{p.Oee.PerformancePct:0}", $"{p.Oee.QualityPct:0}", $"{p.GoodCount:n0}",
                    ReportDurationFormat.Minutes(p.DowntimeMin));
            }
        });
    }

    private void ProductionTable(IContainer c, ReportModel m, int maxRows = 40, bool showIfEmpty = false)
    {
        var rows = m.Production.Where(p => p.TotalCount > 0 || p.TargetCount > 0).ToList();
        if (rows.Count == 0)
        {
            if (showIfEmpty) EmptyState(c);
            else Empty(c);
            return;
        }

        c.Table(t =>
        {
            t.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn();
                cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn();
            });
            HeaderRow(t, "Period", "Good", "Reject", "Total", "Target", "Scrap%", "Var");
            var i = 0;
            foreach (var p in rows.TakeLast(Math.Max(1, maxRows)))
            {
                var variance = p.TargetCount > 0 ? p.GoodCount - p.TargetCount : 0;
                BodyRow(t, i++ % 2 == 0, p.Label, $"{p.GoodCount:n0}", $"{p.RejectCount:n0}", $"{p.TotalCount:n0}",
                    $"{p.TargetCount:n0}", $"{p.ScrapPct:0.0}", $"{variance:+#;-#;0}");
            }
        });
    }

    private void ReasonTable(IContainer c, ReportModel m, ReportBranding b, int maxRows = 20)
    {
        if (m.Reasons.Count == 0) { Empty(c); return; }
        var max = m.Reasons.Max(r => r.TotalMin);

        c.Table(t =>
        {
            t.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3); cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(3);
            });
            HeaderRow(t, "Reason", "Category", "Count", "Minutes", "Share");
            var i = 0;
            foreach (var r in m.Reasons.Take(Math.Max(1, maxRows)))
            {
                var zebra = i++ % 2 == 0;
                BodyCell(t, zebra).Text(r.Reason);
                BodyCell(t, zebra).Text(r.Category).FontColor(Muted);
                BodyCell(t, zebra).AlignRight().Text($"{r.Count}");
                BodyCell(t, zebra).AlignRight().Text(ReportDurationFormat.Minutes(r.TotalMin));
                BodyCell(t, zebra).PaddingVertical(3).Element(cell =>
                {
                    var frac = max > 0 ? (float)(r.TotalMin / max) : 0f;
                    cell.Height(8).Row(bar =>
                    {
                        bar.RelativeItem(Math.Max(0.001f, frac)).Background(b.AccentHex);
                        bar.RelativeItem(Math.Max(0.001f, 1 - frac)).Background(SurfaceAlt);
                    });
                });
            }
        });
    }

    private void FaultTable(IContainer c, ReportModel m, int maxRows = 20)
    {
        if (m.TopFaults.Count == 0) { Empty(c); return; }
        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(); cd.RelativeColumn(4); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "Code", "Mapped reason", "Count", "Minutes");
            var i = 0;
            foreach (var f in m.TopFaults.Take(Math.Max(1, maxRows)))
                BodyRow(t, i++ % 2 == 0, $"{f.Code}", f.Reason, $"{f.Count}", ReportDurationFormat.Minutes(f.TotalMin));
        });
    }

    private void ShiftTable(IContainer c, ReportModel m, int maxRows = 50)
    {
        if (m.Shifts.Count == 0) { Empty(c); return; }
        c.Table(t =>
        {
            t.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(2); cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn();
                cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn();
            });
            HeaderRow(t, "Shift", "Start", "OEE%", "A%", "P%", "Q%", "Good", "Downtime");
            var i = 0;
            foreach (var s in m.Shifts.Take(Math.Max(1, maxRows)))
                BodyRow(t, i++ % 2 == 0, s.ShiftName, $"{Local(s.StartUtc):MM/dd HH:mm}", $"{s.OeePct:0.0}",
                    $"{s.AvailabilityPct:0}", $"{s.PerformancePct:0}", $"{s.QualityPct:0}", $"{s.GoodCount:n0}",
                    ReportDurationFormat.Minutes(s.DowntimeMinutes));
        });
    }

    private void BreakdownTable(IContainer c, ReportModel m, ReportBranding b, int maxRows = 50)
    {
        if (m.Breakdown.Count == 0) { Empty(c); return; }
        c.Table(t =>
        {
            t.ColumnsDefinition(cd =>
            {
                cd.RelativeColumn(3); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn();
                cd.RelativeColumn(); cd.RelativeColumn();
            });
            HeaderRow(t, "Node", "OEE%", "A%", "P%", "Good", "Downtime");
            var i = 0;
            foreach (var n in m.Breakdown.Take(Math.Max(1, maxRows)))
                BodyRow(t, i++ % 2 == 0, n.Name, $"{n.Oee.OeePct:0.0}", $"{n.Oee.AvailabilityPct:0}",
                    $"{n.Oee.PerformancePct:0}", $"{n.GoodCount:n0}", ReportDurationFormat.Minutes(n.DowntimeMin));
        });
    }

    private void HeaderRow(TableDescriptor t, params string[] cells)
    {
        foreach (var cell in cells)
            t.Cell().Background(Ink).PaddingVertical(5).PaddingHorizontal(4)
                .Text(cell).FontColor("#ffffff").Bold().FontSize(8);
    }

    private void BodyRow(TableDescriptor t, bool zebra, params string[] cells)
    {
        foreach (var cell in cells)
            BodyCell(t, zebra).Text(cell);
    }

    private IContainer BodyCell(TableDescriptor t, bool zebra)
    {
        var cell = t.Cell().BorderBottom(1).BorderColor(Border).PaddingVertical(4).PaddingHorizontal(4);
        return zebra ? cell.Background(Surface) : cell;
    }

    private static void Empty(IContainer c) => c.Text("No data in range.").FontColor(Muted).Italic();

    private static DateTime Local(DateTimeOffset dt) => dt.ToLocalTime().DateTime;
}
