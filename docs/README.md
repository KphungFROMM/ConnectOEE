# ConnectOEE Documentation

This folder is the single source of truth for the ConnectOEE design and build plan. It is split into focused markdown files so the knowledge is portable across every computer you use (synced via git) and easy for AI agents to load selectively.

Start with the root [AGENTS.md](../AGENTS.md) for the high-level summary and locked decisions.

## Index

| File | Topic |
| --- | --- |
| [01-product-overview-ux.md](01-product-overview-ux.md) | Product goals and intuitive UX principles |
| [02-tech-stack.md](02-tech-stack.md) | Tech stack choices and justification |
| [03-architecture.md](03-architecture.md) | System architecture, modules, project layout |
| [04-data-model.md](04-data-model.md) | Database entities and relationships |
| [05-rbac-security-audit.md](05-rbac-security-audit.md) | Roles, permissions, plant scoping, audit logging |
| [06-oee-engine-metrics.md](06-oee-engine-metrics.md) | OEE math + reliability/downtime metrics |
| [07-shift-configuration.md](07-shift-configuration.md) | Shift patterns, calendar, runtime handling |
| [08-plc-drivers-udt.md](08-plc-drivers-udt.md) | Driver abstraction, mock + Rockwell, UDT support |
| [09-tag-browser-mapping.md](09-tag-browser-mapping.md) | Live tag browser and tag mapping UI |
| [10-dashboards-widgets-templates.md](10-dashboards-widgets-templates.md) | Widget library and ready-to-go templates |
| [11-wysiwyg-builder.md](11-wysiwyg-builder.md) | WYSIWYG dashboard builder |
| [BUILDER-GALLERY-2026-07.md](BUILDER-GALLERY-2026-07.md) | Builder live gallery + intuition spike (Jul 2026) |
| [12-historian-query-reporting.md](12-historian-query-reporting.md) | Historian, query engine, reporting |
| [13-startup-wizard.md](13-startup-wizard.md) | Guided startup wizard |
| [14-roadmap-phases.md](14-roadmap-phases.md) | Phased build roadmap (sequencing source of truth) |
| [15-commissioning-qa.md](15-commissioning-qa.md) | Greenfield commissioning matrix and verification gate |
| [COMMISSION-REPORT-2026-07-11-live-plc.md](COMMISSION-REPORT-2026-07-11-live-plc.md) | Live PLC greenfield commission @ 192.168.1.21 (Jul 2026) |
| [SNAPSHOT-KIT-2026-07.md](SNAPSHOT-KIT-2026-07.md) | Exhaustive UI snapshot kit (auth→admin + galleries) for Help/brochure/QA |
| [snapshot-kit-2026-07/README.md](snapshot-kit-2026-07/README.md) | Snapshot pack folder index + re-run instructions |
| [help-center/OUTLINE-2026-07.md](help-center/OUTLINE-2026-07.md) | Help Center article outline wired to commission screenshots |
| [brochure/ConnectOEE-brochure.html](brochure/ConnectOEE-brochure.html) | Product brochure (print → PDF) — features, drivers, WYSIWYG builder |
| [brochure/ConnectOEE-brochure-draft.md](brochure/ConnectOEE-brochure-draft.md) | Brochure copy outline + figure map (light UI screenshots throughout) |
| [16-factory-deployment-security.md](16-factory-deployment-security.md) | Factory floor TLS, network, secrets, security commissioning |
| [17-licensing.md](17-licensing.md) | Offline license keys, trial limits, activation |
| [MOVING-TO-ANOTHER-PC.md](MOVING-TO-ANOTHER-PC.md) | How to continue the project on a different computer |
| [COMMISSION-BUILDER-2026-07.md](COMMISSION-BUILDER-2026-07.md) | Builder DnD + widget gallery commission (Jul 2026) |
| [WIDGET-AUDIT-2026-07.md](WIDGET-AUDIT-2026-07.md) | Widget visual audit gallery results |
| [WIDGET-COMMISSION-2026-07.md](WIDGET-COMMISSION-2026-07.md) | Full 111-widget commission summary (Jul 2026) |
| [WIDGET-COMMISSION-SCORECARD-2026-07.md](WIDGET-COMMISSION-SCORECARD-2026-07.md) | Pass/Fix/Defer scorecard for all widget types |
| [BEST-IN-CLASS-FINISH-2026-07.md](BEST-IN-CLASS-FINISH-2026-07.md) | Nesting + write sandbox + template prove-out |
| [WIDGET-LIBRARY-INVENTORY-2026-07.md](WIDGET-LIBRARY-INVENTORY-2026-07.md) | Full catalog coverage + flavor matrix |
| [WIDGET-REDESIGN-2026-07.md](WIDGET-REDESIGN-2026-07.md) | Full-library visual redesign sign-off |
| [WIDGET-VISUAL-LANGUAGE-2026-07.md](WIDGET-VISUAL-LANGUAGE-2026-07.md) | Wall hierarchy + calm/alert chrome rules (v8) |
| [TEMPLATE-INVENTORY-2026-07.md](TEMPLATE-INVENTORY-2026-07.md) | Pre–v7.2 template baseline inventory |
| [TEMPLATE-AUDIT-2026-07-v7.2.md](TEMPLATE-AUDIT-2026-07-v7.2.md) | Retired v7.2 template audit (historical) |
| [TEMPLATE-AUDIT-2026-07-v8.md](TEMPLATE-AUDIT-2026-07-v8.md) | v8 curated catalog QA + screenshot index |
| [TEMPLATE-AUDIT-2026-07-v9.md](TEMPLATE-AUDIT-2026-07-v9.md) | v9 nesting prove-out (Operator Floor / Line Andon) |
| [PLANT-EXPLORER-REDESIGN-2026-07.md](PLANT-EXPLORER-REDESIGN-2026-07.md) | Plant Explorer breadcrumb/drill-grid reimage + shared primitive refresh |

## How to use

- When implementing a feature, read the matching doc first, then the roadmap ([14-roadmap-phases.md](14-roadmap-phases.md)) for sequencing.
- When scope or behavior changes, update the relevant doc in the same change so memory stays accurate everywhere.
- Keep these docs implementation-agnostic enough to remain valid as code evolves, but specific enough to guide decisions.

## Cross-machine sync

These docs live in the repo. To carry memory between computers, commit and push them to a shared git remote, then pull on each machine. The root `AGENTS.md` is auto-loaded by Cursor as project context on any machine.
