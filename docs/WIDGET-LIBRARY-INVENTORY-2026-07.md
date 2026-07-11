# Widget Library Inventory — July 2026

Full catalog inventory for ConnectOEE after the full-library redesign pass.

## Totals

| Metric | Count |
|--------|------:|
| Catalog types (`widgetCatalog`) | 111 |
| Categories | 8 |
| Presentation flavors (`number`/`ring`/`bar`/`spark`) | 20+ KPI types |
| Frame variants (`default`/`compact`/`hero`/`kiosk`) | All except `divider` |

## Categories

| Category | Count | Notes |
|----------|------:|-------|
| KPI & OEE | 21 | Gauges, heroes, tiles — PresentationKpi on number tiles |
| Reliability & downtime | 22 | Charts + single metrics on MetricHero/PresentationKpi |
| Production & shift | 21 | Pace, attainment, strips |
| Charts & trends | 12 | ChartShell consistency |
| State & status | 13 | Redesigned: connection, clock, run-state, line-status use StatusMetricTile/StatusBeacon |
| Interactive | 3 | Functional chrome |
| Layout, media & utility | 14 | Clock elevated; containers remain placeholders |
| Tables & lists | 4 | Table chrome |

## Coverage vs flavors

| Need | Status |
|------|--------|
| OEE / A/P/Q | Covered (gauge, hero, cluster, tiles, traffic light) |
| Downtime / Pareto / Six Big Losses | Covered |
| Reliability (MTTR/MTBF/MTTF/MTTD) | Covered — shared PresentationKpi skins |
| Production pace / attainment | Covered |
| Run state / Andon / connection | Covered — StatusBeacon + StatusMetricTile |
| Historian trends | Covered |
| Nested containers | Placeholder only (deferred) |

## Redundancy (kept, shared skins)

| Pair / group | Approach |
|--------------|----------|
| `mttr-tile` / reliability-cluster | Keep both; tile uses PresentationKpi |
| `run-state-badge` / `status-light` | Badge now uses StatusBeacon (same visual language) |
| `count-to-go` / `count-to-target` | Alias / shared CountToGo |
| `kpi-tile` / scrap/yield/fpy | Field-bound variants of same skin |

## Visual grades (post-redesign)

- **Strong:** andon, status-light, oee-traffic-light, line-status-strip, gauges/heroes, connection-stale, last-update-clock, run-state-badge, line-status-indicator
- **OK:** remaining catalog (ChartShell / MetricHero / WidgetFrame)
- **Weak:** none unexplained (container/tab nesting deferred by design)

## Screenshots

- Baseline / post: `docs/widget-screenshots/v1/` and `v2/` via `scripts/capture-widget-screenshots.mjs`
- Gallery: `/admin?tab=widgets` and `/dev/widgets`
