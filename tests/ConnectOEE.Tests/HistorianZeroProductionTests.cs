using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Tests;

public class HistorianZeroProductionTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly HistorianQueryService _historian;
    private readonly Guid _plantId;

    public HistorianZeroProductionTests()
    {
        var options = new DbContextOptionsBuilder<ConnectOeeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ConnectOeeDbContext(options);

        var plant = new Plant { Name = "FrommConnect", Code = "FC" };
        _plantId = plant.Id;
        var dept = new Department { PlantId = plant.Id, Name = "Production" };
        _db.Add(plant);
        _db.Add(dept);

        for (var i = 1; i <= 3; i++)
        {
            var line = new Line { DepartmentId = dept.Id, Name = $"Line {i}" };
            _db.Add(line);
            _db.OeeConfigs.Add(new OeeConfig { LineId = line.Id, IdealCycleTimeSec = 2.0, TargetOeePct = 85 });
            _db.Add(new Machine { LineId = line.Id, Name = $"M{i}", SequenceIndex = 0 });
        }

        _db.SaveChanges();
        _historian = new HistorianQueryService(_db, new NoOpShiftSchedule());
    }

    [Fact]
    public async Task Plant_snapshot_with_zero_production_returns_empty_oee_not_phantom_loss()
    {
        var to = DateTimeOffset.UtcNow;
        var from = to.AddDays(-7);

        var snap = await _historian.GetSnapshotAsync(EntityLevel.Plant, _plantId, from, to);

        Assert.Equal(0, snap.GoodCount);
        Assert.Equal(0, snap.RejectCount);
        Assert.Equal(0, snap.Oee.OeePct);
        Assert.Equal(0, snap.Oee.PerformanceLossMin);
        Assert.Equal(0, snap.UptimeMin);
    }

    public void Dispose() => _db.Dispose();

    private sealed class NoOpShiftSchedule : Core.Abstractions.IShiftScheduleService
    {
        public Task<Core.Oee.ShiftTimeBalance> GetTimeBalanceAsync(
            Guid lineId, ShiftInstance shift, DateTimeOffset nowUtc, CancellationToken ct = default)
            => Task.FromResult(new Core.Oee.ShiftTimeBalance(false, 3600, 0, []));

        public Task<ShiftAssignment?> FindAssignmentAsync(
            Guid lineId, Guid? plantId, DateOnly date, CancellationToken ct = default)
            => Task.FromResult<ShiftAssignment?>(null);
    }
}
