namespace ConnectOEE.Reporting;

/// <summary>Formats minute values as Xh Ym for PDF/CSV output (matches frontend formatDuration).</summary>
public static class ReportDurationFormat
{
    public static string Minutes(double minutes)
    {
        var total = Math.Max(0, (int)Math.Round(minutes));
        var h = total / 60;
        var m = total % 60;
        return $"{h}h {m}m";
    }
}
