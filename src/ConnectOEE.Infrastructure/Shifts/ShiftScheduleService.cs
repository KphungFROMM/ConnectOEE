using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Oee;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Infrastructure.Shifts;

/// <summary>
/// Resolves calendar-based OEE time balance from assigned shift patterns,
/// active shift definitions, and plant calendar.
/// </summary>
public class ShiftScheduleService : IShiftScheduleService
{
    private static readonly System.Text.Json.JsonSerializerOptions BreakJsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    private readonly ConnectOeeDbContext _db;

    public ShiftScheduleService(ConnectOeeDbContext db) => _db = db;

    public async Task<ShiftTimeBalance> GetTimeBalanceAsync(
        Guid lineId,
        ShiftInstance shift,
        DateTimeOffset nowUtc,
        CancellationToken ct = default)
    {
        var line = await _db.Lines.AsNoTracking()
            .Include(l => l.Department)!.ThenInclude(d => d!.Plant)
            .FirstOrDefaultAsync(l => l.Id == lineId, ct);

        var plant = line?.Department?.Plant;
        var tz = ShiftWindowCalculator.ResolveTimeZone(plant?.TimeZoneId);
        var localShiftStart = TimeZoneInfo.ConvertTime(shift.StartUtc, tz);
        var shiftAnchorDate = DateOnly.FromDateTime(localShiftStart.DateTime);

        if (plant?.Id is Guid plantId)
        {
            var cal = await _db.ShiftCalendars.AsNoTracking()
                .FirstOrDefaultAsync(c => c.PlantId == plantId && c.Date == shiftAnchorDate, ct);

            if (cal is not null && (!cal.IsWorkingDay || cal.IsHoliday || cal.IsPlannedDown))
            {
                return new ShiftTimeBalance(true, 0, 0, Array.Empty<ShiftWindowCalculator.TimeInterval>());
            }
        }

        var allTimeSec = ShiftWindowCalculator.CalendarElapsedSec(shift.StartUtc, shift.EndUtc, nowUtc);
        if (allTimeSec <= 0)
        {
            return new ShiftTimeBalance(false, 0, 0, Array.Empty<ShiftWindowCalculator.TimeInterval>());
        }

        var breakIntervals = await LoadBreakIntervalsAsync(shift.ShiftDefinitionId, shiftAnchorDate, tz, ct);
        var breakOverlap = ShiftWindowCalculator.BreakOverlapSec(shift.StartUtc, EffectiveWindowEnd(shift, nowUtc), breakIntervals);

        return new ShiftTimeBalance(false, allTimeSec, breakOverlap, breakIntervals);
    }

    public async Task<ShiftAssignment?> FindAssignmentAsync(
        Guid lineId,
        Guid? plantId,
        DateOnly date,
        CancellationToken ct = default)
    {
        var lineAssignment = await _db.ShiftAssignments.AsNoTracking()
            .Where(a => a.LineId == lineId && a.EffectiveFrom <= date && (a.EffectiveTo == null || a.EffectiveTo >= date))
            .OrderByDescending(a => a.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
        if (lineAssignment is not null) return lineAssignment;

        if (plantId is null) return null;
        return await _db.ShiftAssignments.AsNoTracking()
            .Where(a => a.PlantId == plantId && a.LineId == null && a.EffectiveFrom <= date && (a.EffectiveTo == null || a.EffectiveTo >= date))
            .OrderByDescending(a => a.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
    }

    private async Task<IReadOnlyList<ShiftWindowCalculator.TimeInterval>> LoadBreakIntervalsAsync(
        Guid shiftDefinitionId,
        DateOnly shiftAnchorDate,
        TimeZoneInfo tz,
        CancellationToken ct)
    {
        if (shiftDefinitionId == Guid.Empty)
            return Array.Empty<ShiftWindowCalculator.TimeInterval>();

        var def = await _db.ShiftDefinitions.AsNoTracking()
            .FirstOrDefaultAsync(d => d.Id == shiftDefinitionId, ct);
        if (def is null || string.IsNullOrWhiteSpace(def.BreakWindowsJson) || def.BreakWindowsJson == "[]")
            return Array.Empty<ShiftWindowCalculator.TimeInterval>();

        try
        {
            var breaks = System.Text.Json.JsonSerializer.Deserialize<List<BreakWindow>>(def.BreakWindowsJson, BreakJsonOptions) ?? new();
            var parsed = new List<(TimeOnly Start, TimeOnly End)>();
            foreach (var b in breaks)
            {
                if (TimeOnly.TryParse(b.Start, out var bs) && TimeOnly.TryParse(b.End, out var be))
                    parsed.Add((bs, be));
            }

            return ShiftWindowCalculator.BuildBreakIntervalsUtc(shiftAnchorDate, tz, parsed);
        }
        catch
        {
            return Array.Empty<ShiftWindowCalculator.TimeInterval>();
        }
    }

    private static DateTimeOffset EffectiveWindowEnd(ShiftInstance shift, DateTimeOffset nowUtc)
        => nowUtc < shift.EndUtc ? nowUtc : shift.EndUtc;

    private sealed record BreakWindow(string Start, string End);
}
