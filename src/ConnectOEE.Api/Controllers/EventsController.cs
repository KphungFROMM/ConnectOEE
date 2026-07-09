using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Core.Oee;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/events")]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IScopeAccessService _scope;
    private readonly SnapshotCache _cache;
    private readonly IHubContext<LiveHub> _hub;

    public EventsController(
        ConnectOeeDbContext db,
        IScopeAccessService scope,
        SnapshotCache cache,
        IHubContext<LiveHub> hub)
    {
        _db = db;
        _scope = scope;
        _cache = cache;
        _hub = hub;
    }

    public record DowntimeDto(Guid Id, Guid LineId, Guid? MachineId, DateTimeOffset StartUtc,
        DateTimeOffset? EndUtc, double DurationSec, string Category, string Kind, string? Reason,
        int? FaultCode, bool IsMicroStop, bool RequiresOperatorReason);

    private async Task<List<Guid>> ResolveLineIdsAsync(Guid? lineId, Guid? plantId)
    {
        if (lineId is { } lid) return [lid];
        if (plantId is { } pid)
        {
            return await _db.Lines.AsNoTracking()
                .Where(l => l.Department != null && l.Department.PlantId == pid)
                .Select(l => l.Id)
                .ToListAsync();
        }
        return [];
    }

    private ActionResult? RequireScope(Guid? lineId, Guid? plantId)
    {
        if (lineId is null && plantId is null)
            return BadRequest(new { message = "lineId or plantId is required" });
        return null;
    }

    private async Task<ActionResult?> AuthorizeScopeAsync(Guid? lineId, Guid? plantId, CancellationToken ct)
    {
        if (lineId is { } lid && !await _scope.CanAccessLineAsync(User, lid, ct))
            return Forbid();
        if (plantId is { } pid && !await _scope.CanAccessPlantAsync(User, pid, ct))
            return Forbid();
        return null;
    }

    /// <summary>Downtime events for a line or plant over a time range (default last 24h).</summary>
    [HttpGet("downtime")]
    public async Task<ActionResult<IEnumerable<DowntimeDto>>> Downtime(
        [FromQuery] Guid? lineId, [FromQuery] Guid? plantId, [FromQuery] Guid? machineId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] bool? needsReason, [FromQuery] int take = 500, CancellationToken ct = default)
    {
        if (RequireScope(lineId, plantId) is { } err) return err;
        if (await AuthorizeScopeAsync(lineId, plantId, ct) is { } forbid) return forbid;

        var lineIds = await ResolveLineIdsAsync(lineId, plantId);
        if (!_scope.HasUnrestrictedAccess(User))
        {
            var allowed = (await _scope.GetAccessibleLineIdsAsync(User, ct)).ToHashSet();
            lineIds = lineIds.Where(allowed.Contains).ToList();
        }
        if (lineIds.Count == 0) return Ok(Array.Empty<DowntimeDto>());

        var fromUtc = from ?? DateTimeOffset.UtcNow.AddHours(-24);
        var toUtc = to ?? DateTimeOffset.UtcNow;
        take = Math.Clamp(take, 1, 500);

        var query = _db.DowntimeEvents
            .Where(e => lineIds.Contains(e.LineId) && e.StartUtc >= fromUtc && e.StartUtc <= toUtc);
        if (machineId is { } mid)
            query = query.Where(e => e.MachineId == mid);

        var fetchLimit = needsReason == true ? 2000 : take;
        var items = await query
            .OrderByDescending(e => e.StartUtc)
            .Take(fetchLimit)
            .ToListAsync(ct);

        var machineIds = items.Where(e => e.MachineId != null).Select(e => e.MachineId!.Value).Distinct().ToList();
        var mappedMachineList = await _db.LogicalSignals.AsNoTracking()
            .Where(s => s.MachineId != null && machineIds.Contains(s.MachineId.Value)
                && s.Role == SignalRole.DowntimeReason && s.Mapping != null)
            .Select(s => s.MachineId!.Value)
            .ToListAsync(ct);
        var mappedMachines = mappedMachineList.ToHashSet();

        var faultCodes = items.Where(e => e.FaultCode is > 0).Select(e => e.FaultCode!.Value).Distinct().ToList();
        var reviewCodes = faultCodes.Count == 0
            ? new HashSet<int>()
            : (await _db.FaultCodeMaps.AsNoTracking()
                .Where(f => f.NeedsReview && faultCodes.Contains(f.Code))
                .Select(f => f.Code)
                .ToListAsync(ct)).ToHashSet();

        var dtos = items.Select(e =>
        {
            var plcMapped = e.MachineId is Guid mid2 && mappedMachines.Contains(mid2);
            var fc = e.FaultCode ?? 0;
            var isPlaceholder = fc > 0 && !string.IsNullOrWhiteSpace(e.Reason)
                && DowntimeReasonResolverService.IsPlaceholderReason(e.Reason, fc);
            var requiresOperator = string.IsNullOrWhiteSpace(e.Reason)
                && (!plcMapped || fc == 0)
                || isPlaceholder
                || (fc > 0 && reviewCodes.Contains(fc) && e.ReasonEnteredByUserId is null);
            return new DowntimeDto(e.Id, e.LineId, e.MachineId, e.StartUtc, e.EndUtc, e.DurationSec,
                e.Category.ToString(), e.Kind.ToString(), e.Reason, e.FaultCode, e.IsMicroStop, requiresOperator);
        }).ToList();

        if (needsReason == true)
            dtos = dtos.Where(d => d.RequiresOperatorReason).Take(take).ToList();
        else if (dtos.Count > take)
            dtos = dtos.Take(take).ToList();

        return Ok(dtos);
    }

    /// <summary>Six Big Losses Pareto for a line or plant over a range.</summary>
    [HttpGet("losses")]
    public async Task<ActionResult<object>> Losses(
        [FromQuery] Guid? lineId, [FromQuery] Guid? plantId, [FromQuery] Guid? machineId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (RequireScope(lineId, plantId) is { } err) return err;
        if (await AuthorizeScopeAsync(lineId, plantId, ct) is { } forbid) return forbid;

        var lineIds = await ResolveLineIdsAsync(lineId, plantId);
        if (!_scope.HasUnrestrictedAccess(User))
        {
            var allowed = (await _scope.GetAccessibleLineIdsAsync(User, ct)).ToHashSet();
            lineIds = lineIds.Where(allowed.Contains).ToList();
        }
        if (lineIds.Count == 0) return Ok(Array.Empty<object>());

        var fromUtc = from ?? DateTimeOffset.UtcNow.AddHours(-24);
        var toUtc = to ?? DateTimeOffset.UtcNow;

        var query = _db.DowntimeEvents
            .Where(e => lineIds.Contains(e.LineId) && e.StartUtc >= fromUtc && e.StartUtc <= toUtc && e.EndUtc != null);
        if (machineId is { } mid)
            query = query.Where(e => e.MachineId == mid);

        var byCategory = await query
            .GroupBy(e => e.Category)
            .Select(g => new { Category = g.Key.ToString(), Count = g.Count(), TotalSec = g.Sum(x => x.DurationSec) })
            .OrderByDescending(x => x.TotalSec)
            .ToListAsync(ct);
        return Ok(byCategory);
    }

    /// <summary>Reliability metrics (MTTR/MTBF/MTTD/...) for a line or plant over a range.</summary>
    [HttpGet("reliability")]
    public async Task<ActionResult<ReliabilityResult>> Reliability(
        [FromQuery] Guid? lineId, [FromQuery] Guid? plantId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (RequireScope(lineId, plantId) is { } err) return err;
        if (await AuthorizeScopeAsync(lineId, plantId, ct) is { } forbid) return forbid;

        var lineIds = await ResolveLineIdsAsync(lineId, plantId);
        if (!_scope.HasUnrestrictedAccess(User))
        {
            var allowed = (await _scope.GetAccessibleLineIdsAsync(User, ct)).ToHashSet();
            lineIds = lineIds.Where(allowed.Contains).ToList();
        }
        if (lineIds.Count == 0) return Ok(ReliabilityResult.Empty);

        var fromUtc = from ?? DateTimeOffset.UtcNow.AddHours(-24);
        var toUtc = to ?? DateTimeOffset.UtcNow;
        var periodSec = (toUtc - fromUtc).TotalSeconds;

        var downtimes = await _db.DowntimeEvents
            .Where(e => lineIds.Contains(e.LineId) && e.StartUtc >= fromUtc && e.StartUtc <= toUtc && e.EndUtc != null)
            .Select(e => new { e.DurationSec, e.Kind, e.StartUtc, e.AcknowledgedUtc })
            .ToListAsync(ct);

        var totalDownSec = downtimes.Sum(d => d.DurationSec);
        var uptimeSec = Math.Max(0, periodSec * lineIds.Count - totalDownSec);

        var stats = downtimes
            .Select(d => new DowntimeStat(
                d.DurationSec,
                d.AcknowledgedUtc is { } ack ? (ack - d.StartUtc).TotalSeconds : null,
                d.Kind == DowntimeKind.Unplanned))
            .ToList();

        var result = ReliabilityCalculator.Compute(new ReliabilityInputs(periodSec * lineIds.Count, uptimeSec, stats));
        return Ok(result);
    }

    public record OperatorDowntimeDto(Guid? OperatorId, string OperatorName, int StopCount, double TotalMin, double UnplannedMin);

    /// <summary>Downtime attributed to operators who entered reasons (shift-to-date or range).</summary>
    [HttpGet("downtime-by-operator")]
    public async Task<ActionResult<IEnumerable<OperatorDowntimeDto>>> DowntimeByOperator(
        [FromQuery] Guid? lineId, [FromQuery] Guid? plantId,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (RequireScope(lineId, plantId) is { } err) return err;
        if (await AuthorizeScopeAsync(lineId, plantId, ct) is { } forbid) return forbid;

        var lineIds = await ResolveLineIdsAsync(lineId, plantId);
        if (!_scope.HasUnrestrictedAccess(User))
        {
            var allowed = (await _scope.GetAccessibleLineIdsAsync(User, ct)).ToHashSet();
            lineIds = lineIds.Where(allowed.Contains).ToList();
        }
        if (lineIds.Count == 0) return Ok(Array.Empty<OperatorDowntimeDto>());

        var fromUtc = from ?? DateTimeOffset.UtcNow.AddHours(-24);
        var toUtc = to ?? DateTimeOffset.UtcNow;

        var events = await _db.DowntimeEvents.AsNoTracking()
            .Where(e => lineIds.Contains(e.LineId) && e.StartUtc >= fromUtc && e.StartUtc <= toUtc && e.EndUtc != null)
            .Select(e => new { e.ReasonEnteredByUserId, e.DurationSec, e.Kind })
            .ToListAsync(ct);

        var userIds = events.Where(e => e.ReasonEnteredByUserId != null).Select(e => e.ReasonEnteredByUserId!.Value).Distinct().ToList();
        var users = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.Id))
            .Select(u => new { u.Id, u.DisplayName, u.UserName })
            .ToDictionaryAsync(u => u.Id, ct);

        var rows = events
            .GroupBy(e => e.ReasonEnteredByUserId)
            .Select(g =>
            {
                var unplanned = g.Where(x => x.Kind == DowntimeKind.Unplanned).Sum(x => x.DurationSec);
                var name = g.Key is Guid uid && users.TryGetValue(uid, out var u)
                    ? (u.DisplayName ?? u.UserName ?? "Unknown")
                    : "Unattributed";
                return new OperatorDowntimeDto(
                    g.Key,
                    name,
                    g.Count(),
                    Math.Round(g.Sum(x => x.DurationSec) / 60.0, 2),
                    Math.Round(unplanned / 60.0, 2));
            })
            .OrderByDescending(x => x.TotalMin)
            .ToList();

        return Ok(rows);
    }

    public record CorrectReasonRequest(string Reason, string? Category);

    /// <summary>Supervisor correction of an already-assigned downtime reason.</summary>
    [HttpPatch("downtime/{id:guid}/reason")]
    [HasPermission(PermissionKeys.EnterDowntimeReason)]
    public async Task<IActionResult> CorrectReason(
        Guid id,
        [FromBody] CorrectReasonRequest request,
        [FromServices] IAuditService audit,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.Reason))
            return BadRequest(new { message = "Reason is required" });

        var ev = await _db.DowntimeEvents.FirstOrDefaultAsync(e => e.Id == id, ct);
        if (ev is null) return NotFound();

        if (!await _scope.CanAccessLineAsync(User, ev.LineId, ct))
            return Forbid();

        var previous = ev.Reason;
        ev.Reason = request.Reason.Trim();
        if (Enum.TryParse<LossCategory>(request.Category, out var cat)) ev.Category = cat;

        if (ev.FaultCode is > 0)
        {
            var map = await _db.FaultCodeMaps.AsNoTracking()
                .Where(f => f.Code == ev.FaultCode && (f.LineId == ev.LineId || f.LineId == null))
                .OrderBy(f => f.LineId.HasValue ? 0 : 1)
                .FirstOrDefaultAsync(ct);
            if (map is not null)
            {
                ev.Kind = map.Kind;
                if (string.IsNullOrWhiteSpace(request.Category))
                    ev.Category = map.Category;
            }
        }

        ev.ReasonEnteredByUserId = User.GetUserId();
        ev.ReasonEnteredUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync(ct);

        if (ev.MachineId is Guid machineId && _cache.TryUpdateReasonText(machineId, ev.Reason, out var snap) && snap is not null)
            await _hub.Clients.Group(LiveHub.LineGroup(ev.LineId)).SendAsync("liveUpdate", snap, ct);

        await audit.LogAsync("downtime.reason.correct", User.GetUserId(), User.GetUserName(),
            entityType: nameof(Core.Entities.DowntimeEvent), entityId: ev.Id.ToString(),
            details: new { Previous = previous, ev.Reason, Category = ev.Category.ToString() });

        return NoContent();
    }
}
