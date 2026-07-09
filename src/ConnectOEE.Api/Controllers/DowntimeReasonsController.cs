using ConnectOEE.Api.Auth;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/downtime-reasons")]
[Authorize]
public class DowntimeReasonsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;
    private readonly Live.DowntimeReasonResolverService _reasons;

    public DowntimeReasonsController(
        ConnectOeeDbContext db,
        IAuditService audit,
        Live.DowntimeReasonResolverService reasons)
    {
        _db = db;
        _audit = audit;
        _reasons = reasons;
    }

    public record DowntimeReasonDto(
        Guid Id,
        int Code,
        string Reason,
        string Category,
        string Kind,
        Guid? LineId,
        Guid? MachineId,
        bool IsAutoCreated,
        bool NeedsReview);

    public record OperatorCatalogEntryDto(int Code, string Reason, string Category, string Kind, bool NeedsReview);

    public record SaveDowntimeReasonRequest(
        int Code,
        string Reason,
        string Category,
        string Kind,
        Guid? LineId,
        Guid? MachineId);

    [HttpGet]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<IEnumerable<DowntimeReasonDto>>> List(
        [FromQuery] Guid? lineId,
        [FromQuery] Guid? machineId)
    {
        var q = _db.FaultCodeMaps.AsNoTracking().AsQueryable();
        if (lineId is { } lid) q = q.Where(f => f.LineId == lid || f.LineId == null);
        if (machineId is { } mid) q = q.Where(f => f.MachineId == mid || f.MachineId == null);
        var items = await q.OrderBy(f => f.Code).ToListAsync();
        return Ok(items.Select(ToDto));
    }

    [HttpGet("pending-review")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<IEnumerable<DowntimeReasonDto>>> PendingReview([FromQuery] Guid? lineId)
    {
        var q = _db.FaultCodeMaps.AsNoTracking().Where(f => f.NeedsReview);
        if (lineId is { } lid) q = q.Where(f => f.LineId == lid || f.LineId == null);
        var items = await q.OrderBy(f => f.Code).ToListAsync();
        return Ok(items.Select(ToDto));
    }

    /// <summary>Read-only catalog for operator station reason buttons (no tag-mapping permission required).</summary>
    [HttpGet("operator-catalog")]
    [HasPermission(PermissionKeys.EnterDowntimeReason)]
    public async Task<ActionResult<IEnumerable<OperatorCatalogEntryDto>>> OperatorCatalog(
        [FromQuery] Guid lineId,
        [FromQuery] Guid? machineId)
    {
        var q = _db.FaultCodeMaps.AsNoTracking()
            .Where(f => f.LineId == lineId || f.LineId == null);
        if (machineId is { } mid)
            q = q.Where(f => f.MachineId == mid || f.MachineId == null);
        var items = await q
            .Where(f => !f.NeedsReview || !Live.DowntimeReasonResolverService.IsPlaceholderReason(f.Reason, f.Code))
            .OrderBy(f => f.Code)
            .ToListAsync();
        // Prefer machine-specific over line-specific over global for duplicate codes.
        var byCode = new Dictionary<int, FaultCodeMap>();
        foreach (var f in items.OrderBy(f => f.MachineId.HasValue ? 0 : f.LineId.HasValue ? 1 : 2))
            byCode[f.Code] = f;
        return Ok(byCode.Values.Select(f => new OperatorCatalogEntryDto(
            f.Code, f.Reason, f.Category.ToString(), f.Kind.ToString(), f.NeedsReview)));
    }

    /// <summary>PLC codes awaiting operator/supervisor review — for badge display on operator station.</summary>
    [HttpGet("operator-pending")]
    [HasPermission(PermissionKeys.EnterDowntimeReason)]
    public async Task<ActionResult<IEnumerable<OperatorCatalogEntryDto>>> OperatorPending([FromQuery] Guid lineId)
    {
        var items = await _db.FaultCodeMaps.AsNoTracking()
            .Where(f => f.NeedsReview && (f.LineId == lineId || f.LineId == null))
            .OrderBy(f => f.Code)
            .ToListAsync();
        return Ok(items.Select(f => new OperatorCatalogEntryDto(
            f.Code, f.Reason, f.Category.ToString(), f.Kind.ToString(), f.NeedsReview)));
    }

    [HttpPost]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<DowntimeReasonDto>> Create([FromBody] SaveDowntimeReasonRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Reason)) return BadRequest(new { message = "Reason is required" });
        var map = new FaultCodeMap
        {
            Code = req.Code,
            Reason = req.Reason.Trim(),
            Category = Enum.TryParse<LossCategory>(req.Category, true, out var c) ? c : LossCategory.Breakdown,
            Kind = Enum.TryParse<DowntimeKind>(req.Kind, true, out var k) ? k : DowntimeKind.Unplanned,
            LineId = req.LineId,
            MachineId = req.MachineId,
            IsAutoCreated = false,
            NeedsReview = false,
        };
        _db.FaultCodeMaps.Add(map);
        await _db.SaveChangesAsync();
        _reasons.InvalidateCatalog();
        await _audit.LogAsync("downtime.reason.create", User.GetUserId(), User.GetUserName(),
            entityType: nameof(FaultCodeMap), entityId: map.Id.ToString());
        return Ok(ToDto(map));
    }

    [HttpPut("{id:guid}")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<IActionResult> Update(Guid id, [FromBody] SaveDowntimeReasonRequest req)
    {
        var map = await _db.FaultCodeMaps.FirstOrDefaultAsync(f => f.Id == id);
        if (map is null) return NotFound();
        map.Code = req.Code;
        map.Reason = req.Reason.Trim();
        if (Enum.TryParse<LossCategory>(req.Category, true, out var c)) map.Category = c;
        if (Enum.TryParse<DowntimeKind>(req.Kind, true, out var k)) map.Kind = k;
        map.LineId = req.LineId;
        map.MachineId = req.MachineId;
        map.UpdatedUtc = DateTimeOffset.UtcNow;
        if (!string.IsNullOrWhiteSpace(map.Reason) &&
            !Live.DowntimeReasonResolverService.IsPlaceholderReason(map.Reason, map.Code))
            map.NeedsReview = false;
        await _db.SaveChangesAsync();
        _reasons.InvalidateCatalog();
        await _audit.LogAsync("downtime.reason.update", User.GetUserId(), User.GetUserName(),
            entityType: nameof(FaultCodeMap), entityId: map.Id.ToString());
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var map = await _db.FaultCodeMaps.FirstOrDefaultAsync(f => f.Id == id);
        if (map is null) return NotFound();
        _db.FaultCodeMaps.Remove(map);
        await _db.SaveChangesAsync();
        _reasons.InvalidateCatalog();
        return NoContent();
    }

    private static DowntimeReasonDto ToDto(FaultCodeMap f) =>
        new(f.Id, f.Code, f.Reason, f.Category.ToString(), f.Kind.ToString(), f.LineId, f.MachineId,
            f.IsAutoCreated, f.NeedsReview);
}

/// <summary>Obsolete alias — use <see cref="DowntimeReasonsController"/>.</summary>
[ApiController]
[Route("api/fault-codes")]
[Authorize]
[Obsolete("Use /api/downtime-reasons")]
public class FaultCodesController : DowntimeReasonsController
{
    public FaultCodesController(ConnectOeeDbContext db, IAuditService audit, Live.DowntimeReasonResolverService reasons)
        : base(db, audit, reasons)
    {
    }
}
