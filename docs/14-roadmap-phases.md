# 14 - Phased Build Roadmap

Each phase is independently demoable and ends in a working vertical slice. Phase numbers in parentheses map to the original 18 implementation steps. This file is the source of truth for sequencing.

- **Phase 0 - Foundation:** monorepo, .NET solution + Vite app, `docker-compose` (Postgres+Timescale) for dev, config/secrets, logging (Serilog), health checks, design-system tokens + dark/light shell built from the ConnectOEE color scheme (see branding in 01: neutral surfaces + blue accent + green/amber/red status colors). Import the official app icon into the repo (favicon + sizes + report-header copy) and wire it into the app shell.
- **Phase 1 - Data model & migrations:** EF Core entities for all groups (see 04), initial migration, TimescaleDB hypertable + continuous-aggregate setup, seed script. (Step 18 + data model)
- **Phase 2 - Auth & RBAC & audit:** Identity + JWT, roles/permissions, plant scoping, audit logging service + middleware (see 05). (Steps 4, 17)
- **Phase 3 - Driver layer + Mock + real-time:** `IPlcDriver` abstraction, Driver Manager, Mock/Simulator driver, ingestion pipeline into hypertables, SignalR live tag/value push, graceful comm-loss + connection-state surfacing (see 08). (Steps 6, 10 foundation)
- **Phase 4 - OEE engine, shift handling & events:** A/P/Q + OEE + TEEP math, full reliability/downtime metric set (see 06), shift resolver + shift-boundary handling (see 07), production runs, downtime detection + Six Big Losses, fault occurrences, state transitions. (Step 11 backend)
- **Phase 5 - Live dashboards (templated) + Plant Explorer:** Line + Plant dashboards from the prebuilt template library (see 10) with gauges/tiles/trends, real-time via SignalR, drill-down plant->dept->line->machine, operator downtime reasoning entry. Includes the dedicated **Plant Explorer** hierarchy navigation page (tree + per-node KPI view) for Admin/Manager/Supervisor (see 10, scope rules in 05). (Steps 10, 11 UI)
- **Phase 6 - Guided startup wizard + shift admin:** 10-step re-runnable wizard (see 13); Step 8 shift config + standalone Admin Shifts screen; Step 10 auto-generates ready-to-go dashboards. (Step 5)
- **Phase 7 - Historian & query engine:** rollups, retention/archiving tiers, time-range/custom/aggregation/drill-through query API (see 12). (Step 13)
- **Phase 8 - Analysis & reporting:** downtime Pareto/top-reasons, production-vs-target, scrap/reject trends, daily shift + on-demand reports, CSV/PDF export with branding (logo/header/footer), prebuilt report templates + an optional WYSIWYG report designer, scheduled reports via SMTP email or file drop with run history (see 12). (Step 12)
- **Phase 9 - UDT & live tag browser & mapping UI:** UDT/nested/array parsing, hierarchical virtualized tree, live preview w/ quality+timestamp, search/filter, metadata panel, bind tag->logical signal, manual-entry fallback, Admin/Supervisor gating (see 08, 09). (Steps 7, 8, 9)
- **Phase 10 - WYSIWYG builder & kiosk:** drag/resize/snap grid, full widget library via extensible registry, data-binding panel, template gallery + save/apply, autosave + version history, draft/published, real-time render engine, anonymous kiosk mode (see 10, 11). (Steps 14, 15)
- **Phase 11 - Rockwell driver (libplctag):** real ControlLogix/CompactLogix read/write (start permissive, reset/ack), UDT enumeration, smart fault-code mapping, multi-PLC per line (see 08). (Step 6 real + fault mapping)
- **Phase 12 - Admin screens & packaging:** remaining admin config UIs, Windows Service packaging + installer, single-port local serving, retention/backup ops, final hardening. (Step 16)

## Cross-cutting principles

- Modular driver + historian + reporting interfaces for extensibility (new drivers/plants/widgets).
- Comment only non-obvious industrial/OEE logic (loss attribution, ideal-rate math, fault-debounce, shift-boundary handling).
- Connection/stale/updating state always surfaced in UI; role + plant/line context always visible.
- Every phase ships migrations so the DB is always upgradable.

## Open items to confirm at build time (non-blocking)

- Component library: default Mantine (vs shadcn/ui).
- PDF library: QuestPDF.
- Breaks excluded from available time by default; crew/rotation model optional/deferrable.
