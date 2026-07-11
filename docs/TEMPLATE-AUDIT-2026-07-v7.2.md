# Template Audit — v7.2 (July 2026)

Visual QA for the **System Dashboard Templates v7.2** wall-fit catalog with PresentationKpi flavors and denser kiosk headlines.

## Harness

- Route: `/dev/templates` (requires `BuildDashboards` permission); Admin embed: `/admin?tab=templates`
- Frame: fixed 16:9 wall frame (`profileContentHeight`), `DashboardRenderer displayMode="wallFit"`, `overflow: hidden`
- Mock data: audit API mode ON
- Toggle: Light/Dark segmented control on the gallery page
- Each card shows **row budget badge** (`maxRow/8` kiosk or `maxRow/9` plant wall)

## Viewport-fit checklist

| Check | Pass criteria | Result |
|-------|---------------|--------|
| Row budget | Kiosk ≤ 8 rows; others ≤ 9 | **18/18 pass** (`node scripts/check-templates.mjs`) |
| No scroll | Frame `scrollHeight ≈ clientHeight` | **Pass** light + dark (`scripts/qa-templates-live.mjs`) |
| Presentation flavors | KPI/reliability/quality seeds use `presentation` | Rings/bars/numbers on Command Center, Reliability Hub, Quality Lab, Maintenance, OEE heroes |
| Kiosk density | 3–5 headline metrics at 10 ft | Operator Kiosk **5**, Line Andon **5**, Maintenance **6** widgets |
| Floor routes | `/present/:id`, `/kiosk/:id` | Spot-checked Operator Kiosk + Andon (HTTP 200) |
| Apply template | Plant + machine apply with FrommConnect binding | Plant Command Center (9 widgets), Operator Kiosk (5 widgets) |
| Refresh layouts | `POST /api/dashboards/refresh-system-layouts` | 36 dashboards refreshed |

## Gallery captures

| Mode | File |
|------|------|
| Light (full page) | [gallery-light.png](template-screenshots/v7.2/gallery-light.png) |
| Dark (full page) | [gallery-dark.png](template-screenshots/v7.2/gallery-dark.png) |

Per-template crops: `docs/template-screenshots/v7.2/{slug}-light.png`, `{slug}-dark.png`.

Merchandising previews (light crops): `frontend/public/template-previews/{slug}.png`.

## v7.2 catalog (18 system templates)

| Template | Category | Scope | Rows | Widgets | Presentation | QA |
|----------|----------|-------|------|---------|--------------|-----|
| Plant Command Center | Plant | plant | 9 | 9 | 2 | Pass |
| Executive Briefing | Executive | plant | 9 | 7 | 1 | Pass |
| Floor At-a-Glance | Plant | plant | 9 | 4 | 0 | Pass |
| Plant Reliability Hub | Analysis | plant | 7 | 10 | 6 | Pass |
| TEEP & Utilization | Executive | plant | 6 | 5 | 1 | Pass |
| Line Performance Board | Line | line | 7 | 6 | 1 | Pass |
| Shift Huddle Board | Shift | line | 6 | 5 | 0 | Pass |
| Machine Station Detail | Machine | machine | 7 | 6 | 0 | Pass |
| Production & Pace | Analysis | line | 8 | 4 | 0 | Pass |
| Quality & Yield Lab | Analysis | line | 8 | 9 | 6 | Pass |
| Downtime Detective | Analysis | line | 8 | 5 | 0 | Pass |
| Setup & Changeover | Analysis | line | 6 | 3 | 0 | Pass |
| Supervisor Cockpit | Line | line | 6 | 5 | 0 | Pass |
| Operator Kiosk | Kiosk | machine | 5 | 5 | 1 | Pass — denser headlines |
| Line Andon Wall | Kiosk | line | 6 | 5 | 1 | Pass — no marquee/shift strip |
| Maintenance Wallboard | Kiosk | plant | 7 | 6 | 4 | Pass — bars + one trend |
| Attainment Tracker | Production | line | 6 | 5 | 0 | Pass |
| Shift Compare | Shift | line | 9 | 6 | 1 | Pass |

## v7.2 changes from v7.1

| Change | Detail |
|--------|--------|
| Presentation seeds | `ring` / `bar` / `number` on KPI, reliability, quality, and OEE-hero tiles |
| Operator Kiosk | Dropped traffic light + shift strip → 5 headline widgets |
| Line Andon Wall | Dropped marquee + shift strip → andon + OEE + traffic + downtime + fault |
| Maintenance Wallboard | Dropped marquee/cluster/top-faults/event-feed → MTTR/MTBF bars + unassigned + reliability trend |
| Preview assets | Real PNG crops replace abstract SVGs |
| Meta counts | `systemTemplateMeta.ts` widgetCounts match seed |
| Stale detection | `isSystemLayoutStale` fingerprints include v7.2 kiosk shapes |

## Migration

1. Deploy v7.2 → startup upserts `LayoutJson` for all 18 system templates
2. **Dashboards → Refresh layouts** (or `POST /api/dashboards/refresh-system-layouts`)
3. Floor monitors: `/present/:id` or `/kiosk/:id`

## Capture commands

```bash
node scripts/check-templates.mjs
node scripts/qa-templates-live.mjs
node scripts/capture-template-screenshots.mjs        # → docs/template-screenshots/v7.2
# Promote light crops:
# copy docs/template-screenshots/v7.2/{slug}-light.png → frontend/public/template-previews/{slug}.png
```

**Exit criteria met:** 18/18 row budget + light/dark gallery QA; curated presentations; denser kiosks; PNG previews; accurate meta; docs synced.
