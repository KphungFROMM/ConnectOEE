using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Infrastructure.Shifts;

public class ShiftResolver : IShiftResolver
{
    private readonly ConnectOeeDbContext _db;

    public ShiftResolver(ConnectOeeDbContext db) => _db = db;

    public async Task<ShiftInstance> ResolveAsync(Guid lineId, DateTimeOffset timestampUtc, CancellationToken ct = default)
    {
        var line = await _db.Lines
            .Include(l => l.Department)!.ThenInclude(d => d!.Plant)
            .FirstOrDefaultAsync(l => l.Id == lineId, ct);

        var plant = line?.Department?.Plant;
        var tz = ResolveTimeZone(plant?.TimeZoneId);
        var localNow = TimeZoneInfo.ConvertTime(timestampUtc, tz);

        // Find the effective pattern: line-specific overrides plant-level.
        var date = DateOnly.FromDateTime(localNow.DateTime);
        var assignment = await FindAssignmentAsync(lineId, plant?.Id, date, ct);

        ShiftWindow window;
        if (assignment is not null)
        {
            var defs = await _db.ShiftDefinitions
                .Where(d => d.ShiftPatternId == assignment.ShiftPatternId)
                .OrderBy(d => d.OrderIndex)
                .ToListAsync(ct);
            window = ResolveWindow(defs, localNow, tz);
        }
        else
        {
            window = FallbackDay(localNow, tz);
        }

        // Materialize (idempotent) the ShiftInstance for this line + window.
        var existing = await _db.ShiftInstances.FirstOrDefaultAsync(
            s => s.LineId == lineId && s.ShiftDefinitionId == window.DefinitionId && s.StartUtc == window.StartUtc, ct);
        if (existing is not null) return existing;

        var instance = new ShiftInstance
        {
            LineId = lineId,
            ShiftDefinitionId = window.DefinitionId,
            ShiftName = window.Name,
            StartUtc = window.StartUtc,
            EndUtc = window.EndUtc,
            IsClosed = false,
        };
        _db.ShiftInstances.Add(instance);
        await _db.SaveChangesAsync(ct);
        return instance;
    }

    private async Task<ShiftAssignment?> FindAssignmentAsync(Guid lineId, Guid? plantId, DateOnly date, CancellationToken ct)
    {
        var lineAssignment = await _db.ShiftAssignments
            .Where(a => a.LineId == lineId && a.EffectiveFrom <= date && (a.EffectiveTo == null || a.EffectiveTo >= date))
            .OrderByDescending(a => a.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
        if (lineAssignment is not null) return lineAssignment;

        if (plantId is null) return null;
        return await _db.ShiftAssignments
            .Where(a => a.PlantId == plantId && a.LineId == null && a.EffectiveFrom <= date && (a.EffectiveTo == null || a.EffectiveTo >= date))
            .OrderByDescending(a => a.EffectiveFrom)
            .FirstOrDefaultAsync(ct);
    }

    private record ShiftWindow(Guid DefinitionId, string Name, DateTimeOffset StartUtc, DateTimeOffset EndUtc);

    /// <summary>Finds which shift definition's window contains the local instant.</summary>
    private static ShiftWindow ResolveWindow(List<ShiftDefinition> defs, DateTimeOffset localNow, TimeZoneInfo tz)
    {
        if (defs.Count == 0) return FallbackDay(localNow, tz);

        var localDate = DateOnly.FromDateTime(localNow.DateTime);

        // Check windows anchored on today and yesterday (covers cross-midnight shifts).
        foreach (var anchor in new[] { localDate.AddDays(-1), localDate })
        {
            foreach (var def in defs)
            {
                var start = anchor.ToDateTime(def.StartTime);
                var endDate = def.CrossesMidnight || def.EndTime <= def.StartTime ? anchor.AddDays(1) : anchor;
                var end = endDate.ToDateTime(def.EndTime);

                var startUtc = ToUtc(start, tz);
                var endUtc = ToUtc(end, tz);
                if (localNow >= startUtc && localNow < endUtc)
                    return new ShiftWindow(def.Id, def.Name, startUtc, endUtc);
            }
        }

        // Fallback: snap to the first definition's window on today.
        var d0 = defs[0];
        var s = ToUtc(localDate.ToDateTime(d0.StartTime), tz);
        var e = s.AddHours(8);
        return new ShiftWindow(d0.Id, d0.Name, s, e);
    }

    private static ShiftWindow FallbackDay(DateTimeOffset localNow, TimeZoneInfo tz)
    {
        var localDate = DateOnly.FromDateTime(localNow.DateTime);
        var start = ToUtc(localDate.ToDateTime(TimeOnly.MinValue), tz);
        var end = start.AddDays(1);
        // Guid.Empty marks the synthetic 24h fallback shift (no configured pattern).
        return new ShiftWindow(Guid.Empty, "All Day", start, end);
    }

    private static DateTimeOffset ToUtc(DateTime localUnspecified, TimeZoneInfo tz)
    {
        var local = DateTime.SpecifyKind(localUnspecified, DateTimeKind.Unspecified);
        var offset = tz.GetUtcOffset(local);
        return new DateTimeOffset(local, offset).ToUniversalTime();
    }

    private static TimeZoneInfo ResolveTimeZone(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return TimeZoneInfo.Utc;
        try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
        catch
        {
            // Browsers send IANA ids; Windows hosts need conversion.
            if (TimeZoneInfo.TryConvertIanaIdToWindowsId(id, out var windowsId))
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(windowsId); }
                catch { /* fall through */ }
            }

            return TimeZoneInfo.Utc;
        }
    }
}
