namespace ConnectOEE.Core.Oee;

/// <summary>
/// Converts OEE time losses and ideal rate into parts-based expectations and attribution.
/// </summary>
public static class PartsLossCalculator
{
    public static ProductionPartsLoss Compute(
        OeeInputs inputs,
        OeeResult oee,
        StateTimeSeconds? stateTimes = null,
        double? shiftElapsedSec = null,
        IReadOnlyDictionary<string, double>? categoryDowntimeSec = null)
    {
        if (inputs.IdealCycleTimeSec <= 0)
            return ProductionPartsLoss.Empty;

        var idealRatePph = 3600.0 / inputs.IdealCycleTimeSec;

        var maxPossible = inputs.PlannedTimeSec > 0
            ? (long)Math.Floor(inputs.PlannedTimeSec / inputs.IdealCycleTimeSec)
            : 0L;

        var theoretical = inputs.RunTimeSec > 0
            ? (long)Math.Floor(inputs.RunTimeSec / inputs.IdealCycleTimeSec)
            : 0L;

        long? expectedPace = null;
        if (shiftElapsedSec is > 0)
        {
            var elapsedH = shiftElapsedSec.Value / 3600.0;
            expectedPace = (long)Math.Round(idealRatePph * elapsedH, MidpointRounding.AwayFromZero);
        }

        var partsLostA = PartsFromLossMinutes(oee.AvailabilityLossMin, idealRatePph);
        var partsLostP = PartsFromLossMinutes(oee.PerformanceLossMin, idealRatePph);
        var partsLostQ = inputs.RejectCount;

        var downSec = stateTimes?.DownSec ?? 0;
        var partsLostBreakdown = downSec > 0
            ? (long)Math.Floor(downSec / inputs.IdealCycleTimeSec)
            : 0L;

        IReadOnlyDictionary<string, long>? byCategory = null;
        if (categoryDowntimeSec is { Count: > 0 })
        {
            byCategory = categoryDowntimeSec
                .Where(kv => kv.Value > 0)
                .ToDictionary(
                    kv => kv.Key,
                    kv => (long)Math.Floor(kv.Value / inputs.IdealCycleTimeSec));
        }

        var couldHaveMade = inputs.GoodCount + partsLostA + partsLostP + partsLostQ;
        var outputGap = theoretical - inputs.TotalCount;

        return new ProductionPartsLoss(
            maxPossible,
            expectedPace,
            theoretical,
            partsLostA,
            partsLostP,
            partsLostQ,
            partsLostBreakdown,
            couldHaveMade,
            outputGap,
            byCategory);
    }

    private static long PartsFromLossMinutes(double lossMin, double idealRatePph)
    {
        if (lossMin <= 0 || idealRatePph <= 0) return 0;
        return (long)Math.Round(lossMin * idealRatePph / 60.0, MidpointRounding.AwayFromZero);
    }
}
