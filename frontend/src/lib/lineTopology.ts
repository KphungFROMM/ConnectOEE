import type { MachineSnapshot } from './liveHub'
import type { PlantNode } from './hierarchy'

export type LineTopologyMode = 'Independent' | 'Continuous'

export interface LineTopologyInfo {
  topology: LineTopologyMode
  lineOutputMachineId?: string | null
  pacingMachineId?: string | null
  lineOutputMachineName?: string | null
}

/** Build WidgetCtx.lineTopologyByLineId from a hierarchy tree. */
export function buildLineTopologyByLineId(tree: PlantNode[]): Record<string, LineTopologyInfo> {
  const out: Record<string, LineTopologyInfo> = {}
  for (const plant of tree) {
    for (const dept of plant.departments) {
      for (const line of dept.lines) {
        out[line.id] = {
          topology: line.topology ?? 'Independent',
          lineOutputMachineId: line.lineOutputMachineId ?? null,
          pacingMachineId: line.pacingMachineId ?? null,
          lineOutputMachineName: line.lineOutputMachineName ?? null,
        }
      }
    }
  }
  return out
}

/** Resolve output/pacing ids (mirrors server LineTopologyResolver). */
export function resolveLineTopology(
  info: LineTopologyInfo | null | undefined,
  machineIdsBySequence: string[],
): { topology: LineTopologyMode; outputId: string | null; pacingId: string | null } {
  const topology = info?.topology ?? 'Independent'
  if (topology !== 'Continuous' || machineIdsBySequence.length === 0) {
    return { topology, outputId: null, pacingId: null }
  }
  let outputId = info?.lineOutputMachineId ?? null
  if (!outputId || !machineIdsBySequence.includes(outputId)) {
    outputId = machineIdsBySequence[machineIdsBySequence.length - 1]!
  }
  let pacingId = info?.pacingMachineId ?? null
  if (!pacingId || !machineIdsBySequence.includes(pacingId)) {
    pacingId = outputId
  }
  return { topology: 'Continuous', outputId, pacingId }
}

export interface LiveRollupCore {
  oeePct: number
  availabilityPct: number
  performancePct: number
  qualityPct: number
  goodCount: number
  rejectCount: number
  idealCycleTimeSec: number
  actualCycleTimeSec: number
  actualRatePph: number
  idealRatePph: number
}

/** Continuous live rollup matching server LineKpiRollup.RollUpContinuous. */
export function rollUpContinuousLive(
  snapshots: MachineSnapshot[],
  outputId: string,
  pacingId: string,
): LiveRollupCore {
  const output = snapshots.find((s) => s.machineId === outputId) ?? snapshots[snapshots.length - 1]!
  const pacing = snapshots.find((s) => s.machineId === pacingId) ?? output
  const good = output.goodCount ?? 0
  const reject = output.rejectCount ?? 0
  const total = good + reject
  const quality = total > 0 ? Math.round((good * 10000) / total) / 100 : output.qualityPct ?? 0
  const availability = Math.round(Math.min(...snapshots.map((s) => s.availabilityPct ?? 0)) * 100) / 100
  const performance = pacing.performancePct ?? 0
  const oee = Math.round((availability * performance * quality) / 100) / 100
  return {
    oeePct: oee,
    availabilityPct: availability,
    performancePct: performance,
    qualityPct: quality,
    goodCount: good,
    rejectCount: reject,
    idealCycleTimeSec: pacing.idealCycleTimeSec > 0 ? pacing.idealCycleTimeSec : output.idealCycleTimeSec,
    actualCycleTimeSec: output.actualCycleTimeSec,
    actualRatePph: output.actualRatePph,
    idealRatePph: pacing.idealRatePph > 0 ? pacing.idealRatePph : output.idealRatePph,
  }
}

type KpiLike = {
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

/** Continuous NodeKpi rollup matching server LineKpiRollup.RollUpContinuous. */
export function rollUpContinuousNodeKpis(
  machines: { id: string; kpi: KpiLike }[],
  outputId: string,
  pacingId: string,
): KpiLike {
  if (machines.length === 0) {
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
  const output = machines.find((m) => m.id === outputId) ?? machines[machines.length - 1]!
  const pacing = machines.find((m) => m.id === pacingId) ?? output
  const good = output.kpi.goodCount
  const reject = output.kpi.rejectCount
  const total = good + reject
  const quality =
    total > 0 ? Math.round((good * 10000) / total) / 100 : output.kpi.qualityPct
  const availability =
    Math.round(Math.min(...machines.map((m) => m.kpi.availabilityPct)) * 100) / 100
  const performance = pacing.kpi.performancePct
  const oee = Math.round((availability * performance * quality) / 100) / 100
  return {
    oeePct: oee,
    availabilityPct: availability,
    performancePct: performance,
    qualityPct: quality,
    goodCount: good,
    rejectCount: reject,
    status: worstStatus(machines.map((m) => m.kpi.status)),
    connectionState: machines.some((m) => m.kpi.connectionState === 'Connected')
      ? 'Connected'
      : 'Disconnected',
    activeRecipeCode: output.kpi.activeRecipeCode ?? pacing.kpi.activeRecipeCode ?? null,
    activeRecipeName: output.kpi.activeRecipeName ?? pacing.kpi.activeRecipeName ?? null,
    idealCycleTimeSec:
      pacing.kpi.idealCycleTimeSec > 0 ? pacing.kpi.idealCycleTimeSec : output.kpi.idealCycleTimeSec,
    actualCycleTimeSec: output.kpi.actualCycleTimeSec,
    actualRatePph: output.kpi.actualRatePph,
    idealRatePph: pacing.kpi.idealRatePph > 0 ? pacing.kpi.idealRatePph : output.kpi.idealRatePph,
    recipeIsAutoCreated: output.kpi.recipeIsAutoCreated || pacing.kpi.recipeIsAutoCreated,
  }
}
