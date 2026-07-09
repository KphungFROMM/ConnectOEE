namespace ConnectOEE.Historian;

/// <summary>
/// Read-side query engine over the historian (raw hypertables + rollups + event
/// tables). Supports time-range trends at selectable granularity, KPI snapshots,
/// hierarchy drill-down (plant -&gt; dept -&gt; line -&gt; machine) and downtime
/// drill-through (line -&gt; category/reason -&gt; events).
/// </summary>
public interface IHistorianQueryService
{
    /// <summary>Bucketed OEE/A/P/Q trend for a node over a range.</summary>
    Task<TrendResult> GetTrendAsync(TrendQuery query, CancellationToken ct = default);

    /// <summary>Single aggregate KPI snapshot for a node over a range.</summary>
    Task<KpiSnapshot> GetSnapshotAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default);

    /// <summary>Immediate children of a node with their KPI roll-ups (drill-down).</summary>
    Task<IReadOnlyList<DrillNode>> DrillDownAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default);

    /// <summary>Downtime grouped by category+reason for a line (drill-through).</summary>
    Task<IReadOnlyList<ReasonBucket>> DrillThroughReasonsAsync(Guid lineId,
        DateTimeOffset from, DateTimeOffset to, string? category = null, CancellationToken ct = default);

    /// <summary>Downtime grouped by category+reason for any hierarchy scope.</summary>
    Task<IReadOnlyList<ReasonBucket>> DrillThroughReasonsScopedAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, string? category = null, CancellationToken ct = default);

    /// <summary>Six Big Losses buckets for a hierarchy scope.</summary>
    Task<IReadOnlyList<HistorianLossBucket>> GetLossesScopedAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default);

    /// <summary>Completed downtime events for analytics drill-through.</summary>
    Task<IReadOnlyList<HistorianEvent>> GetEventsScopedAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, int take = 100, Guid? machineId = null,
        string? category = null, CancellationToken ct = default);

    /// <summary>Production vs target trend (counts per bucket) for a node.</summary>
    Task<IReadOnlyList<ProductionPoint>> GetProductionTrendAsync(TrendQuery query, CancellationToken ct = default);

    /// <summary>Bucketed MTTR/MTBF/stops trend for a node over a range.</summary>
    Task<ReliabilityTrendResult> GetReliabilityTrendAsync(TrendQuery query, CancellationToken ct = default);

    /// <summary>Per-state time breakdown reconstructed from historian state samples.</summary>
    Task<StateTimeBreakdownResult> GetStateBreakdownAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default);

    /// <summary>Parts-based production loss summary and category breakdown.</summary>
    Task<ProductionPartsLossResult> GetProductionPartsLossAsync(EntityLevel level, Guid entityId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct = default);
}
