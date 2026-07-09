using ConnectOEE.Core;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace ConnectOEE.Reporting;

/// <summary>Branding inputs for the PDF header/footer (logo bytes + accent color).</summary>
public record ReportBranding(byte[]? AppLogo, byte[]? PlantLogo, string ProductName = "ConnectOEE", string AccentHex = "#1c7ed6");

/// <summary>
/// Renders a <see cref="ReportModel"/> to a branded, print-friendly PDF with QuestPDF.
/// Header carries the app/plant logo + title block; the footer carries a generated-on
/// timestamp and page numbers. Sections are chosen per <see cref="ReportType"/>.
/// </summary>
public class PdfReportRenderer
{
    static PdfReportRenderer()
    {
        // QuestPDF Community license (free for small businesses / open source).
        QuestPDF.Settings.License = LicenseType.Community;
    }

    private const string Ink = "#212529";
    private const string Muted = "#868e96";
    private const string Border = "#dee2e6";
    private const string SurfaceAlt = "#f1f3f5";

    public byte[] Render(ReportModel m, ReportBranding branding)
    {
        return Document.Create(doc =>
        {
            if (NeedsCover(m.ReportType))
                doc.Page(page => CoverPage(page, m, branding));

            doc.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.DefaultTextStyle(t => t.FontSize(9).FontColor(Ink));

                page.Header().Element(c => Header(c, m, branding));
                page.Content().PaddingVertical(10).Element(c => Content(c, m, branding));
                page.Footer().Element(c => Footer(c, branding));
            });
        }).GeneratePdf();
    }

    private static bool NeedsCover(ReportType type) =>
        type is ReportType.ExecutiveSummary or ReportType.WeeklySummary or ReportType.MonthlySummary;

    private void CoverPage(PageDescriptor page, ReportModel m, ReportBranding b)
    {
        page.Size(PageSizes.A4);
        page.Margin(48);
        page.Content().AlignMiddle().Column(col =>
        {
            col.Spacing(16);
            if (b.PlantLogo is { Length: > 0 })
                col.Item().AlignCenter().Height(64).Image(b.PlantLogo).FitHeight();
            else if (b.AppLogo is { Length: > 0 })
                col.Item().AlignCenter().Height(64).Image(b.AppLogo).FitHeight();

            col.Item().AlignCenter().Text(m.Title).FontSize(28).Bold().FontColor(b.AccentHex);
            col.Item().AlignCenter().Text($"{m.ScopeLevel}: {m.ScopeName}").FontSize(14).FontColor(Muted);
            col.Item().AlignCenter().Text(
                $"{Local(m.From):dddd, MMMM d, yyyy} – {Local(m.To):dddd, MMMM d, yyyy}")
                .FontSize(11).FontColor(Muted);
            col.Item().PaddingTop(24).AlignCenter().Text($"Generated {Local(m.GeneratedUtc):f}")
                .FontSize(10).FontColor(Muted);
            col.Item().AlignCenter().Text(b.ProductName).FontSize(10).Bold().FontColor(b.AccentHex);
        });
    }

    // ----- Header / footer -----

    private void Header(IContainer c, ReportModel m, ReportBranding b)
    {
        c.BorderBottom(2).BorderColor(b.AccentHex).PaddingBottom(8).Row(row =>
        {
            if (b.AppLogo is { Length: > 0 })
                row.ConstantItem(40).Height(40).Image(b.AppLogo).FitArea();

            row.RelativeItem().PaddingLeft(10).Column(col =>
            {
                col.Item().Text(m.Title).FontSize(18).Bold().FontColor(b.AccentHex);
                col.Item().Text($"{b.ProductName} · {m.ScopeLevel}: {m.ScopeName}").FontSize(10).FontColor(Muted);
                col.Item().Text($"{Local(m.From):ddd MMM d, yyyy HH:mm} – {Local(m.To):ddd MMM d, yyyy HH:mm}")
                    .FontSize(9).FontColor(Muted);
            });

            row.ConstantItem(150).Column(col =>
            {
                if (b.PlantLogo is { Length: > 0 })
                    col.Item().AlignRight().Height(36).Image(b.PlantLogo).FitHeight();
                col.Item().AlignRight().Text($"Generated {Local(m.GeneratedUtc):MMM d, yyyy HH:mm}")
                    .FontSize(8).FontColor(Muted);
            });
        });
    }

    private void Footer(IContainer c, ReportBranding b)
    {
        c.BorderTop(1).BorderColor(Border).PaddingTop(6).Row(row =>
        {
            row.RelativeItem().Text($"{b.ProductName} — on-prem OEE accelerator").FontSize(8).FontColor(Muted);
            row.RelativeItem().AlignRight().Text(t =>
            {
                t.DefaultTextStyle(s => s.FontSize(8).FontColor(Muted));
                t.Span("Page ");
                t.CurrentPageNumber();
                t.Span(" of ");
                t.TotalPages();
            });
        });
    }

    // ----- Content sections (chosen per report type) -----

    private void Content(IContainer c, ReportModel m, ReportBranding b)
    {
        c.Column(col =>
        {
            col.Spacing(14);
            col.Item().Element(x => KpiBand(x, m, b));

            switch (m.ReportType)
            {
                case ReportType.ShiftReport:
                case ReportType.DailyOee:
                    if (m.Shifts.Count > 0) col.Item().Element(x => Section(x, "Shift comparison", y => ShiftTable(y, m)));
                    col.Item().Element(x => Section(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend")));
                    col.Item().Element(x => Section(x, "OEE detail", y => TrendTable(y, m)));
                    col.Item().Element(x => Section(x, "Downtime by reason", y => ReasonTable(y, m, b)));
                    if (m.TopFaults.Count > 0) col.Item().Element(x => Section(x, "Top faults", y => FaultTable(y, m)));
                    break;

                case ReportType.DowntimePareto:
                    col.Item().Element(x => Section(x, "Downtime Pareto", y => ChartSection(y, m.ParetoChart, "Pareto")));
                    col.Item().Element(x => Section(x, "Downtime Pareto (by reason)", y => ReasonTable(y, m, b)));
                    col.Item().Element(x => Section(x, "Reliability metrics", y => ReliabilityTable(y, m)));
                    if (m.TopFaults.Count > 0) col.Item().Element(x => Section(x, "Top faults", y => FaultTable(y, m)));
                    break;

                case ReportType.ProductionVsTarget:
                    col.Item().Element(x => Section(x, "Production vs target", y => ChartSection(y, m.ProductionChart, "Production")));
                    col.Item().Element(x => Section(x, "Production detail", y => ProductionTable(y, m)));
                    col.Item().Element(x => Section(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend")));
                    break;

                case ReportType.FaultMaintenance:
                    col.Item().Element(x => Section(x, "Reliability metrics", y => ReliabilityTable(y, m)));
                    col.Item().Element(x => Section(x, "Top faults", y => FaultTable(y, m)));
                    col.Item().Element(x => Section(x, "Downtime by reason", y => ReasonTable(y, m, b)));
                    break;

                case ReportType.ExecutiveSummary:
                    if (m.Breakdown.Count > 0) col.Item().Element(x => Section(x, "Breakdown", y => BreakdownTable(y, m, b)));
                    col.Item().Element(x => Section(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend")));
                    col.Item().Element(x => Section(x, "Downtime by reason", y => ReasonTable(y, m, b)));
                    break;

                case ReportType.WeeklySummary:
                case ReportType.MonthlySummary:
                default:
                    col.Item().Element(x => Section(x, "OEE trend", y => ChartSection(y, m.OeeTrendChart, "OEE trend")));
                    if (m.Breakdown.Count > 0) col.Item().Element(x => Section(x, "Breakdown", y => BreakdownTable(y, m, b)));
                    col.Item().Element(x => Section(x, "Downtime by reason", y => ReasonTable(y, m, b)));
                    col.Item().Element(x => Section(x, "Reliability metrics", y => ReliabilityTable(y, m)));
                    break;
            }
        });
    }

    private void KpiBand(IContainer c, ReportModel m, ReportBranding b)
    {
        var oeeColor = OeeColor(m.Oee.OeePct, m.TargetOeePct);
        c.Row(row =>
        {
            row.Spacing(8);
            row.RelativeItem(2).Element(x => BigKpi(x, "OEE", $"{m.Oee.OeePct:0.0}%", oeeColor, $"Target {m.TargetOeePct:0}%"));
            row.RelativeItem().Element(x => MiniKpi(x, "Availability", $"{m.Oee.AvailabilityPct:0.0}%"));
            row.RelativeItem().Element(x => MiniKpi(x, "Performance", $"{m.Oee.PerformancePct:0.0}%"));
            row.RelativeItem().Element(x => MiniKpi(x, "Quality", $"{m.Oee.QualityPct:0.0}%"));
            row.RelativeItem().Element(x => MiniKpi(x, "Good", $"{m.GoodCount:n0}"));
            row.RelativeItem().Element(x => MiniKpi(x, "Reject", $"{m.RejectCount:n0}"));
            row.RelativeItem().Element(x => MiniKpi(x, "Uptime", ReportDurationFormat.Minutes(m.UptimeMin)));
            row.RelativeItem().Element(x => MiniKpi(x, "Downtime", ReportDurationFormat.Minutes(m.DowntimeMin)));
        });
    }

    private static string OeeColor(double oeePct, double targetPct)
    {
        if (oeePct >= targetPct) return "#2f9e44";
        if (oeePct >= targetPct * 0.7) return "#f08c00";
        return "#e03131";
    }

    private void ChartSection(IContainer c, byte[]? png, string fallbackTitle)
    {
        if (png is { Length: > 0 })
            c.Image(png).FitWidth();
        else
            c.Text($"{fallbackTitle}: insufficient data for chart.").FontColor(Muted).Italic();
    }

    private void BigKpi(IContainer c, string label, string value, string color, string sub)
    {
        c.Background(SurfaceAlt).Border(1).BorderColor(Border).Padding(10).Column(col =>
        {
            col.Item().Text(label).FontSize(9).Bold().FontColor(Muted);
            col.Item().Text(value).FontSize(26).Bold().FontColor(color);
            col.Item().Text(sub).FontSize(8).FontColor(Muted);
        });
    }

    private void MiniKpi(IContainer c, string label, string value)
    {
        c.Background(SurfaceAlt).Border(1).BorderColor(Border).Padding(8).Column(col =>
        {
            col.Item().Text(label).FontSize(8).FontColor(Muted);
            col.Item().Text(value).FontSize(14).Bold();
        });
    }

    private void Section(IContainer c, string title, Action<IContainer> body)
    {
        c.Column(col =>
        {
            col.Item().PaddingBottom(4).Text(title).FontSize(11).Bold().FontColor(Ink);
            col.Item().Element(body);
        });
    }

    // ----- Tables -----

    private void TrendTable(IContainer c, ReportModel m)
    {
        var rows = m.Trend.Where(p => p.TotalCount > 0 || p.DowntimeMin > 0 || p.Oee.OeePct > 0).ToList();
        if (rows.Count == 0) { Empty(c); return; }

        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "Period", "OEE%", "A%", "P%", "Q%", "Good", "Downtime");
            foreach (var p in rows.TakeLast(40))
                BodyRow(t, p.Label, $"{p.Oee.OeePct:0.0}", $"{p.Oee.AvailabilityPct:0}", $"{p.Oee.PerformancePct:0}", $"{p.Oee.QualityPct:0}", $"{p.GoodCount:n0}", ReportDurationFormat.Minutes(p.DowntimeMin));
        });
    }

    private void ProductionTable(IContainer c, ReportModel m)
    {
        var rows = m.Production.Where(p => p.TotalCount > 0 || p.TargetCount > 0).ToList();
        if (rows.Count == 0) { Empty(c); return; }

        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "Period", "Good", "Reject", "Total", "Target", "Scrap%");
            foreach (var p in rows.TakeLast(40))
                BodyRow(t, p.Label, $"{p.GoodCount:n0}", $"{p.RejectCount:n0}", $"{p.TotalCount:n0}", $"{p.TargetCount:n0}", $"{p.ScrapPct:0.0}");
        });
    }

    private void ReasonTable(IContainer c, ReportModel m, ReportBranding b)
    {
        if (m.Reasons.Count == 0) { Empty(c); return; }
        var max = m.Reasons.Max(r => r.TotalMin);

        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(3); cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(3); });
            HeaderRow(t, "Reason", "Category", "Count", "Minutes", "Share");
            foreach (var r in m.Reasons.Take(20))
            {
                BodyCell(t).Text(r.Reason);
                BodyCell(t).Text(r.Category).FontColor(Muted);
                BodyCell(t).AlignRight().Text($"{r.Count}");
                BodyCell(t).AlignRight().Text(ReportDurationFormat.Minutes(r.TotalMin));
                // Mini Pareto bar.
                BodyCell(t).PaddingVertical(2).Element(cell =>
                {
                    var frac = max > 0 ? (float)(r.TotalMin / max) : 0f;
                    cell.Height(10).Row(bar =>
                    {
                        bar.RelativeItem(Math.Max(0.001f, frac)).Background(b.AccentHex);
                        bar.RelativeItem(Math.Max(0.001f, 1 - frac));
                    });
                });
            }
        });
    }

    private void FaultTable(IContainer c, ReportModel m)
    {
        if (m.TopFaults.Count == 0) { Empty(c); return; }
        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(); cd.RelativeColumn(4); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "Code", "Mapped reason", "Count", "Minutes");
            foreach (var f in m.TopFaults)
                BodyRow(t, $"{f.Code}", f.Reason, $"{f.Count}", ReportDurationFormat.Minutes(f.TotalMin));
        });
    }

    private void ShiftTable(IContainer c, ReportModel m)
    {
        if (m.Shifts.Count == 0) { Empty(c); return; }
        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(2); cd.RelativeColumn(2); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "Shift", "Start", "OEE%", "A%", "P%", "Q%", "Good", "Downtime");
            foreach (var s in m.Shifts)
                BodyRow(t, s.ShiftName, $"{Local(s.StartUtc):MM/dd HH:mm}", $"{s.OeePct:0.0}", $"{s.AvailabilityPct:0}", $"{s.PerformancePct:0}", $"{s.QualityPct:0}", $"{s.GoodCount:n0}", ReportDurationFormat.Minutes(s.DowntimeMinutes));
        });
    }

    private void BreakdownTable(IContainer c, ReportModel m, ReportBranding b)
    {
        if (m.Breakdown.Count == 0) { Empty(c); return; }
        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(3); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "Node", "OEE%", "A%", "P%", "Good", "Downtime");
            foreach (var n in m.Breakdown)
                BodyRow(t, n.Name, $"{n.Oee.OeePct:0.0}", $"{n.Oee.AvailabilityPct:0}", $"{n.Oee.PerformancePct:0}", $"{n.GoodCount:n0}", ReportDurationFormat.Minutes(n.DowntimeMin));
        });
    }

    private void ReliabilityTable(IContainer c, ReportModel m)
    {
        var r = m.Reliability;
        c.Table(t =>
        {
            t.ColumnsDefinition(cd => { cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); cd.RelativeColumn(); });
            HeaderRow(t, "MTTR", "MTBF", "MTTF", "MTTD");
            BodyRow(t, ReportDurationFormat.Minutes(r.MttrMin), ReportDurationFormat.Minutes(r.MtbfMin), ReportDurationFormat.Minutes(r.MttfMin), ReportDurationFormat.Minutes(r.MttdMin));
            HeaderRow(t, "Stops/hr", "Failures", "Planned", "Unplanned");
            BodyRow(t, $"{r.StopsPerHour:0.00}", $"{r.FailureCount}", ReportDurationFormat.Minutes(r.PlannedDowntimeMin), ReportDurationFormat.Minutes(r.UnplannedDowntimeMin));
        });
    }

    // ----- Table helpers -----

    private void HeaderRow(TableDescriptor t, params string[] cells)
    {
        foreach (var cell in cells)
            t.Cell().Background(Ink).Padding(4).Text(cell).FontColor("#ffffff").Bold().FontSize(8);
    }

    private void BodyRow(TableDescriptor t, params string[] cells)
    {
        foreach (var cell in cells)
            BodyCell(t).Text(cell);
    }

    private IContainer BodyCell(TableDescriptor t)
        => t.Cell().BorderBottom(1).BorderColor(Border).PaddingVertical(3).PaddingHorizontal(4);

    private static void Empty(IContainer c) => c.Text("No data in range.").FontColor(Muted).Italic();

    private static DateTime Local(DateTimeOffset dt) => dt.ToLocalTime().DateTime;
}
