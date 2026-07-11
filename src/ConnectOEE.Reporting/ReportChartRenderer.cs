using ConnectOEE.Core.Oee;
using ConnectOEE.Historian;
using ScottPlot;
using Colors = ScottPlot.Colors;

namespace ConnectOEE.Reporting;

/// <summary>Renders branded chart PNGs embedded in PDF reports.</summary>
public class ReportChartRenderer
{
    private static readonly ScottPlot.Color Accent = Color.FromHex("#1c7ed6");
    private static readonly ScottPlot.Color AccentSoft = Color.FromHex("#74c0fc");
    private static readonly ScottPlot.Color TargetLine = Color.FromHex("#e03131");
    private static readonly ScottPlot.Color Grid = Color.FromHex("#e9ecef");
    private static readonly ScottPlot.Color Ink = Color.FromHex("#212529");
    private static readonly ScottPlot.Color Green = Color.FromHex("#2f9e44");
    private static readonly ScottPlot.Color Amber = Color.FromHex("#f08c00");
    private static readonly ScottPlot.Color Red = Color.FromHex("#e03131");

    private const int ChartWidth = 900;
    private const int ChartHeight = 280;

    public byte[]? RenderOeeTrend(IReadOnlyList<TrendPoint> points)
    {
        var rows = points.Where(p => p.Oee.OeePct > 0 || p.TotalCount > 0).TakeLast(24).ToList();
        if (rows.Count < 2) return null;

        var plt = CreatePlot("OEE trend", "OEE %");
        var bars = plt.Add.Bars(
            rows.Select((_, i) => (double)i).ToArray(),
            rows.Select(p => p.Oee.OeePct).ToArray());
        bars.Color = Accent;
        ApplyCategoryTicks(plt, rows.Select(p => ShortLabel(p.Label)).ToArray());
        plt.Axes.SetLimitsY(0, Math.Max(100, rows.Max(p => p.Oee.OeePct) * 1.12));
        return plt.GetImageBytes(ChartWidth, ChartHeight, ImageFormat.Png);
    }

    public byte[]? RenderPareto(IReadOnlyList<ReasonBucket> reasons)
    {
        var rows = reasons.OrderByDescending(r => r.TotalMin).Take(10).ToList();
        if (rows.Count == 0) return null;

        var plt = CreatePlot("Downtime Pareto", "Minutes");
        var bars = plt.Add.Bars(
            rows.Select((_, i) => (double)i).ToArray(),
            rows.Select(r => r.TotalMin).ToArray());
        bars.Color = Accent;
        ApplyCategoryTicks(plt, rows.Select(r => ShortLabel(r.Reason, 14)).ToArray());
        return plt.GetImageBytes(ChartWidth, ChartHeight, ImageFormat.Png);
    }

    public byte[]? RenderProductionVsTarget(IReadOnlyList<ProductionPoint> points)
    {
        var rows = points.Where(p => p.TotalCount > 0 || p.TargetCount > 0).TakeLast(24).ToList();
        if (rows.Count < 2) return null;

        var xs = rows.Select((_, i) => (double)i).ToArray();
        var plt = CreatePlot("Production vs target", "Count");
        var bars = plt.Add.Bars(xs, rows.Select(p => (double)p.GoodCount).ToArray());
        bars.Color = AccentSoft;
        bars.LegendText = "Good";

        var scatter = plt.Add.Scatter(xs, rows.Select(p => (double)p.TargetCount).ToArray());
        scatter.Color = TargetLine;
        scatter.LineWidth = 2;
        scatter.MarkerSize = 4;
        scatter.LegendText = "Target";

        plt.ShowLegend(Alignment.UpperRight);
        ApplyCategoryTicks(plt, rows.Select(p => ShortLabel(p.Label)).ToArray());
        return plt.GetImageBytes(ChartWidth, ChartHeight, ImageFormat.Png);
    }

    /// <summary>Single-value OEE ring for the KPI hero (percent 0–100).</summary>
    public byte[] RenderPercentRing(double pct, double targetPct, string label = "OEE")
    {
        var value = Math.Clamp(pct, 0, 100);
        var color = StatusColor(pct, targetPct);
        var plt = new Plot();
        plt.FigureBackground.Color = Colors.White;
        plt.DataBackground.Color = Colors.White;
        plt.HideGrid();
        plt.Axes.Frameless();

        var gauge = plt.Add.RadialGaugePlot(new[] { value });
        gauge.MaximumAngle = 270;
        gauge.StartingAngle = 135;
        gauge.CircularBackground = true;
        gauge.Labels = new[] { $"{value:0.0}%" };
        gauge.Colors = new[] { color };
        gauge.BackgroundTransparencyFraction = 0.15;
        gauge.SpaceFraction = 0.35;
        gauge.FontSizeFraction = 0.22;
        gauge.ShowLevels = true;
        gauge.LabelPositionFraction = 0.5;

        plt.Title(label);
        plt.Axes.Title.Label.FontSize = 12;
        plt.Axes.Title.Label.ForeColor = Ink;
        return plt.GetImageBytes(200, 180, ImageFormat.Png);
    }

