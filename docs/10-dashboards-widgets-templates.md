# 10 - Dashboards: Widget Library & Ready-to-Go Templates

## Widget design system (v4)

Shared primitives live under `frontend/src/components/widgets/design/`:

- **widgetTheme** — chart palette, OEE threshold colors, density scale (`normal` 88px rows / `kiosk` 120px rows)
- **WidgetFrame** — variants `default`, `hero`, `compact`, `kiosk`; live pulse, footer slot
- **KpiValue** — tabular numbers, unit, delta badge, optional sparkline slot
- **ChartShell** — consistent padding, loading skeleton, partial-data banner (“accumulating history — showing shift-to-date”)
- **StatusPill** — Running/Down/Idle with glow + icon
- **AndonStackVisual** — 3-light tower for wall displays

Chart primitives: `ComboParetoChart`, `WaterfallChart`, `HeatmapGrid`, `LeaderboardBars`, upgraded `Sparkline` (area fill + last-point marker).

Kiosk dashboards set `WidgetCtx.density = 'kiosk'` (~2× typography, thicker gauges, reduced chrome).

## Dashboards Hub

The `/dashboards` page groups wizard-generated boards by plant, line, and role (Overview, Analysis, Kiosk). Search, pinned/recent rows, and enriched cards (`InferredCategory`, binding context) replace the flat 36-card grid. System layout refresh lives in the overflow menu, not the primary subtitle.

## Widget presentation variants

Per-widget `frameVariant` (`default` | `hero` | `compact` | `kiosk`) is set in the builder **Layout** tab and seeded on Line Overview, Operator Station, and Executive Summary templates. Five families support variants: OEE gauges, A/P/Q, downtime charts, machine/status grids, and production tiles.

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

*(See registry `widgetCatalog` for the full typed inventory — 98 widget types across KPI, reliability, charts, tables, layout, and interactive categories.)*

### Interactive (role-gated)
- Operator downtime-reason entry button/pad, fault acknowledge button.
- PLC write controls (start permissive / reset / acknowledge - Admin/Supervisor only, audited).
- Navigation/drill button, dashboard-link tile.

## Ready-to-go dashboard templates (prebuilt)

Ships with professionally designed, ready-to-use dashboards so a new install is useful immediately. Stored as `DashboardTemplate` records with placeholder bindings (e.g. `{{line.runState}}`, `{{machine.goodCount}}`) auto-remapped to the chosen line/machine on instantiation. All responsive, touch-friendly, dark/light aware, and editable in the WYSIWYG builder.

Built-in templates (**v7.1 — 18 system templates**; wall-fit reimagining for 1080p floor monitors — no scroll on published/kiosk display):

| Template | Category | Scope | Rows | Widgets | Purpose |
|----------|----------|-------|------|---------|---------|
| **Plant Command Center** | Plant | Plant | 9 | 9 | Plant hero, traffic light, line status strip, gap cluster, andon, grid, leaderboard |
| **Executive Briefing** | Executive | Plant | 9 | 7 | Executive hero, gap cluster, traffic light, TEEP, KPI roll-up, production vs target |
| **Floor At-a-Glance** | Plant | Plant | 9 | 4 | Plant hero, andon, line status strip, full-width machine grid |
| **Plant Reliability Hub** | Analysis | Plant | 7 | 10 | MTTR/MTBF KPIs, active timer, unassigned stops, reliability trend, pareto |
| **TEEP & Utilization** | Executive | Plant | 6 | 5 | TEEP tile, time balance, OEE by shift, loss trend, hourly production |
| **Line Performance Board** | Line | Line | 7 | 6 | OEE hero, gap cluster, attainment, A/P/Q, state timeline, trend |
| **Shift Huddle Board** | Shift | Line | 6 | 5 | Shift summary, pace gauge, shift progress, hourly production, pareto |
| **Machine Station Detail** | Machine | Machine | 7 | 6 | Run state, recipe strip, speed trend, reliability, fault banner, events |
| **Production & Pace** | Analysis | Line | 8 | 4 | Production vs target, hourly bars, takt vs actual, rate variance |
| **Quality & Yield Lab** | Analysis | Line | 8 | 9 | Scrap/yield/FPY KPIs, scrap trend, Six Big Losses, pareto |
| **Downtime Detective** | Analysis | Line | 8 | 5 | Active timer, unassigned stops, pareto, heatmap, event feed |
| **Setup & Changeover** | Analysis | Line | 6 | 3 | State distribution, state timeline, setup pareto |
| **Supervisor Cockpit** | Line | Line | 6 | 5 | KPI group, unassigned banner, downtime pad, top-N, worst lines |
| **Operator Kiosk** | Kiosk | Machine | 7 | 6 | OEE hero, pace gauge, traffic light, shift context, timer, downtime pad |
| **Line Andon Wall** | Kiosk | Line | 7 | 7 | Marquee, andon stack, OEE hero, traffic light, shift context, timer, fault |
| **Maintenance Wallboard** | Kiosk | Plant | 8 | 7 | Marquee, MTTR/MTBF, reliability trend, top faults, event feed |
| **Attainment Tracker** | Production | Line | 6 | 5 | Attainment, pace gauge, gap cluster, production vs target, hourly bar |
| **Shift Compare** | Shift | Line | 9 | 6 | Shift summary, gap cluster, OEE hero, OEE by shift, hourly, trend |

