import type { EntityLevel } from './historian'
import type { PlantNode } from './hierarchy'

export interface ScopeSelection {
  plantId: string | null
  deptId: string | null
  lineId: string | null
  machineId: string | null
}

export function scopeToParam(level: EntityLevel, id: string): string {
  return `${level}:${id}`
}

export function parseScopeParam(scope: string): { level: EntityLevel; id: string } | null {
  const [levelRaw, id] = scope.split(':')
  if (!id || !levelRaw) return null
  const level = levelRaw as EntityLevel
  if (!['Plant', 'Department', 'Line', 'Machine'].includes(level)) return null
  return { level, id }
}

/** Resolve hierarchy select IDs from a `Level:uuid` scope string. */
export function resolveScopeSelection(tree: PlantNode[], scopeParam: string): ScopeSelection | null {
  const parsed = parseScopeParam(scopeParam)
  if (!parsed) return null

  for (const plant of tree) {
    if (parsed.level === 'Plant' && plant.id === parsed.id) {
      return { plantId: plant.id, deptId: null, lineId: null, machineId: null }
    }
    for (const dept of plant.departments) {
      if (parsed.level === 'Department' && dept.id === parsed.id) {
        return { plantId: plant.id, deptId: dept.id, lineId: null, machineId: null }
      }
      for (const line of dept.lines) {
        if (parsed.level === 'Line' && line.id === parsed.id) {
          return { plantId: plant.id, deptId: dept.id, lineId: line.id, machineId: null }
        }
        for (const machine of line.machines) {
          if (parsed.level === 'Machine' && machine.id === parsed.id) {
            return { plantId: plant.id, deptId: dept.id, lineId: line.id, machineId: machine.id }
          }
        }
      }
    }
  }
  return null
}
