using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ConnectOEE.Tests;

public class RecipeResolverServiceTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly RecipeResolverService _resolver;
    private readonly Guid _lineId;
    private readonly Guid _machineId;

    public RecipeResolverServiceTests()
    {
        var services = new ServiceCollection();
        services.AddScoped<IAuditService, NoOpAuditService>();
        var provider = services.BuildServiceProvider();

        var options = new DbContextOptionsBuilder<ConnectOeeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ConnectOeeDbContext(options);

        var plant = new Plant { Name = "P", Code = "P" };
        var dept = new Department { PlantId = plant.Id, Name = "D" };
        var line = new Line { DepartmentId = dept.Id, Name = "L1" };
        _lineId = line.Id;
        var machine = new Machine { LineId = line.Id, Name = "M1", SequenceIndex = 0 };
        _machineId = machine.Id;
        _db.AddRange(plant, dept, line, machine);
        _db.OeeConfigs.Add(new OeeConfig { LineId = line.Id, IdealCycleTimeSec = 3.5, TargetOeePct = 85 });
        _db.SaveChanges();

        _resolver = new RecipeResolverService(provider.GetRequiredService<IServiceScopeFactory>());
    }

    [Fact]
    public async Task Unknown_plc_part_creates_auto_stub_with_line_default_cycle()
    {
        var ts = DateTimeOffset.UtcNow;
        var result = await _resolver.ResolveAsync(_db, _machineId, _lineId, "SKU-999", ts, default);

        Assert.True(result.RecipeChanged);
        Assert.NotNull(result.RunToAdd);
        Assert.Equal("SKU-999", result.Context.RecipeCode);
        Assert.Equal(3.5, result.Context.IdealCycleSec);
        Assert.True(result.Context.IsAutoCreated);

        var stub = await _db.ProductRecipes.SingleAsync(r => r.Code == "SKU-999");
        Assert.True(stub.IsAutoCreated);
        Assert.Null(stub.LineId);
        var rate = await _db.LineProductRates.SingleAsync(r => r.LineId == _lineId && r.ProductRecipeId == stub.Id);
        Assert.Equal(3.5, rate.IdealCycleTimeSec);
    }

    [Fact]
    public async Task Second_read_with_same_code_does_not_duplicate()
    {
        var ts = DateTimeOffset.UtcNow;
        await _resolver.ResolveAsync(_db, _machineId, _lineId, "SKU-777", ts, default);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        await _resolver.ResolveAsync(_db, _machineId, _lineId, "SKU-777", ts.AddSeconds(1), default);

        Assert.Equal(1, await _db.ProductRecipes.CountAsync(r => r.Code == "SKU-777"));
    }

    [Fact]
    public async Task Line_product_rate_overrides_catalog_default()
    {
        var recipe = new ProductRecipe
        {
            LineId = null,
            Code = "KNOWN-1",
            Name = "Known product",
            IdealCycleTimeSec = 1.2,
            IsActive = true,
        };
        _db.ProductRecipes.Add(recipe);
        await _db.SaveChangesAsync();
        _db.LineProductRates.Add(new LineProductRate
        {
            LineId = _lineId,
            ProductRecipeId = recipe.Id,
            IdealCycleTimeSec = 2.8,
        });
        await _db.SaveChangesAsync();
        _resolver.InvalidateCatalog();

        var result = await _resolver.ResolveAsync(_db, _machineId, _lineId, "KNOWN-1", DateTimeOffset.UtcNow, default);

        Assert.Equal("Known product", result.Context.RecipeName);
        Assert.Equal(2.8, result.Context.IdealCycleSec);
        Assert.Equal("line-rate", result.Context.IdealCycleSource);
        Assert.False(result.Context.IsAutoCreated);
    }

    [Fact]
    public async Task No_product_tracking_mode_uses_line_fallback_only()
    {
        var cfg = await _db.OeeConfigs.SingleAsync(o => o.LineId == _lineId);
        cfg.ProductionMode = LineProductionMode.NoProductTracking;
        var recipe = new ProductRecipe
        {
            Code = "PKG-STD",
            Name = "Package",
            IdealCycleTimeSec = 1.8,
            IsActive = true,
        };
        _db.ProductRecipes.Add(recipe);
        await _db.SaveChangesAsync();
        _db.LineProductRates.Add(new LineProductRate
        {
            LineId = _lineId,
            ProductRecipeId = recipe.Id,
            IdealCycleTimeSec = 1.66,
        });
        await _db.SaveChangesAsync();
        _resolver.InvalidateCatalog();

        var result = await _resolver.ResolveAsync(_db, _machineId, _lineId, "PKG-STD", DateTimeOffset.UtcNow, default);

        Assert.Equal(3.5, result.Context.IdealCycleSec);
        Assert.Equal("line-default", result.Context.IdealCycleSource);
    }

    public void Dispose() => _db.Dispose();

    private sealed class NoOpAuditService : IAuditService
    {
        public Task LogAsync(string action, Guid? userId, string? userName, string? entityType = null,
            string? entityId = null, object? details = null, string? result = "Success", CancellationToken ct = default)
            => Task.CompletedTask;
    }
}
