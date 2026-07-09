import { apiGet } from './api'
import { isAuditApiMode } from '../features/builder/auditApiMode'
import { mockHierarchyTree } from '../features/builder/mockAuditApi'

export interface NodeKpi {
  oeePct: number
  availabilityPct: number
  performancePct: number
  qualityPct: number
  goodCount: number
  rejectCount: number
  status: string
  connectionState: string
  activeRecipeCode?: string | null
  activeRecipeName?: string | null
  idealCycleTimeSec: number
  actualCycleTimeSec: number
  actualRatePph: number
  idealRatePph: number
  recipeIsAutoCreated: boolean
}
export interface MachineNode {
  id: string
  name: string
  kpi: NodeKpi
  state?: string | null
  faultCode?: number | null
  speed: number
}
export interface LineNode {
  id: string
  name: string
  kpi: NodeKpi
  machines: MachineNode[]
  activeProductCode?: string | null
}
export interface DeptNode {
  id: string
  name: string
  kpi: NodeKpi
  lines: LineNode[]
}
export interface PlantNode {
  id: string
  name: string
  kpi: NodeKpi
  departments: DeptNode[]
}

export interface ProductionContext {
  activeRecipeCode?: string | null
  activeRecipeName?: string | null
  activeRecipeId?: string | null
  idealCycleTimeSec: number
  idealCycleSource: string
  targetQuantity?: number | null
  productSource: string
  plcPartIdMapped: boolean
  recipeIsAutoCreated: boolean
  changeoverOpen: boolean
  changeoverReason?: string | null
  productionRunStartUtc?: string | null
  autoCreatedProductCount: number
  changeoverMode: import('./idealRate').ChangeoverMode
  recentProductChanges: ProductChangeLog[]
}

export interface ProductChangeLog {
  fromProductId?: string | null
  toProductId: string
  changedUtc: string
}

export const getHierarchyTree = () =>
  isAuditApiMode() ? Promise.resolve(mockHierarchyTree()) : apiGet<PlantNode[]>('/api/hierarchy/tree')
export const getOperatorStations = () =>
  isAuditApiMode() ? Promise.resolve(mockHierarchyTree()) : apiGet<PlantNode[]>('/api/hierarchy/stations')
export const getLineProductionContext = (lineId: string) =>
  apiGet<ProductionContext>(`/api/hierarchy/lines/${lineId}/production-context`)
