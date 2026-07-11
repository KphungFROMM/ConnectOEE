# 12 - Historian, Query Engine & Reporting

## 1. Historical OEE storage

Tiers:

- Raw time-series (1-5 sec).
- Hourly aggregates.
- Shift aggregates.
- Daily aggregates.
- Weekly / monthly / yearly aggregates.

Stored measures:

- Availability %, Performance %, Quality %, OEE %.
- Good / Reject / Total counts, Scrap %.
- Downtime duration by reason.
- Fault occurrences.
- Speed trends.
- State transitions.
- Reliability metrics (MTTR, MTBF, MTTF, MTTD, mean lost time per downtime, failure rate) - see 06.

## 2. Historian engine

- Append-only time-series storage (TimescaleDB hypertables).
- Downsampling via continuous aggregates.
- Retention policies.
- Automatic rollups.

## 3. Query engine

- Time range queries; custom date ranges.
- Multi-line / department / plant aggregation.
- Drill-down: plant -> department -> line -> machine.
- Drill-through: line -> downtime -> reason -> event list.
- KPI snapshots.
- Trend queries.

### Historian REST API (`/api/historian`)

| Endpoint | Purpose |
|----------|---------|
| `GET snapshot` | KPI roll-up for any `level` + `id` and date range |
| `GET trend` | OEE/APQ time series with resolved granularity |
| `GET production` | Good/reject/target buckets |
| `GET drilldown` | Child entities with KPIs |
| `GET reliability-trend` | MTTR/MTBF/stops-per-hour buckets |
| `GET reasons` | Downtime reasons aggregated at **any** scope (`level`+`id`) or legacy `lineId` |
| `GET losses` | Six Big Losses buckets at any scope |
| `GET events` | Paginated downtime events for drill-through (`take`, optional `category`) |

### Analytics & History page

The `/analytics` screen uses the historian API for all scopes (including plant-wide downtime):

- Sticky filter bar: plant/dept/line/machine dropdowns, breadcrumb, presets + custom date range, granularity, compare-to-prior toggle.
- KPI hero: OEE gauge, A/P/Q factors, loss minutes, scrap/FPY, reliability summary.
- Tabs: **Overview** (OEE trend, production, waterfall, losses donut, drill-down), **Downtime** (Pareto, reasons, events drawer with PLC needs-review badges), **Production**, **Reliability**.
- Export CSV (snapshot + trend); deep-link to Reports and Plant Explorer with the same scope.

## 4. Downtime analysis

- Top reasons; top categories.
- Pareto charts.
- Downtime by shift / operator / machine.

## 5. Production analysis

- Production vs target.
- Reject trends.
- Scrap rate trends.
- Hourly production charts.

## 6. Reports

- Daily shift reports.
- On-demand reports.
- Weekly / monthly summaries.
- CSV / PDF export (PDF via QuestPDF + ScottPlot charts).

### Reports UI (`/reports`)

Best-in-class generate workspace aligned with Analytics polish:

- **Generate** — template gallery cards, sticky cascading scope (plant → department → line → machine) + range presets, PDF/CSV segmented control (PDF gated by license), auto-preview (~600ms debounce), premium preview chrome (zoom, open in new tab, CSV table).
- **History** — search / template / status filters; download prior runs.
- **Schedules** — human cadence labels; nested **Delivery settings** (SMTP) tab; email or file-drop delivery.
- **Custom templates** — print-first block designer (palette · A4 page-flow canvas · properties · live PDF preview). Same `ReportBlock[]` schema drives the designer and QuestPDF.
- Deep links: `?tab=`, `?scope=Plant|{id}`, optional `?templateId=` (from Analytics / Plant Explorer).

### Prebuilt report templates

Professionally designed QuestPDF layouts (stored as `ReportTemplate`):

