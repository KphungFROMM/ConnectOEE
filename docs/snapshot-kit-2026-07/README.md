# ConnectOEE Snapshot Kit — July 2026

Exhaustive UI screenshot pack against the live **Connect Demo Plant** (PLC `192.168.1.21`). Use for Help Center, brochure, QA, and regression visual checks.

## Quick facts

| Metric | Value |
| --- | --- |
| Capture date | 2026-07-11 |
| Plant | Connect Demo Plant (`ids.json`) |
| INDEX rows | 89 pass / 4 skip / 0 blocked |
| Page/modal PNGs | ~87 (folders `01`–`10`, `12`) |
| Gallery PNGs | 222 widgets + 18 templates under `11-dev-galleries/` |
| Themes | All unique screens in **light**; product heroes also **dark** |

## Folder map

| Folder | Contents |
| --- | --- |
| `01-auth/` | Login light + dark |
| `02-wizard/` | Wizard steps 1–10 |
| `03-dashboards/` | Hub (+ filters), live dashboard views |
| `04-kiosk-present/` | Beverage Andon kiosk light/dark + present chrome |
| `05-explorer/` | Fleet → plant → dept → lines → machine + tabs |
| `06-operator/` | Grid (+ dark) + Filler detail |
| `07-analytics/` | Plant / Beverage / Filler scopes |
| `08-reports/` | Generate, history, schedules, delivery, custom |
| `09-builder/` | Blank, edit (+ dark), preview, properties, templates, history |
| `10-admin/` | Every admin tab (+ hierarchy dark) |
| `11-dev-galleries/` | Full widget + template packs (light/dark) |
| `12-modals/` | Help drawer, reason assign, tag picker, PLC edit, apply template |

## Index

Machine-readable: [`INDEX.csv`](INDEX.csv) — columns `slug,route,file,theme,status,notes`.

Live entity IDs used for capture: [`ids.json`](ids.json).

## Skips (intentional)

| Slug | Reason |
| --- | --- |
| `login-mfa` | Seed `admin` has no MFA challenge |
| `login-must-change-password` | Admin password already set |
| `trial-banner` | Active/Personal license — trial banner not shown |
| `builder-properties-widget` | Widget options tab only appears for types with option editors |

## How to re-run

Prerequisites: API `:5080`, Vite `:5173`, Postgres up, plant commissioned.

```bash
# Core page / modal pack (+ INDEX.csv rewrite)
node scripts/capture-snapshot-kit.mjs

# Fill hub chips / builder property tabs / explicit skip rows
node scripts/capture-snapshot-kit-gaps.mjs

# Dev galleries into this kit
set OUT_DIR=docs/snapshot-kit-2026-07/11-dev-galleries/widgets
node scripts/capture-widget-screenshots.mjs

set OUT_DIR=docs/snapshot-kit-2026-07/11-dev-galleries/templates
node scripts/capture-template-screenshots.mjs
```

Optional env: `BASE_URL`, `API_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `AUDIT_TOKEN`.

See also: [`../SNAPSHOT-KIT-2026-07.md`](../SNAPSHOT-KIT-2026-07.md).
