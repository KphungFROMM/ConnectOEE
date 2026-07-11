import type { WidgetBinding } from '../../lib/dashboards'
import type { MachineSnapshot } from '../../lib/liveHub'
import type { WidgetCtx } from './common'
import { aggregateSnapshots } from './resolveBindingScope'

export type ScopedSnapshot = MachineSnapshot

function factorField(factor: string | undefined): string {
  switch (factor) {
    case 'A':
      return 'availabilityPct'
    case 'P':
      return 'performancePct'
    case 'Q':
      return 'qualityPct'
    default:
      return 'oeePct'
  }
}

/** Build a pseudo MachineSnapshot from aggregated KPI numbers + optional template row. */
function toPseudoSnapshot(
  agg: ReturnType<typeof aggregateSnapshots>,
  template?: MachineSnapshot,
): ScopedSnapshot {
  const t = template
  return {
    machineId: t?.machineId ?? '',
    lineId: t?.lineId ?? '',
    machineName: t?.machineName ?? 'Aggregate',
    state: t?.state ?? 'Running',
    connectionState: t?.connectionState ?? 'Connected',
    timestampUtc: t?.timestampUtc ?? new Date().toISOString(),
    shiftName: t?.shiftName ?? '',
    shiftStartUtc: t?.shiftStartUtc ?? '',
    shiftEndUtc: t?.shiftEndUtc ?? '',
    faultCode: t?.faultCode ?? null,
    activeRecipeCode: t?.activeRecipeCode,
    activeRecipeName: t?.activeRecipeName,
    recipeIsAutoCreated: t?.recipeIsAutoCreated,
    goodCount: agg.goodCount,
    rejectCount: agg.rejectCount,
    reworkCount: agg.reworkCount,
    speed: agg.actualRatePph,
    oeePct: agg.oeePct,
    availabilityPct: agg.availabilityPct,
    performancePct: agg.performancePct,
    qualityPct: agg.qualityPct,
    teepPct: agg.teepPct,
    scrapPct: agg.scrapPct,
    yieldPct: agg.yieldPct,
    fpyPct: agg.fpyPct,
    mttrMin: agg.mttrMin,
    mtbfMin: agg.mtbfMin,
    mttfMin: agg.mttfMin,
    mttdMin: agg.mttdMin,
    meanLostTimePerDowntimeMin: agg.meanLostTimePerDowntimeMin,
    failureRatePerHour: agg.failureRatePerHour,
    stopsPerHour: agg.stopsPerHour,
    availabilityFromReliabilityPct: agg.availabilityFromReliabilityPct,
    downtimeCount: agg.downtimeCount,
    microStopCount: agg.microStopCount,
    failureCount: agg.failureCount,
    uptimeMin: agg.uptimeMin,
    downtimeMin: agg.downtimeMin,
    plannedDowntimeMin: agg.plannedDowntimeMin,
    unplannedDowntimeMin: agg.unplannedDowntimeMin,
    uptimePct: agg.uptimePct,
    availabilityLossMin: agg.availabilityLossMin,
    performanceLossMin: agg.performanceLossMin,
    qualityLossMin: agg.qualityLossMin,
    actualCycleTimeSec: agg.actualCycleTimeSec,
    idealCycleTimeSec: agg.idealCycleTimeSec,
    actualRatePph: agg.actualRatePph,
    idealRatePph: agg.idealRatePph,
    rateVariancePct: agg.rateVariancePct,
    targetOeePct: agg.targetOeePct,
    targetAvailabilityPct: agg.targetAvailabilityPct,
    targetPerformancePct: agg.targetPerformancePct,
    targetQualityPct: agg.targetQualityPct,
    oeeGapPct: agg.oeeGapPct,
    availabilityGapPct: agg.availabilityGapPct,
    performanceGapPct: agg.performanceGapPct,
    qualityGapPct: agg.qualityGapPct,
    utilizationPct: agg.utilizationPct,
    cycleVariancePct: agg.cycleVariancePct,
    reworkPct: agg.reworkPct,
    runAttainmentPct: agg.runAttainmentPct,
    shiftAttainmentPct: agg.shiftAttainmentPct,
    runTargetQuantity: agg.runTargetQuantity,
    shiftTargetQuantity: agg.shiftTargetQuantity,
    runPartsRemaining: agg.runPartsRemaining,
    shiftPartsRemaining: agg.shiftPartsRemaining,
    theoreticalOutput: agg.theoreticalOutput,
    outputGap: agg.outputGap,
    maxPossibleParts: agg.maxPossibleParts,
    expectedPartsPace: agg.expectedPartsPace,
    partsLostAvailability: agg.partsLostAvailability,
    partsLostPerformance: agg.partsLostPerformance,
    partsLostQuality: agg.partsLostQuality,
    partsLostBreakdown: agg.partsLostBreakdown,
    partsCouldHaveMade: agg.partsCouldHaveMade,
    idleMin: agg.idleMin,
    downMin: agg.downMin,
    setupMin: agg.setupMin,
    starvedMin: agg.starvedMin,
    blockedMin: agg.blockedMin,
    unknownMin: agg.unknownMin,
  }
}

export function resolveScopedSnapshot(ctx: WidgetCtx, binding?: WidgetBinding): ScopedSnapshot | undefined {
  const source = binding?.source ?? (ctx.plantId && !ctx.lineId && !ctx.machineId ? 'plant' : ctx.lineId && !ctx.machineId ? 'line' : 'machine')

  if (source === 'plant' || source === 'line') {
    const snaps = ctx.lineSnapshots
    if (snaps.length === 0) return ctx.snapshot
    if (snaps.length === 1) return snaps[0]
    return toPseudoSnapshot(aggregateSnapshots(snaps, ctx.lineTopologyByLineId), snaps[0])
  }

  return ctx.snapshot ?? ctx.lineSnapshots[0]
}

export function resolveScopedField(
  ctx: WidgetCtx,
  binding?: WidgetBinding,
  field?: string,
): number | string | null {
  const snap = resolveScopedSnapshot(ctx, binding)
  if (!snap || !field) return null
  const key = field === 'speed' ? 'actualRatePph' : field
  const value = (snap as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

export function resolveWidgetField(widget: { binding: WidgetBinding; options: Record<string, unknown> }, _ctx: WidgetCtx): string | undefined {
  if (widget.binding.field) return widget.binding.field
  const factor = widget.options.factor as string | undefined
  if (factor) return factorField(factor)
  return undefined
}

export function resolveWidgetNumeric(
  widget: { binding: WidgetBinding; options: Record<string, unknown> },
  ctx: WidgetCtx,
  fallback = 0,
): number {
  const field = resolveWidgetField(widget, ctx) ?? widget.binding.field
  const raw = resolveScopedField(ctx, widget.binding, field)
  return typeof raw === 'number' ? raw : fallback
}
