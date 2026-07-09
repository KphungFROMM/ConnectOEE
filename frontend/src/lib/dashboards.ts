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

/** True when a wizard dashboard predates v7.1 wall-fit template layouts. */
export function isSystemLayoutStale(d: Dashboard): boolean {
  const types = d.widgets.map((w) => w.type)
  const set = new Set(types)
  const maxRow = d.widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
  const isKiosk =
    d.scope === 'PublicKiosk' ||
    d.name === 'Operator Kiosk' ||
    d.name === 'Line Andon Wall' ||
    d.name === 'Maintenance Wallboard' ||
    d.name.endsWith(' — Andon') ||
    d.name.endsWith(' — Operator Kiosk')

  if (isKiosk && maxRow > 8) return true
  if (!isKiosk && maxRow > 9) return true

  if (d.name.endsWith(' — Andon')) {
    return !set.has('oee-traffic-light') || !set.has('shift-context-strip') || !set.has('marquee-ticker')
  }
  if (d.name.endsWith(' — Operator Kiosk')) {
    return !set.has('pace-gauge') || !set.has('oee-traffic-light') || !set.has('active-downtime-timer')
  }
  if (d.name.endsWith(' — Detail')) {
    return !set.has('recipe-product-strip') || !set.has('speed-trend') || set.has('time-series-trend')
  }
  if (d.name === 'Executive Briefing' || d.name === 'Executive Summary') {
    return !set.has('gap-cluster') || set.has('quick-links-bar')
  }
  if (d.name.endsWith(' — Downtime')) {
    return !set.has('histogram') || !set.has('fault-code-summary')
  }
  if (d.name.endsWith(' — Production')) {
    return !set.has('takt-vs-actual') || !set.has('production-vs-target')
  }
  if (d.name.endsWith(' — Quality')) {
    return !set.has('losses-donut') || types.length > 12
  }
  if (d.name.endsWith(' — Supervisor')) {
    return !set.has('unassigned-stops-banner') || !set.has('top-n-table')
  }
  if (d.name.endsWith(' — Setup')) {
    return !set.has('state-time-breakdown') || !set.has('state-distribution')
  }
  if (d.name === 'TEEP & Utilization' || d.name === 'TEEP Utilization') {
    return !set.has('oee-by-shift') || !set.has('teep-tile')
  }
  if (d.name === 'Maintenance Wallboard') {
    return !set.has('marquee-ticker') || !set.has('mttr-tile')
  }
  if (d.name.endsWith(' — Overview')) {
    return !set.has('attainment-tile') || !set.has('gap-cluster')
  }
  if (d.name.endsWith(' — Shift')) {
    return !set.has('shift-summary') || (!set.has('pace-gauge') && !set.has('target-pace-tile'))
  }
  if (d.name === 'Plant Command Center' || d.name === 'Plant Overview') {
    return !set.has('line-status-strip') || set.has('quick-links-bar')
  }
  if (d.name === 'Floor At-a-Glance' || d.name === 'Multi-Line Overview') {
    return !set.has('machine-grid') || !set.has('line-status-strip')
  }
  if (d.name === 'Plant Reliability Hub' || d.name === 'Maintenance / Fault Focus') {
    return !set.has('active-downtime-timer') || !set.has('unassigned-stops-banner')
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
