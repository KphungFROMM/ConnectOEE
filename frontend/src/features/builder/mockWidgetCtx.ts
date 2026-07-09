import type { MachineSnapshot } from '../../lib/liveHub'
import type { WidgetCtx } from '../../components/widgets/common'

const LINE_ID = '11111111-1111-1111-1111-111111111111'
const MACHINE_ID = '22222222-2222-2222-2222-222222222222'
const PLANT_ID = '33333333-3333-3333-3333-333333333333'

const now = new Date()
const shiftStart = new Date(now)
shiftStart.setHours(6, 0, 0, 0)

export function createMockMachineSnapshot(overrides: Partial<MachineSnapshot> = {}): MachineSnapshot {
  return {
    machineId: MACHINE_ID,
    lineId: LINE_ID,
    machineName: 'Filler 1',
    state: 'Running',
    goodCount: 4820,
    rejectCount: 142,
    reworkCount: 38,
    speed: 1180,
    faultCode: null,
    downtimeReasonText: null,
    connectionState: 'Connected',
    timestampUtc: now.toISOString(),
    oeePct: 72.4,
    availabilityPct: 88.2,
    performancePct: 84.6,
    qualityPct: 97.1,
    teepPct: 65.8,
    shiftName: 'Day',
    shiftStartUtc: shiftStart.toISOString(),
    shiftEndUtc: new Date(shiftStart.getTime() + 8 * 3600_000).toISOString(),
    mttrMin: 12.4,
    mtbfMin: 145.2,
    mttfMin: 145.2,
    mttdMin: 3.8,
    meanLostTimePerDowntimeMin: 12.4,
    failureRatePerHour: 0.42,
    stopsPerHour: 1.8,
    availabilityFromReliabilityPct: 92.1,
    downtimeCount: 6,
    microStopCount: 2,
    failureCount: 3,
    uptimeMin: 312,
    downtimeMin: 48,
    plannedDowntimeMin: 18,
    unplannedDowntimeMin: 30,
    uptimePct: 86.7,
    availabilityLossMin: 48,
    performanceLossMin: 52,
    qualityLossMin: 14,
    actualCycleTimeSec: 2.05,
    idealCycleTimeSec: 1.66,
    actualRatePph: 1180,
    idealRatePph: 2169,
    rateVariancePct: -45.6,
    scrapPct: 2.9,
    yieldPct: 97.1,
    fpyPct: 96.3,
    activeRecipeCode: 'PKG-STD',
    activeRecipeName: 'Standard Pack',
    recipeIsAutoCreated: false,
    idealCycleSource: 'line-rate',
    targetOeePct: 85,
    targetAvailabilityPct: 90,
    targetPerformancePct: 95,
    targetQualityPct: 99,
    oeeGapPct: -12.6,
    availabilityGapPct: -1.8,
    performanceGapPct: -10.4,
    qualityGapPct: -1.9,
    utilizationPct: 78.5,
    cycleVariancePct: 23.5,
    reworkPct: 0.8,
    reworkTrackingActive: true,
    runTargetQuantity: 6000,
    runTargetQuantitySource: 'line-rate',
    runAttainmentPct: 80.3,
    runPartsRemaining: 1180,
    shiftTargetQuantity: 5500,
    shiftTargetQuantitySource: 'schedule',
    shiftAttainmentPct: 87.6,
    shiftPartsRemaining: 680,
    theoreticalOutput: 5100,
    outputGap: 138,
    maxPossibleParts: 5400,
    expectedPartsPace: 4200,
    partsLostAvailability: 320,
    partsLostPerformance: 180,
    partsLostQuality: 98,
    partsLostBreakdown: 210,
    partsCouldHaveMade: 5098,
    idleMin: 12,
    downMin: 18,
    setupMin: 8,
    starvedMin: 6,
    blockedMin: 4,
    unknownMin: 0,
    idlePct: 3.2,
    downPct: 4.8,
    setupPct: 2.1,
    starvedPct: 1.6,
    blockedPct: 1.1,
    unknownPct: 0,
    ...overrides,
  }
}

/** Second machine on same line for grid/rollup widgets. */
export function createMockLineSnapshots(): MachineSnapshot[] {
  return [
    createMockMachineSnapshot(),
    createMockMachineSnapshot({
      machineId: '44444444-4444-4444-4444-444444444444',
      machineName: 'Capper 1',
      state: 'Idle',
      oeePct: 58.2,
      goodCount: 2100,
      rejectCount: 88,
      downtimeMin: 72,
      uptimeMin: 288,
    }),
  ]
}

export function createMockWidgetCtx(overrides: Partial<WidgetCtx> = {}): WidgetCtx {
  const lineSnapshots = createMockLineSnapshots()
  return {
    lineId: LINE_ID,
    machineId: MACHINE_ID,
    plantId: PLANT_ID,
    snapshot: lineSnapshots[0],
    lineSnapshots,
    hubConnected: true,
    density: 'normal',
    wallBoard: false,
    ...overrides,
  }
}

export const MOCK_LINE_ID = LINE_ID
export const MOCK_MACHINE_ID = MACHINE_ID
export const MOCK_PLANT_ID = PLANT_ID