**Wall-fit row budgets (1080p):** kiosk templates ≤ **8 rows**; plant/line/analysis templates ≤ **9 rows**. Layouts are designed to fill a 1920×1080 viewport without vertical scroll when shown via kiosk or presentation mode.

**Per line** (wizard step 10): Overview → **Line Performance Board**, Shift → **Shift Huddle Board**, Detail → **Machine Station Detail**, Downtime → **Downtime Detective**, Production → **Production & Pace**, Quality → **Quality & Yield Lab**, Supervisor → **Supervisor Cockpit**, Setup → **Setup & Changeover**, Operator Kiosk, Andon → **Line Andon Wall**.

**Per plant**: **Plant Command Center**, **Executive Briefing**, **Plant Reliability Hub**, **TEEP & Utilization**, **Maintenance Wallboard** (kiosk). **Floor At-a-Glance** is also created when the plant has **two or more lines**, or **any line with two or more machines**.

After deploying v7.1, run **Refresh layouts** on the Dashboards page once (or `POST /api/dashboards/refresh-system-layouts`) so wizard-named dashboards pick up compact layouts. v6 system template **names** are retired on startup upsert.

Frontend metadata (preview path, roles, scope, recommended flag): `frontend/src/features/builder/systemTemplateMeta.ts`. Gallery thumbnails: `frontend/public/template-previews/{slug}.svg` (replace with PNG crops from `/dev/templates` for production polish).

### Floor display routes

Published and kiosk dashboards render **full-viewport without scroll** via shared `DashboardRenderer` `wallFit` mode:

| Route | Use |
|-------|-----|
| `/kiosk/:id` | Public kiosk scope; signed kiosk session; operator stations |
| `/present/:id` | Published plant/line boards on TVs; minimal chrome, auto-hide header; tap/keyboard for fullscreen |

Signed-in dashboard preview (`/dashboards/:id`) may scroll for admin review; floor monitors should use **Open presentation** or **Open kiosk** from the dashboard header.

- **Line Performance Board** — OEE hero, attainment tile, gap cluster, A/P/Q, state timeline, multi-trend.
- **Machine Station Detail** — run-state badge, recipe-product strip, speed trend, reliability cluster, fault banner.
- **Plant Command Center** — plant hero, line-status-strip, gap cluster, andon, plant grid, leaderboard.
- **Floor At-a-Glance** — plant hero, andon, line-status-strip, full-width machine-grid.
- **Shift Huddle Board** — shift summary, pace gauge, shift progress, hourly production, pareto.
- **Operator Kiosk** — OEE hero, pace gauge, oee-traffic-light, shift context, active-downtime-timer, downtime pad (kiosk density).

### Operator Station page (`/operator`)

Signed-in operators, supervisors, managers, and admins use a dedicated **multi-station** workspace (not limited to the first machine on a line):

- **Stations grid** — all machines in the user’s plant/line scope, grouped by line, with live OEE/state and unassigned-reason badges.
- **Station detail (machine level)** — modernized cockpit when `?machine={id}` is set:
  - Sticky **scope bar** with back link, breadcrumbs, shift progress, and **machine segmented tabs** (state-colored dots) on multi-machine lines.
  - **URL ↔ filter sync** — drilling into a machine sets the scope Machine filter and scopes the reason queue to that station.
  - **Downtime action banner** — when Down with an unassigned stop, large touch-friendly reason pad (sticky above hero).
  - **Product strip** — active SKU, ideal, changeover mode hint, change product (inline select on desktop, modal on touch). Primary path for deliberate SKU changes.
  - **Changeover reason vs product** — assigning Changeover in the reason queue labels the stop only; optional product picker appears for live/recent stops (Skip or Apply). Backfilled historical reasons do not change active product.
  - **Operator machine hero** — shared `ModernKpiHero` layout: OEE ring, A/P/Q factor gauges, production mix, time balance, status beacon.
  - **Shift target strip** — count-to-go, target pace, actual vs ideal rate (uses `actualRatePph`, not raw PLC speed).
  - **Reason queue (machine mode)** — compact table (max 8 rows + expand), hides Machine column, relative timestamps on mobile.
