using ConnectOEE.Core.Oee;

namespace ConnectOEE.Tests;

public class PartsLossCalculatorTests
{
    [Fact]
    public void Converts_apq_loss_minutes_to_parts_at_ideal_rate()
    {
        // 2s ideal cycle => 1800 pph. 10 min availability loss => 300 parts.
        var inputs = new OeeInputs(
            AllTimeSec: 3600,
            PlannedTimeSec: 3600,
            RunTimeSec: 3000,
            IdealCycleTimeSec: 2.0,
            GoodCount: 1400,
            RejectCount: 50);
        var oee = OeeCalculator.Compute(inputs);
        var result = PartsLossCalculator.Compute(inputs, oee);

        Assert.Equal(1800, result.MaxPossibleParts);
        Assert.Equal(1500, result.TheoreticalOutput);
        Assert.Equal(300, result.PartsLostAvailability);
        Assert.True(result.PartsLostPerformance >= 0);
        Assert.Equal(50, result.PartsLostQuality);
        Assert.Equal(1400 + result.PartsLostAvailability + result.PartsLostPerformance + 50, result.PartsCouldHaveMade);
    }

    [Fact]
    public void Zero_ideal_cycle_returns_empty()
    {
        var inputs = new OeeInputs(3600, 3600, 3000, 0, 100, 0);
        var oee = OeeCalculator.Compute(inputs);
        var result = PartsLossCalculator.Compute(inputs, oee);
        Assert.Equal(0, result.MaxPossibleParts);
        Assert.Equal(0, result.PartsLostAvailability);
    }

    [Fact]
    public void Breakdown_parts_from_down_state_seconds()
    {
        var inputs = new OeeInputs(3600, 3600, 3000, 2.0, 1000, 0);
        var oee = OeeCalculator.Compute(inputs);
        var states = new StateTimeSeconds(3000, 0, 0, 120, 0, 0, 0, 0);
        var result = PartsLossCalculator.Compute(inputs, oee, states);
        Assert.Equal(60, result.PartsLostBreakdown);
    }

    [Fact]
    public void Expected_pace_uses_elapsed_shift_hours()
    {
        var inputs = new OeeInputs(3600, 3600, 1800, 2.0, 500, 0);
        var oee = OeeCalculator.Compute(inputs);
        var result = PartsLossCalculator.Compute(inputs, oee, shiftElapsedSec: 1800);
        Assert.Equal(900, result.ExpectedPartsPace);
    }
}
