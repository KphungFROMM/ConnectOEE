using System.Collections.Concurrent;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Live;

/// <summary>
/// Resolves active recipe and ideal cycle: PLC tag → catalog → software run → line default.
/// Manages ProductionRun open/close on recipe changes. Unknown PLC PartIds auto-create catalog stubs.
/// Ideal cycle: LineProductRate → ProductRecipe default → OeeConfig line default.
/// </summary>
public class RecipeResolverService
{
    public sealed record RecipeContext(
        Guid? RecipeId,
        string? RecipeCode,
        string? RecipeName,
        double IdealCycleSec,
        Guid? ProductionRunId,
        bool IsAutoCreated,
        string IdealCycleSource);

    public sealed record ResolveResult(
        RecipeContext Context,
        ProductionRun? RunToAdd,
        ProductionRun? RunToClose,
        bool RecipeChanged,
        string? PreviousRecipeCode);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ConcurrentDictionary<Guid, RecipeContext> _cache = new();
    private List<ProductRecipe> _recipes = new();
    private List<LineProductRate> _lineRates = new();
    private Dictionary<Guid, double> _lineDefaults = new();
    private Dictionary<Guid, LineProductionMode> _lineModes = new();
    private DateTimeOffset _catalogLoaded = DateTimeOffset.MinValue;

    public RecipeResolverService(IServiceScopeFactory scopeFactory) => _scopeFactory = scopeFactory;

    public async Task EnsureCatalogAsync(ConnectOeeDbContext db, CancellationToken ct)
    {
        if (DateTimeOffset.UtcNow - _catalogLoaded < TimeSpan.FromSeconds(30)) return;
        _recipes = await db.ProductRecipes.AsNoTracking().Where(r => r.IsActive).ToListAsync(ct);
        _lineRates = await db.LineProductRates.AsNoTracking().ToListAsync(ct);
        var configs = await db.OeeConfigs.AsNoTracking().ToListAsync(ct);
        _lineDefaults = configs.ToDictionary(o => o.LineId, o => o.IdealCycleTimeSec <= 0 ? 2.0 : o.IdealCycleTimeSec);
        _lineModes = configs.ToDictionary(o => o.LineId, o => o.ProductionMode);
        _catalogLoaded = DateTimeOffset.UtcNow;
    }

    public void InvalidateCatalog() => _catalogLoaded = DateTimeOffset.MinValue;

