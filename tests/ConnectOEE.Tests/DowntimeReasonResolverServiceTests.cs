using ConnectOEE.Api.Live;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace ConnectOEE.Tests;

public class DowntimeReasonResolverServiceTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly DowntimeReasonResolverService _resolver;
    private readonly Guid _lineId;
    private readonly Guid _machineId;

    public DowntimeReasonResolverServiceTests()
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
        _db.SaveChanges();

        _resolver = new DowntimeReasonResolverService(provider.GetRequiredService<IServiceScopeFactory>());
    }

    private sealed class NoOpAuditService : IAuditService
    {
        public Task LogAsync(string action, Guid? userId, string? userName, string? entityType = null,
            string? entityId = null, object? details = null, string? result = "Success", CancellationToken ct = default)
            => Task.CompletedTask;
    }

    [Fact]
    public async Task Unknown_code_creates_stub_with_needs_review()
    {
        var result = await _resolver.ResolveAsync(_db, _machineId, _lineId, 101, default);

        Assert.NotNull(result);
        Assert.Equal(101, result!.Code);
        Assert.True(result.NeedsReview);
        Assert.True(result.WasAutoCreated);
        Assert.Equal(DowntimeReasonResolverService.PlaceholderReason(101), result.Reason);

        var row = await _db.FaultCodeMaps.SingleAsync(m => m.Code == 101);
        Assert.True(row.IsAutoCreated);
        Assert.True(row.NeedsReview);
        Assert.Equal(_lineId, row.LineId);
    }

    [Fact]
    public async Task Second_resolve_does_not_duplicate_stub()
    {
        await _resolver.ResolveAsync(_db, _machineId, _lineId, 202, default);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        await _resolver.ResolveAsync(_db, _machineId, _lineId, 202, default);

        Assert.Equal(1, await _db.FaultCodeMaps.CountAsync(m => m.Code == 202));
    }

    [Fact]
    public async Task Known_catalog_row_returns_without_new_stub()
    {
        _db.FaultCodeMaps.Add(new FaultCodeMap
        {
            LineId = _lineId,
            Code = 50,
            Reason = "Jam at infeed",
            IsAutoCreated = false,
            NeedsReview = false,
        });
        await _db.SaveChangesAsync();

        var result = await _resolver.ResolveAsync(_db, _machineId, _lineId, 50, default);

        Assert.NotNull(result);
        Assert.Equal("Jam at infeed", result!.Reason);
        Assert.False(result.NeedsReview);
        Assert.Equal(1, await _db.FaultCodeMaps.CountAsync(m => m.Code == 50));
    }

    public void Dispose() => _db.Dispose();
}
