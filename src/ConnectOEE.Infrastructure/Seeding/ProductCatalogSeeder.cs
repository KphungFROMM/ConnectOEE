using ConnectOEE.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ConnectOEE.Infrastructure.Seeding;

/// <summary>Idempotent seed of sample product catalog + per-line ideal cycle rates.</summary>
public static class ProductCatalogSeeder
{
    private static readonly (string Code, string Name, double DefaultCycle)[] SampleProducts =
    {
        ("WGT-A100", "Widget Assembly A", 2.4),
        ("WGT-B200", "Widget Assembly B", 3.1),
        ("PKG-STD", "Standard Pack", 1.8),
        ("PKG-PREM", "Premium Pack", 2.2),
        ("SPC-500", "Specialty Run 500", 4.5),
    };

    public static async Task SeedAsync(ConnectOeeDbContext db, ILogger? logger = null, CancellationToken ct = default)
    {
        var recipesByCode = await db.ProductRecipes
            .Where(r => !r.IsAutoCreated)
            .ToDictionaryAsync(r => r.Code, StringComparer.OrdinalIgnoreCase, ct);

        var added = 0;
        foreach (var (code, name, cycle) in SampleProducts)
        {
            if (recipesByCode.ContainsKey(code)) continue;
            var recipe = new ProductRecipe
            {
                LineId = null,
                Code = code,
                Name = name,
                PlcAlias = code,
                IdealCycleTimeSec = cycle,
                IsActive = true,
                IsAutoCreated = false,
            };
            db.ProductRecipes.Add(recipe);
            recipesByCode[code] = recipe;
            added++;
        }
        if (added > 0) await db.SaveChangesAsync(ct);

        var lines = await db.Lines.AsNoTracking().OrderBy(l => l.Name).ToListAsync(ct);
        if (lines.Count == 0) return;

        var allRecipes = await db.ProductRecipes.AsNoTracking()
            .Where(r => SampleProducts.Select(p => p.Code).Contains(r.Code))
            .ToListAsync(ct);

        var rateAdded = 0;
        for (var li = 0; li < lines.Count; li++)
        {
            var line = lines[li];
            var lineDefault = await db.OeeConfigs.AsNoTracking()
                .Where(o => o.LineId == line.Id)
                .Select(o => o.IdealCycleTimeSec)
                .FirstOrDefaultAsync(ct);
            if (lineDefault <= 0) lineDefault = 2.0;

            // Slightly different cycle per line to demonstrate per-line memory.
            var lineFactor = 0.92 + (li % 3) * 0.06;

            foreach (var recipe in allRecipes)
            {
                var exists = await db.LineProductRates.AnyAsync(
                    r => r.LineId == line.Id && r.ProductRecipeId == recipe.Id, ct);
                if (exists) continue;

                var cycle = Math.Round(recipe.IdealCycleTimeSec * lineFactor, 2);
                if (cycle <= 0) cycle = lineDefault;

                db.LineProductRates.Add(new LineProductRate
                {
                    LineId = line.Id,
                    ProductRecipeId = recipe.Id,
                    IdealCycleTimeSec = cycle,
                });
                rateAdded++;
            }
        }

        if (rateAdded > 0)
        {
            await db.SaveChangesAsync(ct);
            logger?.LogInformation("Product catalog: seeded {Products} products, {Rates} line rates", added, rateAdded);
        }
        else if (added > 0)
        {
            logger?.LogInformation("Product catalog: seeded {Products} products", added);
        }
    }
}
