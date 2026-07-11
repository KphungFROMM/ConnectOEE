using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Abstractions;
using ConnectOEE.Core.Entities;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Drivers;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// Logical signal listing, the live tag browser (driver enumeration + value preview),
/// UDT-aware tag import, and tag mapping with type-compatibility validation. Browsing
/// is gated by BrowseTags; mapping changes require MapTags and are all audited.
/// </summary>
[ApiController]
[Route("api/tags")]
[Authorize]
public class TagsController : ControllerBase
{
    private readonly ConnectOeeDbContext _db;
    private readonly IAuditService _audit;
    private readonly TagBrowseService _browse;
    private readonly IHubContext<LiveHub> _hub;

    public TagsController(
        ConnectOeeDbContext db,
        IAuditService audit,
        TagBrowseService browse,
        IHubContext<LiveHub> hub)
    {
        _db = db;
        _audit = audit;
        _browse = browse;
        _hub = hub;
    }

    public record SignalDto(Guid Id, string Name, string Role, string ExpectedType, string? Unit,
        string CountIngestMode, string RunStateIngestMode, Guid? MachineId, Guid? LineId, bool IsMapped, string? MappedPath, bool IsManual, bool Required);
    public record MapRequest(Guid LogicalSignalId, string TagPath, Guid? PlcConnectionId, string? DataType);
    public record UpdateIngestModeRequest(string CountIngestMode);
    public record UpdateRunStateIngestModeRequest(string RunStateIngestMode);
    public record MapResult(bool Mapped, string? Warning);
    public record BrowseResult(bool SupportsBrowsing, string DriverType, IReadOnlyList<BrowseTag> Tags);
    public record BrowseLeafDto(string Name, string FullPath, string DataType, string? UdtTypeName, int ArrayLength, string? Description);
    public record BrowseLeavesResult(bool SupportsBrowsing, string DriverType, IReadOnlyList<BrowseLeafDto> Leaves);
    public record TagPathRequest(string Path, string? DataType);
    public record ValuesRequest(Guid ConnectionId, TagPathRequest[] Paths);
    public record ImportResult(int Tags, int Udts, int Members);

    private static readonly HashSet<SignalRole> RequiredRoles = new()
    {
        SignalRole.RunState, SignalRole.GoodCount,
    };

    /// <summary>
    /// Acceptable physical tag types per logical signal role. Used to warn (not block)
    /// on type-incompatible bindings so operators stay aware while keeping flexibility.
    /// </summary>
    private static readonly Dictionary<SignalRole, TagDataType[]> RoleTypeCompat = new()
    {
        [SignalRole.RunState] = new[] { TagDataType.Bool, TagDataType.Int, TagDataType.Dint },
        [SignalRole.GoodCount] = new[] { TagDataType.Int, TagDataType.Dint, TagDataType.Bool },
        [SignalRole.RejectCount] = new[] { TagDataType.Int, TagDataType.Dint, TagDataType.Bool },
        [SignalRole.ReworkCount] = new[] { TagDataType.Int, TagDataType.Dint, TagDataType.Bool },
        [SignalRole.TotalCount] = new[] { TagDataType.Int, TagDataType.Dint, TagDataType.Bool },
        [SignalRole.Speed] = new[] { TagDataType.Real, TagDataType.Int, TagDataType.Dint },
        [SignalRole.DowntimeReason] = new[] { TagDataType.Int, TagDataType.Dint },
        [SignalRole.RunStateRunning] = new[] { TagDataType.Bool },
        [SignalRole.RunStateIdle] = new[] { TagDataType.Bool },
        [SignalRole.RunStateFaulted] = new[] { TagDataType.Bool },
        [SignalRole.PartId] = new[] { TagDataType.String, TagDataType.Int, TagDataType.Dint },
    };

    private static string? CompatWarning(SignalRole role, TagDataType? type, CountIngestMode ingestMode)
    {
        if (type is null or TagDataType.Unknown) return null;
        if (role == SignalRole.Custom) return null;

        if (ingestMode == CountIngestMode.PulseRisingEdge &&
            role is SignalRole.GoodCount or SignalRole.RejectCount or SignalRole.ReworkCount or SignalRole.TotalCount)
        {
            return type == TagDataType.Bool
                ? null
                : $"Pulse mode expects a Bool tag for {role} (got {type}).";
        }

        if (!RoleTypeCompat.TryGetValue(role, out var allowed)) return null;
        return allowed.Contains(type.Value)
            ? null
            : $"Tag type {type} is unusual for a {role} signal (expected {string.Join("/", allowed)}).";
    }

