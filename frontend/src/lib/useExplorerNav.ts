import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getHierarchyTree, type PlantNode } from './hierarchy'
import { useLiveSnapshots } from './useLiveSnapshots'
import { scopeToParam } from './scopeFromUrl'
import { applySnapshotsToTree } from '../components/explorer/explorerKpi'
import {
  ancestorsOf,
  childrenOfNode,
  findNodeFromScope,
  flattenTree,
  type ExplorerChildSummary,
} from '../components/explorer/explorerTree'
import type { ExplorerNode } from '../components/explorer/explorerTypes'

export type ExplorerStatusFilter = 'all' | 'Running' | 'Down' | 'Idle' | 'Disconnected'

export interface ExplorerRecent {
  level: ExplorerNode['level']
  id: string
  name: string
}

function matchesStatusFilter(node: ExplorerNode, filter: ExplorerStatusFilter): boolean {
  if (filter === 'all') return true
  if (filter === 'Disconnected') return node.kpi.connectionState !== 'Connected'
  if (node.kpi.connectionState !== 'Connected') return false
  if (filter === 'Idle') return node.kpi.status !== 'Running' && node.kpi.status !== 'Down' && node.kpi.status !== 'Setup'
  return node.kpi.status === filter
}

/**
 * Central navigation state for Plant Explorer's breadcrumb-driven canvas: loads the
 * hierarchy (with surfaced loading/error state), keeps a selection in sync with the
 * `?scope=` URL param, and derives the breadcrumb chain + current children + a flat
 * search index from the live (snapshot-merged) tree.
 */
export function useExplorerNav() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rawTree, setRawTree] = useState<PlantNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedScope, setSelectedScope] = useState<{ level: ExplorerNode['level']; id: string } | null>(null)
  const [recent, setRecent] = useState<ExplorerRecent[]>([])
  const [statusFilter, setStatusFilter] = useState<ExplorerStatusFilter>('all')
  const [railOpen, setRailOpen] = useState(false)
  const appliedInitialScope = useRef(false)

  const loadTree = useCallback(() => {
    setLoading(true)
    setError(null)
    return getHierarchyTree()
      .then((t) => {
        setRawTree(t)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Failed to load plant hierarchy')
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  const { snapshots, hubConnected } = useLiveSnapshots()
  const tree = useMemo(() => applySnapshotsToTree(rawTree, snapshots), [rawTree, snapshots])

  // Apply ?scope= once the tree is available; afterwards navigation is driven by `select()`.
  // Single-plant sites auto-enter that plant when no scope is in the URL.
  useEffect(() => {
    if (appliedInitialScope.current || tree.length === 0) return
    appliedInitialScope.current = true
    const scopeParam = searchParams.get('scope')
    if (scopeParam) {
      const node = findNodeFromScope(tree, scopeParam)
      if (node) setSelectedScope({ level: node.level, id: node.id })
      return
    }
    if (tree.length === 1) {
      const plant = tree[0]
      setSelectedScope({ level: 'Plant', id: plant.id })
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('scope', scopeToParam('Plant', plant.id))
          return p
        },
        { replace: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree])

  const selected = useMemo<ExplorerNode | null>(() => {
    if (!selectedScope) return null
    return findNodeFromScope(tree, scopeToParam(selectedScope.level, selectedScope.id))
  }, [tree, selectedScope])

  const breadcrumb = useMemo(() => ancestorsOf(tree, selected), [tree, selected])
  const children = useMemo<ExplorerChildSummary[]>(() => childrenOfNode(tree, selected), [tree, selected])
  const filteredChildren = useMemo(
    () => children.filter((c) => matchesStatusFilter(c, statusFilter)),
    [children, statusFilter],
  )
  const searchIndex = useMemo(() => flattenTree(tree), [tree])

  const select = useCallback(
    (node: ExplorerNode | null) => {
      setSelectedScope(node ? { level: node.level, id: node.id } : null)
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        if (node) p.set('scope', scopeToParam(node.level, node.id))
        else p.delete('scope')
        return p
      })
      if (node) {
        setRecent((prevRecent) => {
          const withoutDup = prevRecent.filter((r) => r.id !== node.id)
          return [{ level: node.level, id: node.id, name: node.name }, ...withoutDup].slice(0, 5)
        })
      }
    },
    [setSearchParams],
  )

  const goHome = useCallback(() => select(null), [select])

  return {
    tree,
    loading,
    error,
    reload: loadTree,
    selected,
    breadcrumb,
    children,
    filteredChildren,
    searchIndex,
    recent,
    select,
    goHome,
    statusFilter,
    setStatusFilter,
    railOpen,
    setRailOpen,
    snapshots,
    hubConnected,
  }
}
