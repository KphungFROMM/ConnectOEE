import { SNAPSHOT_FIELDS, widgetMetaByType } from '../../components/widgets/registry'
import type { DashboardWidget } from '../../lib/dashboards'
import { GRID_COLS } from './gridConstants'

export const PALETTE_DRAG_MIME = 'application/x-connectoee-widget'

export interface CreateWidgetContext {
  lineId?: string | null
  plantId?: string | null
  machineId?: string | null
}

export function defaultBinding(
  type: string,
  ctx: CreateWidgetContext,
): DashboardWidget['binding'] {
  if (type === 'live-tag-value' || type === 'udt-member-value') {
    return {
      bindingKind: 'tag',
      tagPath: 'Program:MainProgram.LineSpeed',
      connectionId: '00000000-0000-0000-0000-000000000001',
    }
  }
  const meta = widgetMetaByType[type]
  const source = ctx.plantId && !ctx.lineId ? 'plant' : ctx.lineId ? 'line' : 'machine'

  const fieldByType: Record<string, string> = {
    'scrap-tile': 'scrapPct',
    'yield-tile': 'yieldPct',
    'fpy-tile': 'fpyPct',
    'teep-tile': 'teepPct',
    'throughput-tile': 'actualRatePph',
    'oee-gauge': 'oeePct',
    'oee-hero': 'oeePct',
  }

  if (meta?.options.includes('field') || fieldByType[type]) {
    return {
      bindingKind: 'snapshot',
      source,
      field: fieldByType[type] ?? SNAPSHOT_FIELDS[0]?.value,
    }
  }
  if (meta?.options.includes('source')) {
    return { bindingKind: 'snapshot', source }
  }
  return { bindingKind: 'snapshot' }
}

export function defaultOptions(type: string): DashboardWidget['options'] {
  if (type === 'factor-gauge') return { factor: 'A' }
  if (type === 'oee-waterfall') return { mode: 'percent' }
  if (type === 'multi-trend') return { trendField: 'oeePct' }
  if (type === 'count-to-go') return { target: 1000 }
  if (type === 'count-to-target') return { target: 5500 }
  if (type === 'target-pace-tile') return { target: 5500 }
  if (type === 'text-label') return { align: 'left', fontSize: 'md', content: 'Section title' }
  if (type === 'kpi-tile-group') return { fields: ['oeePct', 'availabilityPct', 'performancePct', 'qualityPct'] }
  if (type === 'rich-notes') return { content: 'Shift notes and announcements appear here.' }
  if (type === 'image-logo') return { url: '/app-icon.png', alt: 'ConnectOEE' }
  if (type === 'iframe-embed') return { url: 'https://connectoee.local/help' }
  if (type === 'qr-link-tile') return { url: 'https://connectoee.local/kiosk' }
  if (type === 'marquee-ticker') return { source: 'events' }
  if (type === 'container-panel') return { title: 'Section' }
  if (type === 'tabbed-panel') return { tabs: ['Overview', 'Downtime'] }
  if (type === 'dashboard-link') return { dashboardId: 'demo-overview', label: 'Plant Overview' }
  if (type === 'navigation-drill') return { path: '/plant-explorer', label: 'Open Explorer' }
  if (type === 'pace-gauge') return { target: 5500 }
  if (type === 'oee-traffic-light') return { greenThreshold: 85, amberThreshold: 65 }
  return {}
}

/** Click-to-add: center horizontally, append below existing widgets. */
export function clickAddPosition(type: string, widgets: DashboardWidget[]): { x: number; y: number } {
  const meta = widgetMetaByType[type]
  const w = meta?.defaultW ?? 3
  const maxRow = widgets.reduce((m, widget) => Math.max(m, widget.y + widget.h), 0)
  const x = Math.max(0, Math.floor((GRID_COLS - w) / 2))
  return { x, y: maxRow }
}

export function createWidget(
  type: string,
  ctx: CreateWidgetContext,
  position?: { x: number; y: number },
  maxRow = 0,
  optionOverrides?: DashboardWidget['options'],
): DashboardWidget {
  const meta = widgetMetaByType[type]
  const binding = defaultBinding(type, ctx)
  const options = { ...defaultOptions(type), ...optionOverrides }
  if (type === 'factor-gauge') {
    binding.field = 'availabilityPct'
  }
  return {
    id: crypto.randomUUID(),
    type,
    title: meta?.label ?? type,
    x: position?.x ?? 0,
    y: position?.y ?? maxRow,
    w: meta?.defaultW ?? 3,
    h: meta?.defaultH ?? 2,
    binding,
    options,
  }
}

export function widgetsToLayout(widgets: DashboardWidget[]) {
  return widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }))
}

export function applyLayout(widgets: DashboardWidget[], layout: { i: string; x: number; y: number; w: number; h: number }[]) {
  const byId = new Map(layout.map((l) => [l.i, l]))
  return widgets.map((w) => {
    const l = byId.get(w.id)
    if (!l) return w
    return { ...w, x: l.x, y: l.y, w: l.w, h: l.h }
  })
}
