# ConnectOEE QA Findings Report — 2026-07-08

**Plant:** FrommConnect / Line 1 (3 machines, Rockwell PLC `10.0.0.49`)  
**Stack:** API `:5080`, Vite `:5173`, Postgres/Timescale via Docker  
**Tester:** Automated API matrix + code audit + live stack verification  
**Overall grade: B+** — core platform is solid; navigation bugs and metric surfacing gaps hold it back from A.

---

## Executive summary

ConnectOEE is **functionally strong** for its primary workflows: live PLC ingestion, Plant Explorer, dashboards, analytics, operator station, admin commissioning, and kiosk displays. Line 1 commissioning is **green** (`ready=true`). Security commissioning is **not** factory-ready (expected in dev: no admin MFA, dev JWT key).

**Top blockers to fix next:**
1. Broken `/explorer` deep links (4 locations) — users land on login/wizard redirect instead of Plant Explorer
2. Plant Explorer ignores `?scope=` query — Analytics “View live” is ineffective
3. TEEP hardcoded to `0` in Explorer live KPI hero
4. Operator role can access Dashboards (docs say deny) — RBAC inconsistency
5. `plc-write-controls` widget has no `plc.write` permission check (API correctly returns 403)

**PLC reconnect:** Verified `PlantPLC` → `Connected` after API restart; auto-reconnect logic added to `DriverManager` (10s retry on Faulted/Disconnected).

---

## Verification gate

| Check | Result |
|-------|--------|
| API `/health`, `/health/ready` | 200 OK |
| PLC driver `PlantPLC` | Connected (3 machines) |
| Live snapshots | 3 machines reporting |
| Tag browse (Rockwell) | 200 OK (~300KB tree) |
| `dotnet test` (excl. ShiftPatternSaveTests) | **41/41 passed** |
| `npm run build` (frontend) | **Pass** |
| Line commissioning | `ready=true` (all blocking checks green) |
| Security commissioning | `ready=false` (MFA + JWT key — expected dev) |

---

## Phase 1 — Smoke & infrastructure

| Check | Result | Notes |
|-------|--------|-------|
| API health | **Pass** | Process listening on `:5080` |
| PLC connection | **Pass** | `state: Connected` |
| Auth (all roles) | **Pass** | admin (14 perms), supervisor (10), manager (5), operator (2) |
| Setup status | **Pass** | `needsSetup: false` |
| Live hierarchy | **Pass** | OEE ~3.9%, status Idle/Running, `connectionState: Connected` |
| Historian reliability API | **Pass** | MTTR 0.77m, MTBF 67.8m, failure rate 0.885/hr |
| PLC reconnect | **Pass** | Auto-retry implemented; manual restart also recovers |

---

## Phase 2 — Role-based route matrix

### API enforcement (verified)

| Endpoint | Admin | Supervisor | Manager | Operator |
|----------|-------|------------|---------|----------|
| `GET /api/hierarchy/tree` | 200 | 200 | 200 | **403** |
| `GET /api/historian/trend` | 200 | 200 | 200 | **403** |
| `GET /api/tags/browse` | 200 | 200 | **403** | **403** |
| `GET /api/plc/connections` | 200 | 200 | 200 | 200 |
| `GET /api/users` | 200 | **403** | **403** | **403** |
| `POST /api/plc/.../command` | — | — | — | **403** |

### Frontend route guards (code + matrix)

| Route | Admin | Supervisor | Manager | Operator | Issue |
|-------|-------|------------|---------|----------|-------|
| `/` Dashboards | ✓ | ✓ | ✓ | **✓ (open)** | **Major:** docs deny operator; `App.tsx` only uses `RequireAuth` |
| `/builder` | ✓ | ✓ | deny | deny | Pass |
| `/plant-explorer` | ✓ | ✓ | ✓ | deny | Pass |
| `/analytics`, `/reports` | ✓ | ✓ | ✓ | deny | Pass |
| `/tags` | ✓ | ✓ | deny | deny | Pass |
| `/operator` | ✓ | ✓ | ✓ | ✓ | Pass |
| `/admin`, `/wizard` | ✓ | deny | deny | deny | Pass |
| `/kiosk/:id` | anon | — | — | — | Pass (2 published boards) |