    public async Task<ResolveResult> ResolveAsync(
        ConnectOeeDbContext db,
        Guid machineId,
        Guid lineId,
        string? plcPartId,
        DateTimeOffset ts,
        CancellationToken ct)
    {
        await EnsureCatalogAsync(db, ct);

        ProductRecipe? recipe = null;
        if (!string.IsNullOrWhiteSpace(plcPartId))
        {
            var trimmed = plcPartId.Trim();
            recipe = MatchRecipe(trimmed);
            if (recipe is null)
                recipe = await EnsureStubRecipeAsync(db, lineId, trimmed, ct);
        }

        var state = await db.MachineProductionStates.FirstOrDefaultAsync(s => s.MachineId == machineId, ct);
        if (recipe is null && state?.SoftwareRecipeId is Guid swId)
            recipe = _recipes.FirstOrDefault(r => r.Id == swId);

        if (recipe is null && state?.ActiveRecipeId is Guid arId)
            recipe = _recipes.FirstOrDefault(r => r.Id == arId);

        if (recipe is null)
        {
            var openRun = await db.ProductionRuns
                .Where(r => r.LineId == lineId && r.EndUtc == null)
                .OrderByDescending(r => r.StartUtc)
                .FirstOrDefaultAsync(ct);
            if (openRun?.ProductId is { } pid)
                recipe = MatchRecipe(pid);
        }

        var (ideal, idealSource) = ResolveIdealCycle(lineId, recipe);

        var ctx = new RecipeContext(
            recipe?.Id,
            recipe?.Code ?? plcPartId,
            recipe?.Name,
            ideal,
            state?.ActiveProductionRunId,
            recipe?.IsAutoCreated ?? false,
            idealSource);

        ProductionRun? toAdd = null;
        ProductionRun? toClose = null;
        var recipeChanged = false;
        string? previousCode = null;

        var code = recipe?.Code ?? plcPartId;
        if (code != state?.ActiveRecipeCode || (recipe?.Id != state?.ActiveRecipeId && recipe is not null))
        {
            previousCode = state?.ActiveRecipeCode;
            recipeChanged = !string.IsNullOrWhiteSpace(code);
            if (state?.ActiveProductionRunId is Guid runId)
            {
                toClose = await db.ProductionRuns.FirstOrDefaultAsync(r => r.Id == runId, ct);
                if (toClose is not null) toClose.EndUtc = ts;
            }

            if (recipe is not null || !string.IsNullOrWhiteSpace(code))
            {
                var targetQty = recipe?.TargetQuantity
                    ?? _lineRates.FirstOrDefault(r => r.LineId == lineId && r.ProductRecipeId == recipe?.Id)?.TargetQuantity;
                toAdd = new ProductionRun
                {
                    LineId = lineId,
                    StartUtc = ts,
                    ProductId = code,
                    TargetQuantity = targetQty,
                };
                ctx = ctx with
                {
                    ProductionRunId = toAdd.Id,
                    RecipeId = recipe?.Id,
                    RecipeCode = code,
                    RecipeName = recipe?.Name,
                    IdealCycleSec = ideal,
                    IsAutoCreated = recipe?.IsAutoCreated ?? false,
                    IdealCycleSource = idealSource,
                };
            }

            if (state is null)
            {
                state = new MachineProductionState { MachineId = machineId, LineId = lineId };
                db.MachineProductionStates.Add(state);
            }
            state.ActiveRecipeId = recipe?.Id;
            state.ActiveRecipeCode = code;
            state.ActiveProductionRunId = toAdd?.Id;
            state.UpdatedUtc = ts;

            // Line-level product: keep sibling machines in sync for explorer/UI roll-up.
            var siblings = await db.MachineProductionStates
                .Where(s => s.LineId == lineId && s.MachineId != machineId)
                .ToListAsync(ct);
            foreach (var sib in siblings)
            {
                sib.ActiveRecipeId = recipe?.Id;
                sib.ActiveRecipeCode = code;
                sib.ActiveProductionRunId = toAdd?.Id;
                sib.UpdatedUtc = ts;
                _cache[sib.MachineId] = ctx;
            }
        }

        _cache[machineId] = ctx;
        return new ResolveResult(ctx, toAdd, toClose, recipeChanged, previousCode);
    }

    /// <summary>Manual product assignment — sets software recipe and resolves immediately.</summary>
    public async Task<ResolveResult> ApplyManualSelectionAsync(
        ConnectOeeDbContext db,
        Guid machineId,
        Guid lineId,
        Guid? recipeId,
        DateTimeOffset ts,
        CancellationToken ct)
    {
        var state = await db.MachineProductionStates.FirstOrDefaultAsync(s => s.MachineId == machineId, ct);
        if (state is null)
        {
            state = new MachineProductionState { MachineId = machineId, LineId = lineId };
            db.MachineProductionStates.Add(state);
        }
        state.SoftwareRecipeId = recipeId;
        state.UpdatedUtc = ts;
        await db.SaveChangesAsync(ct);
        InvalidateCatalog();
        return await ResolveAsync(db, machineId, lineId, plcPartId: null, ts, ct);
    }

    public RecipeContext GetCached(Guid machineId, Guid lineId)
        => _cache.TryGetValue(machineId, out var c) ? c
            : new RecipeContext(null, null, null,
                _lineDefaults.TryGetValue(lineId, out var d) ? d : 2.0, null, false, "line-default");

