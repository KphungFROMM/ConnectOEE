using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Api.Services;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Core.Licensing;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// PLC connection editor backing both the standalone admin screen and wizard Step 5.
/// The Mock driver needs no real endpoint; Rockwell connections add endpoint/path
/// (driver implemented in Phase 11).
/// </summary>
[ApiController]
[Route("api/plc")]
[Authorize]
public class PlcController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;
    private readonly DriverRegistry _registry;
    private readonly ILicenseService _license;

    public PlcController(ConnectOeeDbContext db, IAuditService audit, DriverRegistry registry, ILicenseService license)
    {
        _db = db;
        _audit = audit;
        _registry = registry;
        _license = license;
    }

    public record ConnectionDto(Guid Id, string Name, string DriverType, string? Endpoint, string? Path,
        int PollIntervalMs, bool Enabled, Guid? LineId, int TagCount);
    public record SaveConnectionRequest(string Name, string DriverType, string? Endpoint, string? Path,
        int? PollIntervalMs, bool? Enabled, Guid? LineId);

    [HttpGet("connections")]
    public async Task<ActionResult<IEnumerable<ConnectionDto>>> List()
    {
        var items = await _db.PlcConnections
            .OrderBy(c => c.Name)
            .Select(c => new ConnectionDto(c.Id, c.Name, c.DriverType.ToString(), c.Endpoint, c.Path,
                c.PollIntervalMs, c.Enabled, c.LineId, c.Tags.Count))
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("connections")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<ActionResult<ConnectionDto>> Create([FromBody] SaveConnectionRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name)) return BadRequest(new { message = "Name is required" });

        var rockwell = LicenseEnforcement.CheckRockwellDriver(_license, req.DriverType);
        if (rockwell is not null) return rockwell;

        var conn = new PlcConnection
        {
            Name = req.Name.Trim(),
            DriverType = Enum.TryParse<DriverType>(req.DriverType, out var dt) ? dt : DriverType.Mock,
            Endpoint = req.Endpoint?.Trim(),
            Path = req.Path?.Trim(),
            PollIntervalMs = req.PollIntervalMs ?? 1000,
            Enabled = req.Enabled ?? true,
            LineId = req.LineId,
        };
        _db.PlcConnections.Add(conn);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("plc.create", User.GetUserId(), User.GetUserName(), entityType: nameof(PlcConnection), entityId: conn.Id.ToString(), details: new { conn.Name, conn.Endpoint });
        return Ok(new ConnectionDto(conn.Id, conn.Name, conn.DriverType.ToString(), conn.Endpoint, conn.Path, conn.PollIntervalMs, conn.Enabled, conn.LineId, 0));
    }

    [HttpPut("connections/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveConnectionRequest req)
    {
        var conn = await _db.PlcConnections.FirstOrDefaultAsync(c => c.Id == id);
        if (conn is null) return NotFound();
        conn.Name = req.Name.Trim();
        if (Enum.TryParse<DriverType>(req.DriverType, out var dt))
        {
            var rockwell = LicenseEnforcement.CheckRockwellDriver(_license, req.DriverType);
            if (rockwell is not null) return rockwell;
            conn.DriverType = dt;
        }
        conn.Endpoint = req.Endpoint?.Trim();
        conn.Path = req.Path?.Trim();
        conn.PollIntervalMs = req.PollIntervalMs ?? conn.PollIntervalMs;
        conn.Enabled = req.Enabled ?? conn.Enabled;
        conn.LineId = req.LineId;
        conn.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("connections/{id:guid}")]
    [HasPermission(PermissionKeys.ManageHierarchy)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var conn = await _db.PlcConnections.FirstOrDefaultAsync(c => c.Id == id);
        if (conn is null) return NotFound();
        _db.PlcConnections.Remove(conn);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ----- Live connection health (always-visible connection state per AGENTS.md) -----

    [HttpGet("status")]
    public ActionResult<IEnumerable<DriverStatus>> Status() => Ok(_registry.Statuses());

    // ----- Control commands (write-back: start-permissive, reset, ack) -----

    public record CommandRequest(string Command);

    [HttpPost("machines/{machineId:guid}/command")]
    [HasPermission(PermissionKeys.PlcWrite)]
    public async Task<IActionResult> Command(Guid machineId, [FromBody] CommandRequest req)
    {
        if (!Enum.TryParse<PlcCommand>(req.Command, ignoreCase: true, out var cmd))
            return BadRequest(new { message = $"Unknown command '{req.Command}'" });

        var driver = _registry.ControllableFor(machineId);
        if (driver is null)
            return BadRequest(new { message = "No controllable driver mapped for this machine" });

        var ok = await driver.WriteCommandAsync(machineId, cmd);
        await _audit.LogAsync("plc.command", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Machine), entityId: machineId.ToString(), details: new { cmd = cmd.ToString(), ok });
        return ok ? Ok(new { ok = true }) : StatusCode(502, new { message = "Command write failed" });
    }

    // ----- Control tag mapping (which tag a command writes) -----

    public record ControlMapDto(Guid Id, Guid MachineId, Guid PlcConnectionId, string Command, string TagPath, string DataType);
    public record SaveControlMapRequest(Guid MachineId, Guid PlcConnectionId, string Command, string TagPath, string? DataType);

    [HttpGet("controls")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<IEnumerable<ControlMapDto>>> Controls([FromQuery] Guid? machineId)
    {
        var q = _db.MachineControlMaps.AsNoTracking().AsQueryable();
        if (machineId is { } m) q = q.Where(c => c.MachineId == m);
        var items = await q
            .Select(c => new ControlMapDto(c.Id, c.MachineId, c.PlcConnectionId, c.Command.ToString(), c.TagPath, c.DataType.ToString()))
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost("controls")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<ControlMapDto>> SaveControl([FromBody] SaveControlMapRequest req)
    {
        if (!Enum.TryParse<PlcCommand>(req.Command, ignoreCase: true, out var cmd))
            return BadRequest(new { message = $"Unknown command '{req.Command}'" });
        if (string.IsNullOrWhiteSpace(req.TagPath))
            return BadRequest(new { message = "TagPath is required" });

        // One mapping per machine+command; upsert.
        var existing = await _db.MachineControlMaps
            .FirstOrDefaultAsync(c => c.MachineId == req.MachineId && c.Command == cmd);
        var dt = Enum.TryParse<TagDataType>(req.DataType, ignoreCase: true, out var d) ? d : TagDataType.Bool;

        if (existing is null)
        {
            existing = new MachineControlMap { MachineId = req.MachineId };
            _db.MachineControlMaps.Add(existing);
        }
        existing.Command = cmd;
        existing.PlcConnectionId = req.PlcConnectionId;
        existing.TagPath = req.TagPath.Trim();
        existing.DataType = dt;
        existing.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("plc.control.map", User.GetUserId(), User.GetUserName(),
            entityType: nameof(MachineControlMap), entityId: existing.Id.ToString(), details: new { req.MachineId, cmd = cmd.ToString(), existing.TagPath });
        return Ok(new ControlMapDto(existing.Id, existing.MachineId, existing.PlcConnectionId, existing.Command.ToString(), existing.TagPath, existing.DataType.ToString()));
    }

    [HttpDelete("controls/{id:guid}")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<IActionResult> DeleteControl(Guid id)
    {
        var map = await _db.MachineControlMaps.FirstOrDefaultAsync(c => c.Id == id);
        if (map is null) return NotFound();
        _db.MachineControlMaps.Remove(map);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
