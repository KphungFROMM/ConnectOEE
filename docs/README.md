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
| [12-historian-query-reporting.md](12-historian-query-reporting.md) | Historian, query engine, reporting |
| [13-startup-wizard.md](13-startup-wizard.md) | Guided startup wizard |
| [14-roadmap-phases.md](14-roadmap-phases.md) | Phased build roadmap (sequencing source of truth) |
| [15-commissioning-qa.md](15-commissioning-qa.md) | Greenfield commissioning matrix and verification gate |
| [16-factory-deployment-security.md](16-factory-deployment-security.md) | Factory floor TLS, network, secrets, security commissioning |
| [17-licensing.md](17-licensing.md) | Offline license keys, trial limits, activation |
| [MOVING-TO-ANOTHER-PC.md](MOVING-TO-ANOTHER-PC.md) | How to continue the project on a different computer |

## How to use

- When implementing a feature, read the matching doc first, then the roadmap ([14-roadmap-phases.md](14-roadmap-phases.md)) for sequencing.
- When scope or behavior changes, update the relevant doc in the same change so memory stays accurate everywhere.
- Keep these docs implementation-agnostic enough to remain valid as code evolves, but specific enough to guide decisions.

## Cross-machine sync

These docs live in the repo. To carry memory between computers, commit and push them to a shared git remote, then pull on each machine. The root `AGENTS.md` is auto-loaded by Cursor as project context on any machine.
