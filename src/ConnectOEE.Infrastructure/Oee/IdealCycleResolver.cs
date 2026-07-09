using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Infrastructure.Oee;

/// <summary>
/// Resolves effective ideal cycle for a line/time window using production runs
/// and per-line product rates (same priority as live RecipeResolverService).
/// </summary>
public static class IdealCycleResolver
{
    public static async Task<double> ResolveForLineWindowAsync(
        ConnectOeeDbContext db,
        Guid lineId,
        DateTimeOffset windowStart,
        DateTimeOffset windowEnd,
        CancellationToken ct = default)
    {
        var cfg = await db.OeeConfigs.AsNoTracking()
            .Where(o => o.LineId == lineId)
            .Select(o => new { o.IdealCycleTimeSec, o.ProductionMode })
            .FirstOrDefaultAsync(ct);
        var lineDefaultSec = cfg?.IdealCycleTimeSec > 0 ? cfg.IdealCycleTimeSec : 2.0;
        if (cfg?.ProductionMode == LineProductionMode.NoProductTracking)
            return lineDefaultSec;

        var runs = await db.ProductionRuns.AsNoTracking()
            .Where(r => r.LineId == lineId
                && r.StartUtc < windowEnd
                && (r.EndUtc == null || r.EndUtc > windowStart))
            .OrderBy(r => r.StartUtc)
            .ToListAsync(ct);

        if (runs.Count == 0) return lineDefaultSec;

        var recipes = await db.ProductRecipes.AsNoTracking().Where(r => r.IsActive).ToListAsync(ct);
        var rates = await db.LineProductRates.AsNoTracking()
            .Where(r => r.LineId == lineId)
            .ToListAsync(ct);

        double weightedSum = 0, weightTotal = 0;
        foreach (var run in runs)
        {
            var segStart = run.StartUtc > windowStart ? run.StartUtc : windowStart;
            var segEnd = (run.EndUtc ?? windowEnd) < windowEnd ? run.EndUtc ?? windowEnd : windowEnd;
            var dur = (segEnd - segStart).TotalSeconds;
            if (dur <= 0) continue;

            var ideal = ResolveForProduct(run.ProductId, recipes, rates, lineDefaultSec);
            weightedSum += ideal * dur;
            weightTotal += dur;
        }

        return weightTotal > 0 ? weightedSum / weightTotal : lineDefaultSec;
    }

    public static async Task<double> ResolveForLinesWindowAsync(
        ConnectOeeDbContext db,
        IReadOnlyList<Guid> lineIds,
        DateTimeOffset windowStart,
        DateTimeOffset windowEnd,
        CancellationToken ct = default)
    {
        if (lineIds.Count == 0) return 2.0;
        if (lineIds.Count == 1)
            return await ResolveForLineWindowAsync(db, lineIds[0], windowStart, windowEnd, ct);

        var ideals = new List<double>();
        foreach (var lid in lineIds)
            ideals.Add(await ResolveForLineWindowAsync(db, lid, windowStart, windowEnd, ct));
        return ideals.Average();
    }

    private static double ResolveForProduct(
        string? code,
        List<ProductRecipe> recipes,
        List<LineProductRate> rates,
        double lineDefault)
    {
        if (string.IsNullOrWhiteSpace(code)) return lineDefault;

        var norm = code.Trim();
        var recipe = recipes.FirstOrDefault(r =>
            string.Equals(r.Code, norm, StringComparison.OrdinalIgnoreCase)
            || string.Equals(r.PlcAlias, norm, StringComparison.OrdinalIgnoreCase));

        if (recipe is null) return lineDefault;

        var lineRate = rates.FirstOrDefault(r => r.ProductRecipeId == recipe.Id);
        if (lineRate is not null && lineRate.IdealCycleTimeSec > 0)
            return lineRate.IdealCycleTimeSec;

        return recipe.IdealCycleTimeSec > 0 ? recipe.IdealCycleTimeSec : lineDefault;
    }
}
