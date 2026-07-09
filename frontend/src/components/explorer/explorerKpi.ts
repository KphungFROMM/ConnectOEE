import type { NodeKpi, PlantNode } from '../../lib/hierarchy'

import type { MachineSnapshot } from '../../lib/liveHub'



/** Reliability and rate fields enriched from live snapshot when available. */

export interface ExplorerLiveMetrics {

  mttrMin: number

  mtbfMin: number

  mttfMin: number

  mttdMin: number

  stopsPerHour: number

  downtimeMin: number

  uptimeMin: number

  uptimePct: number

  plannedDowntimeMin: number

  unplannedDowntimeMin: number

  failureCount: number

  microStopCount: number

  actualRatePph: number

  idealRatePph: number

  rateVariancePct: number

  idealCycleSource?: string | null

  faultCode: number | null

  downtimeReasonText?: string | null

  speed: number

  shiftName: string

  shiftStartUtc: string

  shiftEndUtc: string

  targetOeePct?: number

  oeeGapPct?: number

  runAttainmentPct?: number

  shiftAttainmentPct?: number

}



export function machineIdsForExplorerNode(

  tree: PlantNode[],

  node: { level: string; id?: string },

): string[] {

  if (!node.id) return []

  if (node.level === 'Plant') {

    const plant = tree.find((p) => p.id === node.id)

    if (!plant) return []

    return plant.departments.flatMap((d) => d.lines.flatMap((l) => l.machines.map((m) => m.id)))

  }

  if (node.level === 'Department') {

    for (const p of tree) {

      const dept = p.departments.find((d) => d.id === node.id)

      if (dept) return dept.lines.flatMap((l) => l.machines.map((m) => m.id))

    }

    return []

  }

  if (node.level === 'Line') {

    for (const p of tree) {

      for (const d of p.departments) {

        const line = d.lines.find((l) => l.id === node.id)

        if (line) return line.machines.map((m) => m.id)

      }

    }

    return []

  }

  if (node.level === 'Machine' && node.id) return [node.id]

  return []

}



export function machineNamesForLine(tree: PlantNode[], lineId: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const p of tree) {
    for (const d of p.departments) {
      const line = d.lines.find((l) => l.id === lineId)
      if (line) {
        for (const m of line.machines) out[m.id] = m.name
        return out
      }
    }
  }
  return out
}



export function pickSnapshot(

  snapshots: MachineSnapshot[],

  node: { level: string; id?: string; machineId?: string; lineId?: string },

): MachineSnapshot | undefined {

  const machineId = node.machineId ?? (node.level === 'Machine' ? node.id : undefined)

  if (machineId) return snapshots.find((s) => s.machineId === machineId)

  if (node.level === 'Line' && node.lineId) {

    return snapshots.find((s) => s.lineId === node.lineId)

  }

  if (node.lineId) return snapshots.find((s) => s.lineId === node.lineId)

  return undefined

}