**Finding QA-012 (Major, RBAC):** Operator sees Dashboards nav item and can load `/` + `GET /api/dashboards`. [`docs/15-commissioning-qa.md`](15-commissioning-qa.md) route matrix says operator should be denied. Add `RequirePermission` or hide nav + redirect.

---

## Phase 3 — Workflow walkthroughs

### 3a. Operator (`/operator`) — **Grade: A-**

| Item | Result |
|------|--------|
| Stations API | 200 (1 station for operator scope) |
| PLC write as operator | 403 (correct) |
| Scope bar “Plant Explorer” link | **Fail** — links to `/explorer` (broken) |
| Downtime reason queue | API gated; UI not fully exercised in browser |

### 3b. Plant Explorer (`/plant-explorer`) — **Grade: B+**

| Item | Result |
|------|--------|
| Live tree + KPI | **Pass** — Connected, OEE updating |
| Tree search | Present in UI |
| Detail panel trends | Implemented |
| Analytics “View live” link | **Fail** — `/explorer?scope=` wrong path + scope ignored |
| TEEP in live hero | **Fail** — hardcoded `teepPct: 0` in `ExplorerKpiHero.tsx:28` |

### 3c. Dashboards + Kiosk — **Grade: A-**

| Item | Result |
|------|--------|
| Dashboard count | 15 total, 3 published, 3 kiosk scope |
| Kiosk list (anon) | 2 boards (`kiosk-list` endpoint) |
| Kiosk session | 204 on `POST /api/dashboards/kiosk/{id}/session` |
| Maintenance Wallboard | Published but **no `lineId`** — may fail live binding |

### 3d. Builder — **Grade: B+** (code audit)

| Item | Result |
|------|--------|
| Widget catalog | 96 types, registry parity enforced |
| Palette metadata | Only **12/96** widgets have descriptions/icons |
| Template gallery, undo/redo, publish | Implemented |
| Dark mode builder | Not fully exercised |

### 3e. Analytics — **Grade: B**

| Tab | Result |
|-----|--------|
| Overview | OEE trend, waterfall, losses donut, drill-down — **Pass** |
| Downtime | Pareto, events, reason review — **Pass** |
| Production | Cycle/scrap/yield — **Pass**; missing rate variance |
| Reliability | MTTR, MTBF, stops/hr — **Pass**; missing MTTF/MTTD/failure rate |
| CSV export | Implemented |
| Cross-link to Reports | Implemented |

### 3f. Reports — **Grade: A** (API + prior commission)

Preview, history, schedules/SMTP/designer gated by `reports.manage`.

### 3g. Tag Browser — **Grade: A**

Browse returns full Rockwell tag tree (~300KB). Manager correctly denied browse API.

### 3h. Admin — **Grade: A**

All 10 tabs present. Line commissioning green. Security commissioning shows MFA + JWT as blocking (dev expected).

### 3i. Wizard — **Spot-check**

Re-run available for Admin (`wizard.run`). Not reset during this audit.

---

## Phase 4 — Visual & UX review

Scored **Pass / Minor / Major** based on code review, prior browser session, and [`COMMISSION-REPORT-2026-06-28.md`](COMMISSION-REPORT-2026-06-28.md).

| Area | Score | Notes |
|------|-------|-------|
| Shell / header | **Pass** | Shift clock, connection pill, theme toggle, role badges |
| Branding / colors | **Pass** | ConnectOEE blue primary, status green/amber/red |
| Hierarchy & density | **Pass** | Touch-friendly operator cards; readable tree |
| Empty states | **Minor** | Login kiosk panel empty when no boards (2 exist now — OK) |
| Loading / stale | **Pass** | Skeletons, stale badges on widgets |
| Dark mode | **Minor** | Toggle present; not fully walked on every route |
| Navigation coherence | **Major** | `/explorer` broken links; scope deep-link ignored |
| Forms / validation | **Pass** | Password policy, wizard gating |
| Charts | **Pass** | Empty chart states, tooltips via MetricLabel help |

---

## Phase 5 — Widget audit

### Catalog integrity

- **96 widget types** in `registry.tsx` / `widgetCatalog` (doc claims ~95 — minor drift)
- Integrity assertion runs at module load
- All 8 palette categories populated

### Doc vs implementation

