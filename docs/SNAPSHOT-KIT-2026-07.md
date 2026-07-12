# Snapshot Kit 2026-07 — summary

Complete ConnectOEE UI snapshot pack for Help Center / brochure / QA, captured against the live **Connect Demo Plant** at PLC `192.168.1.21` (no plant wipe).

## Deliverables

- Pack root: [`snapshot-kit-2026-07/`](snapshot-kit-2026-07/)
- Checklist + status: [`snapshot-kit-2026-07/INDEX.csv`](snapshot-kit-2026-07/INDEX.csv)
- Human index: [`snapshot-kit-2026-07/README.md`](snapshot-kit-2026-07/README.md)
- Resolved IDs: [`snapshot-kit-2026-07/ids.json`](snapshot-kit-2026-07/ids.json)

## Counts

| Bucket | Count |
| --- | --- |
| INDEX pass | 89 |
| INDEX skip | 4 |
| INDEX blocked | 0 |
| Auth / wizard / dashboards / kiosk / explorer / operator / analytics / reports / builder / admin / modals PNGs | ~87 |
| Widget gallery PNGs (light+dark) | 222 (111 × 2) |
| Template gallery PNGs (light+dark) | 18 |
| **Total PNGs** | **~327** |

## Theme policy

- Every unique screen: **light**
- Dark heroes: login, dashboards hub, explorer Beverage line, operator grid, analytics plant overview, builder edit, admin hierarchy, Beverage Andon kiosk
- Galleries: both themes via scripts

## Blocked / skipped

Nothing blocked. Skips are expected seed/license/UI-condition gaps:

1. MFA / must-change-password login states (not active for `admin`)
2. Trial banner (licensed install)
3. Builder **Widget** properties tab (only for widgets with option editors)

## Capture scripts

| Script | Role |
| --- | --- |
| [`scripts/capture-snapshot-kit.mjs`](../scripts/capture-snapshot-kit.mjs) | Main page tour → folders `01`–`12` + `INDEX.csv` |
| [`scripts/capture-snapshot-kit-gaps.mjs`](../scripts/capture-snapshot-kit-gaps.mjs) | Hub chips, builder property tabs, explicit skip rows |
| [`scripts/capture-widget-screenshots.mjs`](../scripts/capture-widget-screenshots.mjs) | `OUT_DIR=…/11-dev-galleries/widgets` |
| [`scripts/capture-template-screenshots.mjs`](../scripts/capture-template-screenshots.mjs) | `OUT_DIR=…/11-dev-galleries/templates` |

Navigation uses `domcontentloaded` (not `networkidle`) so SignalR live pages do not hang.

## Relation to commissioning pack

[`commissioning-screenshots/2026-07-11-live-plc/`](commissioning-screenshots/2026-07-11-live-plc/) remains the thin greenfield commission slice (~11 UI shots). This kit is the exhaustive product surface pack for the same plant.

## Product brochure

Sales brochure built from this kit (light UI screenshots throughout; Dark mode noted in copy only):

- [`brochure/ConnectOEE-brochure.html`](brochure/ConnectOEE-brochure.html) — open in browser → Print → Save as PDF
- [`brochure/ConnectOEE-brochure-draft.md`](brochure/ConnectOEE-brochure-draft.md) — editable copy outline
