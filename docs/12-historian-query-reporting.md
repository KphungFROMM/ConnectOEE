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
- CSV / PDF export (PDF via QuestPDF).

### Prebuilt report templates

Professionally designed, ready-to-use report layouts (stored as `ReportTemplate`, analogous to dashboard templates with placeholder bindings remapped to the chosen plant/line/machine + date range):

- **Shift Report** - OEE + A/P/Q, good/reject/scrap, downtime by reason, top faults, notes for a single shift.
- **Daily OEE Report** - day roll-up across shifts with trends and shift comparison.
- **Downtime Pareto Report** - Pareto + top reasons/categories + reliability metrics (MTTR/MTBF...).
- **Production vs Target Report** - hourly/daily production vs target, reject/scrap trends.
- **Weekly / Monthly Summary** - period KPI roll-up with trends.
- **Executive Summary** - multi-line/plant KPI overview for management.
- **Fault / Maintenance Report** - fault frequency, MTBF/MTTR, top fault codes with mapped reasons.

### Report designer (optional, builder-style)

A WYSIWYG report designer (mirrors the dashboard builder) so users compose custom report layouts:

- Drag report sections/blocks (KPI tables, charts, Pareto, trend, downtime list, text, page break).
- Bind blocks to KPIs/aggregates/queries with parameters (date range, plant/line/machine, shift).
- Header/footer, cover page, page numbering, save as reusable `ReportTemplate`, draft/published.

### PDF branding

- ConnectOEE app icon/logo in header; configurable plant logo, title block, header/footer, generated-on timestamp, and page numbers.
- Light, print-friendly styling derived from the ConnectOEE color scheme (see 01).

## 7. Scheduled reports

- Daily / weekly / monthly schedules (per report template, with parameters).
- Delivery via **email (SMTP)** or **file drop** (network/local folder).
- SMTP configuration in Admin settings (host/port/credentials/from); recipients per schedule.
- Run history + last-status surfaced in the Reports admin screen.

## 8. Retention & archiving

- Raw: 30-180 days.
- Hourly: 1-3 years.
- Daily: 5-10 years.
- Monthly: 10+ years.

Implemented with TimescaleDB compression + retention policies mapped to these tiers.
