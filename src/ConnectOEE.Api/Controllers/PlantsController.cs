using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Services;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Core.Licensing;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/plants")]
[Authorize]
public class PlantsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;
    private readonly HierarchyDeleteGuardService _deleteGuard;
    private readonly ILicenseService _license;

    public PlantsController(ConnectOeeDbContext db, IAuditService audit, HierarchyDeleteGuardService deleteGuard,
        ILicenseService license)
    {
        _db = db;
        _audit = audit;
        _deleteGuard = deleteGuard;
        _license = license;
    }

    public record PlantDto(Guid Id, string Name, string? Code, string TimeZoneId, string? Location);
    public record CreatePlantRequest(string Name, string? Code, string? TimeZoneId, string? Location);
    public record UpdatePlantRequest(string? Name, string? Code, string? TimeZoneId, string? Location);

    /// <summary>Lists plants visible to the caller (filtered by UserPlantScope when scoped).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<PlantDto>>> List()
    {
        var scopes = User.GetPlantScopes();
        var query = _db.Plants.AsNoTracking().AsQueryable();
        if (scopes.Count > 0)
            query = query.Where(p => scopes.Contains(p.Id));

        var plants = await query
            .OrderBy(p => p.Name)
            .Select(p => new PlantDto(p.Id, p.Name, p.Code, p.TimeZoneId, p.Location))
            .ToListAsync();
        return Ok(plants);
    }

    /// <summary>Creates a plant. Requires the hierarchy-manage permission and is audited.</summary>
    [HttpPost]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<PlantDto>> Create([FromBody] CreatePlantRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest(new { message = "Name is required" });

        var limit = await LicenseEnforcement.CheckPlantLimitAsync(_db, _license);
        if (limit is not null) return limit;

        var plant = new Plant
        {
            Name = request.Name.Trim(),
            Code = request.Code?.Trim(),
            TimeZoneId = string.IsNullOrWhiteSpace(request.TimeZoneId) ? "UTC" : request.TimeZoneId.Trim(),
            Location = request.Location?.Trim(),
        };
        _db.Plants.Add(plant);
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "plant.create", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Plant), entityId: plant.Id.ToString(),
            details: new { plant.Name, plant.Code });

        return CreatedAtAction(nameof(List), new { id = plant.Id },
            new PlantDto(plant.Id, plant.Name, plant.Code, plant.TimeZoneId, plant.Location));
    }

    /// <summary>Updates plant timezone/location. Shift windows are evaluated in plant local time.</summary>
    [HttpPut("{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<PlantDto>> Update(Guid id, [FromBody] UpdatePlantRequest request)
    {
        var plant = await _db.Plants.FirstOrDefaultAsync(p => p.Id == id);
        if (plant is null) return NotFound();

        if (!string.IsNullOrWhiteSpace(request.TimeZoneId))
            plant.TimeZoneId = request.TimeZoneId.Trim();
        if (!string.IsNullOrWhiteSpace(request.Name))
            plant.Name = request.Name.Trim();
        if (request.Code is not null)
            plant.Code = string.IsNullOrWhiteSpace(request.Code) ? null : request.Code.Trim();
        if (request.Location is not null)
            plant.Location = string.IsNullOrWhiteSpace(request.Location) ? null : request.Location.Trim();
        plant.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();

        await _audit.LogAsync(
            "plant.update", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Plant), entityId: plant.Id.ToString(),
            details: new { plant.Name, plant.Code, plant.TimeZoneId, plant.Location });

        return Ok(new PlantDto(plant.Id, plant.Name, plant.Code, plant.TimeZoneId, plant.Location));
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var plant = await _db.Plants.FirstOrDefaultAsync(p => p.Id == id);
        if (plant is null) return NotFound();
        var blockers = await _deleteGuard.ForPlantAsync(id);
        if (blockers.IsBlocked)
            return BadRequest(new { message = "Cannot delete plant while dependencies exist", blockers });

        _db.Plants.Remove(plant);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("plant.delete", User.GetUserId(), User.GetUserName(), entityType: nameof(Plant), entityId: id.ToString());
        return NoContent();
    }
}
