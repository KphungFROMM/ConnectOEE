import type { DashboardSummary } from '../../lib/dashboards'

export const DASHBOARD_NAME_SEP = ' — '

export type DashboardCategory =
  | 'Executive'
  | 'Plant'
  | 'Line'
  | 'Machine'
  | 'Shift'
  | 'Analysis'
  | 'Kiosk'
  | 'General'

/** @deprecated Prefer DashboardScopeId + left nav */
export type DashboardTab = 'all' | 'plant' | 'kiosks' | 'analysis'

export type DashboardChipFilter = 'pinned' | 'kiosk' | 'analysis'

export type DashboardScopeId = string

export interface ParsedDashboardName {
  prefix: string | null
  suffix: string | null
  baseName: string
}

export interface DashboardScopeNode {
  id: DashboardScopeId
  label: string
  count: number
  kind: 'all' | 'kiosks' | 'plant' | 'line' | 'other'
  children?: DashboardScopeNode[]
}

const PLANT_NAMES = new Set(['Plant Overview'])

const EXECUTIVE_NAMES = new Set<string>([])

const ANALYSIS_NAMES = new Set(['Quality Pulse', 'Analytics Starter'])

const KIOSK_NAMES = new Set([
  'Operator Floor',
  'Line Andon',
  'Maintenance Wall',
  'Operator Station',
  'Andon / Big Screen',
  'Operator Kiosk',
  'Line Andon Wall',
  'Maintenance Wallboard',
])

const SUFFIX_CATEGORY: Record<string, DashboardCategory> = {
  Overview: 'Line',
  Shift: 'Shift',
  Detail: 'Machine',
  Downtime: 'Analysis',
  Production: 'Analysis',
  Quality: 'Analysis',
  Setup: 'Analysis',
  Supervisor: 'Shift',
  'Operator Kiosk': 'Kiosk',
  'Operator Floor': 'Kiosk',
  Andon: 'Kiosk',
  'Maintenance Board': 'Kiosk',
}

export const CATEGORY_COLORS: Record<DashboardCategory, string> = {
  Executive: 'indigo',
  Plant: 'blue',
  Line: 'teal',
  Machine: 'green',
  Shift: 'orange',
  Analysis: 'grape',
  Kiosk: 'violet',
  General: 'gray',
}

export const SCOPE_ALL = 'all'
export const SCOPE_KIOSKS = 'kiosks'
export const SCOPE_OTHER = 'other'

export function parseDashboardName(name: string): ParsedDashboardName {
  const sepIdx = name.lastIndexOf(DASHBOARD_NAME_SEP)
  if (sepIdx >= 0) {
    return {
      prefix: name.slice(0, sepIdx).trim() || null,
      suffix: name.slice(sepIdx + DASHBOARD_NAME_SEP.length).trim() || null,
      baseName: name,
    }
  }
  const asciiIdx = name.lastIndexOf(' - ')
  if (asciiIdx >= 0) {
    return {
      prefix: name.slice(0, asciiIdx).trim() || null,
      suffix: name.slice(asciiIdx + 3).trim() || null,
      baseName: name,
    }
  }
  return { prefix: null, suffix: null, baseName: name }
}

export function inferCategoryFromName(name: string, scope?: string): DashboardCategory {
  if (scope === 'PublicKiosk') return 'Kiosk'
  if (EXECUTIVE_NAMES.has(name)) return 'Executive'
  if (PLANT_NAMES.has(name)) return 'Plant'
  if (ANALYSIS_NAMES.has(name)) return 'Analysis'
  if (KIOSK_NAMES.has(name)) return 'Kiosk'

  const { suffix } = parseDashboardName(name)
  if (suffix && SUFFIX_CATEGORY[suffix]) return SUFFIX_CATEGORY[suffix]

  return 'General'
}

export function resolveCategory(d: DashboardSummary): DashboardCategory {
  if (d.inferredCategory) return d.inferredCategory as DashboardCategory
  return inferCategoryFromName(d.name, d.scope)
}

export function isKioskDashboard(d: DashboardSummary): boolean {
  return d.scope === 'PublicKiosk' || resolveCategory(d) === 'Kiosk'
}

