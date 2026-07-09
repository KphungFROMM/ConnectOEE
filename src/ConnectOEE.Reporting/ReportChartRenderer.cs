using ConnectOEE.Core.Oee;
using ConnectOEE.Historian;
using ScottPlot;

namespace ConnectOEE.Reporting;

/// <summary>Renders chart PNGs embedded in PDF reports.</summary>
public class ReportChartRenderer
{
    public byte[]? RenderOeeTrend(IReadOnlyList<TrendPoint> points)
    {
        var rows = points.Where(p => p.Oee.OeePct > 0 || p.TotalCount > 0).TakeLast(24).ToList();
        if (rows.Count < 2) return null;

        var plt = new Plot();
        plt.Add.Bars(rows.Select((p, i) => (double)i).ToArray(), rows.Select(p => p.Oee.OeePct).ToArray());
        plt.Axes.Bottom.SetTicks(
            rows.Select((_, i) => (double)i).ToArray(),
            rows.Select(p => p.Label.Length > 8 ? p.Label[..8] : p.Label).ToArray());
        plt.Axes.Left.Label.Text = "OEE %";
        plt.Title("OEE trend");
        plt.Axes.SetLimitsY(0, Math.Max(100, rows.Max(p => p.Oee.OeePct) * 1.1));
        return plt.GetImageBytes(640, 220, ImageFormat.Png);
    }

    public byte[]? RenderPareto(IReadOnlyList<ReasonBucket> reasons)
    {
        var rows = reasons.OrderByDescending(r => r.TotalMin).Take(10).ToList();
        if (rows.Count == 0) return null;

        var plt = new Plot();
        plt.Add.Bars(
            rows.Select((_, i) => (double)i).ToArray(),
            rows.Select(r => r.TotalMin).ToArray());
        plt.Axes.Bottom.SetTicks(
            rows.Select((_, i) => (double)i).ToArray(),
            rows.Select(r => r.Reason.Length > 12 ? r.Reason[..12] + "…" : r.Reason).ToArray());
        plt.Axes.Left.Label.Text = "Minutes";
        plt.Title("Downtime Pareto");
        return plt.GetImageBytes(640, 220, ImageFormat.Png);
    }

    public byte[]? RenderProductionVsTarget(IReadOnlyList<ProductionPoint> points)
    {
        var rows = points.Where(p => p.TotalCount > 0 || p.TargetCount > 0).TakeLast(24).ToList();
        if (rows.Count < 2) return null;

        var xs = rows.Select((_, i) => (double)i).ToArray();
        var plt = new Plot();
        plt.Add.Bars(xs, rows.Select(p => (double)p.GoodCount).ToArray());
        plt.Add.Scatter(xs, rows.Select(p => (double)p.TargetCount).ToArray());
        plt.Axes.Bottom.SetTicks(xs, rows.Select(p => p.Label.Length > 8 ? p.Label[..8] : p.Label).ToArray());
        plt.Axes.Left.Label.Text = "Count";
        plt.Title("Production vs target");
        return plt.GetImageBytes(640, 220, ImageFormat.Png);
    }
}
