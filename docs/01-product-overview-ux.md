# 01 - Product Overview & UX Principles

## Product goal

A modern, intuitive, browser-based OEE Accelerator platform providing:

- Real-time OEE (Availability, Performance, Quality) and rich KPI visualization (gauges, tiles, charts, trends).
- Line dashboards and plant dashboards.
- Downtime detection with optional operator reasoning entry.
- Daily shift reports and on-demand reports.
- Multi-line, multi-department, multi-plant support.
- Role-based access for admins, supervisors, operators, managers.
- PLC connectivity (initial: Rockwell EtherNet/IP) with optional write-back (start permissive, reset, acknowledge).
- Smart fault code detection and mapping.
- Guided startup wizard for new installations.
- Kiosk dashboards requiring no login.
- WYSIWYG drag-and-drop dashboard builder.
- Full Rockwell UDT support across all layers.
- Intuitive live tag browsing when the driver supports it.
- Full historical OEE storage, querying, and reporting.

All UI runs in a web browser. There is no desktop UI.

## Deployment requirements

- Runs fully on-prem on Windows Server or Windows PC.
- Self-hosted backend + database; web UI served locally (`http://server:port`).
- No cloud dependency required.
- Must support future scaling to multiple plants/sites.

## Intuitive UX principles (required)

Design philosophy - the system must feel intuitive, predictable, and effortless:

- Zero learning curve for operators; minimal for supervisors; guided structured workflows for admins.
- Clean, modern, uncluttered UI with high contrast for industrial environments.
- Touch-friendly controls; smooth animations and transitions.
- Clear hierarchy and visual grouping; consistent spacing, typography, and color system.
- Dark mode + light mode.
- Always show context (breadcrumbs, headers, labels).
- Always show system state (connected, disconnected, stale, updating).
- Always show user state (role, permissions, plant/line selection).

These principles are the top priority and apply to every screen, widget, report, and wizard step.

## Branding - App icon

The official ConnectOEE app icon was provided by the user and must be used consistently everywhere.

- Source asset (provided): `.cursor/projects/c-Users-Admin-Projects-ConnectOEE/assets/c__Users_Admin_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_app-icon-481a28ca-5180-44dc-b9e3-f0371c61cf5c.png`
- During Phase 0, copy it into the repo as the canonical brand asset (planned: `frontend/public/app-icon.png` + generated `favicon.ico`, and a backend copy for report headers) so the app no longer depends on the `.cursor` path.
- Use it for: browser favicon and PWA/tab icon, app header/top-bar logo, login screen, the guided startup wizard header, kiosk/Andon screens, the Windows Service/app identity, and PDF report header/footer branding.
- Provide light/dark-friendly placement (padding/background) so it reads well in both themes and on high-contrast industrial displays. Generate standard sizes (16/32/48/180/512) during Phase 0.

## Branding - Color scheme

The product is branded **ConnectOEE**. A reference screenshot (a sibling "Connect" app) was provided as a **color-scheme reference only - not a layout reference**. Our navigation/layout decisions (e.g. the Plant Explorer hierarchy, dashboards) stand on their own; only the palette/feel below is derived from it: clean, professional, minimal enterprise - white canvas, light-gray surfaces, a blue primary accent, muted gray text, subtle borders, and soft-blue informational highlights.

These become the design tokens defined in Phase 0 (`frontend/theme/`). Hex values are an approximation of the reference and may be fine-tuned, but the intent (neutral surfaces + single blue accent + clear status colors) is fixed.

### Light theme (default)
- App canvas background: `#FFFFFF`
- Sidebar / sunken surface: `#F4F5F7`
- Card / panel surface: `#FFFFFF`
- Border / divider: `#E3E5E8`
- Primary accent (brand blue): `#2563EB` (hover `#1D4FD7`)
- Selected/active nav background: `#E8F0FE` with blue text
- Info banner background: `#EAF2FE`, border `#CFE0FB`
- Text primary: `#1F2329`
- Text secondary / muted: `#6B7280`
- Section label (uppercase, small): `#9097A1`

### Dark theme
- App canvas background: `#121417`
- Sidebar / sunken surface: `#1A1D21`
- Card / panel surface: `#20242A`
- Border / divider: `#2C313A`
- Primary accent (brand blue): `#4C8DFF` (hover `#6BA1FF`)
- Selected/active nav background: `#1E2A44` with light-blue text
- Info banner background: `#16233B`, border `#274063`
- Text primary: `#E6E9ED`
- Text secondary / muted: `#9BA3AE`

### Status / industrial state colors (both themes, high-contrast)
- Running / good / connected: green `#2E9E5B`
- Warning / stale / reduced speed: amber `#E0A800`
- Fault / stopped / disconnected: red `#D64545`
- Idle / planned-down / neutral: gray `#8A929E`
- Info / selected: brand blue (as above)

These status colors are used consistently for line/machine status lights, Andon widgets, connection indicators, gauge thresholds, and KPI alarm coloring so meaning is uniform everywhere.

### KPI factor identity colors (Admin-configurable)
Default shipped tokens (OEE teal, Availability blue, Performance indigo, Quality grape) live in `frontend/src/theme/tokens.ts` as `oeeFactorColors`. Site admins can override them under **Admin → Appearance**; values persist in `AppearanceSettings` and apply to rings, waterfalls, and explorer loss charts. Widget **By value** band mode is separate and still uses performance tiers vs `targetOeePct`.

**Status / Andon colors** (same tab): running, warning, fault, and idle hex overrides for line lights, Andon stacks, connection indicator mapping, and KPI band alerts. Defaults match `defaultStatusColors` in `tokens.ts`; live values are applied via `statusColorsRuntime`.

**Header branding** (same Admin → Appearance tab): optional custom header title and logo (upload). Empty title/logo keep the product defaults (`ConnectOEE` + `/app-icon.png`). The authenticated shell always shows a **ConnectOEE** mark in the navigation sidebar; when the title is customized, **ConnectOEE** also appears muted under the header title. Login and wizard keep product branding.

## Plant Explorer vs Analytics

- **Plant Explorer** is the live operational cockpit: current shift, SignalR machine snapshots, time-balance donut (uptime vs downtime), OEE waterfall, and recent downtime events. Default view is shift-to-date with optional last-8h toggle.
- **Line topology** (Admin → Hierarchy): **Independent** lines roll up machines as parallel peers; **Continuous** lines show a Continuous badge and use the designated **output** station for line good/reject (and pacing for performance). Explorer tree KPIs, dashboards, historian, and closed shifts share the same rollup rules.
- **Analytics** is the historical analysis workspace: longer ranges, compare periods, exports, supervisor reason correction, and full tabbed drill-down.
- Both share chart components (OEE trend, loss pareto, production) but Explorer prioritizes **live-now** metrics in the hero row; Analytics prioritizes range comparison and reporting.
