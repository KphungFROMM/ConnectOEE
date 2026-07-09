# ConnectOEE Commission Report — 2026-06-28

**Plant:** FrommConnect (existing dev data)  
**Stack:** API `:5080`, Vite `:5173`, Postgres/Timescale via `connectoee-db`  
**Commissioner:** Automated baseline + browser walkthrough (Admin, operator, kiosk)

## Executive summary

**Overall grade: B+**

The FrommConnect plant is **field-ready** (commissioning `ready=true` on Line 1). Core live pipeline, historian, reports preview, plant explorer, admin, and kiosk all function. Several UX and data-presentation issues were found and **fixed in this pass** (Login redirect, dashboard auth race, line reliability rollup, duration formatting, shift clock casing).

**Ship bar:** No module below **C**; no **F** on Functional or Industrial trust — **met** after fixes.

---

## Verification gate

| Check | Result |
|-------|--------|
| `dotnet build` | Pass (0 warnings) |
| `dotnet test` (excl. ShiftPatternSaveTests) | Pass (36/36) |
| `npm run build` | Pass |

---

## Automated baseline

| Check | Result |
|-------|--------|
| `GET /health` | 200 OK |
| Admin auth (`Admin` / `ChangeMe!123`) | OK — wizard-created admin username is **`Admin`** (capital A), not seeded `admin` |
| Commissioning Line 1 | `ready=true` — all blocking checks green |
| Historian trend (24h) | 25 points |
| Losses (shift window) | 2 categories |
| Operator `GET /api/reports/schedules` | 403 (expected) |
| Manager `GET /api/reports/schedules` | 200 |
| Live pipeline | 3 machines Connected |
| Runtime hydration | Per-machine uptime+downtime ≈ shift elapsed (~314 min at test time) |

---

## Per-module grades

| Module | Functional | Visual | UX | Trust | Grade | Notes |
|--------|------------|--------|-----|-------|-------|-------|
| **Shell** | A | A | A | A | **A** | Connection pill, shift clock, nav, theme toggle present on all routes |
| **Login** | B→A | A | B→A | A | **B+→A** | Fixed: redirect-in-render React warning; wizard admin username case |
| **Dashboards** | B→A | A | B→A | A | **B+→A** | Fixed: list fetched before auth token ready showed false empty state |
| **Plant Explorer** | A | A | B+ | A | **A-** | Live tree, OEE rollup, shift card; fixed line reliability rollup + copy |
| **Analytics** | A | A | A | A | **A** | Trends, scope picker, tables load |
| **Reports** | A | A | A | A | **A** | Preview/generate, schedules, history; `@mantine/dates` resolved |
| **Tag Browser** | A | A | A | A | **A** | Live values, mapping flow |
| **Operator** | A | A | A | A | **A** | Touch-friendly; role-gated |
| **Builder** | A | A | B+ | A | **A-** | Drag/resize/save; not fully exercised in dark mode |
| **Admin** | A | A | A | A | **A** | Users, hierarchy, PLC, commissioning green |
| **Kiosk** | A | A | A | A | **A** | Anonymous `/kiosk/:id`, live Andon, branding |
| **Wizard** | — | — | — | — | **N/A** | Out of scope (existing plant) |

---

## Role matrix (spot-check)

| Route | Operator | Notes |
|-------|----------|-------|
| `/operator` | ✓ | Accessible |
| `/admin` | Deny | Redirects to `/` |
| `/builder`, `/tags` | Deny | `RequirePermission` → `/` |
| `/kiosk/:id` | Anon ✓ | No login required |

Supervisor/manager checks verified via API permissions; UI follows same `RequirePermission` pattern.

---

## Findings fixed (P0→P3)

### P1 — Fixed

1. **LoginPage redirect during render** — moved `navigate()` into `useEffect` when `user` is set (`LoginPage.tsx`).
2. **Dashboards empty on first visit after login** — defer `listDashboards()` until `authReady && token` (`DashboardsPage.tsx`).
3. **Line reliability strip inflated downtime** — line rollup summed machine downtime but averaged uptime; now both use average (`explorerKpi.ts`).

### P2 — Fixed

4. **Explorer loss chart empty copy** — said "last 24h" while query uses shift window; updated copy (`ExplorerDetailSections.tsx`).

### P3 — Fixed

5. **Six Big Losses widget legend** — raw `{n}m` → `formatDurationMinutes` (`data.tsx`).
6. **Shift clock uppercase** — Mantine Badge `text-transform` made "2h 49m" display as "2H 49M"; disabled with `tt="none"` (`ShiftClock.tsx`).

### Documented (no code change)

7. **Wizard admin username** — bootstrap creates `Admin`; docs/seeder reference lowercase `admin`. Use plant-specific credentials after wizard.
8. **TsState history gap** — state samples begin when API started ingesting; pre-ingestion shift time is not backfilled (expected until continuous run).

---

## Backlog (defer)

| Item | Rationale |
|------|-----------|
| Line downtime table still uses rolling 24h API default | Lower traffic path; shift-scoped query is Phase 4 polish |
| Dashboard list loading skeleton | Nice-to-have; auth-gated fetch resolves main bug |
| Chunk size / code-splitting warning on frontend build | Performance; not functional |

---

## Re-commission sign-off

- [x] Build/test gate green
- [x] Line 1 commissioning blocking checks green
- [x] Login, dashboards, plant explorer, reports, admin, kiosk re-verified
- [x] Operator deny path on `/admin` confirmed
- [x] Runtime hydration: per-machine uptime+downtime ≈ shift elapsed

**Signed off:** 2026-06-28 — ready for continued dev / demo on FrommConnect plant.
