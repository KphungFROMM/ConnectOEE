# 11 - WYSIWYG Dashboard Builder



A full drag-and-drop dashboard designer at `/builder` and `/builder/:id`.



## Editing experience



- **Drag-and-drop** from categorized widget palette onto a 12-column grid. Palette → canvas uses **native HTML5 drop** on the scroll shell (ConnectReports-style); in-canvas move/resize uses `react-grid-layout`. Drag type is held in React state during dragover (do not rely on `dataTransfer.getData` until drop).

- **Scroll-safe canvas** — outer shell scrolls in **Freeform** profile; drop coordinates include `scrollTop`/`scrollLeft` via `pointerToGridCell` so palette drops work on long canvases.

- **Display profiles** (`displayProfiles.ts`) — toolbar segmented control:

  | Profile | Max rows | Use |
  |---------|----------|-----|
  | **Wall 1080p** | 9 | Plant/line floor boards (default for most templates) |
  | **Kiosk 1080p** | 8 | Operator kiosk, andon, maintenance wallboards |
  | **Freeform** | none | Draft editing; scroll OK while designing |

  Dashed blue line on the canvas marks the profile row budget (labeled e.g. “Wall 1080p budget — 9 rows”); content below is shaded red when over budget (warning only — save is not blocked). Row budget badge in toolbar shows e.g. `12 rows · exceeds 9-row wall budget`.

- **Preview mode** and **wall/kiosk edit** share the same scaled stage (`WALL_STAGE_MAX_WIDTH`, content aspect from the display profile — not a conflicting `aspectRatio` + fixed height). Both use `wallFitRowCount` + `computeWallRowHeight` so sparse boards keep budget cell size (empty band at bottom) instead of stretching; over-budget boards shrink the same way as floor `wallFit`.

- **Full-widget drag** (default) — drag anywhere on the widget surface; title-bar-only mode available in builder settings (widget body stays interactive when title-bar-only is on).

- **Resize** widgets with corner handles (`react-resizable` CSS imported); **move** via drag handle strip or full surface.

- **Snap-to-grid** with vertical compaction and collision prevention for in-canvas moves.

- **Click-to-add** from palette appends below the lowest widget (`clickAddPosition`).

- **Drop-at-cursor** — palette drags land at the pointer grid cell (not `0,0`), with a dashed drop preview while dragging.

- **Palette** — visual-family grouping (OEE, Downtime, Production, Status), distinct Tabler icons per widget, drag ghost with grid size label, and metric search.

- **Widget Audit Gallery** — dev route `/dev/widgets` renders all catalog types with mock snapshot + audit API data for visual QA (light/dark toggle).

- **Preview mode** toggles in-place **wall-fit** rendering via the same stage geometry and row-height math as edit (`DashboardRenderer` `wallFit`).

- **Undo / redo** (toolbar + `Ctrl+Z` / `Ctrl+Shift+Z`).

- **Duplicate** (`Ctrl+D`), **delete** (`Del`), **arrow-key nudge** (hold `Shift` to resize).

- Full-viewport layout (palette · canvas · properties).

- Touch-friendly handles; dark/light aware.

- Small tiles (≤2×3 grid cells) enforce a minimum editor height so KPI content is not clipped.



## Widget library



The full widget library (see [10](10-dashboards-widgets-templates.md)) is surfaced via `widgetCatalog` in `registry.tsx`:



- **111 widget types** across KPI, reliability, charts, tables, layout/utility, and interactive categories.

- Palette grouped by **visual family** (and by category when searching) with search filter, **count badges**, and **per-widget Tabler icons + descriptions** for every catalog type (`widgetPaletteMeta.ts`). Live mini-renders in Gallery mode; Suggested-first progressive disclosure; presentation/frame flavors before drop. See BUILDER-GALLERY-2026-07.md.

- Catalog ↔ registry integrity validated at module load (`widgetCatalog.test.ts`); palette meta coverage covered by `widgetPaletteMeta.test.ts`.



## Properties panel



Three tabs when applicable:



| Tab | Contents |

|-----|----------|

| **Data** | Roll-up scope (plant/line/machine), KPI field binding, historian/chart options (factor, trend field, mode, unit, decimals, tone) |

| **Widget** | Layout widget options: content, URL, alignment, tabs, navigation path, data source, KPI field groups, targets, limits |

