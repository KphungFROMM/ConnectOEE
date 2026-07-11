import type { WidgetBinding } from '../../lib/dashboards'
import type { EntityLevel } from '../../lib/historian'
import type { MachineSnapshot } from '../../lib/liveHub'
import { resolveLineTopology, rollUpContinuousLive, type LineTopologyInfo } from '../../lib/lineTopology'
import type { BindingScope, WidgetCtx } from './common'

export function resolveBindingScope(ctx: WidgetCtx, binding?: WidgetBinding): BindingScope {
  const source = binding?.source ?? 'machine'
  const plantId = ctx.plantId ?? null
  const lineId = ctx.lineId ?? null
  const machineId = ctx.machineId ?? null

  switch (source) {
    case 'plant':
      return {
        plantId,
        lineId,
        machineId,
        historianLevel: 'Plant' as EntityLevel,
        historianId: plantId,
      }
    case 'line':
      return {
        plantId,
        lineId,
        machineId,
        historianLevel: 'Line' as EntityLevel,
        historianId: lineId,
      }
    case 'machine':
    default:
      return {
        plantId,
        lineId,
        machineId: machineId ?? ctx.snapshot?.machineId ?? null,
        historianLevel: 'Machine' as EntityLevel,
        historianId: machineId ?? ctx.snapshot?.machineId ?? null,
      }
  }
}

function topologyForSnapshots(
  snapshots: MachineSnapshot[],
  byLine?: Record<string, LineTopologyInfo>,
): LineTopologyInfo | null {
  if (!byLine || snapshots.length === 0) return null
  const lineIds = [...new Set(snapshots.map((s) => s.lineId).filter(Boolean))]
  if (lineIds.length !== 1) return null
  return byLine[lineIds[0]!] ?? null
}

