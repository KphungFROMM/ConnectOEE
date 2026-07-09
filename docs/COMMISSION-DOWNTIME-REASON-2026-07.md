# Downtime Reason Module — Commission Report (2026-07)

**Scope:** Detect → queue → assign → persist → analyze → correct loop  
**Environment:** API `:5080`, Vite `:5173`, mock PLC on Line 1  
**Evidence:** `docs/commission-results/downtime-reason-api.json`, `scripts/downtime-reason-commission.mjs`

## Executive summary

**P1 sign-off: PASS** (after R1 remediation)

Core operator reason entry, API queue semantics, historian visibility, supervisor correction, and audit trail work on the mock line. **R2 UX discoverability** items were implemented in this pass (Analytics deep link, Admin rename, downtime log CTAs, Analytics assign for unassigned events, list refetch after save). **B4** (empty POST reason) fixed in `ShiftsController.SetReason`.

**Open for R3 (not blockers):** B1/B2 late PLC fault backfill on open stops; B3 global catalog cache; B5 catalog DELETE audit.

---

## Commission matrix

### Phase 1 — Detection & queue (P1)

| # | Result | Notes |
|---|--------|-------|
| 1.1 | **PASS** | Mock PLC produced unassigned stops; `needsReason` queue populated (23–25 events at test time) |
| 1.2 | **PASS** | `GET /api/events/downtime` returns recent events for line |
| 1.3 | **PASS** | Operator UI: banner/queue/modal wired in `OperatorPage` (code + live queue) |
| 1.4 | **PASS** | Running state closes events with duration (mock cycle) |
| 1.5 | **PASS** | API `needsReason=true` count matches operator scope badge source |

### Phase 2 — Reason entry (P1)

| # | Result | Notes |
|---|--------|-------|
| 2.1 | **PASS** | POST `/api/shifts/downtime-reason` → 204; queue −1; reason persisted |
| 2.2 | **PASS** | Modal Other + category path exists (`ReasonAssignModal`) |
| 2.3 | **PASS** | Widget pad uses same POST endpoint (`operator-downtime-pad`) |
| 2.4 | **PASS** | Catalog failure falls back to default reasons (`useDowntimeReasonCatalog`) |
| 2.5 | **PASS** | Assign via REST independent of SignalR; stale indicator on hub disconnect |

### Phase 3 — PLC & catalog (P2)

| # | Result | Notes |
|---|--------|-------|
| 3.1 | **PASS*** | Pending-review API OK; *0 stubs — Downtime Reason tag not mapped on commission line |
| 3.2 | **DEFER** | Requires mapped Reason tag + unknown fault on stop open |
| 3.3 | **DEFER** | Known code pre-fill — needs catalog row + mapped tag |
| 3.4 | **PASS** | Unmapped Reason tag → all stops require operator (`requiresOperatorReason` when no reason) |

### Phase 4 — Changeover & product (P2)

| # | Result | Notes |
|---|--------|-------|
| 4.1–4.5 | **DEFER** | Product picker chain present in `OperatorPage`; not exercised in API script (manual QA on floor) |

### Phase 5 — History & correction (P2)

| # | Result | Notes |
|---|--------|-------|
| 5.1 | **PASS** | Assigned event appears in `/api/historian/events` |
| 5.2 | **PASS** | PATCH `/api/events/downtime/{id}/reason` → 204; audit `downtime.reason.correct` |
| 5.3 | **PASS→FIXED** | Was gap: no assign for unassigned in Analytics — **R2 added Assign reason in Events drawer** |
| 5.4 | **PASS** | Explorer table uses same `getDowntime` API |
| 5.5 | **PASS** | Audit contains `downtime.reason` entries |

### Phase 6 — RBAC & scope (P1)

| # | Result | Notes |
|---|--------|-------|
| 6.1 | **PASS** | `operator`/`supervisor`/`manager` seeded; first-login password change required (expected) |
| 6.2 | **PASS** | Scope enforced via `CanAccessDowntimeLineAsync` / line scopes |
| 6.3 | **PASS** | Manager uses same `downtime.enter` + Analytics permission |
| 6.4 | **PASS** | Kiosk anonymous — no reason entry widgets without auth |

### Phase 7 — Mobile / touch (P3)

| # | Result | Notes |
|---|--------|-------|
| 7.1 | **PASS** | `ReasonQueue` uses relative times ≤767px; banner/modal touch targets ≥44px |
| 7.2 | **PASS** | Product modal centered; no clip in Mantine modal stack |

---

## Backend findings

| ID | Severity | Status | Finding |
|----|----------|--------|---------|
| B1 | Major | **Open (R3)** | PLC fault/reason applied on event **open** only — late codes may not update open `DowntimeEvent` |
| B2 | Major | **Open (R3)** | `ApplyResolvedReason` only on `DowntimeToAdd`; close path does not backfill |
| B3 | Minor | **Open (R3)** | Global catalog (`LineId == null`) cache path |
| B4 | Minor | **FIXED (R1)** | POST rejected empty/whitespace reason (400) |
| B5 | Minor | **Open (R3)** | Catalog DELETE not audited |
| B6 | Info | **Accepted** | `RequiresOperatorReason` computed at query time; Explorer `!reason` may diverge on PLC placeholders |
| B7 | Info | **Accepted** | Shift boundary splits open downtime |
| B8 | Info | **Accepted** | Short changeovers may be `IsMicroStop` |

---

## Remediation delivered (R1–R2)

| Item | Change |
|------|--------|
| R1 B4 | `ShiftsController.SetReason` validates non-empty reason |
| R1 test | `DowntimeReasonAssignTests` — assign clears RequiresOperatorReason |
| R2 deep link | `/analytics?tab=downtime` syncs tab ↔ URL |
| R2 Admin | Tab renamed **Reason catalog**; link to Analytics Events |
| R2 CTA | **View downtime log** on empty Operator queue + Plant Explorer downtime card |
| R2 Analytics | **Assign reason** for unassigned events in Events drawer; refetch after save |
| Tooling | `scripts/downtime-reason-commission.mjs` for repeatable API phases |

---

## Blockers

None for P1 mock-line commissioning after this pass.

**Waivers / factory notes:**

- Commission RBAC users require one-time password change before UI login (`MustChangePassword`).
- PLC catalog auto-stub flow (3.2–3.3) needs Downtime Reason tag mapped on line — recommend wizard step 8 before live PLC cutover.
- B1/B2 backfill deferred to R3 — impact: late-arriving fault codes on long open stops may show blank reason until operator assigns.

---

## How to re-run

```powershell
# API + frontend running
node scripts/downtime-reason-commission.mjs

dotnet test tests/ConnectOEE.Tests/ConnectOEE.Tests.csproj --filter DowntimeReasonAssignTests
```

Screenshots (optional UI capture): `docs/commission-screenshots/downtime-reason/`

---

## Sign-off

| Gate | Result |
|------|--------|
| All P1 matrix items | **PASS** |
| P1 RBAC | **PASS** (seeded accounts + scope API) |
| Findings documented | **YES** |
| Blockers fixed or waived | **YES** |
| Report committed | **YES** |
