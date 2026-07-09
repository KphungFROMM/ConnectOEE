namespace ConnectOEE.Core.Oee;

/// <summary>One downtime occurrence used for reliability math.</summary>
public record DowntimeStat(double DurationSec, double? DetectSec, bool Unplanned);

/// <summary>Reliability metric inputs over a window.</summary>
public record ReliabilityInputs(
    double PeriodSec,
    double TotalUptimeSec,
    IReadOnlyList<DowntimeStat> Downtimes);

/// <summary>Reliability/downtime metric result. Times in minutes unless noted.</summary>
public record ReliabilityResult(
    double MttrMin,
    double MtbfMin,
    double MttfMin,
    double MttdMin,
    double MeanLostTimePerDowntimeMin,
    double FailureRatePerHour,
    double AvailabilityFromReliabilityPct,
    double StopsPerHour,
    int DowntimeCount,
    int FailureCount,
    double PlannedDowntimeMin,
    double UnplannedDowntimeMin)
{
    public static readonly ReliabilityResult Empty =
        new(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
}

/// <summary>
/// Reliability math per docs/06. "Failures" are unplanned stops; planned stops are
/// excluded from MTBF/MTTF/failure-rate but still reported as planned downtime.
/// </summary>
public static class ReliabilityCalculator
{
    public static ReliabilityResult Compute(ReliabilityInputs i)
    {
        var all = i.Downtimes;
        var count = all.Count;
        if (count == 0 && i.PeriodSec <= 0)
            return ReliabilityResult.Empty;

        var failures = all.Where(d => d.Unplanned).ToList();
        var failureCount = failures.Count;

        var totalDownSec = all.Sum(d => d.DurationSec);
        var unplannedDownSec = failures.Sum(d => d.DurationSec);
        var plannedDownSec = totalDownSec - unplannedDownSec;

        // MTTR: average repair (down) time across all stops.
        var mttrSec = count > 0 ? totalDownSec / count : 0;

        // MTBF: uptime between failures. MTTF uses the same uptime/failure framing
        // (first-failure / non-repairable assumption per docs/06).
        var mtbfSec = failureCount > 0 ? i.TotalUptimeSec / failureCount : i.TotalUptimeSec;
        var mttfSec = mtbfSec;

        // MTTD: mean time to detect/acknowledge (event start -> ack).
        var detects = all.Where(d => d.DetectSec.HasValue).Select(d => d.DetectSec!.Value).ToList();
        var mttdSec = detects.Count > 0 ? detects.Average() : 0;

        var meanLostSec = count > 0 ? totalDownSec / count : 0;

        var uptimeHours = i.TotalUptimeSec / 3600.0;
        var failureRatePerHour = uptimeHours > 0 ? failureCount / uptimeHours : 0;

        // Availability from reliability = MTBF / (MTBF + MTTR).
        var availFromRel = (mtbfSec + mttrSec) > 0 ? mtbfSec / (mtbfSec + mttrSec) : 0;

        var periodHours = i.PeriodSec / 3600.0;
        var stopsPerHour = periodHours > 0 ? count / periodHours : 0;

        return new ReliabilityResult(
            MttrMin: Min(mttrSec),
            MtbfMin: Min(mtbfSec),
            MttfMin: Min(mttfSec),
            MttdMin: Min(mttdSec),
            MeanLostTimePerDowntimeMin: Min(meanLostSec),
            FailureRatePerHour: Math.Round(failureRatePerHour, 4),
            AvailabilityFromReliabilityPct: Math.Round(availFromRel * 100.0, 2),
            StopsPerHour: Math.Round(stopsPerHour, 3),
            DowntimeCount: count,
            FailureCount: failureCount,
            PlannedDowntimeMin: Min(plannedDownSec),
            UnplannedDowntimeMin: Min(unplannedDownSec));
    }

    private static double Min(double sec) => Math.Round(sec / 60.0, 2);
}