function rollupSnapshots(snapshots: MachineSnapshot[]): ExplorerLiveMetrics | null {

  if (snapshots.length === 0) return null

  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)

  const sum = (vals: number[]) => vals.reduce((a, b) => a + b, 0)

  const first = snapshots[0]

  return {

    mttrMin: avg(snapshots.map((s) => s.mttrMin ?? 0)),

    mtbfMin: avg(snapshots.map((s) => s.mtbfMin ?? 0)),

    mttfMin: avg(snapshots.map((s) => s.mttfMin ?? 0)),

    mttdMin: avg(snapshots.map((s) => s.mttdMin ?? 0)),

    stopsPerHour: avg(snapshots.map((s) => s.stopsPerHour ?? 0)),

    downtimeMin: avg(snapshots.map((s) => s.downtimeMin ?? 0)),

    uptimeMin: avg(snapshots.map((s) => s.uptimeMin ?? 0)),

    uptimePct: avg(snapshots.map((s) => s.uptimePct ?? 0)),

    plannedDowntimeMin: avg(snapshots.map((s) => s.plannedDowntimeMin ?? 0)),

    unplannedDowntimeMin: avg(snapshots.map((s) => s.unplannedDowntimeMin ?? 0)),

    failureCount: sum(snapshots.map((s) => s.failureCount ?? 0)),

    microStopCount: sum(snapshots.map((s) => s.microStopCount ?? 0)),

    actualRatePph: avg(snapshots.map((s) => s.actualRatePph ?? 0)),

    idealRatePph: avg(snapshots.map((s) => s.idealRatePph ?? 0)),

    rateVariancePct: avg(snapshots.map((s) => s.rateVariancePct ?? 0)),

    faultCode: null,

    speed: avg(snapshots.map((s) => s.speed ?? 0)),

    shiftName: first.shiftName ?? '',

    shiftStartUtc: first.shiftStartUtc ?? '',

    shiftEndUtc: first.shiftEndUtc ?? '',

    targetOeePct: avg(snapshots.map((s) => s.targetOeePct ?? 85)),

    oeeGapPct: avg(snapshots.map((s) => s.oeeGapPct ?? (s.oeePct - (s.targetOeePct ?? 85)))),

    runAttainmentPct: avg(snapshots.map((s) => s.runAttainmentPct ?? 0)),

    shiftAttainmentPct: avg(snapshots.map((s) => s.shiftAttainmentPct ?? 0)),

  }

}



/** Sum/average live reliability fields across all machines on a line. */

export function rollupLineLiveMetrics(snapshots: MachineSnapshot[], lineId: string): ExplorerLiveMetrics | null {

  return rollupSnapshots(snapshots.filter((s) => s.lineId === lineId))

}



export function liveMetricsForExplorerNode(

  snapshots: MachineSnapshot[],

  node: { level: string; id?: string; machineId?: string; lineId?: string },

  tree?: PlantNode[],

): ExplorerLiveMetrics | null {

  if (node.level === 'Line' && node.lineId) {

    return rollupLineLiveMetrics(snapshots, node.lineId)

  }

  if (node.level === 'Machine') {

    return liveMetricsFromSnapshot(pickSnapshot(snapshots, node))

  }

  if ((node.level === 'Plant' || node.level === 'Department') && tree && node.id) {

    const ids = new Set(machineIdsForExplorerNode(tree, node))

    return rollupSnapshots(snapshots.filter((s) => ids.has(s.machineId)))

  }

  return liveMetricsFromSnapshot(pickSnapshot(snapshots, node))

}



/** Good/reject/downtime/uptime for the shift card — live while open, persisted when closed. */

export function shiftCardStats(

  shift: { isClosed: boolean; goodCount: number; rejectCount: number; downtimeMinutes: number } | null,

  kpi?: NodeKpi,

  live?: ExplorerLiveMetrics | null,

) {

  const useLive = shift ? !shift.isClosed : true

  if (useLive) {

    return {

      goodCount: kpi?.goodCount ?? shift?.goodCount ?? 0,

      rejectCount: kpi?.rejectCount ?? shift?.rejectCount ?? 0,

      downtimeMinutes: live?.downtimeMin ?? shift?.downtimeMinutes ?? 0,

      uptimeMinutes: live?.uptimeMin ?? 0,

    }

  }

  return {

    goodCount: shift?.goodCount ?? kpi?.goodCount ?? 0,

    rejectCount: shift?.rejectCount ?? kpi?.rejectCount ?? 0,

    downtimeMinutes: shift?.downtimeMinutes ?? live?.downtimeMin ?? 0,

    uptimeMinutes: live?.uptimeMin ?? 0,

  }

}



