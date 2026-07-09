namespace ConnectOEE.Core.Oee;

/// <summary>
/// Pure shift-window math for OEE time balance: break overlap, accrual exclusion,
/// and planned production time from calendar inputs.
/// </summary>
public static class ShiftWindowCalculator
{
    public readonly record struct TimeInterval(DateTimeOffset StartUtc, DateTimeOffset EndUtc);

    public readonly record struct TimeBalanceResult(double PlannedTimeSec, double RunTimeSec);

    /// <summary>Sum of overlap between [windowStart, windowEnd) and each interval.</summary>
    public static double IntervalOverlapSec(
        DateTimeOffset windowStart,
        DateTimeOffset windowEnd,
        IReadOnlyList<TimeInterval> intervals)
    {
        if (windowEnd <= windowStart || intervals.Count == 0) return 0;

        double total = 0;
        foreach (var iv in intervals)
        {
            var overlapStart = windowStart > iv.StartUtc ? windowStart : iv.StartUtc;
            var overlapEnd = windowEnd < iv.EndUtc ? windowEnd : iv.EndUtc;
            if (overlapEnd > overlapStart)
                total += (overlapEnd - overlapStart).TotalSeconds;
        }

        return Math.Max(0, total);
    }

    /// <summary>
    /// Seconds in [sampleStart, sampleEnd) excluding time inside break intervals.
    /// </summary>
    public static double AccrualSecExcludingBreaks(
        DateTimeOffset sampleStart,
        DateTimeOffset sampleEnd,
        IReadOnlyList<TimeInterval> breakIntervals)
    {
        var span = Math.Max(0, (sampleEnd - sampleStart).TotalSeconds);
        if (span <= 0) return 0;
        var overlap = IntervalOverlapSec(sampleStart, sampleEnd, breakIntervals);
        return Math.Max(0, span - overlap);
    }

    /// <summary>
    /// Builds UTC break intervals from local time-of-day windows on the shift anchor date.
    /// </summary>
    public static IReadOnlyList<TimeInterval> BuildBreakIntervalsUtc(
        DateOnly shiftAnchorDate,
        TimeZoneInfo plantTz,
        IEnumerable<(TimeOnly Start, TimeOnly End)> breaks)
    {
        var list = new List<TimeInterval>();
        foreach (var (start, end) in breaks)
        {
            var startLocal = shiftAnchorDate.ToDateTime(start);
            var endDate = end <= start ? shiftAnchorDate.AddDays(1) : shiftAnchorDate;
            var endLocal = endDate.ToDateTime(end);
            var startUtc = ToUtc(startLocal, plantTz);
            var endUtc = ToUtc(endLocal, plantTz);
            if (endUtc > startUtc)
                list.Add(new TimeInterval(startUtc, endUtc));
        }

        return list;
    }

    /// <summary>
    /// Overlap of break intervals with [shiftStartUtc, windowEndUtc).
    /// </summary>
    public static double BreakOverlapSec(
        DateTimeOffset shiftStartUtc,
        DateTimeOffset windowEndUtc,
        IReadOnlyList<TimeInterval> breakIntervalsUtc)
        => IntervalOverlapSec(shiftStartUtc, windowEndUtc, breakIntervalsUtc);

    /// <summary>
    /// Canonical planned production time and capped run time for OEE inputs.
    /// </summary>
    public static TimeBalanceResult ComputeTimeBalance(
        double allTimeSec,
        double breakOverlapSec,
        double plannedDownSec,
        double runTimeSec)
    {
        var plannedTime = Math.Max(0, allTimeSec - breakOverlapSec - plannedDownSec);
        var runTime = Math.Min(Math.Max(0, runTimeSec), plannedTime);
        return new TimeBalanceResult(plannedTime, runTime);
    }

    /// <summary>Calendar elapsed seconds capped at shift end.</summary>
    public static double CalendarElapsedSec(
        DateTimeOffset shiftStartUtc,
        DateTimeOffset shiftEndUtc,
        DateTimeOffset nowUtc)
    {
        var effectiveEnd = nowUtc < shiftEndUtc ? nowUtc : shiftEndUtc;
        return Math.Max(0, (effectiveEnd - shiftStartUtc).TotalSeconds);
    }

    public static DateTimeOffset ToUtc(DateTime localUnspecified, TimeZoneInfo tz)
    {
        var local = DateTime.SpecifyKind(localUnspecified, DateTimeKind.Unspecified);
        var offset = tz.GetUtcOffset(local);
        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    public static TimeZoneInfo ResolveTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch
        {
            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windowsId))
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(windowsId); }
                catch { /* fall through */ }
            }

            return TimeZoneInfo.Utc;
        }
    }
}
