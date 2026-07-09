using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>Batch-loads line-level attainment targets for an ingest tick.</summary>
public sealed class LineAttainmentLoader
{
    private readonly ConnectOeeDbContext _db;

    public LineAttainmentLoader(ConnectOeeDbContext db) => _db = db;

    public sealed record LineAttainmentData(
        double? RunTargetOnRun,
        double? LineRateTarget,
        double? RecipeTarget,
        double? ScheduleTarget);

    public async Task<Dictionary<Guid, LineAttainmentData>> LoadAsync(
        IReadOnlyCollection<Guid> lineIds,
        IReadOnlyDictionary<Guid, Guid?> activeRecipeIds,
        DateTimeOffset shiftStart,
        DateTimeOffset shiftEnd,
        CancellationToken ct)
    {
        var map = new Dictionary<Guid, LineAttainmentData>();
        if (lineIds.Count == 0) return map;

        var openRuns = await _db.ProductionRuns.AsNoTracking()
            .Where(r => lineIds.Contains(r.LineId) && r.EndUtc == null)
            .ToDictionaryAsync(r => r.LineId, ct);

        var schedules = await _db.ProductionSchedules.AsNoTracking()
            .Where(s => lineIds.Contains(s.LineId)
                && s.TargetQuantity != null && s.TargetQuantity > 0
                && s.StartUtc < shiftEnd
                && (s.EndUtc == null || s.EndUtc > shiftStart))
            .OrderByDescending(s => s.StartUtc)
            .ToListAsync(ct);

        var recipeIds = activeRecipeIds.Values.Where(id => id is not null).Select(id => id!.Value).Distinct().ToList();
        var recipes = recipeIds.Count == 0
            ? new Dictionary<Guid, ProductRecipe>()
            : await _db.ProductRecipes.AsNoTracking()
                .Where(r => recipeIds.Contains(r.Id))
                .ToDictionaryAsync(r => r.Id, ct);

        var lineRates = recipeIds.Count == 0
            ? new List<LineProductRate>()
            : await _db.LineProductRates.AsNoTracking()
                .Where(r => lineIds.Contains(r.LineId) && recipeIds.Contains(r.ProductRecipeId))
                .ToListAsync(ct);

        foreach (var lineId in lineIds)
        {
            openRuns.TryGetValue(lineId, out var run);
            activeRecipeIds.TryGetValue(lineId, out var recipeId);

            double? lineRateTarget = null;
            double? recipeTarget = null;
            if (recipeId is Guid rid)
            {
                lineRateTarget = lineRates.FirstOrDefault(r => r.LineId == lineId && r.ProductRecipeId == rid)?.TargetQuantity;
                if (recipes.TryGetValue(rid, out var recipe))
                    recipeTarget = recipe.TargetQuantity;
            }

            var scheduleTarget = schedules.FirstOrDefault(s => s.LineId == lineId)?.TargetQuantity;

            map[lineId] = new LineAttainmentData(
                run?.TargetQuantity,
                lineRateTarget,
                recipeTarget,
                scheduleTarget);
        }

        return map;
    }

    public static (ResolvedQuantityTarget Run, ResolvedQuantityTarget Shift) Resolve(
        LineAttainmentData data)
    {
        var run = TargetQuantityResolver.ResolveRunTarget(
            data.RunTargetOnRun, data.LineRateTarget, data.RecipeTarget);
        var shift = TargetQuantityResolver.ResolveShiftTarget(
            data.ScheduleTarget, data.RunTargetOnRun, data.LineRateTarget, data.RecipeTarget);
        return (run, shift);
    }
}
