# ConnectOEE Help Center outline — July 2026

Draft article map for an in-suite Help Center. Wire each article to the live-PLC commission screenshot pack under [`docs/commissioning-screenshots/2026-07-11-live-plc/`](../commissioning-screenshots/2026-07-11-live-plc/).

## Getting started

| Article | Audience | Screenshot anchors |
|---------|----------|-------------------|
| First install & Create administrator | Admin | `01-wizard-bootstrap.png` |
| Create your plant | Admin | `02-plant.png` |
| Guided setup wizard (10 steps) | Admin / Supervisor | `01`–`02`, wizard progress chrome |
| Run setup wizard again | Admin | Admin → Run setup wizard |

## Plant & hierarchy

| Article | Audience | Screenshot anchors |
|---------|----------|-------------------|
| Plants, departments, lines, machines | Admin | `03-hierarchy-full.png` |
| Continuous vs Independent lines | Admin / Engineer | `10-explorer-beverage-live.png`, `11-explorer-molding-independent.png` |
| Ideal rate & OEE targets | Admin | Hierarchy line OEE panel (follow-up shot) |

## PLC & tags

| Article | Audience | Screenshot anchors |
|---------|----------|-------------------|
| Add a Rockwell EtherNet/IP connection | Admin | `04-plc-connect.png` |
| Test connection & browse tags | Admin / Engineer | `04`, `05-tag-browse-mapped.png` |
| Map Run State & Good Count (required) | Admin / Engineer | `05` |
| Optional tags: Reject, Fault, PartId | Admin / Engineer | `05`, TAG_MAP |
| Commissioning readiness checklist | Admin | `13-system-commissioning-ready.png` |

## Live operations

| Article | Audience | Screenshot anchors |
|---------|----------|-------------------|
| Plant Explorer cockpit | Supervisor / Manager | `09`, `10`, `11` |
| Operator Station grid & reasons | Operator | `12-operator-grid.png` |
| Dashboards & kiosks | All | `06-dashboards-list.png` |
| Auto-created products (PLC PartId) | Manager | Admin → Recipes → Auto-created review |

## Shifts & products

| Article | Audience | Notes |
|---------|----------|-------|
| Shift patterns & assignments | Admin | Wizard step / Admin → Shifts |
| Product catalog & line speeds | Manager | Recipes tabs; Independent = per-line speeds |

## Suggested IA

1. **Setup** — install, wizard, hierarchy, PLC, tags, shifts  
2. **Operate** — Explorer, Operator, dashboards/kiosks  
3. **Analyze** — Analytics, reports  
4. **Administer** — users, license, System commissioning, backups  

Priority for first Help Center MVP: Setup (wizard → PLC → tags → commissioning ready) + Operate (Explorer + Operator).
