# Widget Redesign — July 2026

Full-library visual redesign of ConnectOEE widgets + supporting gallery.

## Summary

| Area | Before | After |
|------|--------|-------|
| State & status weak tiles | Bare Badge / Text | `StatusMetricTile` / `StatusBeacon` |
| KPI / reliability number tiles | Raw `Text size="30px"` | `PresentationKpi` (number/ring/bar/spark) |
| Frame variants | 13 types | All framed widgets except `divider` |
| Admin gallery | Utilitarian grid | Search, family filters, frame preview, grades, copy type |
| Screenshots | None | `docs/widget-screenshots/v1` + `v2` (111 × light/dark) |

## New design primitives

- [`StatusMetricTile.tsx`](../frontend/src/components/widgets/design/StatusMetricTile.tsx)
- [`PresentationKpi.tsx`](../frontend/src/components/widgets/design/PresentationKpi.tsx)
- `MetricHero` subtitle support
- `ChartShell` `SummaryChip` chrome polish

## Builder Layout tab

- **Frame:** Default / Compact / Hero / Kiosk (`supportsFrameVariant`)
- **Presentation:** Number / Ring / Bar / Spark (`PRESENTATION_WIDGET_TYPES`)

## Smoke dashboard

API-created **Widget Redesign Smoke** bound to FrommConnect / Line 1 / Raw Materials with status, connection, run-state, OEE ring, MTTR, Pareto, Andon, clock.

Open: `/builder/{id}` after login (dashboard id from latest create) or recreate via commission scripts.

## Capture

```powershell
node scripts/capture-widget-screenshots.mjs all
$env:OUT_DIR='docs/widget-screenshots/v2'; node scripts/capture-widget-screenshots.mjs all
```

## Deferred

- True nested `container-panel` / `tabbed-panel`
- Playwright E2E for every builder drop
- Marketing PNG thumbnails in builder palette (gallery live render is source of truth)

## Template reimage (v7.2) — done

System dashboard templates updated for PresentationKpi flavors + denser kiosk headlines. See [TEMPLATE-AUDIT-2026-07-v7.2.md](TEMPLATE-AUDIT-2026-07-v7.2.md) and [TEMPLATE-INVENTORY-2026-07.md](TEMPLATE-INVENTORY-2026-07.md).

## Related

- [WIDGET-LIBRARY-INVENTORY-2026-07.md](WIDGET-LIBRARY-INVENTORY-2026-07.md)
- [COMMISSION-BUILDER-2026-07.md](COMMISSION-BUILDER-2026-07.md)
- [TEMPLATE-AUDIT-2026-07-v7.2.md](TEMPLATE-AUDIT-2026-07-v7.2.md)
- Gallery: http://localhost:5173/admin?tab=widgets
- Templates: http://localhost:5173/dev/templates