export function aggregateSnapshots(
  snapshots: MachineSnapshot[],
  lineTopologyByLineId?: Record<string, LineTopologyInfo>,
) {
  if (snapshots.length === 0) {
    return {
      oeePct: 0,
      availabilityPct: 0,
      performancePct: 0,
      qualityPct: 0,
      goodCount: 0,
      rejectCount: 0,
      teepPct: 0,
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
      actualCycleTimeSec: 0,
      idealCycleTimeSec: 0,
      actualRatePph: 0,
      idealRatePph: 0,
      rateVariancePct: 0,
      reworkCount: 0,
      scrapPct: 0,
      yieldPct: 0,
      fpyPct: 0,
      speed: 0,
      targetOeePct: 85,
      targetAvailabilityPct: 90,
      targetPerformancePct: 95,
      targetQualityPct: 99,
      oeeGapPct: 0,
      availabilityGapPct: 0,
      performanceGapPct: 0,
      qualityGapPct: 0,
      utilizationPct: 0,
      cycleVariancePct: 0,
      reworkPct: 0,
      runAttainmentPct: 0,
      shiftAttainmentPct: 0,
      runTargetQuantity: 0,
      shiftTargetQuantity: 0,
      runPartsRemaining: 0,
      shiftPartsRemaining: 0,
      theoreticalOutput: 0,
      outputGap: 0,
      maxPossibleParts: 0,
      expectedPartsPace: 0,
      partsLostAvailability: 0,
      partsLostPerformance: 0,
      partsLostQuality: 0,
      partsLostBreakdown: 0,
      partsCouldHaveMade: 0,
      idleMin: 0,
      downMin: 0,
      setupMin: 0,
      starvedMin: 0,
      blockedMin: 0,
      unknownMin: 0,
    }
  }

  const n = snapshots.length
  const sum = (pick: (x: MachineSnapshot) => number) => snapshots.reduce((s, x) => s + pick(x), 0)
  const avg = (pick: (x: MachineSnapshot) => number) => sum(pick) / n

  const topoInfo = topologyForSnapshots(snapshots, lineTopologyByLineId)
  const ids = snapshots.map((s) => s.machineId)
  const resolved = resolveLineTopology(topoInfo, ids)
  let oeePct = avg((x) => x.oeePct ?? 0)
  let availabilityPct = avg((x) => x.availabilityPct ?? 0)
  let performancePct = avg((x) => x.performancePct ?? 0)
  let qualityPct = avg((x) => x.qualityPct ?? 0)
  let goodCount = sum((x) => x.goodCount ?? 0)
  let rejectCount = sum((x) => x.rejectCount ?? 0)
  let idealCycleTimeSec = avg((x) => x.idealCycleTimeSec ?? 0)
  let actualCycleTimeSec = avg((x) => x.actualCycleTimeSec ?? 0)
  let actualRatePph = avg((x) => x.actualRatePph ?? 0)
  let idealRatePph = avg((x) => x.idealRatePph ?? 0)

  if (resolved.topology === 'Continuous' && resolved.outputId && resolved.pacingId && n > 1) {
    const c = rollUpContinuousLive(snapshots, resolved.outputId, resolved.pacingId)
    oeePct = c.oeePct
    availabilityPct = c.availabilityPct
    performancePct = c.performancePct
    qualityPct = c.qualityPct
    goodCount = c.goodCount
    rejectCount = c.rejectCount
    idealCycleTimeSec = c.idealCycleTimeSec
    actualCycleTimeSec = c.actualCycleTimeSec
    actualRatePph = c.actualRatePph
    idealRatePph = c.idealRatePph
  } else if (n > 1) {
    const totalPieces = goodCount + rejectCount
    qualityPct =
      totalPieces > 0
        ? Math.round((goodCount * 10000) / totalPieces) / 100
        : avg((x) => x.qualityPct ?? 0)
    oeePct = Math.round((availabilityPct * performancePct * qualityPct) / 100) / 100
  }

  return {
    oeePct,
    availabilityPct,
    performancePct,
    qualityPct,
    goodCount,
    rejectCount,
    teepPct: avg((x) => x.teepPct ?? 0),
    mttrMin: avg((x) => x.mttrMin ?? 0),
    mtbfMin: avg((x) => x.mtbfMin ?? 0),
    mttfMin: avg((x) => x.mttfMin ?? 0),
    mttdMin: avg((x) => x.mttdMin ?? 0),
    meanLostTimePerDowntimeMin: avg((x) => x.meanLostTimePerDowntimeMin ?? 0),
    failureRatePerHour: avg((x) => x.failureRatePerHour ?? 0),
    stopsPerHour: avg((x) => x.stopsPerHour ?? 0),
    availabilityFromReliabilityPct: avg((x) => x.availabilityFromReliabilityPct ?? 0),
    downtimeCount: sum((x) => x.downtimeCount ?? 0),
    microStopCount: sum((x) => x.microStopCount ?? 0),
    failureCount: sum((x) => x.failureCount ?? 0),
    uptimeMin: sum((x) => x.uptimeMin ?? 0),
    downtimeMin: sum((x) => x.downtimeMin ?? 0),
    plannedDowntimeMin: sum((x) => x.plannedDowntimeMin ?? 0),
    unplannedDowntimeMin: sum((x) => x.unplannedDowntimeMin ?? 0),
    uptimePct: avg((x) => x.uptimePct ?? 0),
    availabilityLossMin: sum((x) => x.availabilityLossMin ?? 0),
    performanceLossMin: sum((x) => x.performanceLossMin ?? 0),
    qualityLossMin: sum((x) => x.qualityLossMin ?? 0),
    actualCycleTimeSec,
    idealCycleTimeSec,
    actualRatePph,
    idealRatePph,
    rateVariancePct: avg((x) => x.rateVariancePct ?? 0),
    reworkCount: sum((x) => x.reworkCount ?? 0),
    scrapPct: avg((x) => x.scrapPct ?? 0),
    yieldPct: avg((x) => x.yieldPct ?? 0),
    fpyPct: avg((x) => x.fpyPct ?? 0),
    speed: actualRatePph,
    targetOeePct: avg((x) => x.targetOeePct ?? 85),
    targetAvailabilityPct: avg((x) => x.targetAvailabilityPct ?? 90),
    targetPerformancePct: avg((x) => x.targetPerformancePct ?? 95),
    targetQualityPct: avg((x) => x.targetQualityPct ?? 99),
    oeeGapPct: oeePct - avg((x) => x.targetOeePct ?? 85),
    availabilityGapPct: availabilityPct - avg((x) => x.targetAvailabilityPct ?? 90),
    performanceGapPct: performancePct - avg((x) => x.targetPerformancePct ?? 95),
    qualityGapPct: qualityPct - avg((x) => x.targetQualityPct ?? 99),
    utilizationPct: avg((x) => x.utilizationPct ?? 0),
    cycleVariancePct: avg((x) => x.cycleVariancePct ?? 0),
    reworkPct: avg((x) => x.reworkPct ?? 0),
    runAttainmentPct: avg((x) => x.runAttainmentPct ?? 0),
    shiftAttainmentPct: avg((x) => x.shiftAttainmentPct ?? 0),
    runTargetQuantity: sum((x) => x.runTargetQuantity ?? 0),
    shiftTargetQuantity: sum((x) => x.shiftTargetQuantity ?? 0),
    runPartsRemaining: sum((x) => x.runPartsRemaining ?? 0),
    shiftPartsRemaining: sum((x) => x.shiftPartsRemaining ?? 0),
    theoreticalOutput: sum((x) => x.theoreticalOutput ?? 0),
    outputGap: sum((x) => x.outputGap ?? 0),
    maxPossibleParts: sum((x) => x.maxPossibleParts ?? 0),
    expectedPartsPace: sum((x) => x.expectedPartsPace ?? 0),
    partsLostAvailability: sum((x) => x.partsLostAvailability ?? 0),
    partsLostPerformance: sum((x) => x.partsLostPerformance ?? 0),
    partsLostQuality: sum((x) => x.partsLostQuality ?? 0),
    partsLostBreakdown: sum((x) => x.partsLostBreakdown ?? 0),
    partsCouldHaveMade: sum((x) => x.partsCouldHaveMade ?? 0),
    idleMin: sum((x) => x.idleMin ?? 0),
    downMin: sum((x) => x.downMin ?? 0),
    setupMin: sum((x) => x.setupMin ?? 0),
    starvedMin: sum((x) => x.starvedMin ?? 0),
    blockedMin: sum((x) => x.blockedMin ?? 0),
    unknownMin: sum((x) => x.unknownMin ?? 0),
  }
}
