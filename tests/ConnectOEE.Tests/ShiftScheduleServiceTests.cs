using ConnectOEE.Core.Entities;
using ConnectOEE.Infrastructure;
using ConnectOEE.Infrastructure.Shifts;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Tests;

public class ShiftScheduleServiceTests : IDisposable
{
    private readonly ConnectOeeDbContext _db;
    private readonly ShiftScheduleService _service;
    private readonly Guid _lineId;
    private readonly Guid _plantId;
    private readonly Guid _morningDefId;
    private readonly Guid _dayDefId;

    public ShiftScheduleServiceTests()
    {
        var options = new DbContextOptionsBuilder<ConnectOeeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        _db = new ConnectOeeDbContext(options);
        _service = new ShiftScheduleService(_db);

        var plant = new Plant { Name = "Plant", Code = "P1", TimeZoneId = "UTC" };
        _plantId = plant.Id;
        var dept = new Department { PlantId = plant.Id, Name = "Dept" };
        var line = new Line { DepartmentId = dept.Id, Name = "Line1" };
        _lineId = line.Id;

        var pattern = new ShiftPattern { Name = "3x8" };
        var morning = new ShiftDefinition
        {
            ShiftPatternId = pattern.Id,
            Name = "Morning",
            StartTime = new TimeOnly(6, 0),
            EndTime = new TimeOnly(14, 0),
            OrderIndex = 0,
            BreakWindowsJson = """[{"start":"12:00","end":"12:30"}]""",
        };
        var day = new ShiftDefinition
        {
            ShiftPatternId = pattern.Id,
            Name = "Day",
            StartTime = new TimeOnly(14, 0),
            EndTime = new TimeOnly(22, 0),
            OrderIndex = 1,
            BreakWindowsJson = """[{"start":"18:00","end":"18:30"}]""",
        };
        var night = new ShiftDefinition
        {
            ShiftPatternId = pattern.Id,
            Name = "Night",
            StartTime = new TimeOnly(22, 0),
            EndTime = new TimeOnly(6, 0),
            CrossesMidnight = true,
            OrderIndex = 2,
            BreakWindowsJson = """[{"start":"02:00","end":"02:15"}]""",
        };
        _morningDefId = morning.Id;
        _dayDefId = day.Id;

        pattern.Definitions.Add(morning);
        pattern.Definitions.Add(day);
        pattern.Definitions.Add(night);
        _db.Add(plant);
        _db.Add(dept);
        _db.Add(line);
        _db.Add(pattern);
        _db.ShiftAssignments.Add(new ShiftAssignment
        {
            ShiftPatternId = pattern.Id,
            PlantId = plant.Id,
            EffectiveFrom = new DateOnly(2026, 1, 1),
        });
        _db.SaveChanges();
    }

    [Fact]
    public async Task GetTimeBalance_uses_only_active_shift_definition_breaks()
    {
        var shiftStart = new DateTimeOffset(2026, 6, 28, 6, 0, 0, TimeSpan.Zero);
        var shiftEnd = new DateTimeOffset(2026, 6, 28, 14, 0, 0, TimeSpan.Zero);
        var now = new DateTimeOffset(2026, 6, 28, 13, 0, 0, TimeSpan.Zero);
        var shift = new ShiftInstance
        {
            LineId = _lineId,
            ShiftDefinitionId = _morningDefId,
            ShiftName = "Morning",
            StartUtc = shiftStart,
            EndUtc = shiftEnd,
        };

        var balance = await _service.GetTimeBalanceAsync(_lineId, shift, now);

        Assert.False(balance.IsCalendarExcluded);
        Assert.Equal(7 * 3600, balance.AllTimeSec, 0);
        Assert.Equal(30 * 60, balance.BreakOverlapSec, 0);
    }

    [Fact]
    public async Task GetTimeBalance_day_shift_does_not_include_morning_break()
    {
        var shiftStart = new DateTimeOffset(2026, 6, 28, 14, 0, 0, TimeSpan.Zero);
        var shiftEnd = new DateTimeOffset(2026, 6, 28, 22, 0, 0, TimeSpan.Zero);
        var now = new DateTimeOffset(2026, 6, 28, 19, 0, 0, TimeSpan.Zero);
        var shift = new ShiftInstance
        {
            LineId = _lineId,
            ShiftDefinitionId = _dayDefId,
            ShiftName = "Day",
            StartUtc = shiftStart,
            EndUtc = shiftEnd,
        };

        var balance = await _service.GetTimeBalanceAsync(_lineId, shift, now);

        Assert.Equal(5 * 3600, balance.AllTimeSec, 0);
        Assert.Equal(30 * 60, balance.BreakOverlapSec, 0);
    }

    [Fact]
    public async Task GetTimeBalance_holiday_calendar_excludes_shift()
    {
        _db.ShiftCalendars.Add(new ShiftCalendar
        {
            PlantId = _plantId,
            Date = new DateOnly(2026, 6, 28),
            IsWorkingDay = false,
            IsHoliday = true,
        });
        await _db.SaveChangesAsync();

        var shift = new ShiftInstance
        {
            LineId = _lineId,
            ShiftDefinitionId = _morningDefId,
            ShiftName = "Morning",
            StartUtc = new DateTimeOffset(2026, 6, 28, 6, 0, 0, TimeSpan.Zero),
            EndUtc = new DateTimeOffset(2026, 6, 28, 14, 0, 0, TimeSpan.Zero),
        };

        var balance = await _service.GetTimeBalanceAsync(_lineId, shift, DateTimeOffset.UtcNow);
        Assert.True(balance.IsCalendarExcluded);
        Assert.Equal(0, balance.AllTimeSec);
    }

    [Fact]
    public async Task FindAssignmentAsync_line_overrides_plant_and_respects_effective_to()
    {
        var linePattern = new ShiftPattern { Name = "LineOnly" };
        _db.ShiftPatterns.Add(linePattern);
        _db.ShiftAssignments.Add(new ShiftAssignment
        {
            ShiftPatternId = linePattern.Id,
            LineId = _lineId,
            EffectiveFrom = new DateOnly(2026, 6, 1),
            EffectiveTo = new DateOnly(2026, 6, 30),
        });
        await _db.SaveChangesAsync();

        var active = await _service.FindAssignmentAsync(_lineId, _plantId, new DateOnly(2026, 6, 15));
        Assert.NotNull(active);
        Assert.Equal(linePattern.Id, active!.ShiftPatternId);

        var expired = await _service.FindAssignmentAsync(_lineId, _plantId, new DateOnly(2026, 7, 1));
        Assert.NotNull(expired);
        Assert.NotEqual(linePattern.Id, expired!.ShiftPatternId);
    }

    public void Dispose() => _db.Dispose();
}
