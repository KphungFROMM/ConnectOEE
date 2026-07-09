using ConnectOEE.Api.Auth;
using ConnectOEE.Core.Entities.Security;
using ConnectOEE.Historian;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ConnectOEE.Api.Controllers;

/// <summary>
/// Historian query API: time-range trends, KPI snapshots, hierarchy drill-down and
/// downtime drill-through. Backed by <see cref="IHistorianQueryService"/> over the
/// TimescaleDB rollups + event tables.
/// </summary>
[ApiController]
[Route("api/historian")]
[HasPermission(PermissionKeys.ViewReports)]
public class HistorianController : ControllerBase
{
    private readonly IHistorianQueryService _historian;
    private readonly IScopeAccessService _scope;

    public HistorianController(IHistorianQueryService historian, IScopeAccessService scope)
    {
        _historian = historian;
        _scope = scope;
    }

    /// <summary>Bucketed OEE/A/P/Q trend for a node (auto granularity if omitted).</summary>
    [HttpGet("trend")]
    public async Task<ActionResult<TrendResult>> Trend(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] Granularity granularity = Granularity.Auto, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        var result = await _historian.GetTrendAsync(new TrendQuery(level, id, f, t, granularity), ct);
        return Ok(result);
    }

    /// <summary>Aggregate KPI snapshot for a node over the range.</summary>
    [HttpGet("snapshot")]
    public async Task<ActionResult<KpiSnapshot>> Snapshot(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetSnapshotAsync(level, id, f, t, ct));
    }

    /// <summary>Immediate children of a node with KPI roll-ups (drill-down).</summary>
    [HttpGet("drilldown")]
    public async Task<ActionResult<IReadOnlyList<DrillNode>>> DrillDown(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.DrillDownAsync(level, id, f, t, ct));
    }

    /// <summary>Downtime grouped by category/reason (lineId legacy or level+id scope).</summary>
    [HttpGet("reasons")]
    public async Task<ActionResult<IReadOnlyList<ReasonBucket>>> Reasons(
        [FromQuery] Guid? lineId,
        [FromQuery] EntityLevel? level,
        [FromQuery] Guid? id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        var (f, t) = Range(from, to);
        if (level is { } lv && id is { } eid)
        {
            if (!await _scope.CanAccessEntityAsync(User, lv, eid, ct)) return Forbid();
            return Ok(await _historian.DrillThroughReasonsScopedAsync(lv, eid, f, t, category, ct));
        }
        if (lineId is { } lid)
        {
            if (!await _scope.CanAccessLineAsync(User, lid, ct)) return Forbid();
            return Ok(await _historian.DrillThroughReasonsAsync(lid, f, t, category, ct));
        }
        return BadRequest(new { message = "lineId or level+id is required" });
    }

    /// <summary>Six Big Losses buckets for a hierarchy scope.</summary>
    [HttpGet("losses")]
    public async Task<ActionResult<IReadOnlyList<HistorianLossBucket>>> Losses(
        [FromQuery] EntityLevel level,
        [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetLossesScopedAsync(level, id, f, t, ct));
    }

    /// <summary>Completed downtime events for analytics drill-through.</summary>
    [HttpGet("events")]
    public async Task<ActionResult<IReadOnlyList<HistorianEvent>>> Events(
        [FromQuery] EntityLevel level,
        [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        [FromQuery] int take = 100,
        [FromQuery] Guid? machineId = null,
        [FromQuery] string? category = null,
        CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetEventsScopedAsync(level, id, f, t, take, machineId, category, ct));
    }

    /// <summary>Production-vs-target trend for a node.</summary>
    [HttpGet("production")]
    public async Task<ActionResult<IReadOnlyList<ProductionPoint>>> Production(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] Granularity granularity = Granularity.Auto, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetProductionTrendAsync(new TrendQuery(level, id, f, t, granularity), ct));
    }

    /// <summary>Bucketed MTTR/MTBF/stops trend for a node.</summary>
    [HttpGet("reliability-trend")]
    public async Task<ActionResult<ReliabilityTrendResult>> ReliabilityTrend(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to,
        [FromQuery] Granularity granularity = Granularity.Auto, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetReliabilityTrendAsync(new TrendQuery(level, id, f, t, granularity), ct));
    }

    /// <summary>Run-state time breakdown for a hierarchy scope.</summary>
    [HttpGet("state-breakdown")]
    public async Task<ActionResult<StateTimeBreakdownResult>> StateBreakdown(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetStateBreakdownAsync(level, id, f, t, ct));
    }

    /// <summary>Parts-based production loss summary and category breakdown.</summary>
    [HttpGet("production-parts-loss")]
    public async Task<ActionResult<ProductionPartsLossResult>> ProductionPartsLoss(
        [FromQuery] EntityLevel level, [FromQuery] Guid id,
        [FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct = default)
    {
        if (!await _scope.CanAccessEntityAsync(User, level, id, ct)) return Forbid();
        var (f, t) = Range(from, to);
        return Ok(await _historian.GetProductionPartsLossAsync(level, id, f, t, ct));
    }

    private static (DateTimeOffset from, DateTimeOffset to) Range(DateTimeOffset? from, DateTimeOffset? to)
    {
        var t = to ?? DateTimeOffset.UtcNow;
        var f = from ?? t.AddHours(-24);
        return (f, t);
    }
}
