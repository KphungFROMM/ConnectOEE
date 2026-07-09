using ConnectOEE.Core;
using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Tests;

/// <summary>
/// Verifies downtime reason assign clears RequiresOperatorReason (query-time flag).
/// </summary>
public class DowntimeReasonAssignTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly Guid _lineId;
    private readonly Guid _machineId;

    public DowntimeReasonAssignTests()
    {
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
    }

    [Fact]
    public async Task Assign_reason_clears_requires_operator_flag()
    {
        var t0 = DateTimeOffset.UtcNow.AddMinutes(-5);
        var ev = new DowntimeEvent
        {
            LineId = _lineId,
            MachineId = _machineId,
            StartUtc = t0,
            EndUtc = t0.AddMinutes(2),
            DurationSec = 120,
            Category = LossCategory.Breakdown,
            Kind = DowntimeKind.Unplanned,
        };
        _db.DowntimeEvents.Add(ev);
        await _db.SaveChangesAsync();

        Assert.True(RequiresOperator(ev, plcMapped: false, reviewCodes: []));

        ev.Reason = "Jam cleared";
        ev.ReasonEnteredByUserId = Guid.NewGuid();
        ev.ReasonEnteredUtc = DateTimeOffset.UtcNow;
        ev.AcknowledgedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        var loaded = await _db.DowntimeEvents.AsNoTracking().SingleAsync(e => e.Id == ev.Id);
        Assert.False(RequiresOperator(loaded, plcMapped: false, reviewCodes: []));
        Assert.Equal("Jam cleared", loaded.Reason);
    }

    /// <summary>Mirror of EventsController.Downtime RequiresOperatorReason computation.</summary>
    private static bool RequiresOperator(DowntimeEvent e, bool plcMapped, HashSet<int> reviewCodes)
    {
        var fc = e.FaultCode ?? 0;
        var isPlaceholder = fc > 0 && !string.IsNullOrWhiteSpace(e.Reason)
            && Api.Live.DowntimeReasonResolverService.IsPlaceholderReason(e.Reason, fc);
        return string.IsNullOrWhiteSpace(e.Reason)
            && (!plcMapped || fc == 0)
            || isPlaceholder
            || (fc > 0 && reviewCodes.Contains(fc) && e.ReasonEnteredByUserId is null);
    }

    public void Dispose() => _db.Dispose();
}