    private (double IdealSec, string Source) ResolveIdealCycle(Guid lineId, ProductRecipe? recipe)
    {
        if (_lineModes.TryGetValue(lineId, out var mode) && mode == LineProductionMode.NoProductTracking)
            return (_lineDefaults.TryGetValue(lineId, out var only) ? only : 2.0, "line-default");

        if (recipe is null)
            return (_lineDefaults.TryGetValue(lineId, out var d) ? d : 2.0, "line-default");

        var lineRate = _lineRates.FirstOrDefault(r => r.LineId == lineId && r.ProductRecipeId == recipe.Id);
        if (lineRate is not null && lineRate.IdealCycleTimeSec > 0)
            return (lineRate.IdealCycleTimeSec, "line-rate");

        if (recipe.IdealCycleTimeSec > 0)
            return (recipe.IdealCycleTimeSec, "product-default");

        return (_lineDefaults.TryGetValue(lineId, out var fallback) ? fallback : 2.0, "line-default");
    }

    private ProductRecipe? MatchRecipe(string code)
    {
        var norm = code.Trim();
        // Prefer plant-wide catalog entries; legacy line-scoped rows still match.
        return _recipes
            .Where(r => string.Equals(r.Code, norm, StringComparison.OrdinalIgnoreCase)
                || string.Equals(r.PlcAlias, norm, StringComparison.OrdinalIgnoreCase))
            .OrderBy(r => r.LineId.HasValue ? 1 : 0)
            .FirstOrDefault();
    }

    /// <summary>Idempotent auto-stub when PLC sends an unknown PartId.</summary>
    private async Task<ProductRecipe?> EnsureStubRecipeAsync(
        ConnectOeeDbContext db, Guid lineId, string code, CancellationToken ct)
    {
        var existing = MatchRecipe(code)
            ?? await db.ProductRecipes.FirstOrDefaultAsync(r =>
                r.IsActive && (r.Code == code || r.PlcAlias == code), ct);

        if (existing is not null)
        {
            if (!_recipes.Any(r => r.Id == existing.Id))
                _recipes.Add(existing);
            await EnsureLineRateAsync(db, lineId, existing, ct);
            return existing;
        }

        var ideal = _lineDefaults.TryGetValue(lineId, out var d) ? d : 2.0;
        var stub = new ProductRecipe
        {
            LineId = null,
            Code = code,
            Name = $"Auto: {code}",
            PlcAlias = code,
            IdealCycleTimeSec = ideal,
            IsActive = true,
            IsAutoCreated = true,
        };
        db.ProductRecipes.Add(stub);
        await db.SaveChangesAsync(ct);

        var lineRate = new LineProductRate
        {
            LineId = lineId,
            ProductRecipeId = stub.Id,
            IdealCycleTimeSec = ideal,
        };
        db.LineProductRates.Add(lineRate);
        await db.SaveChangesAsync(ct);

        _recipes.Add(stub);
        _lineRates.Add(lineRate);
        InvalidateCatalog();

        using var scope = _scopeFactory.CreateScope();
        var audit = scope.ServiceProvider.GetRequiredService<IAuditService>();
        await audit.LogAsync("recipe.auto-create", null, "system",
            entityType: nameof(ProductRecipe), entityId: stub.Id.ToString(),
            details: new { stub.Code, lineId, ideal }, ct: ct);

        return stub;
    }

    private async Task EnsureLineRateAsync(ConnectOeeDbContext db, Guid lineId, ProductRecipe recipe, CancellationToken ct)
    {
        var exists = await db.LineProductRates.AnyAsync(r => r.LineId == lineId && r.ProductRecipeId == recipe.Id, ct);
        if (exists) return;

        var ideal = _lineRates.FirstOrDefault(r => r.LineId == lineId && r.ProductRecipeId == recipe.Id)?.IdealCycleTimeSec
            ?? (recipe.IdealCycleTimeSec > 0 ? recipe.IdealCycleTimeSec
                : (_lineDefaults.TryGetValue(lineId, out var d) ? d : 2.0));

        var rate = new LineProductRate { LineId = lineId, ProductRecipeId = recipe.Id, IdealCycleTimeSec = ideal };
        db.LineProductRates.Add(rate);
        await db.SaveChangesAsync(ct);
        _lineRates.Add(rate);
    }
}