| **Layout** | Grid position (x, y, w, h) |



## Data binding panel (Properties → Data)



Binding modes exposed **only where supported**:



| Mode | Widgets | Use |

|------|---------|-----|

| **Snapshot KPI** | KPI tiles, gauges, stat cards, trend widgets | Bind to live `MachineSnapshot` fields (`SNAPSHOT_FIELDS`) with optional plant/line/machine roll-up via `binding.source` |

| **PLC tag** | `live-tag-value`, `udt-member-value` | Raw tag path + connection; **Tag Browser** picker with live preview |



Logical **signal** binding is not shown in the builder (no KPI widget reads signals at runtime yet).



Live preview in the Data tab uses `resolveScopedField` so plant/line scope matches runtime.



Toolbar **plant / line / machine** selectors set preview context for live widget rendering while editing.



## Templates

- **Template gallery** drawer in builder toolbar — v7 **card grid** with preview image, role badges, scope chip, widget count, and **Recommended** ribbon on flagship templates (Plant Command Center, Line Performance Board, Operator Kiosk, Executive Briefing, Downtime Detective). Metadata: `frontend/src/features/builder/systemTemplateMeta.ts`; previews: `frontend/public/template-previews/`.
- **Dashboards hub** — recommended templates appear only when few boards (≤3): compact horizontal strip + Browse all. With existing boards, use **Add dashboard → From template** (modal keeps Recommended badges).
- **Apply template** modal — card picker with preview + description; scope auto-detected from metadata (plant vs line vs machine); primary CTA **Create dashboard**.
- **Save as template** from any saved dashboard.
- Apply uses plant/line/machine pickers for scope binding (widget bindings use `source: plant|line|machine` and roll up at runtime).
- Clone-from-template also available on Dashboards gallery page.
- **Visual QA harness:** `/dev/templates` renders all system templates in a **1080p wall frame** with `wallFit` and mock live data (no scroll). See [TEMPLATE-AUDIT-2026-07.md](TEMPLATE-AUDIT-2026-07.md).
- **Stale layout banner:** wizard dashboards with pre-v7.2 tall layouts (`maxRow > 9` or kiosk `> 8`) or missing v7.2 signature widgets prompt **Refresh layouts** on the Dashboards page (`isSystemLayoutStale` in `frontend/src/lib/dashboards.ts`).



## Dashboard lifecycle



- Permissions: `Private`, `RoleRestricted`, or `PublicKiosk` (+ **Published** toggle).

- **Draft** badge when unpublished; **Live** badge when published.

- Autosave (1.5s debounce) after first manual save; toast on autosave failure.

- Version history drawer with rollback.

- Real-time widget preview via SignalR while editing. Interactive widgets (PLC write / downtime pad) are **sandboxed** (`allowInteractiveWrites: false`) in builder edit/preview and the audit gallery; they write only on live dashboards, Operator Station, and authenticated kiosk sessions.
- **Nesting (one level):** `container-panel` and `tabbed-panel` host child widgets via `parentId` + optional `tabKey`. Drop or click-add while a container/tab is selected nests into it. Containers cannot nest inside containers.



## Permissions



- Route gated by `dashboards.build` permission.

- Admins/Supervisors build dashboards.

- Tag browsing for PLC binding gated to Admin/Supervisor (`tags.browse`).



## Implementation



Frontend modules under `frontend/src/features/builder/`:



- `BuilderPage` — state, persistence, keyboard shortcuts

- `WidgetPalette` — categorized draggable list with search, counts, tooltips

- `BuilderCanvas` — grid editor + drop target

- `PropertiesPanel` — Data / Widget / Layout tabs

- `BindingEditor` — scope + KPI or PLC tag binding

- `WidgetOptionsEditor` — layout widget configuration

- `BuilderToolbar` — metadata, display profile, row budget badge, preview, undo, templates

- `displayProfiles.ts`, `viewportGrid.ts` — 1080p row budgets and wall-fit row height math

- `TemplateGalleryDrawer`, `useBuilderHistory`, `gridConstants`, `widgetFactory`, `WidgetAuditGallery`, `mockWidgetCtx`, `mockAuditApi`



Shared widget scope helpers: `frontend/src/components/widgets/resolveScopedSnapshot.ts`.

