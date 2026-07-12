# 10 - Dashboards: Widget Library & Ready-to-Go Templates

## Widget design system (v4)

Shared primitives live under `frontend/src/components/widgets/design/`:

- **widgetTheme** — chart palette, OEE threshold colors, density scale (`normal` 88px rows / `kiosk` 120px rows)
- **WidgetFrame** — variants `default`, `hero`, `compact`, `kiosk`; live pulse, footer slot
- **KpiValue** — tabular numbers, unit, delta badge, optional sparkline slot
- **ChartShell** — consistent padding, loading skeleton, partial-data banner (“accumulating history — showing shift-to-date”)
- **StatusVisual** / **statusStyle** — `beacon` | `pill` | `minimal` | `tower` | `strip` for run-state, Andon, and OEE traffic widgets
- **AndonStackVisual** — tower / strip / beacon layouts (no overlapping bottom hero text)
- **PresentationKpi** — `number` | `ring` | `bar` | `spark` | `ringSpark` | `barSpark` | `tile` | `delta` | `gauge`

Chart primitives: `ComboParetoChart`, `WaterfallChart`, `HeatmapGrid`, `LeaderboardBars`, upgraded `Sparkline` (area fill + last-point marker).

Kiosk dashboards set `WidgetCtx.density = 'kiosk'` (~2× typography, thicker gauges, reduced chrome).

## Dashboards Hub

The `/dashboards` page is a **scope-first browser**: left nav (All / Kiosks / plants with nested lines), main searchable card grid for the selected scope, and filter chips (Pinned, Kiosk, Analysis). Opening or pinning a board never removes it from its plant/line home — recent is a non-removing shortcut strip (max 8) plus card badges; pin is a badge + chip filter. Selected scope persists in `localStorage` (`connectoee.dashboards.selectedScope`). System layout refresh lives in the overflow menu.

## Widget presentation variants

Per-widget `frameVariant` (`default` | `hero` | `compact` | `kiosk`) is set in the builder **Layout** tab and seeded on system templates. KPI tiles also expose `presentation` skins (including **tile**, **delta**, **gauge**). Status widgets expose `statusStyle` (`beacon` / `pill` / `minimal` / `tower` / `strip`) in palette Flavors, Layout, and canvas chips.

## Plant-scoped binding

Dashboards may bind at **plant**, **line**, or **machine** level via `Dashboard.PlantId`, `LineId`, and `MachineId`.

- Plant templates (**Plant Command Center**, **Executive Briefing**, **Floor At-a-Glance**, **Plant Reliability Hub**, **TEEP & Utilization**) require `plantId`.
- Metrics APIs accept `lineId` **or** `plantId`: `/api/events/downtime`, `/losses`, `/reliability`.
- `resolveBindingScope` maps widget binding source → historian level and live snapshot aggregation.
- `resolveScopedSnapshot` / `resolveScopedField` (`resolveScopedSnapshot.ts`) apply the same roll-up rules at widget render time: plant/line scopes aggregate `lineSnapshots`; machine scope uses the selected machine snapshot.

## Comprehensive widget library (~98 types)

Every widget is data-bindable, responsive, touch-friendly, dark/light aware, and exposes no-data / stale / disconnected states. Widgets register via a typed **widget registry** (`registry.tsx` + builder catalog). Catalog ↔ registry integrity is validated at build time (`widgetCatalog.test.ts`).

### Tier A — v4 premium widgets