    /// <summary>Compact sparkline from a series of percent values.</summary>
    public byte[]? RenderSparkline(IReadOnlyList<double> values, string? colorHex = null, int width = 480, int height = 40)
    {
        var rows = values.Where(v => !double.IsNaN(v) && !double.IsInfinity(v)).TakeLast(24).ToList();
        if (rows.Count < 2) return null;

        var plt = new Plot();
        plt.FigureBackground.Color = Colors.White;
        plt.DataBackground.Color = Colors.White;
        plt.HideGrid();
        plt.Axes.Frameless();
        plt.Layout.Frameless();

        var xs = rows.Select((_, i) => (double)i).ToArray();
        var ys = rows.ToArray();
        var line = plt.Add.ScatterLine(xs, ys);
        line.Color = Color.FromHex(colorHex ?? "#1c7ed6");
        line.LineWidth = 2.5f;
        line.MarkerSize = 0;

        var max = Math.Max(100, rows.Max() * 1.05);
        var min = Math.Min(0, rows.Min() * 0.95);
        plt.Axes.SetLimits(0, rows.Count - 1, min, max);
        return plt.GetImageBytes(width, height, ImageFormat.Png);
    }

    public byte[]? RenderOeeSparkline(IReadOnlyList<TrendPoint> points) =>
        RenderSparkline(
            points.Where(p => p.Oee.OeePct > 0 || p.TotalCount > 0).Select(p => p.Oee.OeePct).ToList(),
            "#1c7ed6",
            width: 240,
            height: 48);

    public byte[]? RenderAvailabilitySparkline(IReadOnlyList<TrendPoint> points) =>
        RenderSparkline(
            points.Where(p => p.Oee.AvailabilityPct > 0 || p.TotalCount > 0).Select(p => p.Oee.AvailabilityPct).ToList(),
            "#2f9e44",
            width: 640,
            height: 40);

    public byte[]? RenderPerformanceSparkline(IReadOnlyList<TrendPoint> points) =>
        RenderSparkline(
            points.Where(p => p.Oee.PerformancePct > 0 || p.TotalCount > 0).Select(p => p.Oee.PerformancePct).ToList(),
            "#1c7ed6",
            width: 640,
            height: 40);

    public byte[]? RenderQualitySparkline(IReadOnlyList<TrendPoint> points) =>
        RenderSparkline(
            points.Where(p => p.Oee.QualityPct > 0 || p.TotalCount > 0).Select(p => p.Oee.QualityPct).ToList(),
            "#7048e8",
            width: 640,
            height: 40);

    private static ScottPlot.Color StatusColor(double pct, double targetPct)
    {
        if (pct >= targetPct) return Green;
        if (pct >= targetPct * 0.7) return Amber;
        return Red;
    }

    private static Plot CreatePlot(string title, string yLabel)
    {
        var plt = new Plot();
        plt.Title(title);
        plt.Axes.Left.Label.Text = yLabel;
        plt.Axes.Left.Label.ForeColor = Ink;
        plt.Axes.Bottom.Label.ForeColor = Ink;
        plt.FigureBackground.Color = Colors.White;
        plt.DataBackground.Color = Colors.White;
        plt.Grid.MajorLineColor = Grid;
        plt.Axes.Color(Ink);
        return plt;
    }

    private static void ApplyCategoryTicks(Plot plt, string[] labels)
    {
        plt.Axes.Bottom.SetTicks(
            labels.Select((_, i) => (double)i).ToArray(),
            labels);
        plt.Axes.Bottom.TickLabelStyle.Rotation = -35;
        plt.Axes.Bottom.TickLabelStyle.Alignment = Alignment.MiddleRight;
        plt.Axes.Bottom.MinimumSize = 48;
    }

    private static string ShortLabel(string label, int max = 10)
    {
        if (string.IsNullOrEmpty(label)) return "";
        return label.Length > max ? label[..max] + "…" : label;
    }
}
