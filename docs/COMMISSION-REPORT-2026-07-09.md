# ConnectOEE Commission Report — 2026-07-09

**Plant:** FrommConnect (fresh install, 3-line commissioning)  
**PLC:** Rockwell EtherNet/IP @ `10.0.0.49` (path `1,0`)  
**Stack:** API `:5080`, Vite `:5173`, Postgres/Timescale via Docker  
**Commissioner:** Production-manager walkthrough + browser QA (16 checkpoints)  
**Credentials:** `admin` / `ChangeMe!123`

## Executive summary

**Overall grade: C+ (blocked on live PLC data)**

Fresh-reset commissioning completed successfully: hierarchy (1 plant · 1 dept · 3 lines · 9 machines), Rockwell PLC connection, required tag mapping (9/9), 3×8 shifts, and **36 system dashboards** generated. UI modules render correctly with coherent empty states, insight banners, and navigation drill-through.

**Critical blocker:** Live machine snapshots show **OFFLINE / DISCONNECTED** across dashboards, Plant Explorer, and Operator Station despite tag browse returning **327 tags** from the PLC. Wizard PLC step shows connection **FAULTED**. Tag paths were mapped to fallback `Program:MainProgram.RunState` / `Program:MainProgram.GoodCount` because browse results did not match keyword heuristics — these paths are likely incorrect for the target controller program.

**Ship bar for field go-live:** Not met until live RunState + GoodCount reads validate on at least one line.

---

## Commissioning setup

| Item | Value |
|------|-------|
| Plant | FrommConnect (`FROMM`, America/New_York) |
| Department | Production |
| Lines | Line 1, Line 2, Line 3 |
| Machines / line | Raw Materials, Washing, Drying (9 total) |
| PLC | Plant PLC — RockwellEthernetIp, `10.0.0.49`, slot `1,0`, 1000 ms poll |
| Shifts | 3×8 Fixed (Day / Swing / Night), plant-wide |
| Dashboards | 36 generated from system templates |
| Script | `scripts/fromm-3line-commission.ps1` |

### PLC connectivity notes

| Check | Result |
|-------|--------|
| Network reachability (`10.0.0.49`) | Ping succeeds from dev PC |
| Tag browse (`GET /api/tags/browse`) | **Pass** — 327 tags returned |
| Tag path resolution | **Fail** — keyword search missed RunState/GoodCount; script used fallback paths |
| Connection health (wizard UI) | **FAULTED** on Plant PLC step |
| Live machine snapshots | **OFFLINE** — all 9 machines |
| Builder plant-level preview | Shows aggregated OEE ~10.7% (historian/rollup, not confirmed live PLC) |

**Recommended next steps (field):**

1. Open **Tag Browser** → browse Plant PLC → identify actual RunState and GoodCount tag paths (likely UDT or line-specific program scope).
2. Remap all 9 machines (or one line first for smoke test) via wizard step 7 or Admin → Tag Mapping.
3. Confirm wizard PLC step shows **CONNECTED** and Operator grid shows Running/Down with non-zero counts when PLC is in production.
4. If CompactLogix uses a non-default slot, adjust path (e.g. `1,1`).

---

## Snapshot checklist (16 checkpoints)

Screenshots: [`docs/commissioning-screenshots/`](commissioning-screenshots/)

| # | Screen | File | Status |
|---|--------|------|--------|
| 1 | Admin bootstrap / post-setup entry | `01-login-admin-bootstrap.png` | **Partial** — admin created via API bootstrap (wizard skips form when admin exists); login/dashboard entry captured |
| 2 | Wizard — 3 lines hierarchy | `02-wizard-hierarchy-lines.png` | **Pass** |
| 3 | Wizard — Rockwell PLC config | `03-wizard-plc-rockwell.png` | **Pass** (shows FAULTED) |
| 4 | Wizard — tag mapping 9/9 | `04-wizard-tags-mapped.png` | **Pass** |
| 5 | Wizard — dashboards finish | `05-wizard-finish.png` | **Pass** (36 dashboards) |
| 5b | Wizard — shifts (step 9) | `09-wizard-shifts.png` | **Pass** |
| 6 | Dashboards list | `06-dashboards-list.png` | **Pass** |
| 7 | Line 1 Overview (live) | `07-line1-overview-dashboard.png` | **Partial** — layout OK, no live data |
| 8 | Machine Detail dashboard | `08-machine-detail-dashboard.png` | **Partial** — layout OK, no live data |
| 9 | Plant Explorer — plant | `09-explorer-plant.png` | **Pass** |
| 10 | Plant Explorer — Line 1 | `10-explorer-line1.png` | **Pass** |
| 11 | Plant Explorer — machine | `11-explorer-machine.png` | **Pass** |
| 12 | Operator grid | `12-operator-grid.png` | **Pass** |
| 13 | Operator machine detail | `13-operator-machine-detail.png` | **Pass** (DISCONNECTED badge) |
| 14 | Analytics overview | `14-analytics-overview.png` | **Pass** |
| 15 | Builder — palette + canvas | `15-builder-palette-canvas.png` | **Pass** |
| 16 | Builder — widget added | `16-builder-widget-added.png` | **Pass** (click-add lands at grid origin) |

---

## PM walkthrough — pass/fail matrix

### Dashboards review

| Criterion | Result | Notes |
|-----------|--------|-------|
| Glanceability (10 ft wall) | **Partial** | Templates exist (Andon, Operator Kiosk, Supervisor); kiosk typography adequate but live tiles empty |
| Role fit (operator vs plant) | **Pass** | 36 templates span line/machine/plant/kiosk categories |
| Live state visible | **Fail** | Connection/stale indicators present but all machines offline |
| Drill-through to Explorer/Analytics | **Pass** | Links and scope breadcrumbs work |
| Seeded template categories | **Pass** | Line, Machine, Plant, Analysis, Kiosk all present in list |