export function scopeLabel(d: DashboardSummary): string {
  if (d.scope === 'PublicKiosk') return 'Kiosk'
  if (d.scope === 'RoleRestricted') return 'Published'
  if (d.scope === 'Private') return 'Private'
  return d.scope
}

export function bindingContextLabel(d: DashboardSummary): string | null {
  const parts: string[] = []
  if (d.plantName) parts.push(d.plantName)
  if (d.lineName) parts.push(d.lineName)
  if (d.machineName) parts.push(d.machineName)
  if (parts.length > 0) return parts.join(' › ')
  if (d.lineId || d.plantId || d.machineId) return 'Bound scope'
  return null
}

/** Primary card title: prefer role/suffix so line context is not duplicated. */
export function displayTitle(d: DashboardSummary): string {
  const { suffix, prefix } = parseDashboardName(d.name)
  if (suffix && prefix) return suffix
  return d.name
}

export function displaySubtitle(d: DashboardSummary): string | null {
  const binding = bindingContextLabel(d)
  if (binding) return binding
  const { suffix, prefix } = parseDashboardName(d.name)
  if (suffix && prefix) return prefix
  return null
}

export function matchesTab(d: DashboardSummary, tab: DashboardTab): boolean {
  if (tab === 'all') return true
  const category = resolveCategory(d)
  if (tab === 'plant') return category === 'Plant' || category === 'Executive'
  if (tab === 'kiosks') return isKioskDashboard(d)
  if (tab === 'analysis') return category === 'Analysis'
  return true
}