export function teepPctForExplorerNode(

  snapshots: MachineSnapshot[],

  node: { level: string; id?: string; machineId?: string; lineId?: string },

  tree?: PlantNode[],

): number {

  const avg = (vals: number[]) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)

  if (node.level === 'Machine') {

    return pickSnapshot(snapshots, node)?.teepPct ?? 0

  }

  if (node.level === 'Line') {

    const lineId = node.lineId ?? node.id

    const snaps = snapshots.filter((s) => s.lineId === lineId)

    return avg(snaps.map((s) => s.teepPct ?? 0))

  }

  if (tree && node.id) {

    const ids = new Set(machineIdsForExplorerNode(tree, node))

    const snaps = snapshots.filter((s) => ids.has(s.machineId))

    return avg(snaps.map((s) => s.teepPct ?? 0))

  }

  return avg(snapshots.map((s) => s.teepPct ?? 0))

}



export function liveMetricsFromSnapshot(s?: MachineSnapshot): ExplorerLiveMetrics | null {

  if (!s) return null

  return {

    mttrMin: s.mttrMin ?? 0,

    mtbfMin: s.mtbfMin ?? 0,

    mttfMin: s.mttfMin ?? 0,

    mttdMin: s.mttdMin ?? 0,

    stopsPerHour: s.stopsPerHour ?? 0,

    downtimeMin: s.downtimeMin ?? 0,

    uptimeMin: s.uptimeMin ?? 0,

    uptimePct: s.uptimePct ?? 0,

    plannedDowntimeMin: s.plannedDowntimeMin ?? 0,

    unplannedDowntimeMin: s.unplannedDowntimeMin ?? 0,

    failureCount: s.failureCount ?? 0,

    microStopCount: s.microStopCount ?? 0,

    actualRatePph: s.actualRatePph ?? 0,

    idealRatePph: s.idealRatePph ?? 0,

    rateVariancePct: s.rateVariancePct ?? 0,

    idealCycleSource: s.idealCycleSource,

    faultCode: s.faultCode,

    downtimeReasonText: s.downtimeReasonText,

    speed: s.speed ?? 0,

    shiftName: s.shiftName ?? '',

    shiftStartUtc: s.shiftStartUtc ?? '',

    shiftEndUtc: s.shiftEndUtc ?? '',

    targetOeePct: s.targetOeePct,

    oeeGapPct: s.oeeGapPct,

    runAttainmentPct: s.runAttainmentPct ?? undefined,

    shiftAttainmentPct: s.shiftAttainmentPct ?? undefined,

  }

}



export function mergeKpiWithSnapshot(kpi: NodeKpi, snap?: MachineSnapshot): NodeKpi {

  if (!snap) return kpi

  return {

    ...kpi,

    oeePct: snap.oeePct ?? kpi.oeePct,

    availabilityPct: snap.availabilityPct ?? kpi.availabilityPct,

    performancePct: snap.performancePct ?? kpi.performancePct,

    qualityPct: snap.qualityPct ?? kpi.qualityPct,

    goodCount: snap.goodCount ?? kpi.goodCount,

    rejectCount: snap.rejectCount ?? kpi.rejectCount,

    status: snap.state ?? kpi.status,

    connectionState: snap.connectionState ?? kpi.connectionState,

    idealCycleTimeSec: snap.idealCycleTimeSec ?? kpi.idealCycleTimeSec,

    actualCycleTimeSec: snap.actualCycleTimeSec ?? kpi.actualCycleTimeSec,

    actualRatePph: snap.actualRatePph ?? kpi.actualRatePph,

    idealRatePph: snap.idealRatePph ?? kpi.idealRatePph,

    activeRecipeCode: snap.activeRecipeCode ?? kpi.activeRecipeCode,

    activeRecipeName: snap.activeRecipeName ?? kpi.activeRecipeName,

  }

}



const STATUS_RANK: Record<string, number> = {

  Down: 5,

  Setup: 4,

  Blocked: 3,

  Starved: 3,

  Idle: 2,

  Running: 1,

  PlannedDown: 1,

  Unknown: 0,

}



function worstStatus(statuses: string[]): string {

  return statuses.reduce((worst, s) => ((STATUS_RANK[s] ?? 0) > (STATUS_RANK[worst] ?? 0) ? s : worst), 'Unknown')

}



/** Roll child KPIs up for line/dept/plant — mirrors HierarchyController.RollUp. */

