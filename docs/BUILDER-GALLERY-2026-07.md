# Builder Gallery & Intuitive WYSIWYG (2026-07)

Competitive targets and what ConnectOEE shipped in the Builder spike.

## Competitive bar

| Pattern | Leader | ConnectOEE response |
|---------|--------|---------------------|
| Live thumbnail gallery | Grafana | Live mini-renders in palette (`PaletteWidgetPreview`) |
| Flavor / style presets | Grafana panel styles | Presentation + frame + Identity/By value color chips |
| Suggested widgets | Grafana suggestions | Rule-based “Suggested for this board” + Add all |
| Machine performance tiles | MachineMetrics | `machine-grid` `cardStyle: performance` |
| Story / 4–6 widgets | FourJaw | Layout snippets + suggested packs |
| Wall density while editing | (rare) | Same stage size + `wallFitRowCount` for edit and preview (no squish/stretch mismatch) |
| Ring label fit | — | In-ring % sized to inner diameter; KPI `colorMode` identity vs band |

## Intuition rules

1. Show don’t tell — live previews, not icons alone.
2. Decide for them — profile-based flavor defaults.
3. Progressive disclosure — Suggested first; Browse all for the full catalog.
4. Empty canvas — Template / Suggested / Browse (three starts).
5. WYSIWYG — Wall/Kiosk edit stage matches floor density; Preview confirms.

## Key files

- `frontend/src/features/builder/WidgetPalette.tsx`
- `frontend/src/features/builder/PaletteWidgetPreview.tsx`
- `frontend/src/features/builder/BuilderCanvas.tsx`
- `frontend/src/features/builder/suggestedWidgets.ts`
- `frontend/src/features/builder/defaultFlavors.ts`

## Deferred (Phase 3)

Kiosk playlist/carousel, library widgets, story layout ghost guides, Freeform overlay mode.
