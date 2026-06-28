# 10 - Dashboards: Widget Library & Ready-to-Go Templates

## Comprehensive widget library

Every widget is data-bindable (PLC tags, UDT members, logical signals, KPIs, aggregates, shift/historian data), responsive, touch-friendly, dark/light aware, configurable (title, thresholds, colors, units, refresh), and works in both the WYSIWYG builder and live/kiosk rendering. Each exposes threshold/alarm coloring and a "no data / stale / disconnected" state. Widgets register via a typed **widget registry** so new types can be added without touching the builder core.

### KPI & OEE
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
- Generic data/KPI table (sortable), event log list (downtime/fault/state), drill-through list, top-N table, leaderboard (best/worst lines).

### Layout, media & utility
- Text/label block, rich-text/notes, image/logo, divider, container/group panel, tabbed panel.
- Web/iframe embed, clock/date, shift-progress bar, marquee/ticker (alerts), QR/link tile.
- Live PLC-tag value widget (raw bound tag with quality+timestamp), UDT-member value widget.

### Interactive (role-gated)
- Operator downtime-reason entry button/pad, fault acknowledge button.
- PLC write controls (start permissive / reset / acknowledge - Admin/Supervisor only, audited).
- Navigation/drill button, dashboard-link tile.

## Ready-to-go dashboard templates (prebuilt)

Ships with professionally designed, ready-to-use dashboards so a new install is useful immediately. Stored as `DashboardTemplate` records with placeholder bindings (e.g. `{{line.runState}}`, `{{machine.goodCount}}`) auto-remapped to the chosen line/machine on instantiation. All responsive, touch-friendly, dark/light aware, and editable in the WYSIWYG builder.

Built-in templates:

- **Line Overview** - OEE overall gauge + A/P/Q gauges, good/reject/scrap tiles, target-vs-actual chart, line status, active downtime reason.
- **Machine Detail** - single-machine state timeline, speed trend, fault summary, counts, current fault code -> reason.
- **Plant Overview** - tile grid of all lines with OEE %, status color, live counts; plant OEE roll-up; worst-performer highlights.
- **Shift Summary** - shift OEE, production vs target, downtime Pareto, top fault codes, good/reject totals for active/most recent shift.
- **Operator Station (kiosk)** - large high-contrast OEE + counts + run state, one-tap downtime reason entry, no login.
- **Andon / Big Screen (kiosk)** - minimal full-screen line status board for wall-mounted displays.
- **Downtime Analysis** - Pareto, downtime by reason/category, by shift/machine, event drill-through list.
- **Production Analysis** - hourly production bars, reject/scrap trends, production-vs-target trend.
- **Maintenance / Fault Focus** - fault frequency, MTBF/MTTR summaries, top fault codes with mapped reasons.
- **Executive / Manager Summary** - multi-line/plant KPI roll-up with trend sparklines.

### Template lifecycle
- Admins/Supervisors can save any dashboard as a reusable template; system templates are read-only but cloneable.
- "Apply template" flow: pick template -> pick target line/machine/plant -> auto-bind placeholders -> save as draft -> publish.

## Plant Explorer (hierarchy navigation)

A dedicated navigation page for non-operator roles (Admin, Manager, Supervisor) to browse the entire enterprise. Operators are excluded (they stay limited to their assigned line).

- **Persistent hierarchy tree**: Plant -> Department -> Line -> Machine, expand/collapse, with live status color + OEE % badge on each node.
- **Per-node contextual view**: selecting any node shows a KPI/detail panel appropriate to its level - plant/department roll-up, line OEE + A/P/Q, or machine detail (state, speed, faults, counts).
- **Drill-down** by clicking into child nodes and **drill-through** into downtime -> reason -> event list.
- **Search/filter** the tree by name; quick-jump to any line/machine.
- **Scope-aware**: a user only sees the plants/lines within their `UserPlantScope` (Supervisors scoped; Admin/Manager typically full).
- **Real-time**: node badges and KPI panels update live via SignalR.
- Acts as the primary navigation shell into dashboards, reports, and machine detail; complements (does not replace) the Plant Overview dashboard template.

## Dashboard permissions

- Private, role-restricted, or public/kiosk.
- Supervisors can delete only dashboards they created.