- **Shift Report** - hero OEE + A/P/Q, scrap/FPY, production strip, shift comparison, trend, downtime, faults.
- **Daily OEE Report** - day roll-up across shifts with trends and shift comparison.
- **Downtime Pareto Report** - Pareto-first + reasons + reliability strip + faults.
- **Production vs Target Report** - dual-series chart, variance column, OEE trend.
- **Weekly / Monthly Summary** - cover with headline KPIs; trend, breakdown, losses, reliability.
- **Executive Summary** - cover KPIs; breakdown + trend + top losses for management skim.
- **Fault / Maintenance Report** - reliability hero, fault frequency, linked downtime.

### Custom report designer

Print-aware block designer for **Custom** templates (system `ReportType` layouts stay curated hard-coded QuestPDF until optionally migrated):

**Block schema** (`LayoutJson` = `ReportBlock[]`):

| Type | Renders |
|------|---------|
| `cover` | Branded cover page |
| `kpi-hero` | OEE ring + A/P/Q + secondary metrics |
| `apq-bars` / `secondary-metrics` / `reliability` | KPI strips |
| `oee-trend` / `pareto` / `production-chart` | Charts |
| `*-table` | Shift / trend / production / reason / fault / breakdown tables |
| `section-title` / `rich-text` / `page-break` | Layout |

**API**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/reports/templates/{id}` | Detail + `layoutJson` for Custom |
| `POST /api/reports/templates/custom` | Create (validates block types) |
| `PUT /api/reports/templates/{id}` | Update Custom only |
| `DELETE /api/reports/templates/{id}` | Delete Custom (not if scheduled) |
| `POST /api/reports/templates/{id}/fork` | Fork system → Custom with matching preset blocks |

**Authoring UX:** gallery palette with print-stub mini-previews; A4 vertical flow with full-width section cards (drag reorder / insert); typed properties (`showSparklines`, `includeSecondary`, `maxRows`, `showIfEmpty`, rich-text); undo/redo; autosave; debounced PDF preview; role presets (Operator / Supervisor / Executive) plus system-layout forks.

### Block catalog (visual stubs)

Canvas and palette render print-styled mocks (ring + A/P/Q, chart silhouettes, table headers) so composing feels like placing PDF sections — not badge chips. Live historian data appears only in the PDF preview pane after save.

### PDF branding

- ConnectOEE app icon + optional plant logo; accent `#1c7ed6`; status green/amber/red OEE coloring.
- Header scope breadcrumb + range; footer with generated-on timestamp and page X of Y.
- Branded ScottPlot charts (~900×280) for OEE trend, Pareto, production vs target.
- Light, print-friendly surfaces derived from the ConnectOEE color scheme (see 01).

## 7. Scheduled reports

- Daily / weekly / monthly schedules (per report template, with parameters).
- Delivery via **email (SMTP)** or **file drop** (network/local folder).
- SMTP configuration under Reports → Schedules → Delivery settings (host/port/credentials/from); recipients per schedule.
- Run history + last-status on the History and Schedules tabs.

## Manual QA (Reports + designer)

1. Generate — select Shift Report, confirm auto-preview PDF looks modern (KPI cards, charts).
2. Change scope via cascading dropdowns; preview refreshes.
3. Switch to CSV — table preview (not raw dump); Download saves to History.
4. Schedule… prefills Schedules; cadence shows “Weekly · Monday at 06:00”.
5. Delivery settings — save SMTP / send test.
6. Custom templates — start from Shift Report; add/reorder blocks; Save; preview shows matching sections within ~1s.
7. Fork a system template → edit → Generate PDF / schedule Custom end-to-end.
8. Analytics deep-link `/reports?scope=Line:{id}` lands with scope selected.
9. Trial — PDF disabled with message; CSV still works.

## 8. Retention & archiving

- Raw: 30-180 days.
- Hourly: 1-3 years.
- Daily: 5-10 years.
- Monthly: 10+ years.

Implemented with TimescaleDB compression + retention policies mapped to these tiers.