| Type | Purpose |
|------|---------|
| `plant-summary-hero` | Plant KPI strip (OEE, A/P/Q, good/reject, TEEP) |
| `plant-grid` | Line-level card grid (hierarchy KPIs) |
| `machine-grid` | All machines grouped by line — compact OEE/state cards (live snapshots) |
| `line-leaderboard` | Horizontal OEE ranking bars |
| `worst-lines` | Bottom-N alert cards below target |
| `oee-hero` | Large gradient OEE ring + A/P/Q mini-rings |
| `apq-cluster` | Three ring gauges in one widget |
| `kpi-stat-card` | KPI + delta + sparkline |
| `andon-stack` | Stack-light tower (kiosk) |
| `oee-waterfall` | OEE loss bridge (`options.mode`: `percent` \| `minutes`) |
| `downtime-heatmap` | Hour × weekday downtime grid |
| `multi-trend` | Multi-series OEE/A/P/Q/TEEP/loss overlay |
| `event-feed` | Rich downtime/fault list with severity |
| `shift-progress-bar` | Shift elapsed + production pace |
| `reliability-cluster` | 2×3 grid: MTTR, MTBF, MTTF, MTTD, stops/hr, mean lost time |
| `loss-minutes-bridge` | Horizontal stacked bar: A/P/Q loss minutes |
| `cycle-time-compare` | Ideal vs actual cycle + delta |
| `rate-variance` | Ideal vs actual rate (pph) + variance % |
| `time-balance` | Donut: uptime / planned / unplanned downtime |
| `reliability-trend` | Dual-line MTTR + MTBF over time (historian) |
| `loss-trend` | Stacked area: A/P/Q loss minutes over time |
| `operator-downtime-leaderboard` | Top operators by stop count / minutes |

### KPI & OEE (existing + polished)
- OEE overall gauge, A/P/Q individual gauges, combined A/P/Q gauge cluster.
- KPI tile (single value + delta + sparkline), KPI tile group/grid.
- Availability %, Performance %, Quality %, OEE %, TEEP %, Scrap %, Yield %, FPY tiles.
- Good / Reject / Total count tiles, count-to-target / count-to-go, target pace tile.

### Reliability & downtime
- MTTR / MTBF / MTTF / MTTD tiles, mean-lost-time-per-downtime, failure-rate, stops/hour.
- Downtime reason list, downtime Pareto chart, Six Big Losses breakdown (bar/stacked/donut).
- Downtime by shift/operator/machine, top fault codes table, fault-code summary, active-fault banner.
- Planned vs unplanned downtime split, micro-stop counter.

### State & status
- Line status indicator, machine status light / Andon stack-light widget.
- Machine state timeline (Gantt-style), state distribution donut, current run-state badge.
- Connection/health indicator (connected/stale/disconnected), last-update clock.

### Charts & trends
- Time-series trend (OEE, counts, speed, downtime), multi-series/overlay trend.
- Target vs actual chart, production-vs-target trend, hourly production bar chart.
- Reject/scrap trend, speed trend, Pareto, histogram, heatmap (e.g. downtime by hour/day), stacked area, sparkline.
- Waterfall (OEE loss breakdown), gauge bar / linear gauge, radial progress.

### Production & shift
- Shift summary tile, production run list, current-job/product banner, throughput rate.
- Cycle-time widget, takt vs actual, units-per-shift, OEE-by-shift comparison.

### Tables & lists
- `data-table` — sortable lines/downtime/snapshots table
- `top-n-table` — top N lines/machines by snapshot field
- `drill-through-list` — downtime rows with duration
- `kpi-tile-group` — mini KPI grid from `options.fields[]`

### Layout, media & utility (new)
- `text-label`, `rich-notes`, `image-logo`, `divider`, `container-panel`, `tabbed-panel`
- `iframe-embed`, `clock-date`, `marquee-ticker`, `qr-link-tile`, `dashboard-link`, `navigation-drill`
- `live-tag-value`, `udt-member-value` (PLC tag binding)

### Extra KPI & chart widgets (new)
- `mttr-tile`, `mtbf-tile`, `teep-tile`, `total-count-tile`, `count-to-go`, `target-pace-tile`
- `speed-trend`, `sparkline-tile`, `linear-gauge`, `oee-by-shift`, `takt-vs-actual`, `units-per-shift`
- `line-status-indicator`, `run-state-badge`, `fault-code-summary`, `histogram`

*(See registry `widgetCatalog` for the full typed inventory — **111** widget types across KPI, reliability, charts, tables, layout, and interactive categories. Presentation flavors and frame variants: see [WIDGET-REDESIGN-2026-07.md](WIDGET-REDESIGN-2026-07.md).)*

