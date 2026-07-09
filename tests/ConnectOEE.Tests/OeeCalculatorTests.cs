using ConnectOEE.Core.Oee;

namespace ConnectOEE.Tests;

public class OeeCalculatorTests
{
    [Fact]
    public void Computes_textbook_oee_example()
    {
        // Classic OEE worked example:
        //  Planned production time = 420 min, downtime = 47 min -> run = 373 min
        //  Ideal cycle = 1.0 s/part, total = 19,271 parts, rejects = 423
        var inputs = new OeeInputs(
            AllTimeSec: 480 * 60,
            PlannedTimeSec: 420 * 60,
            RunTimeSec: 373 * 60,
            IdealCycleTimeSec: 1.0,
            GoodCount: 19271 - 423,
            RejectCount: 423);

        var r = OeeCalculator.Compute(inputs);

        Assert.Equal(88.81, r.AvailabilityPct, 1);
        Assert.Equal(86.12, r.PerformancePct, 1);
        Assert.Equal(97.80, r.QualityPct, 1);
        Assert.Equal(74.79, r.OeePct, 1);
    }

    [Fact]
    public void Performance_is_capped_at_100pct()
    {
        var inputs = new OeeInputs(600, 600, 600, 2.0, 400, 0); // ideal time 800s > run 600s
        var r = OeeCalculator.Compute(inputs);
        Assert.Equal(100.0, r.PerformancePct, 2);
    }

    [Fact]
    public void Empty_inputs_yield_zeroes_not_nan()
    {
        var r = OeeCalculator.Compute(new OeeInputs(0, 0, 0, 0, 0, 0));
        Assert.Equal(0, r.OeePct);
        Assert.Equal(0, r.AvailabilityPct);
        Assert.False(double.IsNaN(r.PerformancePct));
    }

    [Fact]
    public void Quality_loss_counts_rejects_at_ideal_cycle()
    {
        var r = OeeCalculator.Compute(new OeeInputs(3600, 3600, 3600, 6.0, 100, 10));
        Assert.Equal(1.0, r.QualityLossMin, 2); // 10 rejects * 6s = 60s = 1 min
    }

    [Fact]
    public void Fpy_excludes_rework_from_first_pass_denominator()
    {
        // 80 good (first pass), 10 rejects, 10 rework -> FPY = 80 / (80+10+10) = 80%
        var r = OeeCalculator.Compute(new OeeInputs(3600, 3600, 3600, 6.0, 80, 10, ReworkCount: 10));
        Assert.Equal(80.0, r.FpyPct, 2);
        // Yield still uses total count (good / (good+reject))
        Assert.Equal(88.89, r.YieldPct, 2);
    }
}

public class ReliabilityCalculatorTests
{
    [Fact]
    public void Computes_mttr_mtbf_and_availability()
    {
        var downtimes = new List<DowntimeStat>
        {
            new(600, null, true),  // 10 min unplanned
            new(1200, null, true), // 20 min unplanned
        };
        var r = ReliabilityCalculator.Compute(new ReliabilityInputs(
            PeriodSec: 8 * 3600,
            TotalUptimeSec: 6 * 3600,
            Downtimes: downtimes));

        Assert.Equal(2, r.DowntimeCount);
        Assert.Equal(2, r.FailureCount);
        Assert.Equal(15.0, r.MttrMin, 2);  // (10+20)/2
        Assert.Equal(180.0, r.MtbfMin, 2); // 6h uptime / 2 failures = 3h
        Assert.True(r.AvailabilityFromReliabilityPct is > 90 and < 100);
    }

    [Fact]
    public void Planned_stops_excluded_from_failures()
    {
        var downtimes = new List<DowntimeStat>
        {
            new(600, null, false), // planned
            new(600, null, true),  // unplanned
        };
        var r = ReliabilityCalculator.Compute(new ReliabilityInputs(3600, 1800, downtimes));
        Assert.Equal(1, r.FailureCount);
        Assert.Equal(2, r.DowntimeCount);
        Assert.Equal(10.0, r.PlannedDowntimeMin, 2);
    }
}
