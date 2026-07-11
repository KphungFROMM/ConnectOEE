using ConnectOEE.Api.Auth;
using ConnectOEE.Api.Live;
using ConnectOEE.Core;
using ConnectOEE.Core.Oee;
using ConnectOEE.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ConnectOEE.Api.Controllers;

[ApiController]
[Route("api/live")]
[Authorize]
public class LiveController : ControllerBase
{
    private readonly SnapshotCache _cache;
    private readonly IScopeAccessService _scope;
    private readonly ConnectOeeDbContext _db;

    public LiveController(SnapshotCache cache, IScopeAccessService scope, ConnectOeeDbContext db)
    {
        _cache = cache;
        _scope = scope;
        _db = db;
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

    public record LineLiveRollupDto(
        Guid LineId,
        LineTopology Topology,
        Guid? LineOutputMachineId,
        Guid? PacingMachineId,
        string? LineOutputMachineName,
        double OeePct,
        double AvailabilityPct,
        double PerformancePct,
        double QualityPct,
        long GoodCount,
        long RejectCount);

    /// <summary>Topology-aware rolled-up live KPI for a line (widgets / dashboards).</summary>
    [HttpGet("line/{lineId:guid}/rollup")]
    public async Task<ActionResult<LineLiveRollupDto>> LineRollup(Guid lineId, CancellationToken ct)
    {
        if (!await _scope.CanAccessLineAsync(User, lineId, ct))
            return Forbid();

        var machines = await _db.Machines.AsNoTracking()
            .Where(m => m.LineId == lineId)
            .OrderBy(m => m.SequenceIndex)
            .Select(m => new { m.Id, m.Name })
            .ToListAsync(ct);
        var cfg = await _db.OeeConfigs.AsNoTracking().FirstOrDefaultAsync(o => o.LineId == lineId, ct);
        var ids = machines.Select(m => m.Id).ToList();
        var topo = LineTopologyResolver.FromConfig(cfg, ids);
        var snaps = _cache.ForLine(lineId).ToList();
        var rows = ids.Select(id =>
        {
            var s = snaps.FirstOrDefault(x => x.MachineId == id);
            return s is null
                ? new LineKpiRollup.KpiRow(id, 0, 0, 0, 0, 0, 0, "Unknown", "Disconnected", null, null, 0, 0, 0, 0, false)
                : new LineKpiRollup.KpiRow(id, s.OeePct, s.AvailabilityPct, s.PerformancePct, s.QualityPct,
                    s.GoodCount, s.RejectCount, s.State, s.ConnectionState,
                    s.ActiveRecipeCode, s.ActiveRecipeName, s.IdealCycleTimeSec, s.ActualCycleTimeSec,
                    s.ActualRatePph, s.IdealRatePph, s.RecipeIsAutoCreated);
        }).ToList();

        var rolled = LineKpiRollup.RollUpLine(rows, topo);
        var outName = topo.OutputMachineId is Guid oid
            ? machines.FirstOrDefault(m => m.Id == oid)?.Name
            : null;

        return Ok(new LineLiveRollupDto(
            lineId, topo.Topology, topo.OutputMachineId, topo.PacingMachineId, outName,
            rolled.OeePct, rolled.AvailabilityPct, rolled.PerformancePct, rolled.QualityPct,
            rolled.GoodCount, rolled.RejectCount));
    }
}
