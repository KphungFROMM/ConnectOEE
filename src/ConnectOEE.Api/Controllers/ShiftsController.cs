using System.Text.Json;
using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/shifts")]
[Authorize]
public class ShiftsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IShiftResolver _resolver;
    private readonly SnapshotCache _cache;
    private readonly IHubContext<LiveHub> _hub;

    public ShiftsController(
        ConnectOeeDbContext db,
        IShiftResolver resolver,
        SnapshotCache cache,
        IHubContext<LiveHub> hub)
    {
        _db = db;
        _resolver = resolver;
        _cache = cache;
        _hub = hub;
    }

    public record ShiftInstanceDto(Guid Id, string ShiftName, DateTimeOffset StartUtc, DateTimeOffset EndUtc,
        bool IsClosed, double? OeePct, double? AvailabilityPct, double? PerformancePct, double? QualityPct,
        long GoodCount, long RejectCount, double DowntimeMinutes);

    /// <summary>Resolves (materializing if needed) the active shift for a line or plant roll-up.</summary>
    [HttpGet("current")]
    public async Task<ActionResult<ShiftInstanceDto>> Current([FromQuery] Guid? lineId, [FromQuery] Guid? plantId)
    {
        if (lineId is null && plantId is null)
            return BadRequest(new { message = "lineId or plantId is required" });
        if (lineId is { } singleLineId)
        {
            var s = await _resolver.ResolveAsync(singleLineId, DateTimeOffset.UtcNow, HttpContext.RequestAborted);
            return Ok(ToDto(s));
        }

        var lineIds = await _db.Lines.AsNoTracking()
            .Where(l => l.Department != null && l.Department.PlantId == plantId)
            .Select(l => l.Id)
            .ToListAsync(HttpContext.RequestAborted);
        if (lineIds.Count == 0)
            return Ok(new ShiftInstanceDto(Guid.Empty, "—", DateTimeOffset.UtcNow, DateTimeOffset.UtcNow,
                false, null, null, null, null, 0, 0, 0));

        var shifts = new List<ShiftInstance>();
        foreach (var lid in lineIds)
            shifts.Add(await _resolver.ResolveAsync(lid, DateTimeOffset.UtcNow, HttpContext.RequestAborted));

        var withOee = shifts.Where(s => s.OeePct.HasValue).ToList();
        return Ok(new ShiftInstanceDto(
            Guid.Empty,
            "Plant (all lines)",
            shifts.Min(s => s.StartUtc),
            shifts.Max(s => s.EndUtc),
            shifts.All(s => s.IsClosed),
            withOee.Count > 0 ? Math.Round(withOee.Average(s => s.OeePct!.Value), 2) : null,
            withOee.Count > 0 ? Math.Round(withOee.Average(s => s.AvailabilityPct ?? 0), 2) : null,
            withOee.Count > 0 ? Math.Round(withOee.Average(s => s.PerformancePct ?? 0), 2) : null,
            withOee.Count > 0 ? Math.Round(withOee.Average(s => s.QualityPct ?? 0), 2) : null,
            shifts.Sum(s => s.GoodCount),
            shifts.Sum(s => s.RejectCount),
            Math.Round(shifts.Sum(s => s.DowntimeMinutes), 2)));
    }

    private static ShiftInstanceDto ToDto(ShiftInstance s) =>
        new(s.Id, s.ShiftName, s.StartUtc, s.EndUtc, s.IsClosed,
            s.OeePct, s.AvailabilityPct, s.PerformancePct, s.QualityPct, s.GoodCount, s.RejectCount, s.DowntimeMinutes);

    /// <summary>Recent shift instances for a line (most recent first).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<ShiftInstanceDto>>> Recent([FromQuery] Guid lineId, [FromQuery] int take = 20)
    {
        var items = await _db.ShiftInstances
            .Where(s => s.LineId == lineId)
            .OrderByDescending(s => s.StartUtc)
            .Take(Math.Clamp(take, 1, 100))
            .Select(s => new ShiftInstanceDto(s.Id, s.ShiftName, s.StartUtc, s.EndUtc, s.IsClosed,
                s.OeePct, s.AvailabilityPct, s.PerformancePct, s.QualityPct, s.GoodCount, s.RejectCount, s.DowntimeMinutes))
            .ToListAsync();
        return Ok(items);
    }

    public record SetReasonRequest(Guid DowntimeEventId, string Reason, string? Category);

    /// <summary>Operator one-tap downtime-reason entry (writes back to the event, audited).</summary>
    [HttpPost("downtime-reason")]
    [HasPermission(PermissionKeys.EnterDowntimeReason)]
    public async Task<IActionResult> SetReason([FromBody] SetReasonRequest request,
        [FromServices] IAuditService audit)
    {
        var ev = await _db.DowntimeEvents.FirstOrDefaultAsync(e => e.Id == request.DowntimeEventId);
        if (ev is null) return NotFound();

        if (!await CanAccessDowntimeLineAsync(ev.LineId))
            return Forbid();

        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { message = "Reason is required" });

        ev.Reason = request.Reason.Trim();
        if (Enum.TryParse<Core.LossCategory>(request.Category, out var cat)) ev.Category = cat;

        if (ev.FaultCode is > 0)
        {
            var map = await _db.FaultCodeMaps.AsNoTracking()
                .Where(f => f.Code == ev.FaultCode && (f.LineId == ev.LineId || f.LineId == null))
                .OrderBy(f => f.LineId.HasValue ? 0 : 1)
                .FirstOrDefaultAsync();
            if (map is not null)
            {
                ev.Kind = map.Kind;
                if (string.IsNullOrWhiteSpace(request.Category))
                    ev.Category = map.Category;
            }
        }

        ev.ReasonEnteredByUserId = User.GetUserId();
        ev.ReasonEnteredUtc = DateTimeOffset.UtcNow;
        if (ev.AcknowledgedUtc is null) ev.AcknowledgedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        if (ev.MachineId is Guid machineId && _cache.TryUpdateReasonText(machineId, ev.Reason, out var snap) && snap is not null)
            await _hub.Clients.Group(LiveHub.LineGroup(ev.LineId)).SendAsync("liveUpdate", snap);

        await audit.LogAsync("downtime.reason", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Core.Entities.DowntimeEvent), entityId: ev.Id.ToString(),
            details: new { ev.Reason, Category = ev.Category.ToString() });

        return NoContent();
    }

    private async Task<bool> CanAccessDowntimeLineAsync(Guid lineId)
    {
        var plantScopes = User.GetPlantScopes();
        var lineScopes = User.GetLineScopes();
        if (plantScopes.Count == 0 && lineScopes.Count == 0) return true;

        if (lineScopes.Count > 0)
            return lineScopes.Contains(lineId);

        var plantId = await _db.Lines.AsNoTracking()
            .Where(l => l.Id == lineId)
            .Select(l => l.Department != null ? l.Department.PlantId : Guid.Empty)
            .FirstOrDefaultAsync();
        return plantId != Guid.Empty && plantScopes.Contains(plantId);
    }

    // ---------------- Shift admin (patterns, assignments, calendar) ----------------

    public record BreakWindow(TimeOnly Start, TimeOnly End);
    public record DefinitionDto(Guid Id, string Name, TimeOnly StartTime, TimeOnly EndTime, bool CrossesMidnight, string? Color, int OrderIndex, List<BreakWindow> Breaks);
    public record PatternDto(Guid Id, string Name, string? Description, List<DefinitionDto> Definitions);
    public record SaveDefinition(string Name, TimeOnly StartTime, TimeOnly EndTime, bool? CrossesMidnight, string? Color, int? OrderIndex, List<BreakWindow>? Breaks);
    public record SavePatternRequest(string Name, string? Description, List<SaveDefinition> Definitions);

    public record AssignmentDto(Guid Id, Guid ShiftPatternId, string PatternName, Guid? PlantId, Guid? LineId, DateOnly EffectiveFrom, DateOnly? EffectiveTo);
    public record SaveAssignmentRequest(Guid ShiftPatternId, Guid? PlantId, Guid? LineId, DateOnly EffectiveFrom, DateOnly? EffectiveTo);

    public record CalendarDto(Guid Id, DateOnly Date, bool IsWorkingDay, bool IsHoliday, bool IsPlannedDown, string? Note);
    public record SaveCalendarRequest(Guid PlantId, DateOnly Date, bool IsWorkingDay, bool IsHoliday, bool IsPlannedDown, string? Note);

    [HttpGet("patterns")]
    public async Task<ActionResult<IEnumerable<PatternDto>>> Patterns()
    {
        var patterns = await _db.ShiftPatterns.Include(p => p.Definitions).OrderBy(p => p.Name).ToListAsync();
        return Ok(patterns.Select(ToPatternDto));
    }

    [HttpPost("patterns")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<ActionResult<PatternDto>> CreatePattern([FromBody] SavePatternRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });
        var pattern = new ShiftPattern { Name = req.Name.Trim(), Description = req.Description };
        ApplyDefinitions(pattern, req.Definitions);
        _db.ShiftPatterns.Add(pattern);
        await _db.SaveChangesAsync();
        return Ok(ToPatternDto(pattern));
    }

    [HttpPut("patterns/{id:guid}")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<ActionResult<PatternDto>> UpdatePattern(Guid id, [FromBody] SavePatternRequest req)
    {
        var pattern = await _db.ShiftPatterns.Include(p => p.Definitions).FirstOrDefaultAsync(p => p.Id == id);
        if (pattern is null) return NotFound();
        pattern.Name = req.Name.Trim();
        pattern.Description = req.Description;
        pattern.UpdatedUtc = DateTimeOffset.UtcNow;
        _db.ShiftDefinitions.RemoveRange(pattern.Definitions);
        pattern.Definitions.Clear();
        ApplyDefinitions(pattern, req.Definitions);
        await _db.SaveChangesAsync();
        return Ok(ToPatternDto(pattern));
    }

    [HttpDelete("patterns/{id:guid}")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<IActionResult> DeletePattern(Guid id)
    {
        var pattern = await _db.ShiftPatterns.FirstOrDefaultAsync(p => p.Id == id);
        if (pattern is null) return NotFound();
        var assigned = await _db.ShiftAssignments.AnyAsync(a => a.ShiftPatternId == id);
        if (assigned) return BadRequest(new { message = "Pattern is assigned; remove assignments first" });
        _db.ShiftPatterns.Remove(pattern);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("assignments")]
    public async Task<ActionResult<IEnumerable<AssignmentDto>>> Assignments()
    {
        var items = await _db.ShiftAssignments
            .Join(_db.ShiftPatterns, a => a.ShiftPatternId, p => p.Id, (a, p) => new AssignmentDto(
                a.Id, a.ShiftPatternId, p.Name, a.PlantId, a.LineId, a.EffectiveFrom, a.EffectiveTo))
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("assignments")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<ActionResult<AssignmentDto>> CreateAssignment([FromBody] SaveAssignmentRequest req)
    {
        if (req.PlantId is null && req.LineId is null) return BadRequest(new { message = "Plant or line is required" });
        var pattern = await _db.ShiftPatterns.FirstOrDefaultAsync(p => p.Id == req.ShiftPatternId);
        if (pattern is null) return BadRequest(new { message = "Pattern not found" });

        var a = new ShiftAssignment
        {
            ShiftPatternId = req.ShiftPatternId,
            PlantId = req.PlantId,
            LineId = req.LineId,
            EffectiveFrom = req.EffectiveFrom,
            EffectiveTo = req.EffectiveTo,
        };
        _db.ShiftAssignments.Add(a);
        await _db.SaveChangesAsync();
        return Ok(new AssignmentDto(a.Id, a.ShiftPatternId, pattern.Name, a.PlantId, a.LineId, a.EffectiveFrom, a.EffectiveTo));
    }

    [HttpDelete("assignments/{id:guid}")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<IActionResult> DeleteAssignment(Guid id)
    {
        var a = await _db.ShiftAssignments.FirstOrDefaultAsync(x => x.Id == id);
        if (a is null) return NotFound();
        _db.ShiftAssignments.Remove(a);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("calendar")]
    public async Task<ActionResult<IEnumerable<CalendarDto>>> Calendar([FromQuery] Guid plantId)
    {
        var items = await _db.ShiftCalendars
            .Where(c => c.PlantId == plantId)
            .OrderBy(c => c.Date)
            .Select(c => new CalendarDto(c.Id, c.Date, c.IsWorkingDay, c.IsHoliday, c.IsPlannedDown, c.Note))
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("calendar")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<IActionResult> SaveCalendar([FromBody] SaveCalendarRequest req)
    {
        var existing = await _db.ShiftCalendars.FirstOrDefaultAsync(c => c.PlantId == req.PlantId && c.Date == req.Date);
        if (existing is null)
        {
            _db.ShiftCalendars.Add(new ShiftCalendar
            {
                PlantId = req.PlantId, Date = req.Date, IsWorkingDay = req.IsWorkingDay,
                IsHoliday = req.IsHoliday, IsPlannedDown = req.IsPlannedDown, Note = req.Note,
            });
        }
        else
        {
            existing.IsWorkingDay = req.IsWorkingDay;
            existing.IsHoliday = req.IsHoliday;
            existing.IsPlannedDown = req.IsPlannedDown;
            existing.Note = req.Note;
            existing.UpdatedUtc = DateTimeOffset.UtcNow;
        }
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static void ApplyDefinitions(ShiftPattern pattern, List<SaveDefinition> defs)
    {
        var i = 0;
        foreach (var d in defs ?? new())
        {
            pattern.Definitions.Add(new ShiftDefinition
            {
                ShiftPattern = pattern,
                Name = d.Name.Trim(),
                StartTime = d.StartTime,
                EndTime = d.EndTime,
                CrossesMidnight = d.CrossesMidnight ?? (d.EndTime <= d.StartTime),
                Color = d.Color,
                OrderIndex = d.OrderIndex ?? i,
                BreakWindowsJson = JsonSerializer.Serialize(d.Breaks ?? new()),
            });
            i++;
        }
    }

    private static PatternDto ToPatternDto(ShiftPattern p) => new(
        p.Id, p.Name, p.Description,
        p.Definitions.OrderBy(d => d.OrderIndex).Select(d => new DefinitionDto(
            d.Id, d.Name, d.StartTime, d.EndTime, d.CrossesMidnight, d.Color, d.OrderIndex,
            ParseBreaks(d.BreakWindowsJson))).ToList());

    private static List<BreakWindow> ParseBreaks(string json)
    {
        try { return JsonSerializer.Deserialize<List<BreakWindow>>(json) ?? new(); }
        catch { return new(); }
    }
}