export function rollUpKpis(kpis: NodeKpi[]): NodeKpi {

  if (kpis.length === 0) {

    return {

      oeePct: 0,

      availabilityPct: 0,

      performancePct: 0,

      qualityPct: 0,

      goodCount: 0,

      rejectCount: 0,

      status: 'Unknown',

      connectionState: 'Disconnected',

      activeRecipeCode: null,

      activeRecipeName: null,

      idealCycleTimeSec: 0,

      actualCycleTimeSec: 0,

      actualRatePph: 0,

      idealRatePph: 0,

      recipeIsAutoCreated: false,

    }

  }

  const idealCycles = kpis.filter((c) => c.idealCycleTimeSec > 0).map((c) => c.idealCycleTimeSec)

  const actualCycles = kpis.filter((c) => c.actualCycleTimeSec > 0).map((c) => c.actualCycleTimeSec)

  const goodCount = kpis.reduce((s, c) => s + c.goodCount, 0)

  const rejectCount = kpis.reduce((s, c) => s + c.rejectCount, 0)

  const availabilityPct = Math.round((kpis.reduce((s, c) => s + c.availabilityPct, 0) / kpis.length) * 100) / 100

  const performancePct = Math.round((kpis.reduce((s, c) => s + c.performancePct, 0) / kpis.length) * 100) / 100

  const totalPieces = goodCount + rejectCount

  const qualityPct =

    totalPieces > 0

      ? Math.round((goodCount / totalPieces) * 10000) / 100

      : Math.round((kpis.reduce((s, c) => s + c.qualityPct, 0) / kpis.length) * 100) / 100

  const oeePct = Math.round((availabilityPct * performancePct * qualityPct) / 10000 * 100) / 100

  return {

    oeePct,

    availabilityPct,

    performancePct,

    qualityPct,

    goodCount,

    rejectCount,

    status: worstStatus(kpis.map((c) => c.status)),

    connectionState: kpis.some((c) => c.connectionState === 'Connected') ? 'Connected' : 'Disconnected',

    activeRecipeCode: kpis.map((c) => c.activeRecipeCode).find((c) => c) ?? null,

    activeRecipeName: kpis.map((c) => c.activeRecipeName).find((c) => c) ?? null,

    idealCycleTimeSec: idealCycles.length ? Math.round((idealCycles.reduce((a, b) => a + b, 0) / idealCycles.length) * 100) / 100 : 0,

    actualCycleTimeSec: actualCycles.length ? Math.round((actualCycles.reduce((a, b) => a + b, 0) / actualCycles.length) * 100) / 100 : 0,

    actualRatePph: Math.round((kpis.reduce((s, c) => s + c.actualRatePph, 0) / kpis.length) * 100) / 100,

    idealRatePph: Math.round((kpis.reduce((s, c) => s + c.idealRatePph, 0) / kpis.length) * 100) / 100,

    recipeIsAutoCreated: kpis.some((c) => c.recipeIsAutoCreated),

  }

}



/** Overlay SignalR/REST snapshots onto hierarchy tree KPIs (server cache can lag after setup). */

export function applySnapshotsToTree(tree: PlantNode[], snapshots: MachineSnapshot[]): PlantNode[] {

  if (snapshots.length === 0) return tree

  const byMachine = new Map(snapshots.map((s) => [s.machineId, s]))



  return tree.map((plant) => {

    const departments = plant.departments.map((dept) => {

      const lines = dept.lines.map((line) => {

        const machines = line.machines.map((m) => {

          const snap = byMachine.get(m.id)

          return snap ? { ...m, kpi: mergeKpiWithSnapshot(m.kpi, snap) } : m

        })

        return { ...line, machines, kpi: rollUpKpis(machines.map((m) => m.kpi)) }

      })

      return { ...dept, lines, kpi: rollUpKpis(lines.map((l) => l.kpi)) }

    })

    return { ...plant, departments, kpi: rollUpKpis(departments.map((d) => d.kpi)) }

  })

}