### Interactive (role-gated)
- Operator downtime-reason entry button/pad, fault acknowledge button.
- PLC write controls (start permissive / reset / acknowledge - Admin/Supervisor only, audited).
- Navigation/drill button, dashboard-link tile.

## Ready-to-go dashboard templates (prebuilt)

Ships with professionally designed, ready-to-use dashboards so a new install is useful immediately. Stored as `DashboardTemplate` records with placeholder bindings (e.g. `{{line.runState}}`, `{{machine.goodCount}}`) auto-remapped to the chosen line/machine on instantiation. All responsive, touch-friendly, dark/light aware, and editable in the WYSIWYG builder.

Built-in templates (**v8 — 8 curated system templates**; blank-grid compositions with wall visual language — no scroll on published/kiosk display). Visual rules: [WIDGET-VISUAL-LANGUAGE-2026-07.md](WIDGET-VISUAL-LANGUAGE-2026-07.md). Premade v7.2 layouts are retired on upsert.

| Template | Category | Scope | Rows | Widgets | Purpose |
|----------|----------|-------|------|---------|---------|
| **Operator Floor** | Kiosk | Machine | 8 | 12 | Identity strip, OEE hero, run state, pace, counts, downtime pad |
| **Line Andon** | Kiosk | Line | 8 | 9 | Andon hero + supporting OEE; alert strips when bad |
| **Maintenance Wall** | Kiosk | Plant | 8 | 10 | MTTR/MTBF/stops, unassigned stops, reliability trend |
| **Plant Overview** | Plant | Plant | 9 | 6 | Plant hero, line status, gap cluster, grid, leaderboard |
| **Shift Supervisor** | Shift | Line | 8 | 9 | Shift progress, losses, reason queue, vs target |
| **Quality Pulse** | Analysis | Line | 8 | 7 | Scrap / FPY / yield + scrap trend + quality pareto |
| **Production Board** | Production | Line | 8 | 8 | Pace, counts, product, hourly production |
| **Analytics Starter** | Analysis | Plant | 8 | 5 | Chart-heavy signed-in analysis starter |

**Wall-fit row budgets (1080p):** kiosk templates ≤ **8 rows**; plant/line/analysis templates ≤ **9 rows**. Layouts are designed to fill a 1920×1080 viewport without vertical scroll when shown via kiosk or presentation mode.

**Per line** (wizard step 10): Supervisor → **Shift Supervisor**, Production → **Production Board**, Quality → **Quality Pulse**, Operator Floor (kiosk), Andon → **Line Andon**.

**Per plant**: **Plant Overview**, **Analytics Starter**, **Maintenance Wall** (kiosk).

After deploying v8, run **Refresh layouts** on the Dashboards page once (or `POST /api/dashboards/refresh-system-layouts`) so wizard-named dashboards pick up the new layouts. Orphaned v7.2 system template **names** are removed on startup upsert.

Frontend metadata (preview path, roles, scope, recommended flag): `frontend/src/features/builder/systemTemplateMeta.ts`. Gallery thumbnails: `frontend/public/template-previews/{slug}.png` (crops from `/dev/templates`; see [TEMPLATE-AUDIT-2026-07-v8.md](TEMPLATE-AUDIT-2026-07-v8.md)).

### Floor display routes

Published and kiosk dashboards render **full-viewport without scroll** via shared `DashboardRenderer` `wallFit` mode:

| Route | Use |
|-------|-----|
| `/kiosk/:id` | Public kiosk scope; signed kiosk session; operator stations |
| `/present/:id` | Published plant/line boards on TVs; minimal chrome, auto-hide header; tap/keyboard for fullscreen |

Signed-in dashboard preview (`/dashboards/:id`) may scroll for admin review; floor monitors should use **Open presentation** or **Open kiosk** from the dashboard header.

