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
}

export type ExplorerRange = 'shift' | '8h'
