namespace ConnectOEE.Core.Oee;

/// <summary>
/// Resolves run and shift production targets using the same line-first tier model as ideal cycle.
/// </summary>
public static class TargetQuantityResolver
{
    public static ResolvedQuantityTarget ResolveRunTarget(
        double? productionRunTarget,
        double? lineRateTarget,
        double? recipeTarget)
    {
        if (productionRunTarget is > 0)
            return new ResolvedQuantityTarget(productionRunTarget, "production-run");
        if (lineRateTarget is > 0)
            return new ResolvedQuantityTarget(lineRateTarget, "line-rate");
        if (recipeTarget is > 0)
            return new ResolvedQuantityTarget(recipeTarget, "product-default");
        return new ResolvedQuantityTarget(null, null);
    }

    public static ResolvedQuantityTarget ResolveShiftTarget(
        double? scheduleTarget,
        double? productionRunTarget,
        double? lineRateTarget,
        double? recipeTarget)
    {
        if (scheduleTarget is > 0)
            return new ResolvedQuantityTarget(scheduleTarget, "schedule");
        // Documented fallback: use run target when schedule exists without quantity is not applied —
        // only explicit schedule quantity counts as shift target.
        _ = productionRunTarget;
        _ = lineRateTarget;
        _ = recipeTarget;
        return new ResolvedQuantityTarget(null, null);
    }
}
