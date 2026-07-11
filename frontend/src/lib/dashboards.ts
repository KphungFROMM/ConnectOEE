import { apiGet, apiPost } from './api'
import { apiPut, apiDelete } from './admin'

export interface WidgetBinding {
  bindingKind?: 'snapshot' | 'signal' | 'tag'
  source?: 'machine' | 'line' | 'plant'
  field?: string
  signalId?: string
  tagPath?: string
  connectionId?: string
  [k: string]: unknown
}
export interface WidgetOptions {
  factor?: 'A' | 'P' | 'Q'
  kind?: 'percent' | 'number' | 'count'
  unit?: string
  tone?: 'good' | 'bad' | 'neutral'
  decimals?: number
  /** identity = factor hue; band = value vs target tiers */
  colorMode?: 'identity' | 'band'
  [k: string]: unknown
}
export interface DashboardWidget {
  id: string
  type: string
  title?: string | null
  x: number
  y: number
  w: number
  h: number
  binding: WidgetBinding
  options: WidgetOptions
  /** Parent container/tab widget id; omit/null = root grid. */
  parentId?: string | null
  /** For tabbed-panel children: tab index key ("0", "1", …). */
  tabKey?: string | null
}
export interface Dashboard {
  id: string
  name: string
  scope: string
  isPublished: boolean
  version: number
  plantId?: string | null
  lineId?: string | null
  machineId?: string | null
  widgets: DashboardWidget[]
}
export interface DashboardSummary {
  id: string
  name: string
  scope: string
  isPublished: boolean
  plantId?: string | null
  lineId?: string | null
  machineId?: string | null
  plantName?: string | null
  lineName?: string | null
  machineName?: string | null
  inferredCategory?: string | null
}
export interface DashboardTemplate {
  id: string
  name: string
  category: string
  description?: string | null
  layoutJson?: string | null
  widgetCount?: number
}

export interface SaveWidget {
  type: string
  title?: string | null
  x: number
  y: number
  w: number
  h: number
  binding?: WidgetBinding
  options?: WidgetOptions
  /** Preserve client id across save so parentId references stay valid. */
  id?: string
  parentId?: string | null
  tabKey?: string | null
}
export interface SaveDashboardRequest {
  name: string
  scope?: string
  isPublished?: boolean
  plantId?: string | null
  lineId?: string | null
  machineId?: string | null
  widgets: SaveWidget[]
}
export interface DashboardVersion {
  version: number
  isAutosave: boolean
  savedUtc: string
}

export const listDashboards = () => apiGet<DashboardSummary[]>('/api/dashboards')
export const getDashboard = (id: string) => apiGet<Dashboard>(`/api/dashboards/${id}`)
export const listTemplates = () => apiGet<DashboardTemplate[]>('/api/dashboards/templates')
export const applyTemplate = (body: {
  templateId: string
  name?: string
  plantId?: string | null
  lineId?: string | null
  machineId?: string | null
}) => apiPost<Dashboard>('/api/dashboards/apply-template', body)

export const createDashboard = (body: SaveDashboardRequest) =>
  apiPost<Dashboard>('/api/dashboards', body)
export const updateDashboard = (id: string, body: SaveDashboardRequest) =>
  apiPut<Dashboard>(`/api/dashboards/${id}`, body)
export const autosaveDashboard = (id: string, body: SaveDashboardRequest) =>
  apiPost<Dashboard>(`/api/dashboards/${id}/autosave`, body)
export const deleteDashboard = (id: string) => apiDelete(`/api/dashboards/${id}`)
export const getVersions = (id: string) =>
  apiGet<DashboardVersion[]>(`/api/dashboards/${id}/versions`)
export const rollbackVersion = (id: string, version: number) =>
  apiPost<Dashboard>(`/api/dashboards/${id}/rollback/${version}`, {})
export const saveAsTemplate = (id: string, body: { name: string; category?: string; description?: string }) =>
  apiPost<DashboardTemplate>(`/api/dashboards/${id}/save-as-template`, body)
export const refreshSystemLayouts = () =>
  apiPost<{ refreshed: number; dashboardNames: string[]; details: { name: string; widgetTypes: string[] }[] }>(
    '/api/dashboards/refresh-system-layouts',
    {},
  )

