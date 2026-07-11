# Widget Visual Language (v8)

ConnectOEE industrial presentation rules for widgets and system templates. Evolve the brand (neutral surfaces, blue primary, green/amber/red status)—do not invent a new product look.

## Hierarchy (wall)

1. **One hero signal** per viewport (OEE **or** Andon—not both fighting).
2. **Calm / all-clear** is muted and subordinate—never a full-cell solid green slab.
3. **Status color** is for run/fault/warn state. OEE metrics default to **factor identity** (`kpiAccentColor` / live `getFactorColors()` from Admin → Appearance, defaults in `oeeFactorColors`: OEE teal, A blue, P indigo, Q grape). Optional **By value** (`colorMode: 'band'`) reuses Plant Explorer tiers vs `targetOeePct`.
4. Ring in-label % is sized to the **inner diameter** (`GaugeRing` / `fitRingValueFontPx`) so digits never sit under the stroke; metric titles stay below the ring on wall boards.
5. Every wall board includes an **identity strip**: entity context, shift, clock, connection/stale.
6. Fill the wall row budget (`kioskWall` 8 / `plantWall` 9); no large empty bands on 1080p.

## Wall theme

Kiosk (`/kiosk/:id`) and presentation (`/present/:id`) use wall density/layout, but **follow the app color scheme** (moon toggle in the app header, or the sun/moon control on the wall chrome). Surfaces use scheme-aware `--coee-wall-*` vars — light and dark both stay consistent tile-to-tile (no forced dark override).

Admin / Builder / Explorer stay light-first by default; use the header moon icon to switch.

## Chrome

| Primitive | Alert | Calm |
|-----------|-------|------|
| `InfoStrip` | Full-bleed red/blue for fault/info that needs attention | Compact muted bar / soft tint—never `teal-9` slab |
| `StatusVisual` / `statusStyle` | `beacon` / `tower` for attention | `pill` / `minimal` / `strip` for secondary; Running uses brand green without competing with OEE hero |
| `AndonStackVisual` | Active lamp strong; inactive lamps dim; no overlapping bottom hero text | Layout via `statusStyle`: `tower` / `strip` / `beacon` |
| `WidgetSurface` | Hero elevation on primary tiles | Secondary tiles quieter |
| `PresentationKpi` / `MetricHero` | Density-aware type scale; skins include `tile` / `delta` / `gauge` | One accent per card max |

### Status style flavor (`options.statusStyle`)

Available on `run-state-badge`, `status-light`, `andon-stack`, `oee-traffic-light`, `line-status-indicator`: **beacon**, **pill**, **minimal**, **tower**, **strip**. Pick in palette Flavors, Properties → Layout, or canvas chips.

### KPI presentation skins (`options.presentation`)

`number`, `ring`, `bar`, `spark`, `ringSpark`, `barSpark`, plus **tile** (soft tinted panel), **delta** (value + delta chip), **gauge** (segmented linear).

## Tokens

- Admin / Builder: light-first from `frontend/src/theme/tokens.ts`.
- Wall / kiosk: `wallTheme` + CSS vars in `widgetTheme.ts` (`--coee-wall-*`).
- Calm surfaces: `toneSurfaceStyle(..., { calmMuted: true })` or InfoStrip `variant="calm"`.

## Template catalog (v8)

Eight curated system templates—see [10-dashboards-widgets-templates.md](10-dashboards-widgets-templates.md). Premade v7.2 layouts are retired.
