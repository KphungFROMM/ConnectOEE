using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/live")]
[Authorize]
public class LiveController : ControllerBase
{
    private readonly SnapshotCache _cache;
    private readonly IScopeAccessService _scope;

    public LiveController(SnapshotCache cache, IScopeAccessService scope)
    {
        _cache = cache;
        _scope = scope;
    }

    /// <summary>Latest snapshot for every machine (initial dashboard load).</summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<MachineSnapshot>>> All(CancellationToken ct)
    {
        var all = _cache.All();
        if (_scope.HasUnrestrictedAccess(User))
            return Ok(all);

        var lineIds = (await _scope.GetAccessibleLineIdsAsync(User, ct)).ToHashSet();
        return Ok(all.Where(s => lineIds.Contains(s.LineId)));
    }

    /// <summary>Latest snapshots for a single line.</summary>
    [HttpGet("line/{lineId:guid}")]
    public async Task<ActionResult<IEnumerable<MachineSnapshot>>> ForLine(Guid lineId, CancellationToken ct)
    {
        if (!await _scope.CanAccessLineAsync(User, lineId, ct))
            return Forbid();
        return Ok(_cache.ForLine(lineId));
    }
}
