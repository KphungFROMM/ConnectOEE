import { useCallback, useMemo, useState } from 'react'
import type { DashboardSummary } from '../../lib/dashboards'
import {
  filterDashboardsByScope,
  scopeTreeFromDashboards,
  scopeTitle,
  SCOPE_ALL,
  type DashboardChipFilter,
  type DashboardScopeId,
  type DashboardScopeNode,
} from './dashboardGrouping'

const PINNED_KEY = 'connectoee.dashboards.pinned'
const RECENT_KEY = 'connectoee.dashboards.recent'
const SCOPE_KEY = 'connectoee.dashboards.selectedScope'
const MAX_RECENT = 8

function readIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

function writeIds(key: string, ids: string[]) {
  localStorage.setItem(key, JSON.stringify(ids))
}

function readScope(): DashboardScopeId {
  try {
    return localStorage.getItem(SCOPE_KEY) || SCOPE_ALL
  } catch {
    return SCOPE_ALL
  }
}

function writeScope(scopeId: DashboardScopeId) {
  localStorage.setItem(SCOPE_KEY, scopeId)
}

export function useDashboardFilters(dashboards: DashboardSummary[]) {
  const [search, setSearch] = useState('')
  const [chips, setChips] = useState<DashboardChipFilter[]>([])
  const [selectedScope, setSelectedScopeState] = useState<DashboardScopeId>(() => readScope())
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readIds(PINNED_KEY))
  const [recentIds, setRecentIds] = useState<string[]>(() => readIds(RECENT_KEY))

  const setSelectedScope = useCallback((scopeId: DashboardScopeId) => {
    setSelectedScopeState(scopeId)
    writeScope(scopeId)
  }, [])

  const scopeTree: DashboardScopeNode[] = useMemo(() => scopeTreeFromDashboards(dashboards), [dashboards])

  // If persisted scope vanished (e.g. plant deleted), fall back to All.
  const resolvedScope = useMemo(() => {
    if (selectedScope === SCOPE_ALL) return selectedScope
    const exists = scopeTree.some(
      (n) => n.id === selectedScope || n.children?.some((c) => c.id === selectedScope),
    )
    return exists ? selectedScope : SCOPE_ALL
  }, [selectedScope, scopeTree])

  const filtered = useMemo(
    () =>
      filterDashboardsByScope(dashboards, {
        scopeId: resolvedScope,
        search,
        chips,
        pinnedIds,
      }),
    [dashboards, resolvedScope, search, chips, pinnedIds],
  )

  const recentDashboards = useMemo(() => {
    const byId = new Map(dashboards.map((d) => [d.id, d]))
    return recentIds.map((id) => byId.get(id)).filter((d): d is DashboardSummary => !!d).slice(0, MAX_RECENT)
  }, [dashboards, recentIds])

  const activeScopeTitle = useMemo(() => scopeTitle(resolvedScope, scopeTree), [resolvedScope, scopeTree])

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      writeIds(PINNED_KEY, next)
      return next
    })
  }, [])

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds])

  const isRecent = useCallback((id: string) => recentIds.includes(id), [recentIds])

  const recordRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT)
      writeIds(RECENT_KEY, next)
      return next
    })
  }, [])

  const toggleChip = useCallback((chip: DashboardChipFilter) => {
    setChips((prev) => (prev.includes(chip) ? prev.filter((c) => c !== chip) : [...prev, chip]))
  }, [])

  return {
    search,
    setSearch,
    chips,
    toggleChip,
    selectedScope: resolvedScope,
    setSelectedScope,
    scopeTree,
    activeScopeTitle,
    filtered,
    recentDashboards,
    pinnedIds,
    recentIds,
    togglePin,
    isPinned,
    isRecent,
    recordRecent,
  }
}
