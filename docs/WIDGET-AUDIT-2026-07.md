# Widget Visual Audit — July 2026

Systematic QA pass for all **111** widget types via the **Widget library** at `/admin?tab=widgets` and `/dev/widgets` (requires `dashboards.build` or admin).

> **Update (full redesign):** See [WIDGET-REDESIGN-2026-07.md](WIDGET-REDESIGN-2026-07.md) and [WIDGET-LIBRARY-INVENTORY-2026-07.md](WIDGET-LIBRARY-INVENTORY-2026-07.md). State & status bare badges were replaced with `StatusMetricTile` / `StatusBeacon`; KPI tiles use `PresentationKpi`. Screenshots: `docs/widget-screenshots/`.

## How to reproduce

1. Sign in as Admin (or any role with builder permission).
2. Open `/dev/widgets`.
3. Toggle **Light** / **Dark** in the gallery header.
4. Each card renders at catalog default `defaultW × defaultH` with `createMockWidgetCtx()` live snapshot data and audit API mocks (`setAuditApiMode(true)`).

## Cross-cutting standards (applied)

| Standard | Status |
|----------|--------|
| Empty state via `WidgetFrame` / `EmptyChartState` | ✅ All types show explicit empty or content |
| Stale badge when hub disconnected | ✅ Wired on live widgets |
| Historian widgets show data in audit | ✅ Audit API mocks in `mockAuditApi.ts` |
| Default binding produces visible output | ✅ `widgetFactory.ts` + scoped snapshot roll-up fixes |
| Min size / no clip at default size | ✅ Gallery uses catalog default heights |

## Issues log

Severity: **blocker** · **polish** · **docs**

### Blockers (fixed)

| Widget | Issue | Fix |
|--------|-------|-----|
| `oee-waterfall` | Y-axis showed garbage values (`99999994%`) — Start step subtracted 100 from running total | `WaterfallChart.tsx`: treat `Start`/`OEE` steps explicitly |
| `attainment-tile` | Empty at line scope — pseudo snapshot missing target qty fields | `aggregateSnapshots` + `toPseudoSnapshot` include run/shift targets |
| Historian charts (multi-trend, hourly production, etc.) | Loading/empty without backend | Audit API mode returns mock trend/production/reasons |
| Builder DnD | Drops failed when canvas scrolled | Scroll-aware `pointerToGridCell` + canvas shell restructure |
| Builder DnD | `process is not defined` from react-draggable | `vite.config.ts` `define: { 'process.env': {} }` |

### Polish (fixed)

| Widget | Issue | Fix |
|--------|-------|-----|
| `count-to-target`, `target-pace-tile` | No target in factory defaults | Default `target: 5500` in `widgetFactory.ts` |
| `live-tag-value`, `udt-member-value` | No tag path in defaults | Demo tag path + connection ID in `defaultBinding` |
| `image-logo`, `iframe-embed`, `qr-link-tile`, `text-label`, etc. | Blank without user config | Demo URL/content in `defaultOptions` |
| `dashboard-link` | Empty without dashboard ID | Demo ID + label in `defaultOptions` |
| `loss-minutes-bridge`, `cycle-time-compare` | Misleading “History building” banner | `ChartShell bucketCount={2}` for snapshot charts |
| `reliability-cluster` palette copy | Said MTTR/MTBF only | Updated to MTTR/MTBF/MTTF/MTTD grid in `widgetPaletteMeta.ts` |

### Polish (accepted / by design)

| Widget | Notes |
|--------|-------|
| `operator-downtime-pad`, `fault-ack-button`, `plc-write-controls` | Interactive — preview shows UI; writes disabled or noop in builder preview |
| `iframe-embed` | Demo URL may not load off-prem; frame chrome still validates layout |
| `dashboard-link` | Demo ID is placeholder until user picks a saved dashboard |
| `marquee-ticker` | Scrolls live downtime text when events exist; static fallback acceptable |

## Category pass summary

| Category | Count | Light | Dark | Blockers |
|----------|------:|-------|------|----------|
| KPI & OEE | 24 | ✅ | ✅ | 0 |
| Reliability & downtime | 22 | ✅ | ✅ | 0 |
| Charts & trends | 12 | ✅ | ✅ | 0 |
| Production & shift | 18 | ✅ | ✅ | 0 |
| State & status | 13 | ✅ | ✅ | 0 |
| Interactive | 3 | ✅ | ✅ | 0 |
| Layout, media & utility | 14 | ✅ | ✅ | 0 |
| Tables & lists | 5 | ✅ | ✅ | 0 |

## Regression tests

- `frontend/src/features/builder/gridCoords.test.ts` — scroll-aware drop coordinates (4 cases)
- `frontend/src/components/widgets/widgetCatalog.test.ts` — registry ↔ catalog parity (100 types)

## Next (out of scope for this audit)

- System dashboard template redesign (16 templates) — deferred until widgets vetted ✅
- Playwright E2E for scroll → drop at row 10+ (manual QA verified in builder)
