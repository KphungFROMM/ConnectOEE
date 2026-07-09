using ConnectOEE.Core;
using ConnectOEE.Core.Oee;

namespace ConnectOEE.Tests;

public class ExtendedKpiCalculatorTests
{
    private static OeeInputs SampleInputs() =>
        new(3600, 3300, 3000, 2.0, 500, 20, ReworkCount: 5);

    private static OeeResult SampleOee() => OeeCalculator.Compute(SampleInputs());

    private static OeeTargets DefaultTargets() => new(85, 90, 95, 99);

    [Fact]
    public void Computes_target_gaps()
    {
        var oee = SampleOee();
        var ext = ExtendedKpiCalculator.Compute(
            oee, SampleInputs(), DefaultTargets(), 500, 5, true,
            new ResolvedQuantityTarget(null, null),
            new ResolvedQuantityTarget(null, null),
            StateTimeSeconds.Empty);

        Assert.Equal(Math.Round(oee.OeePct - 85, 2), ext.OeeGapPct);
        Assert.Equal(Math.Round(oee.AvailabilityPct - 90, 2), ext.AvailabilityGapPct);
    }

    [Fact]
    public void Utilization_is_planned_over_all_time()
    {
        var inputs = new OeeInputs(3600, 2700, 2400, 2.0, 100, 0);
        var oee = OeeCalculator.Compute(inputs);
        var ext = ExtendedKpiCalculator.Compute(
            oee, inputs, DefaultTargets(), 100, 0, false,
            new ResolvedQuantityTarget(null, null),
            new ResolvedQuantityTarget(null, null),
            StateTimeSeconds.Empty);

        Assert.Equal(75.0, ext.UtilizationPct);
    }

    [Fact]
    public void Cycle_variance_positive_when_slower_than_ideal()
    {
        var inputs = new OeeInputs(3600, 3600, 3600, 2.0, 900, 0); // actual cycle 4s
        var oee = OeeCalculator.Compute(inputs);
        var ext = ExtendedKpiCalculator.Compute(
            oee, inputs, DefaultTargets(), 900, 0, false,
            new ResolvedQuantityTarget(null, null),
            new ResolvedQuantityTarget(null, null),
            StateTimeSeconds.Empty);

        Assert.Equal(100.0, ext.CycleVariancePct);
    }

    [Fact]
    public void Run_attainment_uses_good_count_and_line_target_precedence()
    {
        var run = TargetQuantityResolver.ResolveRunTarget(1000, 800, 600);
        Assert.Equal(1000, run.Quantity);
        Assert.Equal("production-run", run.Source);

        var oee = SampleOee();
        var ext = ExtendedKpiCalculator.Compute(
            oee, SampleInputs(), DefaultTargets(), 250, 0, false,
            run, new ResolvedQuantityTarget(null, null), StateTimeSeconds.Empty);

        Assert.Equal(25.0, ext.RunAttainmentPct);
        Assert.Equal(750, ext.RunPartsRemaining);
    }

    [Fact]
    public void Shift_attainment_only_when_schedule_target_set()
    {
        var shift = TargetQuantityResolver.ResolveShiftTarget(2000, 1000, 800, 600);
        Assert.Equal(2000, shift.Quantity);
        Assert.Equal("schedule", shift.Source);

        var oee = SampleOee();
        var ext = ExtendedKpiCalculator.Compute(
            oee, SampleInputs(), DefaultTargets(), 500, 0, false,
            new ResolvedQuantityTarget(null, null), shift, StateTimeSeconds.Empty);

        Assert.Equal(25.0, ext.ShiftAttainmentPct);
    }
}

public class ReworkTrackingPolicyTests
{
    [Fact]
    public void Auto_active_only_when_mapped()
    {
        Assert.False(ReworkTrackingPolicy.IsActive(ReworkTrackingMode.Auto, false));
        Assert.True(ReworkTrackingPolicy.IsActive(ReworkTrackingMode.Auto, true));
    }

    [Fact]
    public void Off_zeros_rework_and_fpy_equals_yield()
    {
        var oee = OeeCalculator.Compute(new OeeInputs(3600, 3600, 3600, 6.0, 80, 10, ReworkCount: 10));
        Assert.Equal(0, ReworkTrackingPolicy.EffectiveReworkCount(10, false));
        Assert.Equal(oee.YieldPct, ReworkTrackingPolicy.EffectiveFpyPct(oee, false));
    }

    [Fact]
    public void On_always_active()
    {
        Assert.True(ReworkTrackingPolicy.IsActive(ReworkTrackingMode.On, false));
    }
}

public class StateTimeAccrualTests
{
    [Fact]
    public void Accrues_per_state_without_affecting_running_bucket()
    {
        var times = StateTimeSeconds.Empty;
        StateTimeAccrual.Accrue(ref times, RunState.Running, 100);
        StateTimeAccrual.Accrue(ref times, RunState.Idle, 50);
        StateTimeAccrual.Accrue(ref times, RunState.Down, 30);

        Assert.Equal(100, times.RunSec);
        Assert.Equal(50, times.IdleSec);
        Assert.Equal(30, times.DownSec);
        Assert.Equal(80, times.TotalStoppedSec);
    }
}

public class TargetQuantityResolverTests
{
    [Fact]
    public void Run_target_prefers_production_run_then_line_rate_then_recipe()
    {
        var r1 = TargetQuantityResolver.ResolveRunTarget(null, 500, 300);
        Assert.Equal(500, r1.Quantity);
        Assert.Equal("line-rate", r1.Source);

        var r2 = TargetQuantityResolver.ResolveRunTarget(1000, 500, 300);
        Assert.Equal(1000, r2.Quantity);
        Assert.Equal("production-run", r2.Source);
    }
}