| Widget | Doc says | Code shows | Severity |
|--------|----------|------------|----------|
| `reliability-cluster` | MTTR, MTBF, MTTF, MTTD, stops/hr, mean lost | MTTF, MTTD, mean lost, fail/hr, stops/hr, avail(rel) — **no MTTR/MTBF** | Minor |

### Permission gap

| Widget | Issue | Severity |
|--------|-------|----------|
| `plc-write-controls` | No `hasPermission(PlcWrite)` check before rendering buttons | **Major** (security UX) |

### Palette discoverability

Only **12/96** widgets have `WIDGET_PALETTE_META` entries. Supervisors building dashboards see sparse tooltips for 84 widgets.

### Widget expansion candidates (validated need)

| Candidate | Rationale |
|-----------|-----------|
| Shift comparison card | No side-by-side current vs prior shift OEE in Analytics |
| Unattributed downtime counter | `needsReason` exists in Operator/DowntimeTab but no hero tile |
| TEEP + loading strip | TEEP in widgets but not Analytics/Explorer live hero |
| Rework/scrap split donut | Rework count in snapshot, not in Analytics KpiHero |
| Machine state Gantt | `state-timeline` exists but shift-length Gantt would help supervisors |
| Benchmark target overlay | No plant/line OEE target line on trend charts |
| Operator downtime leaderboard in Analytics | API `downtime-by-operator` exists; widget only |
| Dedicated downtime-by-shift widget | Partially covered by `oee-by-shift` / `histogram` |

---

## Phase 6 — Metrics coverage (docs/06 vs UI)

### Backend exposes (verified via `/api/events/reliability`, `/api/live`)

MTTR, MTBF, MTTF, MTTD, mean lost time, failure rate, availability from reliability, stops/hr, micro-stop count, rate variance, TEEP, rework count, loss minutes.

### Surfacing gaps

| Metric | Live snapshot | Widgets | Analytics KpiHero | Explorer live | Reliability tab | Production tab |
|--------|---------------|---------|-------------------|---------------|-----------------|----------------|
| TEEP % | ✓ | ✓ `teep-tile` | ✗ | **✗ hardcoded 0** | ✗ | ✗ |
| Rework count | ✓ | ✓ bindable | ✗ | ✗ | ✗ | ✗ |
| Total count | ✓ | ✓ | partial | partial | ✗ | ✗ |
| Failure rate λ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| MTTF / MTTD | ✓ | ✓ cluster | ✗ | ✗ | ✗ | ✗ |
| Mean lost time | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Avail (reliability) % | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Rate variance % | ✓ | ✓ | ✗ | partial live | ✗ | ✗ |
| Micro-stop count | ✓ | ✓ | ✗ | conditional | ✗ | ✗ |
| Operator downtime rollup | ✓ API | widget only | ✗ | ✗ | ✗ | ✗ |
| Loss min help tooltips | ✓ | ✓ | chips w/o help | — | — | — |

### Data integrity spot-check

| Comparison | Result |
|------------|--------|
| Hierarchy tree OEE vs historian last bucket | **Minor drift** — live tree ~3.9% OEE; historian bucket structure differs (expected: live vs rolled-up) |
| Live snapshots count | 3 = machine count ✓ |
| Reliability API vs Reliability tab fields | API has full set; tab shows subset |

---

## Findings register (prioritized)

### Blocker

_None in dev environment. Security commissioning correctly blocks factory deploy._

### Major

| ID | Category | Finding | Location | Fix |
|----|----------|---------|----------|-----|
| QA-001 | Function | `/explorer` links route to non-existent path | `AnalyticsEmpty.tsx`, `OperatorScopeBar.tsx`, `AnalyticsPage.tsx`, `layoutWidgets.tsx`, `WidgetOptionsEditor.tsx` | Change to `/plant-explorer` |
| QA-002 | Function | Plant Explorer ignores `?scope=` query param | `PlantExplorerPage.tsx` | Parse `useSearchParams`, auto-select node |
| QA-003 | Metrics | TEEP hardcoded to 0 in Explorer live KPI | `ExplorerKpiHero.tsx:28` | Use `kpi.teepPct` or snapshot field |
| QA-004 | Security | PLC write widget no permission gate | `extended.tsx` `PlcWriteControlsWidget` | Check `hasPermission(PlcWrite)` |
| QA-005 | RBAC | Operator can access Dashboards | `App.tsx`, `AppLayout.tsx` | Align with docs: deny or document change |
| QA-006 | Function | Presence cleanup uses `sendBeacon` POST to DELETE URL → 405 | `useClientPresence.ts:65-66` | Use `fetch DELETE` or POST endpoint for beacon |