- **Reason queue (line mode)** — on grid view / All stations: full paginated plant/line backlog.
- **Catalog-driven reasons** — downtime reason catalog per line; PLC codes flagged **needs review** when auto-stubbed.
- Scope filters: plant / line / machine; URL `?machine={id}` for bookmarking a station.
- **Andon / Big Screen (kiosk)** — marquee ticker, andon stack, run-state badge, mega KPIs, fault strip.
- **Downtime Analysis** — pareto, histogram, fault summary, operator leaderboard, heatmap, events.
- **Production Analysis** — hourly bars, takt vs actual, quality row, loss analytics, OEE waterfall.
- **Maintenance / Fault Focus** — MTTR/MTBF tiles, reliability trend, fault summary, pareto, events.
- **Executive Summary** — plant hero, KPI tile group, TEEP, leaderboard, production vs target, heatmap.

### Live snapshot bindable fields (`SNAPSHOT_FIELDS`)

KPI tiles and stat cards can bind to: OEE/A/P/Q/TEEP %, good/reject/**rework** counts, speed, full reliability cluster (MTTR/MTBF/MTTF/MTTD, mean lost time, failure rate, stops/hr, availability from reliability, failure count), **microStopCount**, **uptimeMin** / **downtimeMin** / **uptimePct**, planned/unplanned downtime minutes, **availability/performance/quality loss minutes**, scrap/yield/fpy %, **actualCycleTimeSec** / ideal cycle, **actualRatePph** / **idealRatePph** / **rateVariancePct**, **parts loss fields** (`maxPossibleParts`, `expectedPartsPace`, `partsLostAvailability`, `partsLostPerformance`, `partsLostBreakdown`, …), run state. Widgets **Expected vs Actual Count** and **Parts Loss Waterfall** visualize pace and A/P/Q parts loss. Plant-scoped widgets sum minute/count fields across machines; percentage and rate fields are averaged.


### Template lifecycle
- Admins/Supervisors can save any dashboard as a reusable template; system templates are read-only but cloneable.
- "Apply template" flow: pick template -> pick target line/machine/plant -> auto-bind placeholders -> save as draft -> publish.

## Plant Explorer (hierarchy navigation)

A dedicated navigation page for non-operator roles (Admin, Manager, Supervisor) to browse the entire enterprise. Operators are excluded (they stay limited to their assigned line).

- **Persistent hierarchy tree**: Plant → Department → Line → Machine, expand/collapse, with live status dot, OEE % badge, thin OEE progress bar, and **active product code** on line nodes.
- **Dashboard-style detail panel** (every hierarchy level):
  - Sticky context header with connection state and **Open in Analytics** link.
  - **OEE hero**: ring gauge, A/P/Q factor bars, loss chips, production totals (historian snapshot with live fallback).
  - **OEE trend chart** (current shift or last 8h toggle) via historian.
  - **Child comparison**: horizontal OEE leaderboard + clickable drill-down table (Plant → departments/lines, Department → lines, Line → machines).
  - **Machine grid** cards with ring gauges (all machines on a line; worst performers at dept/plant scope).
  - **Production chart**, **loss donut**, and **loss pareto** for the selected scope and time window.
  - **Shift context bar**, reliability strip, and reliability trend (line/machine).
  - **Line product strip** (line + machine scope): active product, change selector, changeover mode hint, recent product changes, and changeover-in-progress alert (SetupTracked only).
  - **Operations accordion** (line): editable line product speeds only.
  - Machine scope: rate vs ideal bar, run state, PLC speed, micro-stops.
- **Downtime table**: recent events with category color chips and unassigned-reason count.
- **Drill-through**: quick links to Dashboards, Analytics, Reports, Tag Browser.
- **Search/filter** the tree by name.
- **Scope-aware**: a user only sees plants/lines within their `UserPlantScope`.
- **Real-time**: node badges and KPI panels update live via SignalR; historian data refreshes every 60s.
- **Sample products** (seeded): WGT-A100, WGT-B200, PKG-STD, PKG-PREM, SPC-500 with per-line ideal cycle rates.

## Dashboard permissions

- Private, role-restricted, or public/kiosk.
- Supervisors can delete only dashboards they created.
