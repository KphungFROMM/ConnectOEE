import type { MachineSnapshot } from '../../lib/liveHub'
import type { MachineNode, PlantNode } from '../../lib/hierarchy'

export type MachineSortBy = 'oee' | 'name' | 'state'

export interface MachineGridEntry {
  machineId: string
  lineId: string
  lineName: string
  deptName: string
  plantName: string
  order: number
  snapshot: MachineSnapshot
}

export interface MachineGridLineGroup {
  lineId: string
  lineName: string
  deptName: string
  plantName: string
  machines: MachineGridEntry[]
}

const STATE_RANK: Record<string, number> = {
  Down: 0,
  Setup: 1,
  PlannedDown: 2,
  Idle: 3,
  Starved: 4,
  Blocked: 5,
  Running: 6,
  Unknown: 7,
}

function stateRank(state: string): number {
  return STATE_RANK[state] ?? 8
}

function snapshotFromNode(machine: MachineNode, lineId: string): MachineSnapshot {
  const k = machine.kpi
  return {
    machineId: machine.id,
    lineId,
    machineName: machine.name,
    state: machine.state ?? k.status ?? 'Unknown',
    goodCount: k.goodCount,
    rejectCount: k.rejectCount,
    reworkCount: 0,
    speed: machine.speed,
    faultCode: machine.faultCode ?? null,
    downtimeReasonText: null,
    connectionState: k.connectionState,
    timestampUtc: new Date().toISOString(),
    oeePct: k.oeePct,
    availabilityPct: k.availabilityPct,
    performancePct: k.performancePct,
    qualityPct: k.qualityPct,
    teepPct: 0,
    shiftName: '',
    shiftStartUtc: '',
    shiftEndUtc: '',
    mttrMin: 0,
    mtbfMin: 0,
    mttfMin: 0,
    mttdMin: 0,
    meanLostTimePerDowntimeMin: 0,
    failureRatePerHour: 0,
    stopsPerHour: 0,
    availabilityFromReliabilityPct: 0,
    downtimeCount: 0,
    microStopCount: 0,
    failureCount: 0,
    uptimeMin: 0,
    downtimeMin: 0,
    plannedDowntimeMin: 0,
    unplannedDowntimeMin: 0,
    uptimePct: 0,
    availabilityLossMin: 0,
    performanceLossMin: 0,
    qualityLossMin: 0,
    scrapPct: 0,
    yieldPct: k.qualityPct,
    fpyPct: k.qualityPct,
    actualCycleTimeSec: k.actualCycleTimeSec,
    idealCycleTimeSec: k.idealCycleTimeSec,
    actualRatePph: k.actualRatePph,
    idealRatePph: k.idealRatePph,
    rateVariancePct: 0,
  }
}

function sortEntries(entries: MachineGridEntry[], sortBy: MachineSortBy): MachineGridEntry[] {
  const sorted = [...entries]
  switch (sortBy) {
    case 'oee':
      sorted.sort((a, b) => (b.snapshot.oeePct ?? 0) - (a.snapshot.oeePct ?? 0))
      break
    case 'state':
      sorted.sort(
        (a, b) =>
          stateRank(a.snapshot.state) - stateRank(b.snapshot.state) ||
          a.snapshot.machineName.localeCompare(b.snapshot.machineName),
      )
      break
    default:
      sorted.sort((a, b) => a.order - b.order || a.snapshot.machineName.localeCompare(b.snapshot.machineName))
  }
  return sorted
}

/** Builds machine grid rows from hierarchy order with live snapshot overlay. */
export function buildMachineGridGroups(
  plants: PlantNode[],
  liveSnapshots: MachineSnapshot[],
  plantId: string | undefined,
  sortBy: MachineSortBy = 'name',
): MachineGridLineGroup[] {
  const liveById = new Map(
    liveSnapshots
      .filter((s) => s.machineId)
      .map((s) => [s.machineId.toLowerCase(), s] as const),
  )
  const groups: MachineGridLineGroup[] = []

  for (const plant of plants) {
    if (plantId && plant.id.toLowerCase() !== plantId.toLowerCase()) continue
    for (const dept of plant.departments) {
      for (const line of dept.lines) {
        const entries: MachineGridEntry[] = line.machines.map((machine, idx) => {
          const live = machine.id ? liveById.get(machine.id.toLowerCase()) : undefined
          return {
            machineId: machine.id,
            lineId: line.id,
            lineName: line.name,
            deptName: dept.name,
            plantName: plant.name,
            order: idx,
            snapshot: live ?? snapshotFromNode(machine, line.id),
          }
        })
        if (entries.length === 0) continue
        groups.push({
          lineId: line.id,
          lineName: line.name,
          deptName: dept.name,
          plantName: plant.name,
          machines: sortEntries(entries, sortBy),
        })
      }
    }
  }

  return groups
}

export function flattenMachineGridGroups(groups: MachineGridLineGroup[], sortBy: MachineSortBy): MachineGridEntry[] {
  return sortEntries(
    groups.flatMap((g) => g.machines),
    sortBy,
  )
}
