using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/schedules")]
[Authorize]
public class SchedulesController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;

    public SchedulesController(ConnectOeeDbContext db) => _db = db;

    public record ScheduleDto(Guid Id, Guid LineId, Guid? ProductRecipeId, DateTimeOffset StartUtc, DateTimeOffset? EndUtc, double? TargetQuantity, string? Note);
    public record SaveScheduleRequest(Guid LineId, Guid? ProductRecipeId, DateTimeOffset StartUtc, DateTimeOffset? EndUtc, double? TargetQuantity, string? Note);

    [HttpGet]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<IEnumerable<ScheduleDto>>> List([FromQuery] Guid? lineId)
    {
        var q = _db.ProductionSchedules.AsNoTracking().AsQueryable();
        if (lineId is { } lid) q = q.Where(s => s.LineId == lid);
        var items = await q.OrderBy(s => s.StartUtc).ToListAsync();
        return Ok(items.Select(s => new ScheduleDto(s.Id, s.LineId, s.ProductRecipeId, s.StartUtc, s.EndUtc, s.TargetQuantity, s.Note)));
    }

    [HttpPost]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<ScheduleDto>> Create([FromBody] SaveScheduleRequest req)
    {
        var s = new ProductionSchedule
        {
            LineId = req.LineId,
            ProductRecipeId = req.ProductRecipeId,
            StartUtc = req.StartUtc,
            EndUtc = req.EndUtc,
            TargetQuantity = req.TargetQuantity,
            Note = req.Note?.Trim(),
        };
        _db.ProductionSchedules.Add(s);
        await _db.SaveChangesAsync();
        return Ok(new ScheduleDto(s.Id, s.LineId, s.ProductRecipeId, s.StartUtc, s.EndUtc, s.TargetQuantity, s.Note));
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var s = await _db.ProductionSchedules.FirstOrDefaultAsync(x => x.Id == id);
        if (s is null) return NotFound();
        _db.ProductionSchedules.Remove(s);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

[ApiController]
[Route("api/crews")]
[Authorize]
public class CrewsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;

    public CrewsController(ConnectOeeDbContext db) => _db = db;

    public record CrewDto(Guid Id, string Name, Guid? PlantId);
    public record SaveCrewRequest(string Name, Guid? PlantId);
    public record AssignCrewRequest(Guid ShiftInstanceId, Guid CrewId, Guid LineId);

    [HttpGet]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<ActionResult<IEnumerable<CrewDto>>> List()
    {
        var items = await _db.Crews.AsNoTracking().OrderBy(c => c.Name).ToListAsync();
        return Ok(items.Select(c => new CrewDto(c.Id, c.Name, c.PlantId)));
    }

    [HttpPost]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<ActionResult<CrewDto>> Create([FromBody] SaveCrewRequest req)
    {
        var c = new Crew { Name = req.Name.Trim(), PlantId = req.PlantId };
        _db.Crews.Add(c);
        await _db.SaveChangesAsync();
        return Ok(new CrewDto(c.Id, c.Name, c.PlantId));
    }

    [HttpPost("assign")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<IActionResult> Assign([FromBody] AssignCrewRequest req)
    {
        _db.ShiftCrews.Add(new ShiftCrew { ShiftInstanceId = req.ShiftInstanceId, CrewId = req.CrewId, LineId = req.LineId });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.ManageShifts)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var c = await _db.Crews.FirstOrDefaultAsync(x => x.Id == id);
        if (c is null) return NotFound();
        _db.Crews.Remove(c);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
