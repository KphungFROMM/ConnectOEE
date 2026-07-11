namespace ConnectOEE.Core.Oee;

/// <summary>
/// Single source of truth for rolling machine KPIs up to a line (and then dept/plant).
/// Independent = sum counts + average A/P (legacy). Continuous = output-station counts.
/// </summary>
public static class LineKpiRollup
{
    /// <summary>Minimal KPI row used by hierarchy tree and client mirrors.</summary>
    public readonly record struct KpiRow(
        Guid MachineId,
        double OeePct,
        double AvailabilityPct,
        double PerformancePct,
        double QualityPct,
        long GoodCount,
        long RejectCount,
        string Status,
        string ConnectionState,
        string? ActiveRecipeCode,
        string? ActiveRecipeName,
        double IdealCycleTimeSec,
        double ActualCycleTimeSec,
        double ActualRatePph,
        double IdealRatePph,
        bool RecipeIsAutoCreated);

    public readonly record struct RolledKpi(
        double OeePct,
        double AvailabilityPct,
        double PerformancePct,
        double QualityPct,
        long GoodCount,
        long RejectCount,
        string Status,
        string ConnectionState,
        string? ActiveRecipeCode,
        string? ActiveRecipeName,
        double IdealCycleTimeSec,
        double ActualCycleTimeSec,
        double ActualRatePph,
        double IdealRatePph,
        bool RecipeIsAutoCreated);

    /// <summary>Independent peer rollup (also used for dept/plant over line KPIs).</summary>
    public static RolledKpi RollUpIndependent(IReadOnlyList<KpiRow> children)
    {
        if (children.Count == 0)
            return Empty();

        var good = children.Sum(c => c.GoodCount);
        var reject = children.Sum(c => c.RejectCount);
        var availability = Math.Round(children.Average(c => c.AvailabilityPct), 2);
        var performance = Math.Round(children.Average(c => c.PerformancePct), 2);
        var totalPieces = good + reject;
        var quality = totalPieces > 0
            ? Math.Round(good * 100.0 / totalPieces, 2)
            : Math.Round(children.Average(c => c.QualityPct), 2);
        var oee = Math.Round(availability * performance * quality / 10000.0, 2);

        return new RolledKpi(
            oee,
            availability,
            performance,
            quality,
            good,
            reject,
            WorstStatus(children.Select(c => c.Status)),
            children.Any(c => c.ConnectionState == "Connected") ? "Connected" : "Disconnected",
            children.Select(c => c.ActiveRecipeCode).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
            children.Select(c => c.ActiveRecipeName).FirstOrDefault(c => !string.IsNullOrWhiteSpace(c)),
            Math.Round(children.Where(c => c.IdealCycleTimeSec > 0).Select(c => c.IdealCycleTimeSec).DefaultIfEmpty(0).Average(), 2),
            Math.Round(children.Where(c => c.ActualCycleTimeSec > 0).Select(c => c.ActualCycleTimeSec).DefaultIfEmpty(0).Average(), 2),
            Math.Round(children.Average(c => c.ActualRatePph), 2),
            Math.Round(children.Average(c => c.IdealRatePph), 2),
            children.Any(c => c.RecipeIsAutoCreated));
    }

    /// <summary>
    /// Continuous line: counts/Q/rates from output station; A = min station availability;
    /// P from pacing station; OEE = A×P×Q; status = worst child.
    /// </summary>
    public static RolledKpi RollUpContinuous(
        IReadOnlyList<KpiRow> machines,
        Guid outputMachineId,
        Guid pacingMachineId)
    {
        if (machines.Count == 0) return Empty();

        var output = machines.FirstOrDefault(m => m.MachineId == outputMachineId);
        var pacing = machines.FirstOrDefault(m => m.MachineId == pacingMachineId);
        if (output.MachineId == Guid.Empty) output = machines[^1];
        if (pacing.MachineId == Guid.Empty) pacing = output;

        var good = output.GoodCount;
        var reject = output.RejectCount;
        var totalPieces = good + reject;
        var quality = totalPieces > 0
            ? Math.Round(good * 100.0 / totalPieces, 2)
            : output.QualityPct;

        var availability = Math.Round(machines.Min(c => c.AvailabilityPct), 2);
        var performance = pacing.PerformancePct;
        var oee = Math.Round(availability * performance * quality / 10000.0, 2);

        return new RolledKpi(
            oee,
            availability,
            performance,
            quality,
            good,
            reject,
            WorstStatus(machines.Select(c => c.Status)),
            machines.Any(c => c.ConnectionState == "Connected") ? "Connected" : "Disconnected",
            output.ActiveRecipeCode ?? pacing.ActiveRecipeCode,
            output.ActiveRecipeName ?? pacing.ActiveRecipeName,
            pacing.IdealCycleTimeSec > 0 ? pacing.IdealCycleTimeSec : output.IdealCycleTimeSec,
            output.ActualCycleTimeSec,
            output.ActualRatePph,
            pacing.IdealRatePph > 0 ? pacing.IdealRatePph : output.IdealRatePph,
            output.RecipeIsAutoCreated || pacing.RecipeIsAutoCreated);
    }

    public static RolledKpi RollUpLine(
        IReadOnlyList<KpiRow> machines,
        LineTopologyResolution topology)
    {
        if (topology.Topology == LineTopology.Continuous
            && topology.OutputMachineId is Guid outId
            && topology.PacingMachineId is Guid paceId)
            return RollUpContinuous(machines, outId, paceId);

        return RollUpIndependent(machines);
    }

    public static RolledKpi Empty() =>
        new(0, 0, 0, 0, 0, 0, "Unknown", "Disconnected", null, null, 0, 0, 0, 0, false);

    public static string WorstStatus(IEnumerable<string> statuses)
    {
        var set = statuses.ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (set.Contains("Down") || set.Contains("Setup")) return "Down";
        if (set.Contains("Idle") || set.Contains("Starved") || set.Contains("Blocked")) return "Idle";
        if (set.Contains("PlannedDown")) return "PlannedDown";
        if (set.Contains("Running")) return "Running";
        return "Unknown";
    }
}