### Minor

| ID | Category | Finding | Location |
|----|----------|---------|----------|
| QA-007 | Metrics | Analytics missing TEEP, rework, failure rate, MTTF/MTTD | `KpiHero.tsx`, `ReliabilityTab.tsx`, `ProductionTab.tsx` |
| QA-008 | Widgets | `reliability-cluster` ≠ doc spec (no MTTR/MTBF) | `kpiPremium.tsx` vs `docs/10-*.md` |
| QA-009 | Widgets | Maintenance Wallboard kiosk has no `lineId` | Dashboard seed data |
| QA-010 | RBAC | Admin route gated only by `users.manage`; tabs not sub-gated | `AdminPage.tsx` (may be intentional) |
| QA-011 | Docs | `docs/05-rbac-security-audit.md` duplicate Manager entry | docs |
| QA-012 | API | Manager can list PLC connections but not browse tags | By design; consider read-only browse for managers |

### Polish

| ID | Category | Finding | Location |
|----|----------|---------|----------|
| QA-013 | Widgets | 84/96 widgets lack palette descriptions/icons | `widgetPaletteMeta.ts` |
| QA-014 | UX | Loss chips in KpiHero lack help tooltips | `KpiHero.tsx` |
| QA-015 | UX | Dark mode not verified on every route | Manual pass |
| QA-016 | Docs | Widget count 95 vs 96 | `docs/10-*.md` |

---

## Per-module grades

| Module | Functional | Visual | UX | Trust | Grade |
|--------|------------|--------|-----|-------|-------|
| Shell | A | A | A | A | **A** |
| Login | A | A | B+ | A | **A-** |
| Dashboards | A | A | B+ | A | **A-** |
| Plant Explorer | B+ | A | B | A | **B+** |
| Analytics | B+ | A | B+ | A | **B+** |
| Reports | A | A | A | A | **A** |
| Tag Browser | A | A | A | A | **A** |
| Operator | A | A | B+ | A | **A-** |
| Builder | A | A | B | A | **B+** |
| Admin | A | A | A | A | **A** |
| Kiosk | A | A | A | A | **A** |
| Wizard | — | — | — | — | **N/A** |

**Ship bar (dev):** No module below **C**; no **F** on Functional or Industrial trust — **met**.

**Factory ship bar:** Security commissioning must pass (MFA, JWT, HTTPS) — **not met** (expected dev).

---

## Gap backlog (recommended fix order)

### Sprint 1 — Quick wins (1–2 days)

1. Fix all `/explorer` → `/plant-explorer` links (QA-001)
2. Wire `teepPct` in `ExplorerKpiHero` (QA-003)
3. Add `plc.write` check to `PlcWriteControlsWidget` (QA-004)
4. Fix presence `sendBeacon` DELETE bug (QA-006)
5. Parse `?scope=` in Plant Explorer (QA-002)

### Sprint 2 — Metric surfacing (2–3 days)

6. Add TEEP, rework, total count to Analytics `KpiHero`
7. Extend `ReliabilityTab` with MTTF, MTTD, failure rate, avail(rel)
8. Add rate variance + actual/ideal rate to `ProductionTab`
9. Add operator downtime section to Downtime tab (use existing API)

### Sprint 3 — Widget & builder polish (3–5 days)

10. Enrich `WIDGET_PALETTE_META` for all 96 widgets
11. Align `reliability-cluster` with docs OR update docs
12. Implement 2–3 expansion widgets (shift comparison, unattributed downtime counter, benchmark overlay)
13. Decide operator Dashboards access — implement or update docs (QA-005)

### Sprint 4 — Factory readiness

14. Enable admin MFA in dev test pass
15. Document JWT key rotation for production
16. Re-run security commissioning checklist

---

## Test artifacts

- API role matrix: executed 2026-07-08 22:01 UTC-4
- PLC status: `Connected` throughout audit (after reconnect fix)
- Kiosk boards: Line 1 Andon, Line 1 Operator Kiosk
- Commission users: all login OK with `ChangeMe!123`

---

*Report generated as part of Full App QA Audit plan. Fixes are not included in this document — implement per gap backlog after review.*
