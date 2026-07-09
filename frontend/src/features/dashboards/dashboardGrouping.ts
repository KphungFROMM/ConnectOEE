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

export type DashboardTab = 'all' | 'plant' | 'kiosks' | 'analysis'

export type DashboardGroupKind = 'pinned' | 'recent' | 'plant' | 'line' | 'kiosk' | 'analysis' | 'other'

export interface ParsedDashboardName {
  prefix: string | null
  suffix: string | null
  baseName: string
}

export interface DashboardGroup {
  id: string
  kind: DashboardGroupKind
  title: string
  subtitle?: string
  dashboards: DashboardSummary[]
}

const PLANT_NAMES = new Set([
  'Plant Overview',
  'Multi-Line Overview',
])

const EXECUTIVE_NAMES = new Set([
  'Executive Summary',
  'TEEP Utilization',
])

const ANALYSIS_NAMES = new Set([
  'Maintenance / Fault Focus',
])

const KIOSK_NAMES = new Set([
  'Operator Station',
  'Andon / Big Screen',
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
  Supervisor: 'Line',
  'Operator Kiosk': 'Kiosk',
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

export function parseDashboardName(name: string): ParsedDashboardName {
  const idx = name.lastIndexOf(DASHBOARD_NAME_SEP)
  if (idx < 0) return { prefix: null, suffix: null, baseName: name }
  return {
    prefix: name.slice(0, idx).trim() || null,
    suffix: name.slice(idx + DASHBOARD_NAME_SEP.length).trim() || null,
    baseName: name,
  }
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

export function displayTitle(d: DashboardSummary): string {
  const { suffix, prefix } = parseDashboardName(d.name)
  if (suffix && prefix) return suffix
  return d.name
}

export function matchesTab(d: DashboardSummary, tab: DashboardTab): boolean {
  if (tab === 'all') return true
  const category = resolveCategory(d)
  if (tab === 'plant') return category === 'Plant' || category === 'Executive'
  if (tab === 'kiosks') return category === 'Kiosk' || d.scope === 'PublicKiosk'
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

function groupKeyForDashboard(d: DashboardSummary): { kind: DashboardGroupKind; id: string; title: string; subtitle?: string } {
  const category = resolveCategory(d)

  if (category === 'Kiosk' || d.scope === 'PublicKiosk') {
    return { kind: 'kiosk', id: 'kiosk', title: 'Kiosk & wallboards' }
  }
  if (category === 'Analysis') {
    return { kind: 'analysis', id: 'analysis', title: 'Analysis dashboards' }
  }
  if (category === 'Plant' || category === 'Executive') {
    const title = d.plantName ?? 'Plant dashboards'
    return { kind: 'plant', id: `plant:${d.plantId ?? title}`, title, subtitle: category }
  }
  if (d.lineName) {
    const subtitle = d.plantName ?? undefined
    return { kind: 'line', id: `line:${d.lineId ?? d.lineName}`, title: d.lineName, subtitle }
  }
  const { prefix } = parseDashboardName(d.name)
  if (prefix) {
    return { kind: 'line', id: `line-prefix:${prefix}`, title: prefix }
  }
  return { kind: 'other', id: 'other', title: 'Other dashboards' }
}

const GROUP_ORDER: DashboardGroupKind[] = ['pinned', 'recent', 'plant', 'line', 'kiosk', 'analysis', 'other']

export function groupDashboards(
  dashboards: DashboardSummary[],
  options: { pinnedIds: string[]; recentIds: string[] },
): DashboardGroup[] {
  const pinnedSet = new Set(options.pinnedIds)
  const recentSet = new Set(options.recentIds.filter((id) => !pinnedSet.has(id)))

  const pinned = dashboards.filter((d) => pinnedSet.has(d.id))
  const recent = dashboards.filter((d) => recentSet.has(d.id))
  const rest = dashboards.filter((d) => !pinnedSet.has(d.id) && !recentSet.has(d.id))

  const bucketMap = new Map<string, DashboardGroup>()

  for (const d of rest) {
    const meta = groupKeyForDashboard(d)
    const bucketId = `${meta.kind}:${meta.id}`
    const existing = bucketMap.get(bucketId)
    if (existing) {
      existing.dashboards.push(d)
    } else {
      bucketMap.set(bucketId, {
        id: bucketId,
        kind: meta.kind,
        title: meta.title,
        subtitle: meta.subtitle,
        dashboards: [d],
      })
    }
  }

  const groups: DashboardGroup[] = []
  if (pinned.length > 0) {
    groups.push({ id: 'pinned', kind: 'pinned', title: 'Pinned', dashboards: pinned })
  }
  if (recent.length > 0) {
    groups.push({ id: 'recent', kind: 'recent', title: 'Recently opened', dashboards: recent })
  }

  const sortedBuckets = [...bucketMap.values()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a.kind)
    const ib = GROUP_ORDER.indexOf(b.kind)
    if (ia !== ib) return ia - ib
    return a.title.localeCompare(b.title)
  })

  for (const bucket of sortedBuckets) {
    bucket.dashboards.sort((a, b) => a.name.localeCompare(b.name))
    groups.push(bucket)
  }

  return groups
}
