# 11 - WYSIWYG Dashboard Builder

A full drag-and-drop dashboard designer.

## Editing experience

- Drag-and-drop layout editing.
- Resize widgets with handles.
- Snap-to-grid + alignment guides.
- Responsive + touch-friendly.

## Widget library

The full comprehensive widget library (see 10), surfaced via an extensible widget registry so new widget types appear in the builder automatically.

## Data binding panel

- Bind to PLC tags, UDT members, logical signals, KPIs, aggregates, shift data.
- Live value preview while binding.
- Threshold/alarm configuration, units, colors, refresh.

## Templates

- Gallery to browse/preview/apply the prebuilt templates (see 10).
- "Save as template" from any dashboard.
- Placeholder re-binding when applying a template to a target line/machine/plant.
- Clone-from-template.

## Dashboard lifecycle

- Permissions: private, role-restricted, or public/kiosk.
- Autosave + version history (`DashboardVersion`) with rollback.
- Draft vs published mode.
- Real-time rendering engine (same engine used by live dashboards/kiosk).

## Permissions

- Admins/Supervisors build dashboards.
- Supervisors can delete only dashboards they created.
- Tag browsing for binding gated to Admin/Supervisor.