export function matchesSearch(d: DashboardSummary, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    d.name,
    d.inferredCategory,
    d.plantName,
    d.lineName,
    d.machineName,
    d.scope,
    bindingContextLabel(d),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

function plantScopeId(d: DashboardSummary): string | null {
  if (d.plantId) return `plant:${d.plantId}`
  if (d.plantName) return `plant:name:${d.plantName}`
  return null
}

function lineScopeId(d: DashboardSummary): string | null {
  if (d.lineId) return `line:${d.lineId}`
  if (d.lineName) return `line:name:${d.lineName}`
  const { prefix } = parseDashboardName(d.name)
  if (prefix && !d.plantId && !PLANT_NAMES.has(d.name) && !EXECUTIVE_NAMES.has(d.name)) {
    return `line:name:${prefix}`
  }
  return null
}

function isPlantLevelBoard(d: DashboardSummary): boolean {
  const category = resolveCategory(d)
  if (category === 'Plant' || category === 'Executive') return true
  if (d.plantId && !d.lineId && !d.lineName) return true
  return PLANT_NAMES.has(d.name) || EXECUTIVE_NAMES.has(d.name)
}

/** Whether a board belongs in the selected scope (boards stay in every matching home). */
export function boardsInScope(dashboards: DashboardSummary[], scopeId: DashboardScopeId): DashboardSummary[] {
  if (!scopeId || scopeId === SCOPE_ALL) return [...dashboards]

  if (scopeId === SCOPE_KIOSKS) {
    return dashboards.filter(isKioskDashboard)
  }

  if (scopeId === SCOPE_OTHER) {
    return dashboards.filter((d) => {
      if (isKioskDashboard(d)) return false
      if (plantScopeId(d) || lineScopeId(d) || isPlantLevelBoard(d)) return false
      return true
    })
  }

  if (scopeId.startsWith('plant:')) {
    // Plant scope includes every board under that plant (plant-level + lines).
    return dashboards.filter((d) => plantScopeId(d) === scopeId)
  }

  if (scopeId.startsWith('line:')) {
    return dashboards.filter((d) => lineScopeId(d) === scopeId)
  }

  return dashboards
}

export function filterDashboardsByScope(
  dashboards: DashboardSummary[],
  options: {
    scopeId: DashboardScopeId
    search: string
    chips: DashboardChipFilter[]
    pinnedIds: string[]
  },
): DashboardSummary[] {
  const pinnedSet = new Set(options.pinnedIds)
  let list = boardsInScope(dashboards, options.scopeId).filter((d) => matchesSearch(d, options.search))

  for (const chip of options.chips) {
    if (chip === 'pinned') list = list.filter((d) => pinnedSet.has(d.id))
    if (chip === 'kiosk') list = list.filter(isKioskDashboard)
    if (chip === 'analysis') list = list.filter((d) => resolveCategory(d) === 'Analysis')
  }

  return list.sort((a, b) => a.name.localeCompare(b.name))
}

export function scopeTreeFromDashboards(dashboards: DashboardSummary[]): DashboardScopeNode[] {
  const plants = new Map<string, { label: string; lines: Map<string, { label: string; ids: string[] }>; plantBoardIds: string[] }>()
  const orphanLines = new Map<string, { label: string; ids: string[] }>()

  for (const d of dashboards) {
    const pid = plantScopeId(d)
    const lid = lineScopeId(d)

    if (lid) {
      if (!pid) {
        let line = orphanLines.get(lid)
        if (!line) {
          line = { label: d.lineName ?? parseDashboardName(d.name).prefix ?? 'Line', ids: [] }
          orphanLines.set(lid, line)
        }
        line.ids.push(d.id)
        continue
      }
      let plant = plants.get(pid)
      if (!plant) {
        plant = { label: d.plantName ?? 'Plant', lines: new Map(), plantBoardIds: [] }
        plants.set(pid, plant)
      }
      let line = plant.lines.get(lid)
      if (!line) {
        line = { label: d.lineName ?? parseDashboardName(d.name).prefix ?? 'Line', ids: [] }
        plant.lines.set(lid, line)
      }
      line.ids.push(d.id)
      continue
    }

    if (pid || isPlantLevelBoard(d)) {
      const plantKey = pid ?? `plant:name:${d.name}`
      const plantLabel = d.plantName ?? (isPlantLevelBoard(d) ? d.name : 'Plant')
      let plant = plants.get(plantKey)
      if (!plant) {
        plant = { label: plantLabel, lines: new Map(), plantBoardIds: [] }
        plants.set(plantKey, plant)
      }
      plant.plantBoardIds.push(d.id)
    }
  }

  const kioskCount = dashboards.filter(isKioskDashboard).length
  const otherCount = boardsInScope(dashboards, SCOPE_OTHER).length

  const nodes: DashboardScopeNode[] = [
    { id: SCOPE_ALL, label: 'All boards', count: dashboards.length, kind: 'all' },
    { id: SCOPE_KIOSKS, label: 'Kiosks', count: kioskCount, kind: 'kiosks' },
  ]

  const plantNodes = [...plants.entries()]
    .map(([id, plant]) => {
      const lineChildren: DashboardScopeNode[] = [...plant.lines.entries()]
        .map(([lineId, line]) => ({
          id: lineId,
          label: line.label,
          count: line.ids.length,
          kind: 'line' as const,
        }))
        .sort((a, b) => a.label.localeCompare(b.label))

      const total = plant.plantBoardIds.length + lineChildren.reduce((sum, c) => sum + c.count, 0)

      return {
        id,
        label: plant.label,
        count: total,
        kind: 'plant' as const,
        children: lineChildren.length > 0 ? lineChildren : undefined,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))

  nodes.push(...plantNodes)

  const orphanLineNodes = [...orphanLines.entries()]
    .map(([id, line]) => ({
      id,
      label: line.label,
      count: line.ids.length,
      kind: 'line' as const,
    }))
    .sort((a, b) => a.label.localeCompare(b.label))

  nodes.push(...orphanLineNodes)

  if (otherCount > 0) {
    nodes.push({ id: SCOPE_OTHER, label: 'Other', count: otherCount, kind: 'other' })
  }

  return nodes
}

export function scopeTitle(scopeId: DashboardScopeId, tree: DashboardScopeNode[]): string {
  if (scopeId === SCOPE_ALL) return 'All boards'
  if (scopeId === SCOPE_KIOSKS) return 'Kiosks'
  if (scopeId === SCOPE_OTHER) return 'Other'
  for (const node of tree) {
    if (node.id === scopeId) return node.label
    for (const child of node.children ?? []) {
      if (child.id === scopeId) {
        return node.kind === 'plant' ? `${node.label} › ${child.label}` : child.label
      }
    }
  }
  return 'Dashboards'
}

export function isRecent(id: string, recentIds: string[]): boolean {
  return recentIds.includes(id)
}

export function isPinned(id: string, pinnedIds: string[]): boolean {
  return pinnedIds.includes(id)
}
