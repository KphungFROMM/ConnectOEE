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
  topology?: import('./lineTopology').LineTopologyMode
  lineOutputMachineId?: string | null
  pacingMachineId?: string | null
  lineOutputMachineName?: string | null
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

export type HierarchyLevel = 'Plant' | 'Department' | 'Line' | 'Machine'

/** A single hierarchy node flattened out of the nested tree, with its ancestry kept alongside for search/breadcrumb use. */
export interface FlatHierarchyNode {
  level: HierarchyLevel
  id: string
  name: string
  kpi: NodeKpi
  plantId: string
  plantName: string
  deptId?: string
  deptName?: string
  lineId?: string
  lineName?: string
  activeProductCode?: string | null
  /** Ancestor names joined "Plant › Dept › Line" (excludes the node itself) — disambiguates same-named nodes (e.g. every line has a "Washing" machine). */
  parentPath?: string
  topology?: import('./lineTopology').LineTopologyMode
  lineOutputMachineName?: string | null
}

/** Flatten Plant→Department→Line→Machine into a single searchable/indexable list. */
export function flattenHierarchyTree(tree: PlantNode[]): FlatHierarchyNode[] {
  const out: FlatHierarchyNode[] = []
  for (const plant of tree) {
    out.push({ level: 'Plant', id: plant.id, name: plant.name, kpi: plant.kpi, plantId: plant.id, plantName: plant.name })
    for (const dept of plant.departments) {
      out.push({
        level: 'Department',
        id: dept.id,
        name: dept.name,
        kpi: dept.kpi,
        plantId: plant.id,
        plantName: plant.name,
        deptId: dept.id,
        deptName: dept.name,
        parentPath: plant.name,
      })
      for (const line of dept.lines) {
        out.push({
          level: 'Line',
          id: line.id,
          name: line.name,
          kpi: line.kpi,
          plantId: plant.id,
          plantName: plant.name,
          deptId: dept.id,
          deptName: dept.name,
          lineId: line.id,
          lineName: line.name,
          activeProductCode: line.activeProductCode ?? line.kpi.activeRecipeCode,
          parentPath: `${plant.name} › ${dept.name}`,
          topology: line.topology,
          lineOutputMachineName: line.lineOutputMachineName,
        })
        for (const machine of line.machines) {
          out.push({
            level: 'Machine',
            id: machine.id,
            name: machine.name,
            kpi: machine.kpi,
            plantId: plant.id,
            plantName: plant.name,
            deptId: dept.id,
            deptName: dept.name,
            lineId: line.id,
            lineName: line.name,
            parentPath: `${plant.name} › ${dept.name} › ${line.name}`,
          })
        }
      }
    }
  }
  return out
}

export const getHierarchyTree = () =>
  isAuditApiMode() ? Promise.resolve(mockHierarchyTree()) : apiGet<PlantNode[]>('/api/hierarchy/tree')
export const getOperatorStations = () => apiGet<PlantNode[]>('/api/hierarchy/stations')
export const getLineProductionContext = (lineId: string) =>
  apiGet<ProductionContext>(`/api/hierarchy/lines/${lineId}/production-context`)
