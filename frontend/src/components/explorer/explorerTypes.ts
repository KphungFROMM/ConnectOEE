import type { NodeKpi } from '../../lib/hierarchy'

export type ExplorerLevel = 'Plant' | 'Department' | 'Line' | 'Machine'

export interface ExplorerNode {
  level: ExplorerLevel
  id: string
  name: string
  kpi: NodeKpi
  lineId?: string
  machineId?: string
  plantId?: string
  /** Ancestor names joined "Plant › Dept › Line" (excludes this node) — only populated on flattened search-index entries. */
  parentPath?: string
  topology?: import('../../lib/lineTopology').LineTopologyMode
  lineOutputMachineName?: string | null
}

export type ExplorerRange = 'shift' | '8h'
