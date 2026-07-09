using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Oee;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Tests;

public class IdealCycleResolverTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly Guid _lineId;

    public IdealCycleResolverTests()
    {
        var options = new DbContextOptionsBuilder<ConnectOeeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ConnectOeeDbContext(options);

        var plant = new Plant { Name = "P", Code = "P" };
        var dept = new Department { PlantId = plant.Id, Name = "D" };
        var line = new Line { DepartmentId = dept.Id, Name = "L1" };
        _lineId = line.Id;

        _db.AddRange(plant, dept, line);
        _db.OeeConfigs.Add(new OeeConfig { LineId = line.Id, IdealCycleTimeSec = 4.0, TargetOeePct = 85 });

        var productA = new ProductRecipe { Code = "SKU-A", Name = "A", IdealCycleTimeSec = 2.0, IsActive = true };
        var productB = new ProductRecipe { Code = "SKU-B", Name = "B", IdealCycleTimeSec = 6.0, IsActive = true };
        _db.ProductRecipes.AddRange(productA, productB);
        _db.LineProductRates.Add(new LineProductRate
        {
            LineId = line.Id,
            ProductRecipeId = productB.Id,
            IdealCycleTimeSec = 5.0,
        });

        var shiftStart = DateTimeOffset.Parse("2026-06-01T08:00:00Z");
        var mid = DateTimeOffset.Parse("2026-06-01T10:00:00Z");
        var shiftEnd = DateTimeOffset.Parse("2026-06-01T16:00:00Z");

        _db.ProductionRuns.AddRange(
            new ProductionRun { LineId = line.Id, ProductId = "SKU-A", StartUtc = shiftStart, EndUtc = mid },
            new ProductionRun { LineId = line.Id, ProductId = "SKU-B", StartUtc = mid, EndUtc = shiftEnd });

        _db.SaveChanges();
    }

    [Fact]
    public async Task ResolveForLineWindowAsync_time_weighted_across_two_products()
    {
        var from = DateTimeOffset.Parse("2026-06-01T08:00:00Z");
        var to = DateTimeOffset.Parse("2026-06-01T16:00:00Z");

        var ideal = await IdealCycleResolver.ResolveForLineWindowAsync(_db, _lineId, from, to);

        // 2h @ 2.0s + 6h @ 5.0s (line rate overrides recipe) = 34 / 8 = 4.25
        Assert.Equal(4.25, ideal, precision: 2);
    }

    [Fact]
    public async Task ResolveForLineWindowAsync_falls_back_to_line_default_without_runs()
    {
        _db.ProductionRuns.RemoveRange(_db.ProductionRuns);
        await _db.SaveChangesAsync();

        var ideal = await IdealCycleResolver.ResolveForLineWindowAsync(
            _db, _lineId,
            DateTimeOffset.Parse("2026-06-01T08:00:00Z"),
            DateTimeOffset.Parse("2026-06-01T16:00:00Z"));

        Assert.Equal(4.0, ideal);
    }

    public void Dispose() => _db.Dispose();
}
