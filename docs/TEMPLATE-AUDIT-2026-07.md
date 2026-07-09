# Template Audit — v7.1 (July 2026)

Visual QA for the **System Dashboard Templates v7.1** wall-fit catalog. All templates must fit a 1080p viewport without scroll when rendered via `wallFit` mode.

## Harness

- Route: `/dev/templates` (requires `BuildDashboards` permission)
- Frame: fixed 16:9 wall frame (`profileContentHeight`), `DashboardRenderer displayMode="wallFit"`, `overflow: hidden`
- Mock data: audit API mode ON (historian widgets show meaningful charts)
- Toggle: app header dark mode + per-page Light/Dark segmented control
- Each card shows **row budget badge** (`maxRow/8` kiosk or `maxRow/9` plant wall)

## Viewport-fit checklist

| Check | Pass criteria |
|-------|---------------|
| Row budget | Kiosk templates ≤ 8 rows; all others ≤ 9 rows |
| No scroll | Template preview container has `overflow: hidden`; no vertical scrollbar at 1080p |
| Readable density | Dynamic row height ≥ profile minimum (64px plant, 72px kiosk) |
| Floor routes | `/present/:id` and `/kiosk/:id` use same `wallFit` renderer |
| Builder guide | Dashed budget line + overflow shading when editing over profile |

## Gallery captures

Capture at **1920×1080** from `/dev/templates` (browser full-screen or devtools device mode):

| Mode | File |
|------|------|
| Light (full page) | [gallery-light.png](template-screenshots/v7.1/gallery-light.png) |
| Dark (full page) | [gallery-dark.png](template-screenshots/v7.1/gallery-dark.png) |

Per-template crops (optional): `docs/template-screenshots/v7.1/{slug}-light.png`, `{slug}-dark.png`.

## v7.1 catalog (18 system templates)

| Template | Category | Scope | Rows | Widgets | Recommended | QA status |
|----------|----------|-------|------|---------|-------------|-----------|
| Plant Command Center | Plant | plant | 9 | 9 | Yes | Pass — wall-fit hero + strip + grid |
| Executive Briefing | Executive | plant | 9 | 7 | Yes | Pass — compact executive stack |
| Floor At-a-Glance | Plant | plant | 9 | 4 | — | Pass — full-width machine-grid |
| Plant Reliability Hub | Analysis | plant | 7 | 10 | — | Pass — timer + unassigned + charts |
| TEEP & Utilization | Executive | plant | 6 | 5 | — | Pass — 6-row compact |
| Line Performance Board | Line | line | 7 | 6 | Yes | Pass — hero + gap + timeline |
| Shift Huddle Board | Shift | line | 6 | 5 | — | Pass — pace + hourly + pareto |
| Machine Station Detail | Machine | machine | 7 | 6 | — | Pass — recipe strip + speed trend |
| Production & Pace | Analysis | line | 8 | 4 | — | Pass — wide production vs target |
| Quality & Yield Lab | Analysis | line | 8 | 9 | — | Pass — scrap trend + losses-donut |
| Downtime Detective | Analysis | line | 8 | 5 | Yes | Pass — pareto + heatmap |
| Setup & Changeover | Analysis | line | 6 | 3 | — | Pass — 6-row state focus |
| Supervisor Cockpit | Line | line | 6 | 5 | — | Pass — downtime pad + top-N |
| Operator Kiosk | Kiosk | machine | 7 | 6 | Yes | Pass — kiosk density, ≤8 rows |
| Line Andon Wall | Kiosk | line | 7 | 7 | — | Pass — andon + marquee |
| Maintenance Wallboard | Kiosk | plant | 8 | 7 | — | Pass — MTTR/MTBF kiosk wall |
| Attainment Tracker | Production | line | 6 | 5 | — | Pass — attainment + pace |
| Shift Compare | Shift | line | 9 | 6 | — | Pass — 9-row shift compare |

## v7.1 changes from v7

| Change | Detail |
|--------|--------|
| Row compaction | All templates reimagined to ≤8/9 rows (was 11–25 rows) |
| Section labels | Standalone `text-label` rows removed |
| Shared renderer | `DashboardRenderer wallFit` + `viewportGrid.ts` for kiosk and presentation |
| Presentation route | `/present/:id` for published floor TVs |
| Builder profiles | Wall 1080p / Kiosk 1080p / Freeform with overflow warnings |
| Stale detection | `isSystemLayoutStale` checks row budget + v7.1 widget fingerprints |

## Migration (existing installs)

1. Deploy v7.1 → startup upserts compact `LayoutJson` for all 18 system templates
2. Admin: **Dashboards → Refresh layouts** once (or `POST /api/dashboards/refresh-system-layouts`)
3. Floor monitors: use **Open presentation** or kiosk link instead of signed-in scroll view

## Preview assets

- Gallery thumbnails: `frontend/public/template-previews/{slug}.svg`
- Full captures: `docs/template-screenshots/v7.1/`

**Exit criteria:** All templates render in `/dev/templates` with mock data inside 1080p wall frame; row badges green; light + dark gallery captures committed; zero open blockers.

## QA run — 2026-07-09

API restart required to upsert v7.1 compact layouts (`16 updated` on startup). After upsert, automated DOM audit on `/dev/templates` confirmed:

| Result | Detail |
|--------|--------|
| **18/18 pass row budget** | All kiosk ≤ 8 rows; all plant/line ≤ 9 rows |
| **0 frame overflow** | Every wall frame `scrollHeight === clientHeight` |
| **Screenshots** | `gallery-light.png`, `gallery-dark.png`, plus `{slug}-light.png` / `{slug}-dark.png` for all 18 system templates |

Capture command (requires dev server + API):

```bash
node scripts/capture-template-screenshots.mjs        # light + dark
node scripts/capture-template-screenshots.mjs dark   # dark only
```