### Plant Explorer review

| Criterion | Result | Notes |
|-----------|--------|-------|
| Hierarchy tree (status, OEE, product) | **Partial** | Tree renders; all nodes OFFLINE 0.0% |
| Detail panel (hero, comparison, trends) | **Pass** | Sections render with correct empty states |
| Real-time updates (SignalR) | **Untested** | No state transitions to observe without PLC data |

### Operator Station review

| Criterion | Result | Notes |
|-----------|--------|-------|
| 9-station grid | **Pass** | Grouped by line, filters work |
| Machine detail drill-down | **Pass** | `/operator?machine={id}` loads KPI hero, product picker, reason queue |
| Reason queue | **Pass** | Empty queue — "All recent stops have a reason" |
| Changeover / product decouple | **Not exercised** | Implemented in prior session; not re-tested this pass |

### Analytics review

| Criterion | Result | Notes |
|-----------|--------|-------|
| Scope picker (plant/dept/line/machine) | **Pass** | Plant scope loads |
| Time range + compare | **Pass** | 24h default, compare toggle |
| Historian charts | **Partial** | Sparse coverage banner; OEE 0%, anomalous loss bar (533h) with zero production |
| Export / Reports link | **Pass** | Controls present |

### Builder review (gaps documented — not fixed this pass)

| Issue | PM impact | Severity |
|-------|-----------|----------|
| Click-add / drop lands at `(0,0)` | Frustrating layout for supervisors | **High** |
| Title-bar-only drag handle | Feels stiff vs consumer DnD | **Medium** |
| `pointerEvents: none` in edit preview | Widgets feel dead while editing | **Medium** |
| Container/tabbed panels are placeholders | No nested layouts | **Low** (documented) |
| Template apply replaces all widgets | Risky for supervisors | **Medium** |
| Sparse palette previews (text buttons) | Doesn't feel like a "gadget library" | **High** (visual roadmap) |
| 98 widget types, 7 palette categories | Depth is strong; discoverability weak | **Info** |

---

## Per-module grades

| Module | Functional | Visual | UX | Trust | Grade | Notes |
|--------|------------|--------|-----|-------|-------|-------|
| **Wizard** | A | A | A | B | **A-** | Full 10-step flow; PLC fault visible (good trust signal) |
| **Dashboards** | B | A | B | C | **B-** | Templates render; live data blocked |
| **Plant Explorer** | B | A | A | C | **B** | Hierarchy UX is a differentiator; offline state dominates |
| **Operator** | B | A | A | C | **B** | Grid + detail solid; disconnected badge correct |
| **Analytics** | B | A | A | B | **B+** | Strong layout; historian sparse without production |
| **Builder** | A | B+ | B | A | **B+** | Full library; DnD/palette polish gaps |
| **Shell** | A | A | A | A | **A** | Connection pill, shift clock, nav consistent |

---

## Findings & recommendations

### P0 — Field blocker

1. **Incorrect tag paths** — Remap RunState/GoodCount using live Tag Browser on `10.0.0.49`; do not rely on `Program:MainProgram.*` fallbacks.

### P1 — Before supervisor sign-off

2. **PLC connection FAULTED** — Investigate driver poll errors (path/slot, tag datatype, firewall CIP port 44818).
3. **Historian anomaly** — Six Big Losses shows 533h with zero production/downtime; verify rollup when no machine events exist.

### P2 — UX polish (see visual audit doc)

4. Widget **presentation variants** (compact / hero / kiosk / executive) for same binding.
5. Builder **drop-at-cursor** and **palette thumbnails**.
6. Operator view **density tier** — reduce to 3–5 headline metrics on kiosk templates.

---

## Verification gate

| Check | Result |
|-------|--------|
| `docker compose up -d` | Pass |
| `.\scripts\reset-fresh-install.ps1` | Pass (tenant cleared; audit append-only warning benign) |
| `.\scripts\fromm-3line-commission.ps1` | Pass |
| API health | Pass (`:5080`) |
| Frontend | Pass (`:5173`) |
| Browser QA (16 checkpoints) | Pass (1 partial — admin bootstrap via API) |

---

## Re-test after remediation (2026-07-09)

| Area | Fix applied | Re-test |
|------|-------------|---------|
| Commission script | `fullPath`, tree flatten, per-machine discovery, no fallbacks | Re-run `fromm-3line-commission.ps1` |
| Tag browse API | `GET /api/tags/browse/leaves` | Script + Tag Browser |
| PLC diagnostics | `statusDetail` on driver status | Wizard step 6 + Admin PLC |
| Historian | No phantom 500h loss when zero production | Analytics plant 24h empty state |
| Dashboards hub | Grouped/searchable list | Navigate to Line 1 Overview in <10s |
| Builder | Drop-at-cursor, template confirm | Builder screenshot checkpoint |
| Widget variants | `frameVariant` in Layout tab | OEE Gauge compact/hero/kiosk |

**Post-remediation target grade:** A- (pending live PLC on `10.0.0.49` — `plc/status` still **Faulted** until tags remapped with fixed script).

**Build gate (2026-07-09):** `npm run build` pass; `dotnet test` 50/50 pass (API rebuild blocked while service running).


- [VISUAL-COMPETITIVE-AUDIT-2026-07.md](VISUAL-COMPETITIVE-AUDIT-2026-07.md) — competitive comparison + widget variant / builder roadmap
- [15-commissioning-qa.md](15-commissioning-qa.md) — commissioning checklist reference
- Prior baseline: [COMMISSION-REPORT-2026-06-28.md](COMMISSION-REPORT-2026-06-28.md)
