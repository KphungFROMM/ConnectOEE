import { widgetMetaByType } from '../../components/widgets/registry'
import type { DashboardWidget } from '../../lib/dashboards'
import type { DisplayProfileId } from './displayProfiles'
import { GRID_COLS } from './gridConstants'
import { createWidget, type CreateWidgetContext } from './widgetFactory'
import { flavorDefaultsForType } from './defaultFlavors'

export interface SuggestContext {
  displayProfile: DisplayProfileId
  plantId: string | null
  lineId: string | null
  machineId: string | null
}

/** Rule-based suggestions by display profile + binding scope. */
export function suggestedWidgetTypes(ctx: SuggestContext): string[] {
  const { displayProfile, plantId, lineId, machineId } = ctx

  if (machineId || (displayProfile === 'kioskWall' && lineId)) {
    return [
      'oee-hero',
      'andon-stack',
      'active-downtime-timer',
      'shift-progress',
      'connection-stale',
      'last-update-clock',
    ]
  }

  if (displayProfile === 'kioskWall') {
    return [
      'oee-hero',
      'andon-stack',
      'active-downtime-timer',
      'shift-progress-bar',
      'connection-stale',
      'run-state-badge',
    ]
  }

  if (plantId && !lineId) {
    return [
      'plant-summary-hero',
      'plant-grid',
      'machine-grid',
      'oee-by-shift',
      'line-leaderboard',
      'connection-stale',
    ]
  }

  if (lineId) {
    return [
      'oee-gauge',
      'apq-cluster',
      'shift-progress',
      'pareto',
      'active-downtime-timer',
      'connection-stale',
    ]
  }

  // Unscoped / freeform starter set
  return ['oee-hero', 'apq-cluster', 'shift-progress', 'andon-stack', 'connection-stale', 'last-update-clock']
}

/** Pack widgets left-to-right, wrapping rows without overlap. */
export function packWidgetsOnGrid(
  types: string[],
  bindCtx: CreateWidgetContext,
  displayProfile: DisplayProfileId,
  startY = 0,
): DashboardWidget[] {
  let x = 0
  let y = startY
  let rowH = 0
  const out: DashboardWidget[] = []

  for (const type of types) {
    if (!widgetMetaByType[type]) continue
    const meta = widgetMetaByType[type]
    const w = meta.defaultW ?? 3
    const h = meta.defaultH ?? 2
    if (x + w > GRID_COLS) {
      x = 0
      y += rowH
      rowH = 0
    }
    const flavors = flavorDefaultsForType(type, displayProfile)
    const widget = createWidget(type, bindCtx, { x, y }, y, flavors)
    out.push(widget)
    x += w
    rowH = Math.max(rowH, h)
  }

  return out
}

export interface LayoutSnippet {
  id: string
  label: string
  description: string
  types: string[]
}

export const LAYOUT_SNIPPETS: LayoutSnippet[] = [
  {
    id: 'kpi-strip',
    label: 'KPI strip 4-up',
    description: 'OEE + A/P/Q tiles across the top',
    types: ['kpi-tile', 'kpi-tile', 'kpi-tile', 'kpi-tile'],
  },
  {
    id: 'apq-cluster',
    label: 'APQ cluster',
    description: 'Availability, Performance, Quality rings',
    types: ['apq-cluster'],
  },
  {
    id: 'wall-chrome',
    label: 'Wall chrome row',
    description: 'Entity context, shift, clock, connection',
    types: ['shift-context-strip', 'last-update-clock', 'connection-stale'],
  },
]

/** Deduplicate snippet types that may not exist; fall back for missing. */
export function resolveSnippetTypes(snippet: LayoutSnippet): string[] {
  const fallbacks: Record<string, string> = {
    'shift-context-strip': 'shift-progress',
    'shift-progress-bar': 'shift-progress',
  }
  return snippet.types
    .map((t) => (widgetMetaByType[t] ? t : fallbacks[t]))
    .filter((t): t is string => !!t && !!widgetMetaByType[t])
}
