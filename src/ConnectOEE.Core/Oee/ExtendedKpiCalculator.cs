namespace ConnectOEE.Core.Oee;

/// <summary>
/// Derived KPIs beyond canonical A/P/Q/OEE: target gaps, utilization, cycle variance,
/// attainment, rework %, and state-time presentation.
/// </summary>
public static class ExtendedKpiCalculator
{
    public static ExtendedKpiResult Compute(
        OeeResult oee,
        OeeInputs inputs,
        OeeTargets targets,
        long goodCount,
        long reworkCount,
        bool reworkTrackingActive,
        ResolvedQuantityTarget runTarget,
        ResolvedQuantityTarget shiftTarget,
        StateTimeSeconds stateTimes,
        double? shiftElapsedSec = null,
        IReadOnlyDictionary<string, double>? categoryDowntimeSec = null)
    {
        var oeeGap = Gap(oee.OeePct, targets.TargetOeePct);
        var aGap = Gap(oee.AvailabilityPct, targets.TargetAvailabilityPct);
        var pGap = Gap(oee.PerformancePct, targets.TargetPerformancePct);
        var qGap = Gap(oee.QualityPct, targets.TargetQualityPct);

        var utilization = inputs.AllTimeSec > 0
            ? Math.Round(inputs.PlannedTimeSec / inputs.AllTimeSec * 100.0, 2)
            : 0;

        var cycleVariance = oee.IdealCycleTimeSec > 0 && oee.ActualCycleTimeSec > 0
            ? Math.Round((oee.ActualCycleTimeSec - oee.IdealCycleTimeSec) / oee.IdealCycleTimeSec * 100.0, 2)
            : 0;

        double? reworkPct = null;
        if (reworkTrackingActive)
        {
            var denom = goodCount + inputs.RejectCount + reworkCount;
            reworkPct = denom > 0 ? Math.Round(reworkCount * 100.0 / denom, 2) : 0;
        }

        var effectiveFpy = ReworkTrackingPolicy.EffectiveFpyPct(oee, reworkTrackingActive);

        var runAttainment = Attainment(goodCount, runTarget.Quantity);
        var shiftAttainment = Attainment(goodCount, shiftTarget.Quantity);

        var partsLoss = PartsLossCalculator.Compute(
            inputs, oee, stateTimes, shiftElapsedSec, categoryDowntimeSec);
        var theoretical = partsLoss.TheoreticalOutput;
        var outputGap = partsLoss.OutputGapParts;

        return new ExtendedKpiResult(
            targets,
            oeeGap,
            aGap,
            pGap,
            qGap,
            utilization,
            cycleVariance,
            reworkPct,
            reworkTrackingActive,
            effectiveFpy,
            runTarget,
            runAttainment.Pct,
            runAttainment.Remaining,
            shiftTarget,
            shiftAttainment.Pct,
            shiftAttainment.Remaining,
            theoretical,
            outputGap,
            partsLoss,
            StateTimeAccrual.ToMinutes(stateTimes));
    }

    private static double Gap(double actual, double target) => Math.Round(actual - target, 2);

    private static (double? Pct, double? Remaining) Attainment(long good, double? target)
    {
        if (target is not > 0) return (null, null);
        var pct = Math.Round(good * 100.0 / target.Value, 2);
        var remaining = Math.Max(0, Math.Round(target.Value - good, 0));
        return (pct, remaining);
    }
}
