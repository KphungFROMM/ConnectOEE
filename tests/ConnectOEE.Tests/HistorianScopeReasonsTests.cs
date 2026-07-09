using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Historian;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Tests;

public class HistorianScopeReasonsTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly HistorianQueryService _historian;
    private readonly Guid _plantId;
    private readonly Guid _lineId;
    private readonly Guid _machineId;

    public HistorianScopeReasonsTests()
    {
        var options = new DbContextOptionsBuilder<ConnectOeeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ConnectOeeDbContext(options);

        var plant = new Plant { Name = "P", Code = "P" };
        _plantId = plant.Id;
        var dept = new Department { PlantId = plant.Id, Name = "D" };
        var line = new Line { DepartmentId = dept.Id, Name = "L1" };
        _lineId = line.Id;
        var machine = new Machine { LineId = line.Id, Name = "M1", SequenceIndex = 0 };
        _machineId = machine.Id;
        _db.AddRange(plant, dept, line, machine);
        _db.OeeConfigs.Add(new OeeConfig { LineId = line.Id, IdealCycleTimeSec = 2.0, TargetOeePct = 85 });
        _db.SaveChanges();

        _historian = new HistorianQueryService(_db, new NoOpShiftSchedule());
    }

    [Fact]
    public async Task Plant_scope_aggregates_reasons_from_all_lines()
    {
        var t0 = DateTimeOffset.UtcNow.AddHours(-2);
        _db.DowntimeEvents.AddRange(
            new DowntimeEvent
            {
                LineId = _lineId, MachineId = _machineId, StartUtc = t0, EndUtc = t0.AddMinutes(10),
                DurationSec = 600, Category = LossCategory.Breakdown, Kind = DowntimeKind.Unplanned,
                Reason = "Jam",
            },
            new DowntimeEvent
            {
                LineId = _lineId, MachineId = _machineId, StartUtc = t0.AddMinutes(15), EndUtc = t0.AddMinutes(20),
                DurationSec = 300, Category = LossCategory.SmallStop, Kind = DowntimeKind.Unplanned,
                Reason = "Jam",
            });
        await _db.SaveChangesAsync();

        var from = t0.AddHours(-1);
        var to = DateTimeOffset.UtcNow;
        var reasons = await _historian.DrillThroughReasonsScopedAsync(
            EntityLevel.Plant, _plantId, from, to, default);

        Assert.Equal(2, reasons.Where(r => r.Reason == "Jam").Sum(r => r.Count));
        Assert.Equal(15, reasons.Where(r => r.Reason == "Jam").Sum(r => r.TotalMin));
    }

    [Fact]
    public async Task Plant_scope_losses_groups_by_category()
    {
        var t0 = DateTimeOffset.UtcNow.AddHours(-1);
        _db.DowntimeEvents.Add(new DowntimeEvent
        {
            LineId = _lineId, MachineId = _machineId, StartUtc = t0, EndUtc = t0.AddMinutes(5),
            DurationSec = 300, Category = LossCategory.Breakdown, Kind = DowntimeKind.Unplanned,
        });
        await _db.SaveChangesAsync();

        var losses = await _historian.GetLossesScopedAsync(
            EntityLevel.Plant, _plantId, t0.AddMinutes(-5), DateTimeOffset.UtcNow, default);

        Assert.Contains(losses, l => l.Category == "Breakdown" && l.Count == 1);
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