    /// <summary>Lists logical signals (optionally for a machine) with mapping status.</summary>
    [HttpGet("signals")]
    public async Task<ActionResult<IEnumerable<SignalDto>>> Signals([FromQuery] Guid? machineId, [FromQuery] Guid? lineId)
    {
        var query = _db.LogicalSignals.Include(s => s.Mapping).ThenInclude(m => m!.TagDefinition).AsQueryable();
        if (machineId is { } mid) query = query.Where(s => s.MachineId == mid);
        if (lineId is { } lid) query = query.Where(s => s.LineId == lid);

        var signals = await query.OrderBy(s => s.Role).ToListAsync();
        return Ok(signals.Select(s => new SignalDto(
            s.Id, s.Name, s.Role.ToString(), s.ExpectedType.ToString(), s.Unit,
            s.CountIngestMode.ToString(), s.RunStateIngestMode.ToString(), s.MachineId, s.LineId,
            s.Mapping != null,
            s.Mapping?.MemberPath ?? s.Mapping?.TagDefinition?.FullPath,
            s.Mapping?.IsManual ?? false,
            RequiredRoles.Contains(s.Role))));
    }

    [HttpPut("signals/{signalId:guid}/run-state-ingest-mode")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<IActionResult> UpdateRunStateIngestMode(Guid signalId, [FromBody] UpdateRunStateIngestModeRequest req)
    {
        if (!Enum.TryParse<RunStateIngestMode>(req.RunStateIngestMode, ignoreCase: true, out var mode))
            return BadRequest(new { message = "Invalid run state ingest mode" });
        var signal = await _db.LogicalSignals.FirstOrDefaultAsync(s => s.Id == signalId);
        if (signal is null) return NotFound();
        if (signal.Role != SignalRole.RunState)
            return BadRequest(new { message = "Run state ingest mode applies to RunState signal only" });
        signal.RunStateIngestMode = mode;
        signal.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Updates how ConnectOEE interprets a count signal (cumulative delta vs pulse edge).</summary>
    [HttpPut("signals/{signalId:guid}/ingest-mode")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<IActionResult> UpdateIngestMode(Guid signalId, [FromBody] UpdateIngestModeRequest req)
    {
        if (!Enum.TryParse<CountIngestMode>(req.CountIngestMode, ignoreCase: true, out var mode))
            return BadRequest(new { message = "Invalid count ingest mode" });

        var signal = await _db.LogicalSignals.FirstOrDefaultAsync(s => s.Id == signalId);
        if (signal is null) return NotFound();
        if (signal.Role is not (SignalRole.GoodCount or SignalRole.RejectCount or SignalRole.ReworkCount or SignalRole.TotalCount))
            return BadRequest(new { message = "Ingest mode applies to count signals only" });

        signal.CountIngestMode = mode;
        if (mode == CountIngestMode.PulseRisingEdge)
            signal.ExpectedType = TagDataType.Bool;
        else if (signal.ExpectedType == TagDataType.Bool)
            signal.ExpectedType = TagDataType.Dint;

        signal.UpdatedUtc = DateTimeOffset.UtcNow;
        await _db.SaveChangesAsync();
        await _audit.LogAsync("signal.ingest_mode", User.GetUserId(), User.GetUserName(),
            entityType: nameof(LogicalSignal), entityId: signal.Id.ToString(),
            details: new { signal.Name, Mode = mode.ToString() });
        return NoContent();
    }

    /// <summary>
    /// Binds a logical signal to a tag path. Works for both browsed tags (DataType
    /// supplied -> type validated) and manual entry (no DataType). Returns any
    /// type-compatibility warning. All changes are audited.
    /// </summary>
    [HttpPost("map")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<MapResult>> Map([FromBody] MapRequest req)
    {
        var signal = await _db.LogicalSignals.Include(s => s.Mapping).FirstOrDefaultAsync(s => s.Id == req.LogicalSignalId);
        if (signal is null) return NotFound(new { message = "Signal not found" });
        if (string.IsNullOrWhiteSpace(req.TagPath)) return BadRequest(new { message = "Tag path is required" });

        var path = req.TagPath.Trim();
        var dataType = Enum.TryParse<TagDataType>(req.DataType, ignoreCase: true, out var dt) ? dt : (TagDataType?)null;
        // Browsed binds carry a concrete DataType; manual entry leaves it unset.
        var isManual = dataType is null;
        var warning = CompatWarning(signal.Role, dataType, signal.CountIngestMode);

        // Find or create a TagDefinition for the path on the chosen connection.
        Guid? connId = req.PlcConnectionId ?? await _db.PlcConnections.Select(c => (Guid?)c.Id).FirstOrDefaultAsync();
        TagDefinition? tag = null;
        if (connId is { } cid)
        {
            tag = await _db.TagDefinitions.FirstOrDefaultAsync(t => t.PlcConnectionId == cid && t.FullPath == path);
            if (tag is null)
            {
                tag = new TagDefinition { PlcConnectionId = cid, Name = path, FullPath = path, DataType = dataType ?? signal.ExpectedType };
                _db.TagDefinitions.Add(tag);
            }
            else if (dataType is { } resolved)
            {
                tag.DataType = resolved;
            }
        }

        if (signal.Mapping is null)
        {
            _db.TagMappings.Add(new TagMapping
            {
                LogicalSignalId = signal.Id,
                TagDefinitionId = tag?.Id,
                MemberPath = path,
                IsManual = isManual,
            });
        }
        else
        {
            signal.Mapping.TagDefinitionId = tag?.Id;
            signal.Mapping.MemberPath = path;
            signal.Mapping.IsManual = isManual;
            signal.Mapping.UpdatedUtc = DateTimeOffset.UtcNow;
        }

        await _db.SaveChangesAsync();
        await _audit.LogAsync("tag.map", User.GetUserId(), User.GetUserName(),
            entityType: nameof(LogicalSignal), entityId: signal.Id.ToString(),
            details: new { signal.Name, TagPath = path, DataType = dataType?.ToString(), Manual = isManual });
        return Ok(new MapResult(true, warning));
    }

    /// <summary>Removes the mapping for a logical signal (audited).</summary>
    [HttpDelete("map/{signalId:guid}")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<IActionResult> Unmap(Guid signalId)
    {
        var signal = await _db.LogicalSignals.Include(s => s.Mapping).FirstOrDefaultAsync(s => s.Id == signalId);
        if (signal?.Mapping is null) return NotFound();
        _db.TagMappings.Remove(signal.Mapping);
        await _db.SaveChangesAsync();
        await _audit.LogAsync("tag.unmap", User.GetUserId(), User.GetUserName(),
            entityType: nameof(LogicalSignal), entityId: signal.Id.ToString(), details: new { signal.Name });
        return NoContent();
    }

    /// <summary>
    /// Enumerates the controller tag namespace for a connection (hierarchical, UDT-aware).
    /// Returns SupportsBrowsing=false for drivers without enumeration so the UI shows the
    /// manual-entry fallback.
    /// </summary>
    [HttpGet("browse")]
    [HasPermission(PermissionKeys.BrowseTags)]
    public async Task<ActionResult<BrowseResult>> Browse([FromQuery] Guid connectionId, CancellationToken ct)
    {
        var (driverType, driver) = await _browse.ResolveAsync(connectionId, ct);
        if (driver is null || !driver.SupportsBrowsing)
            return Ok(new BrowseResult(false, driverType.ToString(), Array.Empty<BrowseTag>()));

        var progress = new Progress<BrowseProgress>(p =>
        {
            _ = _hub.Clients.Group(LiveHub.BrowseGroup(connectionId)).SendAsync(
                "tagBrowseProgress",
                new { connectionId, percent = p.Percent, message = p.Message },
                CancellationToken.None);
        });

        var tags = await driver.BrowseAsync(ct, progress);
        return Ok(new BrowseResult(true, driverType.ToString(), tags));
    }

    /// <summary>Flat list of bindable tag leaves — convenient for commissioning scripts and auto-mapping.</summary>
    [HttpGet("browse/leaves")]
    [HasPermission(PermissionKeys.BrowseTags)]
    public async Task<ActionResult<BrowseLeavesResult>> BrowseLeaves([FromQuery] Guid connectionId, CancellationToken ct)
    {
        var (driverType, driver) = await _browse.ResolveAsync(connectionId, ct);
        if (driver is null || !driver.SupportsBrowsing)
            return Ok(new BrowseLeavesResult(false, driverType.ToString(), Array.Empty<BrowseLeafDto>()));

        var tree = await driver.BrowseAsync(ct);
        var leaves = TagTreeFlattener.Leaves(tree)
            .Select(l => new BrowseLeafDto(l.Name, l.FullPath, l.DataType.ToString(), l.UdtTypeName, l.ArrayLength, l.Description))
            .ToList();
        return Ok(new BrowseLeavesResult(true, driverType.ToString(), leaves));
    }

    /// <summary>Reads live values (with quality + timestamp) for the given tag paths.</summary>
    [HttpPost("values")]
    [HasPermission(PermissionKeys.BrowseTags)]
    public async Task<ActionResult<IReadOnlyList<TagValueSample>>> Values([FromBody] ValuesRequest req, CancellationToken ct)
    {
        var (_, driver) = await _browse.ResolveAsync(req.ConnectionId, ct);
        if (driver is null || !driver.SupportsBrowsing || req.Paths is null || req.Paths.Length == 0)
            return Ok(Array.Empty<TagValueSample>());

        var requests = req.Paths
            .Where(p => !string.IsNullOrWhiteSpace(p.Path))
            .Select(p => new TagReadRequest(p.Path.Trim(), TagBrowseService.ParseDataType(p.DataType)))
            .ToArray();
        var samples = await driver.ReadValuesAsync(requests, ct);
        return Ok(samples);
    }

    /// <summary>
    /// Imports the browsed tag tree into TagDefinitions + UDT type/member definitions
    /// (flattened for the historian). Idempotent per connection; audited.
    /// </summary>
    [HttpPost("import")]
    [HasPermission(PermissionKeys.MapTags)]
    public async Task<ActionResult<ImportResult>> Import([FromQuery] Guid connectionId, CancellationToken ct)
    {
        var (_, driver) = await _browse.ResolveAsync(connectionId, ct);
        if (driver is null || !driver.SupportsBrowsing)
            return BadRequest(new { message = "This connection's driver does not support browsing." });

        var tree = await driver.BrowseAsync(ct);
        var leaves = TagTreeFlattener.Leaves(tree);
        var udts = TagTreeFlattener.Udts(tree);

        var existingPaths = await _db.TagDefinitions
            .Where(t => t.PlcConnectionId == connectionId)
            .Select(t => t.FullPath)
            .ToListAsync(ct);
        var existingSet = new HashSet<string>(existingPaths, StringComparer.OrdinalIgnoreCase);

        var addedTags = 0;
        foreach (var leaf in leaves)
        {
            if (existingSet.Contains(leaf.FullPath)) continue;
            _db.TagDefinitions.Add(new TagDefinition
            {
                PlcConnectionId = connectionId,
                Name = leaf.Name,
                FullPath = leaf.FullPath,
                DataType = leaf.DataType,
                UdtTypeName = leaf.UdtTypeName,
                ArrayLength = leaf.ArrayLength,
                Description = leaf.Description,
            });
            addedTags++;
        }

        var existingUdts = await _db.UdtTypes
            .Where(u => u.PlcConnectionId == connectionId)
            .Select(u => u.Name)
            .ToListAsync(ct);
        var existingUdtSet = new HashSet<string>(existingUdts, StringComparer.OrdinalIgnoreCase);

        var addedUdts = 0;
        var addedMembers = 0;
        foreach (var udt in udts)
        {
            if (existingUdtSet.Contains(udt.TypeName)) continue;
            var type = new UdtType { Name = udt.TypeName, PlcConnectionId = connectionId };
            foreach (var m in udt.Members)
            {
                type.Members.Add(new UdtMember
                {
                    Name = m.Name,
                    DataType = m.DataType,
                    FlattenedPath = m.FlattenedPath,
                    ArrayLength = m.ArrayLength,
                });
                addedMembers++;
            }
            _db.UdtTypes.Add(type);
            addedUdts++;
        }

        await _db.SaveChangesAsync(ct);
        await _audit.LogAsync("tag.import", User.GetUserId(), User.GetUserName(),
            entityType: nameof(PlcConnection), entityId: connectionId.ToString(),
            details: new { addedTags, addedUdts, addedMembers });
        return Ok(new ImportResult(addedTags, addedUdts, addedMembers));
    }
}
