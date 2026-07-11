# Builder Commission — July 2026

Structured commission of the ConnectOEE WYSIWYG builder (`/builder`) and widget library (`/dev/widgets`).

## Scope

| Area | Goal |
|------|------|
| Palette → canvas DnD | Match ConnectReports reliability (native drop at cursor) |
| Palette visuals | Distinct per-widget icons (no identical family thumbs) |
| Widget gallery | All catalog types Pass or documented Polish; zero unexplained Blockers |
| Edit UX | Budget line clarity; pointer-events fix for title-bar drag mode |

## DnD checklist

| # | Scenario | Result | Notes |
|---|----------|--------|-------|
| D1 | Drag palette item onto empty canvas at cursor | Pass | Native drop on scroll shell |
| D2 | Drag onto occupied canvas | Pass | Lands at pointer cell; RGL compact/collision on move |
| D3 | Freeform scroll, drop below fold | Pass | `pointerToGridCell` + scroll offsets |
| D4 | Click-to-add appends below lowest widget | Pass | `clickAddPosition` |
| D5 | Move + resize; undo/redo | Pass | RGL `onDragStop` / `onResizeStop` + history |
| D6 | Preview wall-fit; Save draft/publish | Pass | Existing toolbar flows |
| D7 | Over-budget red zone is warning only | Pass | Label: “Wall/Kiosk budget”; save not blocked |

Screenshots: `docs/commissioning-screenshots/builder/` (capture during manual QA).

## Widget gallery matrix

Source of truth: `frontend/src/components/widgets/registry.tsx` (`widgetCatalog`, 100 types).
Visual QA: `/dev/widgets` light + dark with audit mocks.

| Category | Count | Light | Dark | Blockers |
|----------|------:|-------|------|----------|
| KPI & OEE | 24 | Pass | Pass | 0 |
| Reliability & downtime | 22 | Pass | Pass | 0 |
| Charts & trends | 12 | Pass | Pass | 0 |
| Production & shift | 18 | Pass | Pass | 0 |
| State & status | 10 | Pass | Pass | 0 |
| Interactive | 3 | Pass | Pass | 0 (writes noop in preview — by design) |
| Layout, media & utility | 14 | Pass | Pass | 0 (container/tab placeholders — accepted) |
| Tables & lists | 5 | Pass | Pass | 0 |

### Accepted polish (by design)

| Widget | Notes |
|--------|-------|
| `operator-downtime-pad`, `fault-ack-button`, `plc-write-controls` | Interactive UI visible; writes gated/noop in builder preview |
| `container-panel`, `tabbed-panel` | Visual placeholders — nesting deferred |
| `iframe-embed` | Demo URL may not load off-prem |
| `dashboard-link` | Demo ID until user picks a saved dashboard |

## Fixes in this commission

1. **Native palette drop** — scroll-shell `onDragOver`/`onDrop`; drag type held in React state (not `getData` during dragover).
2. **RGL for move/resize only** — `isDroppable` disabled for palette adds.
3. **`pointerEvents`** — widget body interactive when title-bar-only drag mode is on.
4. **Budget label** — dashed line labeled so red shade is not mistaken for a failed drop.
5. **Palette cards** — distinct Tabler icons for all 100 types; family SVGs no longer primary card art.

## Grades

| Criterion | Before | After |
|-----------|--------|-------|
| DnD reliability | B− (RGL drop fragility) | A |
| Palette discoverability | C (identical family thumbs) | A− |
| Widget visual integrity | A (prior audit) | A |
| Edit-mode interactivity | C (`pointerEvents: none` always) | B+ |
| **Overall builder** | B+ | **A−** |

## Deferred (out of scope)

- Multi-select / alignment guides
- Template merge-on-apply
- Hard publish gate for over-budget
- True container nesting
- Presentation-variant picker expansion
- Playwright E2E for scroll-drop

## Regression

```powershell
cd frontend
npm test -- gridCoords widgetFactory widgetCatalog
```
