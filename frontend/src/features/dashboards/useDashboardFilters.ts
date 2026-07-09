import { useCallback, useMemo, useState } from 'react'
import type { DashboardSummary } from '../../lib/dashboards'
import {
  groupDashboards,
  matchesSearch,
  matchesTab,
  type DashboardGroup,
  type DashboardTab,
} from './dashboardGrouping'

const PINNED_KEY = 'connectoee.dashboards.pinned'
const RECENT_KEY = 'connectoee.dashboards.recent'
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

export function useDashboardFilters(dashboards: DashboardSummary[]) {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<DashboardTab>('all')
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readIds(PINNED_KEY))
  const [recentIds, setRecentIds] = useState<string[]>(() => readIds(RECENT_KEY))

  const filtered = useMemo(() => {
    return dashboards.filter((d) => matchesTab(d, tab) && matchesSearch(d, search))
  }, [dashboards, search, tab])

  const groups: DashboardGroup[] = useMemo(
    () => groupDashboards(filtered, { pinnedIds, recentIds }),
    [filtered, pinnedIds, recentIds],
  )

  const togglePin = useCallback((id: string) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [id, ...prev]
      writeIds(PINNED_KEY, next)
      return next
    })
  }, [])

  const isPinned = useCallback((id: string) => pinnedIds.includes(id), [pinnedIds])

  const recordRecent = useCallback((id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, MAX_RECENT)
      writeIds(RECENT_KEY, next)
      return next
    })
  }, [])

  return {
    search,
    setSearch,
    tab,
    setTab,
    filtered,
    groups,
    pinnedIds,
    recentIds,
    togglePin,
    isPinned,
    recordRecent,
  }
}
