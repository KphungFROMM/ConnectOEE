# Widget commission report (Jul 2026)

Full-library commission of all **111** registry widget types: function, flavors, presentability, and gallery tooling.

## Verdict

| Grade | Count |
|-------|------:|
| **Pass** | **111** |
| Fix | 0 |
| **Defer** | **0** |

Superseded for nesting/writes by [BEST-IN-CLASS-FINISH-2026-07.md](BEST-IN-CLASS-FINISH-2026-07.md) (container/tab + interactive write loop).


## Phase 0 — Gallery tooling

- [`WidgetAuditGallery.tsx`](../frontend/src/features/builder/WidgetAuditGallery.tsx): **Presentation**, **Color mode**, and **Status style** controls in addition to Frame + light/dark; options applied per `PRESENTATION_WIDGET_TYPES` / `STATUS_STYLE_WIDGET_TYPES`.
- Living grades: [`widgetCommissionGrades.ts`](../frontend/src/features/builder/widgetCommissionGrades.ts) → Pass/Fix/Defer badges.
- Scorecard: [`WIDGET-COMMISSION-SCORECARD-2026-07.md`](WIDGET-COMMISSION-SCORECARD-2026-07.md) (regenerate via `node scripts/generate-commission-scorecard.mjs`).
- Screenshots: [`docs/widget-screenshots/v3/`](widget-screenshots/v3/) — 111 × light + 111 × dark (`OUT_DIR=docs/widget-screenshots/v3 node scripts/capture-widget-screenshots.mjs all`; supports `AUDIT_TOKEN` when password login is unavailable).

## Batch fixes closed during commission

| Area | Fix |
|------|-----|
| Audit hierarchy | `getHierarchyTree()` returns `mockHierarchyTree()` in audit mode — unblocks plant/machine grids, line status, data-table / top-n |
| `factor-gauge` | Import `oeeColor` (crash when field not A/P/Q) |
| `kpi-stat-card` | Wire `PresentationKpi` + colorMode + wall label |
| `linear-gauge` | Wire `PresentationKpi` + `kpiAccentColor` |
| `plant-summary-hero` | Machine → line → plant scope |
| `oee-waterfall` | `resolveScopedSnapshot` for line/machine |
| Production tiles | `total-count-tile`, `units-per-shift`, `sparkline-tile` → PresentationKpi |
| Scope polish | `current-job-banner`, `shift-progress`, `shift-progress-bar` use scoped snapshot |
| Downtime | `active-downtime-timer` no longer treats Idle as stop; MTTR/MTBF snapshot fallback |

## Defer (intentional)

| Type | Reason |
|------|--------|
| `container-panel` | Nesting placeholder |
| `tabbed-panel` | Nesting placeholder |
| `operator-downtime-pad` | UI present; writes gated in preview |
| `fault-ack-button` | UI present; writes gated in preview |
| `plc-write-controls` | UI present; writes gated in preview |

## Library / gallery expansion backlog

Only gaps justified by this commission (not speculative adds):

1. **True nested container / tabbed panel** — replace placeholders so builders can nest widgets (highest value after Defer set).
2. **Line-status binding.source** — strip/indicator still plant-wide worst-line; honor scoped binding when set.
3. **Andon `pill` / `minimal`** — currently alias to beacon layout; distinct skins if wall designers need them.
4. **oee-by-shift** — still hour buckets; rename or implement true shift buckets.
5. **Template screenshot backfill** for v8 templates if wall packs ship new status/OEE compositions.
6. **Gallery Strong/OK nuance** — optional secondary badge beyond Pass/Fix/Defer once nesting ships.

No “add 20 widgets” backlog without a scorecard gap.

## Related docs

- [WIDGET-COMMISSION-SCORECARD-2026-07.md](WIDGET-COMMISSION-SCORECARD-2026-07.md)
- [WIDGET-VISUAL-LANGUAGE-2026-07.md](WIDGET-VISUAL-LANGUAGE-2026-07.md)
- [WIDGET-AUDIT-2026-07.md](WIDGET-AUDIT-2026-07.md) (prior July pass; superseded for grades by this commission)
- [WIDGET-LIBRARY-INVENTORY-2026-07.md](WIDGET-LIBRARY-INVENTORY-2026-07.md)
