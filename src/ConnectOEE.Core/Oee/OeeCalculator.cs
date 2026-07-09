namespace ConnectOEE.Core.Oee;

/// <summary>
/// Pure OEE math. Kept dependency-free so it is unit-testable and reusable by the
/// live engine, historian rollups, and reports.
/// </summary>
public static class OeeCalculator
{
    public static OeeResult Compute(OeeInputs i)
    {
        // Availability = operating time / planned production time.
        var availability = Ratio(i.RunTimeSec, i.PlannedTimeSec);

        // Performance = ideal time for actual output / operating time.
        // Equivalent to (ideal cycle * total count) / run time. Capped at 1 because
        // sensor noise / counter timing can briefly push it slightly over 100%.
        var idealProductionTime = i.IdealCycleTimeSec * i.TotalCount;
        var performance = Math.Min(1.0, Ratio(idealProductionTime, i.RunTimeSec));

        // Quality = good / total produced.
        var quality = Ratio(i.GoodCount, i.TotalCount);

        var oee = availability * performance * quality;

        // TEEP folds in utilization (planned production time / all calendar time).
        var utilization = Ratio(i.PlannedTimeSec, i.AllTimeSec);
        var teep = oee * utilization;

        // Loss attribution (minutes):
        //  - availability loss = planned time not spent running (downtime)
        //  - performance loss  = run time lost to running slower than ideal
        //  - quality loss      = ideal time spent producing rejects
        var availabilityLossMin = Math.Max(0, i.PlannedTimeSec - i.RunTimeSec) / 60.0;
        var performanceLossMin = Math.Max(0, i.RunTimeSec - idealProductionTime) / 60.0;
        var qualityLossMin = (i.IdealCycleTimeSec * i.RejectCount) / 60.0;

        var actualCycle = i.TotalCount > 0 ? i.RunTimeSec / i.TotalCount : 0;

        var scrap = Ratio(i.RejectCount, i.TotalCount);
        var yield = quality;
        // First-pass yield: good parts that did not require rework (good should be first-pass only).
        var fpyDenom = i.GoodCount + i.RejectCount + Math.Max(0, i.ReworkCount);
        var fpy = fpyDenom > 0 ? Ratio(i.GoodCount, fpyDenom) : yield;

        return new OeeResult(
            AvailabilityPct: Pct(availability),
            PerformancePct: Pct(performance),
            QualityPct: Pct(quality),
            OeePct: Pct(oee),
            TeepPct: Pct(teep),
            ScrapPct: Pct(scrap),
            YieldPct: Pct(yield),
            FpyPct: Pct(fpy),
            AvailabilityLossMin: availabilityLossMin,
            PerformanceLossMin: performanceLossMin,
            QualityLossMin: qualityLossMin,
            ActualCycleTimeSec: actualCycle,
            IdealCycleTimeSec: i.IdealCycleTimeSec);
    }

    private static double Ratio(double numerator, double denominator)
        => denominator <= 0 ? 0 : numerator / denominator;

    private static double Pct(double ratio) => Math.Round(ratio * 100.0, 2);
}
