# Widget commission scorecard (Jul 2026)

Living Pass / Fix / Defer grades for all 111 registry widgets. Gallery badges read from `frontend/src/features/builder/widgetCommissionGrades.ts`.

| Type | Label | Family | Grade | Notes |
|------|-------|--------|-------|-------|
| `andon-stack` | Andon Stack | status | **Pass** | tower/strip/beacon; frameVariant honored |
| `connection-stale` | Connection Status | status | **Pass** | connection indicator |
| `fault-banner` | Active Fault | status | **Pass** | alert strip; wall calm variant |
| `last-update-clock` | Last Update | status | **Pass** | last snapshot clock |
| `line-status-indicator` | Line Status | status | **Pass** | statusStyle; hierarchy mock in audit gallery |
| `line-status-strip` | Line Status Strip | status | **Pass** | horizontal pills; hierarchy mock wired |
| `machine-grid` | Machine Grid | status | **Pass** | machine tiles; cardStyle flavor; audit hierarchy mock |
| `oee-traffic-light` | OEE Traffic Light | status | **Pass** | soft panel/ring; no solid slab |
| `plant-grid` | Plant Grid | status | **Pass** | line KPI card grid; audit hierarchy mock |
| `run-state-badge` | Run State Badge | status | **Pass** | statusStyle + context line |
| `state-distribution` | State Distribution | status | **Pass** | state time donut |
| `state-time-breakdown` | State Time Breakdown | status | **Pass** | state minutes breakdown |
| `state-timeline` | State Timeline | status | **Pass** | state timeline strip |
| `status-light` | Status Light | status | **Pass** | statusStyle matrix; calm beacon |
| `apq-cluster` | A/P/Q Cluster | oee | **Pass** | three rings |
| `factor-gauge` | A/P/Q Gauge | oee | **Pass** | A/P/Q single ring; oeeColor fallback fixed |
| `fpy-tile` | FPY % | oee | **Pass** | presentation skins |
| `gap-cluster` | Gap vs Target | oee | **Pass** | A/P/Q gap vs target |
| `kpi-stat-card` | KPI Stat Card | oee | **Pass** | PresentationKpi + colorMode + wall label |
| `kpi-tile` | KPI Tile | oee | **Pass** | 9 presentation skins + colorMode |
| `kpi-tile-group` | KPI Tile Group | oee | **Pass** | KPI group |
| `line-leaderboard` | Line Leaderboard | oee | **Pass** | OEE ranking bars |
| `linear-gauge` | Linear Gauge | oee | **Pass** | PresentationKpi gauge/bar/ring + colorMode |
| `oee-by-shift` | OEE by Shift | oee | **Pass** | shift compare chart |
| `oee-gauge` | OEE Gauge | oee | **Pass** | KPI field picker; label below ring |
| `oee-hero` | OEE Hero | oee | **Pass** | KPI field + showLabelBelow |
| `oee-waterfall` | OEE Waterfall | oee | **Pass** | loss bridge; resolveScopedSnapshot |
| `plant-summary-hero` | KPI Summary | oee | **Pass** | KPI Summary; machine/line/plant scope |
| `scrap-tile` | Scrap % | oee | **Pass** | presentation skins |
| `target-vs-actual` | Target vs Actual | oee | **Pass** | bars vs targets |
| `teep-tile` | TEEP | oee | **Pass** | presentation skins |
| `worst-lines` | Worst Lines | oee | **Pass** | at-risk lines |
| `yield-tile` | Yield % | oee | **Pass** | presentation skins |
| `active-downtime-timer` | Active Downtime Timer | downtime | **Pass** | Down/Setup only; Idle not treated as stop |
| `downtime-heatmap` | Downtime Heatmap | downtime | **Pass** | hour/day heat |
| `downtime-list` | Downtime List | downtime | **Pass** | event table |
| `event-feed` | Event Feed | downtime | **Pass** | live feed |
| `failure-rate` | Failure Rate | downtime | **Pass** | presentation skins |
| `fault-code-summary` | Downtime Reason Summary | downtime | **Pass** | reason cards |
| `histogram` | Duration Histogram | downtime | **Pass** | duration buckets |
| `loss-minutes-bridge` | Loss Minutes Bridge | downtime | **Pass** | loss bridge |
| `loss-trend` | Loss Trend | downtime | **Pass** | loss trend |
| `losses-donut` | Six Big Losses | downtime | **Pass** | six big losses |
| `mean-lost-time` | Mean Lost Time | downtime | **Pass** | presentation skins |
| `micro-stop-counter` | Micro-stop Counter | downtime | **Pass** | presentation skins |
| `mtbf-tile` | MTBF | downtime | **Pass** | presentation skins; snapshot fallback |
| `mttd-tile` | MTTD | downtime | **Pass** | presentation skins |
| `mttf-tile` | MTTF | downtime | **Pass** | presentation skins |
| `mttr-tile` | MTTR | downtime | **Pass** | presentation skins; snapshot fallback |
| `operator-downtime-leaderboard` | Operator Downtime | downtime | **Pass** | operator ranking |
| `pareto` | Downtime Pareto | downtime | **Pass** | combo pareto |
| `planned-unplanned-split` | Planned vs Unplanned | downtime | **Pass** | split chart |
| `reliability-cluster` | Reliability Cluster | downtime | **Pass** | reliability KPI cluster |
| `reliability-panel` | Reliability Panel | downtime | **Pass** | MTTR/MTBF panel |
| `reliability-trend` | Reliability Trend | downtime | **Pass** | historian trend |
| `stops-per-hour` | Stops / Hour | downtime | **Pass** | presentation skins |
| `time-balance` | Time Balance | downtime | **Pass** | available vs lost |
| `top-fault-codes` | Top Downtime Reasons | downtime | **Pass** | reason ranking |
| `unassigned-stops-banner` | Unassigned Stops Banner | downtime | **Pass** | unassigned banner |
| `unattributed-downtime-counter` | Unattributed Stops | downtime | **Pass** | awaiting reason count |
| `attainment-tile` | Production Attainment | production | **Pass** | run/shift attainment |
| `count-tile` | Count Tile | production | **Pass** | presentation skins |
| `count-to-go` | Count to Go | production | **Pass** | remaining count |
| `count-to-target` | Count to Target | production | **Pass** | count progress |
| `current-job-banner` | Current Job | production | **Pass** | active job; scoped snapshot |
| `cycle-time-compare` | Cycle Time Compare | production | **Pass** | ideal vs actual |
| `cycle-time-tile` | Cycle Time | production | **Pass** | presentation skins |
| `expected-vs-actual-count` | Expected vs Actual Count | production | **Pass** | expected vs actual |
| `hourly-production-bar` | Hourly Production | production | **Pass** | hourly bars |
| `multi-trend` | Multi Trend | production | **Pass** | multi series |
| `pace-gauge` | Pace Gauge | production | **Pass** | pace indicator |
| `parts-loss-waterfall` | Parts Loss Waterfall | production | **Pass** | parts loss bridge |
| `production-run-list` | Production Summary | production | **Pass** | run list |
| `production-vs-target` | Production vs Target | production | **Pass** | vs target trend |
| `rate-variance` | Rate Variance | production | **Pass** | rate variance |
| `recipe-product-strip` | Recipe / Product Strip | production | **Pass** | recipe context |
| `scrap-trend` | Scrap Trend | production | **Pass** | scrap trend |
| `shift-comparison-card` | Shift Comparison | production | **Pass** | shift compare card |
| `shift-context-strip` | Shift Context Strip | production | **Pass** | shift context |
| `shift-progress` | Shift Progress | production | **Pass** | scoped shift progress |
| `shift-progress-bar` | Shift Progress Bar | production | **Pass** | scoped progress bar |
| `shift-summary` | Shift Summary | production | **Pass** | shift summary |
| `sparkline-tile` | Sparkline Tile | production | **Pass** | PresentationKpi spark modes |
| `speed-trend` | Speed Trend | production | **Pass** | speed trend |
| `takt-vs-actual` | Takt vs Actual | production | **Pass** | takt compare |
| `target-pace-tile` | Target Pace | production | **Pass** | required pace |
| `throughput-tile` | Throughput | production | **Pass** | presentation skins |
| `time-series-trend` | Trend Tile | production | **Pass** | bound field trend |
| `total-count-tile` | Total Count | production | **Pass** | PresentationKpi skins |
| `units-per-shift` | Units per Shift | production | **Pass** | PresentationKpi skins |
| `clock-date` | Clock & Date | layout | **Pass** | clock |
| `container-panel` | Container Panel | layout | **Pass** | nested CSS/RGL host; one level |
| `dashboard-link` | Dashboard Link | layout | **Pass** | nav to dashboard; placeholder id until set |
| `data-table` | Data Table | layout | **Pass** | data table; audit hierarchy mock |
| `divider` | Divider | layout | **Pass** | section divider; no frame variants |
| `drill-through-list` | Drill-through List | layout | **Pass** | drill list |
| `fault-ack-button` | Fault Ack | layout | **Pass** | writes when allowInteractiveWrites + PlcWrite |
| `iframe-embed` | Iframe Embed | layout | **Pass** | iframe; demo URL may fail offline |
| `image-logo` | Image / Logo | layout | **Pass** | image/logo |
| `live-tag-value` | Live PLC Tag | layout | **Pass** | PLC tag display |
| `marquee-ticker` | Marquee Ticker | layout | **Pass** | ticker |
| `navigation-drill` | Navigation Drill | layout | **Pass** | nav drill |
| `operator-downtime-pad` | Downtime Pad | layout | **Pass** | writes when allowInteractiveWrites + permission |
| `plc-write-controls` | PLC Controls | layout | **Pass** | writes when allowInteractiveWrites + PlcWrite |
| `qr-link-tile` | QR Link Tile | layout | **Pass** | QR link |
| `quick-links-bar` | Quick Links | layout | **Pass** | quick links |
| `rich-notes` | Rich Notes | layout | **Pass** | notes block |
| `tabbed-panel` | Tabbed Panel | layout | **Pass** | tabbed nested host; one level |
| `text-label` | Text Label | layout | **Pass** | static text |
| `top-n-table` | Top N Table | layout | **Pass** | top N table; audit hierarchy mock |
| `udt-member-value` | UDT Member | layout | **Pass** | UDT member |

## Counts

| Grade | Count |
|-------|------:|
| Pass | 111 |
| Fix | 0 |
| Defer | 0 |
| **Total** | **111** |

## Pass bar

1. Renders in Admin Widget Gallery light + dark, default size
2. Functions with mock/live ctx (no blank/crash; correct scope)
3. Flavors intentional when applicable (presentation / statusStyle / colorMode / frame)
4. Presentable per visual language (calm surfaces, readable type, no overlap)
5. State-of-the-art enough for industrial wall — or Defer with reason
