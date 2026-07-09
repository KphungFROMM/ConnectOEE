import type { PlantNode } from '../../lib/hierarchy'
import type { MachineSnapshot } from '../../lib/liveHub'

export interface LineMeta {
  name: string
  plant: string
  dept: string
}

export interface LineRankItem {
  lineId: string
  name: string
  value: number
  plant?: string
  dept?: string
}

export const OEE_TARGET_PCT = 85

export function buildLineMetaMap(tree: PlantNode[] | null | undefined): Map<string, LineMeta> {
  const map = new Map<string, LineMeta>()
  for (const p of tree ?? []) {
    for (const d of p.departments) {
      for (const l of d.lines) {
        map.set(l.id.toLowerCase(), { name: l.name, plant: p.name, dept: d.name })
      }
    }
  }
  return map
}

export function flatLines(tree: PlantNode[] | null | undefined, plantId?: string | null) {
  const plantKey = plantId?.toLowerCase()
  return (tree ?? [])
    .filter((p) => !plantKey || p.id.toLowerCase() === plantKey)
    .flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ plant: p.name, dept: d.name, line: l }))))
}

export function rankLinesFromTree(tree: PlantNode[] | null | undefined, plantId?: string | null): LineRankItem[] {
  return flatLines(tree, plantId).map(({ plant, dept, line }) => ({
    lineId: line.id.toLowerCase(),
    name: line.name,
    value: line.kpi.oeePct,
    plant,
    dept,
  }))
}

export function rankLinesFromSnapshots(
  snapshots: MachineSnapshot[],
  metaMap: Map<string, LineMeta>,
): LineRankItem[] {
  const byLine = new Map<string, number[]>()
  for (const s of snapshots) {
    const key = s.lineId.toLowerCase()
    const bucket = byLine.get(key) ?? []
    bucket.push(s.oeePct ?? 0)
    byLine.set(key, bucket)
  }
  return Array.from(byLine.entries()).map(([lineId, values]) => {
    const meta = metaMap.get(lineId)
    return {
      lineId,
      name: meta?.name ?? `Line ${lineId.slice(0, 8)}`,
      value: values.reduce((sum, v) => sum + v, 0) / values.length,
      plant: meta?.plant,
      dept: meta?.dept,
    }
  })
}

export function mergeLineRanking(
  tree: PlantNode[] | null | undefined,
  plantId: string | null | undefined,
  snapshots: MachineSnapshot[],
): LineRankItem[] {
  const metaMap = buildLineMetaMap(tree)
  const treeItems = rankLinesFromTree(tree, plantId)
  if (treeItems.length > 0) return treeItems
  return rankLinesFromSnapshots(snapshots, metaMap)
}

export function atRiskLines(items: LineRankItem[], maxItems = 4): LineRankItem[] {
  return [...items]
    .filter((item) => item.value < OEE_TARGET_PCT)
    .sort((a, b) => a.value - b.value)
    .slice(0, maxItems)
}
