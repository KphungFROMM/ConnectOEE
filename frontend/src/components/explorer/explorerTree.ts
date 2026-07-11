import { flattenHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { parseScopeParam } from '../../lib/scopeFromUrl'
import type { ExplorerNode } from './explorerTypes'

/** A drill-grid child card — an {@link ExplorerNode} plus how many of its own children it has. */
export interface ExplorerChildSummary extends ExplorerNode {
  childCount?: number
  childLabel?: string
  activeProductCode?: string | null
}

/** Resolve a `Level:uuid` scope string (as used in `?scope=`) against the live tree. */
export function findNodeFromScope(tree: PlantNode[], scope: string): ExplorerNode | null {
  const parsed = parseScopeParam(scope)
  if (!parsed) return null
  return findNodeById(tree, parsed.level as ExplorerNode['level'], parsed.id)
}

export function findNodeById(tree: PlantNode[], level: ExplorerNode['level'], id: string): ExplorerNode | null {
  for (const plant of tree) {
    if (level === 'Plant' && plant.id === id) {
      return { level: 'Plant', id: plant.id, name: plant.name, kpi: plant.kpi, plantId: plant.id }
    }
    for (const dept of plant.departments) {
      if (level === 'Department' && dept.id === id) {
        return { level: 'Department', id: dept.id, name: dept.name, kpi: dept.kpi, plantId: plant.id }
      }
      for (const line of dept.lines) {
        if (level === 'Line' && line.id === id) {
          return {
            level: 'Line',
            id: line.id,
            name: line.name,
            kpi: line.kpi,
            lineId: line.id,
            plantId: plant.id,
            topology: line.topology,
            lineOutputMachineName: line.lineOutputMachineName,
          }
        }
        for (const machine of line.machines) {
          if (level === 'Machine' && machine.id === id) {
            return {
              level: 'Machine',
              id: machine.id,
              name: machine.name,
              kpi: machine.kpi,
              lineId: line.id,
              machineId: machine.id,
              plantId: plant.id,
            }
          }
        }
      }
    }
  }
  return null
}

/** Plant → …→ node chain for breadcrumb pills. Empty when node is null/not found. */
export function ancestorsOf(tree: PlantNode[], node: ExplorerNode | null): ExplorerNode[] {
  if (!node) return []
  for (const plant of tree) {
    const plantEntry: ExplorerNode = { level: 'Plant', id: plant.id, name: plant.name, kpi: plant.kpi, plantId: plant.id }
    if (node.level === 'Plant' && plant.id === node.id) return [plantEntry]

    for (const dept of plant.departments) {
      const deptEntry: ExplorerNode = { level: 'Department', id: dept.id, name: dept.name, kpi: dept.kpi, plantId: plant.id }
      if (node.level === 'Department' && dept.id === node.id) return [plantEntry, deptEntry]

      for (const line of dept.lines) {
        const lineEntry: ExplorerNode = {
          level: 'Line',
          id: line.id,
          name: line.name,
          kpi: line.kpi,
          lineId: line.id,
          plantId: plant.id,
          topology: line.topology,
          lineOutputMachineName: line.lineOutputMachineName,
        }
        if (node.level === 'Line' && line.id === node.id) return [plantEntry, deptEntry, lineEntry]

        for (const machine of line.machines) {
          if (node.level === 'Machine' && machine.id === node.id) {
            return [
              plantEntry,
              deptEntry,
              lineEntry,
              {
                level: 'Machine',
                id: machine.id,
                name: machine.name,
                kpi: machine.kpi,
                lineId: line.id,
                machineId: machine.id,
                plantId: plant.id,
              },
            ]
          }
        }
      }
    }
  }
  return []
}

function pluralize(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`
}

/** Immediate children of a node as drill-grid cards. Passing `null` returns the plant list (root screen). */
export function childrenOfNode(tree: PlantNode[], node: ExplorerNode | null): ExplorerChildSummary[] {
  if (!node) {
    return tree.map((p) => ({
      level: 'Plant',
      id: p.id,
      name: p.name,
      kpi: p.kpi,
      plantId: p.id,
      childCount: p.departments.length,
      childLabel: pluralize(p.departments.length, 'department'),
    }))
  }

  if (node.level === 'Plant') {
    const plant = tree.find((p) => p.id === node.id)
    if (!plant) return []
    return plant.departments.map((d) => ({
      level: 'Department',
      id: d.id,
      name: d.name,
      kpi: d.kpi,
      plantId: plant.id,
      childCount: d.lines.length,
      childLabel: pluralize(d.lines.length, 'line'),
    }))
  }

  if (node.level === 'Department') {
    for (const p of tree) {
      const dept = p.departments.find((d) => d.id === node.id)
      if (dept) {
        return dept.lines.map((l) => ({
          level: 'Line' as const,
          id: l.id,
          name: l.name,
          kpi: l.kpi,
          lineId: l.id,
          plantId: p.id,
          childCount: l.machines.length,
          childLabel: pluralize(l.machines.length, 'machine'),
          activeProductCode: l.activeProductCode ?? l.kpi.activeRecipeCode,
          topology: l.topology,
          lineOutputMachineName: l.lineOutputMachineName,
        }))
      }
    }
    return []
  }

  if (node.level === 'Line') {
    for (const p of tree) {
      for (const d of p.departments) {
        const line = d.lines.find((l) => l.id === node.id)
        if (line) {
          return line.machines.map((m) => ({
            level: 'Machine',
            id: m.id,
            name: m.name,
            kpi: m.kpi,
            lineId: line.id,
            machineId: m.id,
            plantId: p.id,
          }))
        }
      }
    }
    return []
  }

  return []
}

/** Flat, searchable index of every node in the tree — used by the Navigator's jump search and the Rail. */
export function flattenTree(tree: PlantNode[]): ExplorerNode[] {
  return flattenHierarchyTree(tree).map((n) => ({
    level: n.level,
    id: n.id,
    name: n.name,
    kpi: n.kpi,
    plantId: n.plantId,
    lineId: n.lineId,
    machineId: n.level === 'Machine' ? n.id : undefined,
    parentPath: n.parentPath,
    topology: n.topology,
    lineOutputMachineName: n.lineOutputMachineName,
  }))
}
