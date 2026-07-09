using ConnectOEE.Core.Oee;

namespace ConnectOEE.Tests;

public class ShiftWindowCalculatorTests
{
    private static readonly TimeZoneInfo Utc = TimeZoneInfo.Utc;

    [Fact]
    public void ComputeTimeBalance_subtracts_breaks_and_planned_down()
    {
        // 8 h shift, 30 min lunch, 30 min planned changeover -> 7 h planned production time
        var allSec = 8 * 3600.0;
        var breakSec = 30 * 60.0;
        var plannedDownSec = 30 * 60.0;
        var result = ShiftWindowCalculator.ComputeTimeBalance(allSec, breakSec, plannedDownSec, runTimeSec: 6 * 3600);

        Assert.Equal(7 * 3600, result.PlannedTimeSec, 0);
        Assert.Equal(6 * 3600, result.RunTimeSec, 0);
    }

    [Fact]
    public void ComputeTimeBalance_partial_shift_before_lunch()
    {
        // 2 h elapsed, lunch not yet reached -> planned time = 2 h
        var allSec = 2 * 3600.0;
        var result = ShiftWindowCalculator.ComputeTimeBalance(allSec, breakOverlapSec: 0, plannedDownSec: 0, runTimeSec: 7200);
        Assert.Equal(7200, result.PlannedTimeSec, 0);
    }

    [Fact]
    public void ComputeTimeBalance_caps_run_time_at_planned_time()
    {
        var result = ShiftWindowCalculator.ComputeTimeBalance(3600, 0, 0, runTimeSec: 5000);
        Assert.Equal(3600, result.PlannedTimeSec, 0);
        Assert.Equal(3600, result.RunTimeSec, 0);
    }

    [Fact]
    public void BreakOverlapSec_counts_only_overlapping_portion()
    {
        var shiftStart = new DateTimeOffset(2026, 6, 28, 6, 0, 0, TimeSpan.Zero);
        var windowEnd = new DateTimeOffset(2026, 6, 28, 10, 0, 0, TimeSpan.Zero);
        var breaks = ShiftWindowCalculator.BuildBreakIntervalsUtc(
            new DateOnly(2026, 6, 28),
            Utc,
            [(new TimeOnly(12, 0), new TimeOnly(12, 30))]);

        // Lunch hasn't started yet at 10:00
        var overlap = ShiftWindowCalculator.BreakOverlapSec(shiftStart, windowEnd, breaks);
        Assert.Equal(0, overlap, 0);

        // At 13:00 window includes lunch
        var laterEnd = new DateTimeOffset(2026, 6, 28, 13, 0, 0, TimeSpan.Zero);
        overlap = ShiftWindowCalculator.BreakOverlapSec(shiftStart, laterEnd, breaks);
        Assert.Equal(30 * 60, overlap, 0);
    }

    [Fact]
    public void AccrualSecExcludingBreaks_excludes_partial_overlap()
    {
        var sampleStart = new DateTimeOffset(2026, 6, 28, 11, 45, 0, TimeSpan.Zero);
        var sampleEnd = new DateTimeOffset(2026, 6, 28, 12, 15, 0, TimeSpan.Zero);
        var breaks = ShiftWindowCalculator.BuildBreakIntervalsUtc(
            new DateOnly(2026, 6, 28),
            Utc,
            [(new TimeOnly(12, 0), new TimeOnly(12, 30))]);

        // 30 min poll spanning 15 min before + 15 min during lunch -> 15 min accrual
        var accrual = ShiftWindowCalculator.AccrualSecExcludingBreaks(sampleStart, sampleEnd, breaks);
        Assert.Equal(15 * 60, accrual, 0);
    }

    [Fact]
    public void CalendarElapsedSec_caps_at_shift_end()
    {
        var start = new DateTimeOffset(2026, 6, 28, 6, 0, 0, TimeSpan.Zero);
        var end = new DateTimeOffset(2026, 6, 28, 14, 0, 0, TimeSpan.Zero);
        var now = new DateTimeOffset(2026, 6, 28, 16, 0, 0, TimeSpan.Zero);

        Assert.Equal(8 * 3600, ShiftWindowCalculator.CalendarElapsedSec(start, end, now), 0);
    }

    [Fact]
    public void IntervalOverlapSec_sums_multiple_intervals()
    {
        var windowStart = new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero);
        var windowEnd = new DateTimeOffset(2026, 1, 1, 4, 0, 0, TimeSpan.Zero);
        var intervals = new List<ShiftWindowCalculator.TimeInterval>
        {
            new(new DateTimeOffset(2026, 1, 1, 1, 0, 0, TimeSpan.Zero), new DateTimeOffset(2026, 1, 1, 1, 30, 0, TimeSpan.Zero)),
            new(new DateTimeOffset(2026, 1, 1, 2, 0, 0, TimeSpan.Zero), new DateTimeOffset(2026, 1, 1, 2, 15, 0, TimeSpan.Zero)),
        };

        Assert.Equal(45 * 60, ShiftWindowCalculator.IntervalOverlapSec(windowStart, windowEnd, intervals), 0);
    }
}