- **Operator Floor** — identity strip, OEE hero, run-state badge, pace, count-to-go, downtime pad.
- **Line Andon** — andon stack hero, OEE ring, downtime/fault strips, line status.
- **Maintenance Wall** — MTTR/MTBF bars, unassigned banner, reliability trend, pareto.
- **Plant Overview** — plant hero, line-status-strip, gap cluster, plant grid, leaderboard.
- **Shift Supervisor** — shift summary/progress, production vs target, reason queue, downtime pad.
- **Quality Pulse** — scrap/yield/FPY rings, scrap trend, Six Big Losses, pareto.
- **Production Board** — product strip, pace, attainment, gap, hourly bars.
- **Analytics Starter** — KPI group, multi-trend, losses donut, reliability, pareto.

### Operator Station page (`/operator`)

Signed-in operators, supervisors, managers, and admins use a dedicated **multi-station** workspace (not limited to the first machine on a line):

- **Stations grid** — all machines in the user’s plant/line scope, grouped by line, with live OEE/state and unassigned-reason badges.
- **Station detail (machine level)** — modernized cockpit when `?machine={id}` is set:
  - Sticky **scope bar** with back link, breadcrumbs, shift progress, and **machine segmented tabs** (state-colored dots) on multi-machine lines.
  - **URL ↔ filter sync** — drilling into a machine sets the scope Machine filter and scopes the reason queue to that station.
  - **Downtime action banner** — when Down with an unassigned stop, large touch-friendly reason pad (sticky above hero).
  - **Product strip** — active SKU, ideal, changeover mode hint, change product (inline select on desktop, modal on touch). Primary path for deliberate SKU changes. When the active SKU was auto-created from an unknown PLC PartId, an orange badge links managers to **Admin → Recipes → Auto-created review** (`/admin?tab=recipes&recipesTab=review`) to set catalog + line speeds.
  - **Changeover reason vs product** — assigning Changeover in the reason queue labels the stop only; optional product picker appears for live/recent stops (Skip or Apply). Backfilled historical reasons do not change active product.
  - **Operator machine hero** — shared `ModernKpiHero` layout: OEE ring, A/P/Q factor gauges, production mix, time balance, status beacon.
  - **Shift target strip** — count-to-go, target pace, actual vs ideal rate (uses `actualRatePph`, not raw PLC speed).
  - **Reason queue (machine mode)** — compact table (max 8 rows + expand), hides Machine column, relative timestamps on mobile.
- **Reason queue (line mode)** — on grid view / All stations: full paginated plant/line backlog.
- **Catalog-driven reasons** — Operator Station quick-reason buttons come from **Admin → Reason catalog** (`/admin?tab=faults`). Admins add/edit/delete descriptions (grouped by loss category); leave PLC code blank for operator-only buttons (auto synthetic codes ≥ 9000). Real PLC stop codes can be mapped the same way; unknown codes are auto-stubbed for **needs review**.
- Scope filters: plant / line / machine; URL `?machine={id}` for bookmarking a station.

### Live snapshot bindable fields (`SNAPSHOT_FIELDS`)

