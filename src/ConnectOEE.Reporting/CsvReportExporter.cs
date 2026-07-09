using System.Globalization;
using System.Text;
using ConnectOEE.Core;
using CsvHelper;

namespace ConnectOEE.Reporting;

/// <summary>
/// Exports a <see cref="ReportModel"/> to CSV. The most relevant dataset for the
/// report type becomes the table body, preceded by a short KPI summary block so the
/// file is self-describing when opened in Excel.
/// </summary>
public class CsvReportExporter
{
    public byte[] Export(ReportModel m)
    {
        var sb = new StringBuilder();
        using (var writer = new StringWriter(sb))
        using (var csv = new CsvWriter(writer, CultureInfo.InvariantCulture))
        {
            // ----- Summary block -----
            WriteKv(csv, "Report", m.Title);
            WriteKv(csv, "Scope", $"{m.ScopeLevel}: {m.ScopeName}");
            WriteKv(csv, "From", m.From.ToLocalTime().ToString("u"));
            WriteKv(csv, "To", m.To.ToLocalTime().ToString("u"));
            WriteKv(csv, "Generated", m.GeneratedUtc.ToLocalTime().ToString("u"));
            WriteKv(csv, "OEE%", m.Oee.OeePct.ToString("0.00"));
            WriteKv(csv, "Availability%", m.Oee.AvailabilityPct.ToString("0.00"));
            WriteKv(csv, "Performance%", m.Oee.PerformancePct.ToString("0.00"));
            WriteKv(csv, "Quality%", m.Oee.QualityPct.ToString("0.00"));
            WriteKv(csv, "Good", m.GoodCount.ToString());
            WriteKv(csv, "Reject", m.RejectCount.ToString());
            WriteKv(csv, "Downtime", ReportDurationFormat.Minutes(m.DowntimeMin));
            WriteKv(csv, "Uptime", ReportDurationFormat.Minutes(m.UptimeMin));
            csv.NextRecord();

            switch (m.ReportType)
            {
                case ReportType.ProductionVsTarget:
                    WriteProduction(csv, m);
                    break;
                case ReportType.DowntimePareto:
                case ReportType.FaultMaintenance:
                    WriteReasons(csv, m);
                    break;
                default:
                    WriteTrend(csv, m);
                    break;
            }
        }
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    private static void WriteKv(CsvWriter csv, string k, string v)
    {
        csv.WriteField(k);
        csv.WriteField(v);
        csv.NextRecord();
    }

    private static void WriteTrend(CsvWriter csv, ReportModel m)
    {
        foreach (var h in new[] { "Period", "OEE%", "Availability%", "Performance%", "Quality%", "Good", "Reject", "Total", "DowntimeMin" })
            csv.WriteField(h);
        csv.NextRecord();
        foreach (var p in m.Trend)
        {
            csv.WriteField(p.Label);
            csv.WriteField(p.Oee.OeePct);
            csv.WriteField(p.Oee.AvailabilityPct);
            csv.WriteField(p.Oee.PerformancePct);
            csv.WriteField(p.Oee.QualityPct);
            csv.WriteField(p.GoodCount);
            csv.WriteField(p.RejectCount);
            csv.WriteField(p.TotalCount);
            csv.WriteField(p.DowntimeMin);
            csv.NextRecord();
        }
    }

    private static void WriteProduction(CsvWriter csv, ReportModel m)
    {
        foreach (var h in new[] { "Period", "Good", "Reject", "Total", "Target", "Scrap%" })
            csv.WriteField(h);
        csv.NextRecord();
        foreach (var p in m.Production)
        {
            csv.WriteField(p.Label);
            csv.WriteField(p.GoodCount);
            csv.WriteField(p.RejectCount);
            csv.WriteField(p.TotalCount);
            csv.WriteField(p.TargetCount);
            csv.WriteField(p.ScrapPct);
            csv.NextRecord();
        }
    }

    private static void WriteReasons(CsvWriter csv, ReportModel m)
    {
        foreach (var h in new[] { "Category", "Kind", "Reason", "Count", "Minutes" })
            csv.WriteField(h);
        csv.NextRecord();
        foreach (var r in m.Reasons)
        {
            csv.WriteField(r.Category);
            csv.WriteField(r.Kind);
            csv.WriteField(r.Reason);
            csv.WriteField(r.Count);
            csv.WriteField(r.TotalMin);
            csv.NextRecord();
        }
    }
}