/** True when a wizard dashboard predates v8 curated template layouts. */
export function isSystemLayoutStale(d: Dashboard): boolean {
  const types = d.widgets.map((w) => w.type)
  const set = new Set(types)
  const maxRow = d.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
  const name = d.name
  const suffix = (() => {
    const em = name.lastIndexOf(' — ')
    const ascii = name.lastIndexOf(' - ')
    if (em >= 0) return name.slice(em + 3)
    if (ascii >= 0) return name.slice(ascii + 3)
    return null
  })()

  const isKiosk =
    d.scope === 'PublicKiosk' ||
    name === 'Operator Floor' ||
    name === 'Operator Kiosk' ||
    name === 'Line Andon' ||
    name === 'Line Andon Wall' ||
    name === 'Maintenance Wall' ||
    name === 'Maintenance Wallboard' ||
    suffix === 'Andon' ||
    suffix === 'Operator Floor' ||
    suffix === 'Operator Kiosk'

  if (isKiosk && maxRow > 8) return true
  if (!isKiosk && maxRow > 9) return true

  // Wizard suffixes / legacy titles — stale until widgets match the remapped v8 fingerprint.
  if (suffix === 'Andon' || name === 'Line Andon' || name === 'Line Andon Wall') {
    return !set.has('andon-stack') || !set.has('oee-hero') || set.has('oee-traffic-light')
  }
  if (suffix === 'Operator Floor' || suffix === 'Operator Kiosk' || name === 'Operator Floor' || name === 'Operator Kiosk') {
    return !set.has('pace-gauge') || !set.has('run-state-badge') || !set.has('shift-context-strip')
  }
  if (suffix === 'Production' || name === 'Production Board' || name === 'Production & Pace' || name === 'Attainment Tracker') {
    return !set.has('hourly-production-bar') || !set.has('production-vs-target')
  }
  if (suffix === 'Quality' || name === 'Quality Pulse' || name === 'Quality & Yield Lab') {
    return !set.has('scrap-tile') || !set.has('fpy-tile')
  }
  // Overview / Shift / Downtime / Setup / Supervisor all remap → Shift Supervisor
  if (
    suffix === 'Supervisor' ||
    suffix === 'Overview' ||
    suffix === 'Shift' ||
    suffix === 'Downtime' ||
    suffix === 'Setup' ||
    name === 'Shift Supervisor' ||
    name === 'Shift Huddle Board' ||
    name === 'Supervisor Cockpit' ||
    name === 'Downtime Detective' ||
    name === 'Setup & Changeover' ||
    name === 'Line Performance Board' ||
    name === 'Shift Compare'
  ) {
    return !set.has('shift-summary') || !set.has('unassigned-stops-banner')
  }
  if (suffix === 'Detail' || name === 'Machine Station Detail') {
    return !set.has('hourly-production-bar') || !set.has('production-vs-target')
  }
  if (name === 'Maintenance Wall' || name === 'Maintenance Wallboard' || name === 'Maintenance / Fault Focus' || name === 'Plant Reliability Hub' || suffix === 'Maintenance Board') {
    return !set.has('mttr-tile') || !set.has('unassigned-stops-banner')
  }
  if (
    name === 'Plant Overview' ||
    name === 'Plant Command Center' ||
    name === 'Executive Briefing' ||
    name === 'Executive Summary' ||
    name === 'Floor At-a-Glance' ||
    name === 'Multi-Line Overview' ||
    name === 'TEEP & Utilization' ||
    name === 'TEEP Utilization'
  ) {
    return !set.has('line-status-strip') || !set.has('plant-grid')
  }
  if (name === 'Analytics Starter') {
    return !set.has('multi-trend') || !set.has('pareto')
  }

  return false
}

/** @deprecated Use isSystemLayoutStale — kept for Andon-specific checks. */
export function isAndonLayoutStale(d: Dashboard): boolean {
  return d.name.endsWith(' — Andon') && isSystemLayoutStale(d)
}
export const getKioskDashboard = (id: string) =>
  apiGet<Dashboard>(`/api/dashboards/kiosk/${id}`)
export const getKioskLive = (id: string) =>
  apiGet<unknown[]>(`/api/dashboards/kiosk/${id}/live`)

/** Establishes signed httpOnly kiosk session cookie (required before kiosk data APIs). */
export async function establishKioskSession(id: string): Promise<void> {
  const res = await fetch(`/api/dashboards/kiosk/${id}/session`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to establish kiosk session')
}

export interface KioskListItem {
  id: string
  name: string
  lineId: string
  lineName: string
}

export const listKioskDashboards = () => apiGet<KioskListItem[]>('/api/dashboards/kiosk-list')