KPI tiles and stat cards can bind to: OEE/A/P/Q/TEEP %, good/reject/**rework** counts, speed, full reliability cluster (MTTR/MTBF/MTTF/MTTD, mean lost time, failure rate, stops/hr, availability from reliability, failure count), **microStopCount**, **uptimeMin** / **downtimeMin** / **uptimePct**, planned/unplanned downtime minutes, **availability/performance/quality loss minutes**, scrap/yield/fpy %, **actualCycleTimeSec** / ideal cycle, **actualRatePph** / **idealRatePph** / **rateVariancePct**, **parts loss fields** (`maxPossibleParts`, `expectedPartsPace`, `partsLostAvailability`, `partsLostPerformance`, `partsLostBreakdown`, …), run state. Widgets **Expected vs Actual Count** and **Parts Loss Waterfall** visualize pace and A/P/Q parts loss. Plant-scoped widgets sum minute/count fields across machines; percentage and rate fields are averaged.


### Template lifecycle
- Admins/Supervisors can save any dashboard as a reusable template; system templates are read-only but cloneable.
- "Apply template" flow: pick template -> pick target line/machine/plant -> auto-bind placeholders -> save as draft -> publish.

## Plant Explorer (hierarchy navigation)

A dedicated navigation page for non-operator roles (Admin, Manager, Supervisor) to browse the entire enterprise. Operators are excluded (they stay limited to their assigned line). Redesigned 2026-07 from a static two-pane tree into a breadcrumb-driven, card-based drill-down navigator — see [`PLANT-EXPLORER-REDESIGN-2026-07.md`](PLANT-EXPLORER-REDESIGN-2026-07.md) for the full before/after writeup and screenshots.

- **`ExplorerNavigator`** (sticky top bar): global fuzzy search/jump across the flattened hierarchy (no need to expand branches), breadcrumb trail as pills — each pill carries a status dot + OEE% badge so health stays visible while navigating up/down — quick status filter chips (Running/Idle/Down/Disconnected), and a rail toggle. Collapses to a back button + current node name on mobile.
- **`ExplorerRail`** (collapsible quick-jump list): compact searchable list of the whole hierarchy plus recently visited nodes, for users who want the old "see everything" feel without it dominating the layout. Off-canvas drawer on mobile/tablet.
- **`ExplorerNodeHero`**: compact "you are here" summary for the current node — OEE ring, run-state `StatusPill`, A/P/Q mini badges, and active product code.
- **`ExplorerDrillGrid`**: responsive card grid of the current node's children — `HierarchyNodeCard` (status beacon, OEE ring, child count / active product, hover-lift) for Plant/Department/Line, `MachineGridCard` for Machine-level children. Empty and no-filter-match states included.
- **`ExplorerDetailPanel`** (deep-dive, shown for the selected node): restyled with the widget design system (`WidgetSurface`/`WidgetFrame`/`PresentationKpi`/`ChartShell`):
  - Sticky context header with connection state, `StatusPill`, and **Open in Analytics** link.
  - **OEE hero**: ring gauge, A/P/Q factor bars, loss chips, production totals (historian snapshot with live fallback).
  - **Compare** section: OEE loss waterfall + horizontal OEE leaderboard with clickable drill-down table (Plant → departments/lines, Department → lines, Line → machines).
  - **Production chart**, **loss donut**, and **loss pareto** for the selected scope and time window.
  - **Shift context bar**, reliability strip (`PresentationKpi` ring/bar tiles), and reliability trend (line/machine).
  - **Line product strip** (line + machine scope): active product, change selector, changeover mode hint, recent product changes, and changeover-in-progress alert (SetupTracked only).
  - **Operations accordion** (line): editable line product speeds only.
  - Machine scope: rate vs ideal bar, run state, PLC speed, micro-stops.
  - **Downtime table**: recent events with category color chips and unassigned-reason count.
- **Drill-through**: quick links to Dashboards, Analytics, Reports, Admin → Tag Mapping.
- **URL-synced**: current selection is reflected in `?scope=Level:id`, deep-linkable and back-button aware.
- **Scope-aware**: a user only sees plants/lines within their `UserPlantScope`.
- **Real-time**: node badges and KPI panels update live via SignalR; historian data refreshes every 60s.
- **Responsive & motion**: single-column cards + drawer rail + collapsed breadcrumb on mobile; hover-lift on interactive cards and a drill fade/slide transition on navigation (respects `prefers-reduced-motion`); loading skeletons and a retryable error state for hierarchy fetch failures.
- **Unified OEE color/status system** (`widgets/common.tsx`: `oeeExplorerHexColor`/`oeeExplorerBadgeColor`, `statusSurfaceTone`, `explorerRunStateColor`) drives Explorer breadcrumbs/cards, Analytics' `ModernKpiHero`, and Operator Station's `StationGrid`/`OperatorMachineHero` — the same tiered color language everywhere.
- **Sample products** (seeded): WGT-A100, WGT-B200, PKG-STD, PKG-PREM, SPC-500 with per-line ideal cycle rates.

## Dashboard permissions

- Private, role-restricted, or public/kiosk.
- Supervisors can delete only dashboards they created.
