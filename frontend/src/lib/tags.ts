import { apiGet, apiPost } from './api'
import { apiDelete } from './admin'
import { isAuditApiMode } from '../features/builder/auditApiMode'
import { mockTagValues } from '../features/builder/mockAuditApi'

// ----- Live tag browser (Phase 9) -----
export interface BrowseTag {
  name: string
  fullPath: string
  dataType: string
  udtTypeName?: string | null
  arrayLength: number
  description?: string | null
  bindable: boolean
  flattenedPath: string
  children: BrowseTag[]
}

export interface BrowseResult {
  supportsBrowsing: boolean
  driverType: string
  tags: BrowseTag[]
}

export interface TagValueSample {
  fullPath: string
  value: number
  quality: string
  timestampUtc: string
  display?: string | null
}

export interface TagPathRequest {
  path: string
  dataType?: string | null
}

export interface MapResult {
  mapped: boolean
  warning?: string | null
}

export interface ImportResult {
  tags: number
  udts: number
  members: number
}

export const browseTags = (connectionId: string) =>
  apiGet<BrowseResult>(`/api/tags/browse?connectionId=${connectionId}`)

export const readTagValues = (connectionId: string, paths: TagPathRequest[]) =>
  isAuditApiMode()
    ? Promise.resolve(mockTagValues(paths))
    : apiPost<TagValueSample[]>('/api/tags/values', { connectionId, paths })

export const importTags = (connectionId: string) =>
  apiPost<ImportResult>(`/api/tags/import?connectionId=${connectionId}`, {})

export const mapTagBound = (body: {
  logicalSignalId: string
  tagPath: string
  plcConnectionId?: string | null
  dataType?: string | null
}) => apiPost<MapResult>('/api/tags/map', body)

export const unmapSignal = (signalId: string) => apiDelete(`/api/tags/map/${signalId}`)

/** Flattens a browse tree into the visible rows for a virtualized list, honoring
 * the expanded set and an optional case-insensitive name/path filter. */
export interface FlatRow {
  tag: BrowseTag
  depth: number
  hasChildren: boolean
  expanded: boolean
}

export function flattenVisible(
  roots: BrowseTag[],
  expanded: Set<string>,
  filter: string,
): FlatRow[] {
  const q = filter.trim().toLowerCase()
  const matches = (t: BrowseTag): boolean =>
    !q ||
    t.name.toLowerCase().includes(q) ||
    t.fullPath.toLowerCase().includes(q) ||
    (t.udtTypeName?.toLowerCase().includes(q) ?? false)

  // A node is kept if it matches or any descendant matches.
  const keep = (t: BrowseTag): boolean => matches(t) || t.children.some(keep)

  const rows: FlatRow[] = []
  const walk = (nodes: BrowseTag[], depth: number) => {
    for (const t of nodes) {
      if (q && !keep(t)) continue
      const hasChildren = t.children.length > 0
      // When filtering, auto-expand to reveal matches.
      const isExpanded = q ? true : expanded.has(t.fullPath)
      rows.push({ tag: t, depth, hasChildren, expanded: isExpanded })
      if (hasChildren && isExpanded) walk(t.children, depth + 1)
    }
  }
  walk(roots, 0)
  return rows
}
