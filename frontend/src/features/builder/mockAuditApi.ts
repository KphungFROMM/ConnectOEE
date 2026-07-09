import type {
  Granularity,
  ProductionPoint,
  ReasonBucket,
  ReliabilityTrendResult,
  TrendPoint,
  TrendResult,
} from '../../lib/historian'
import type { DowntimeEvent, LossBucket, OperatorDowntime, Reliability, ShiftInstance } from '../../lib/metrics'
import type { PlantNode } from '../../lib/hierarchy'
import type { TagValueSample } from '../../lib/tags'
import { MOCK_LINE_ID, MOCK_MACHINE_ID, MOCK_PLANT_ID } from './mockWidgetCtx'

const now = Date.now()
const shiftStart = new Date(now)
shiftStart.setHours(6, 0, 0, 0)

function hourLabels(count: number): { bucketUtc: string; label: string }[] {
  const out: { bucketUtc: string; label: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now - i * 3600_000)
    out.push({
      bucketUtc: d.toISOString(),
      label: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    })
  }
  return out
}

function baseOee(seed: number) {
  const oee = 68 + (seed % 12)
  const a = oee + 8 + (seed % 5)
  const p = oee + 4 + (seed % 4)
  const q = 95 + (seed % 4)
  return {
    availabilityPct: Math.min(a, 98),
    performancePct: Math.min(p, 96),
    qualityPct: Math.min(q, 99.5),
    oeePct: oee,
    teepPct: oee - 6,
    scrapPct: 2.5 + (seed % 3) * 0.4,
    yieldPct: 97,
    fpyPct: 96,
    availabilityLossMin: 8 + (seed % 6),
    performanceLossMin: 10 + (seed % 8),
    qualityLossMin: 2 + (seed % 3),
    actualCycleTimeSec: 2.1,
    idealCycleTimeSec: 1.66,
  }
}

export function mockTrendResult(from?: string, to?: string): TrendResult {
  const points: TrendPoint[] = hourLabels(8).map((h, i) => ({
    ...h,
    oee: baseOee(i + 3),
    goodCount: 520 + i * 45,
    rejectCount: 12 + (i % 3) * 4,
    totalCount: 540 + i * 48,
    downtimeMin: 4 + (i % 4) * 2,
    targetOeePct: 85,
    uptimeMin: 52 - (i % 3),
    plannedDowntimeMin: 2,
    unplannedDowntimeMin: 3 + (i % 2),
    microStopCount: i % 3,
  }))
  return {
    level: 'Line',
    entityId: MOCK_LINE_ID,
    entityName: 'Line 1',
    resolvedGranularity: 'Hour',
    from: from ?? shiftStart.toISOString(),
    to: to ?? new Date().toISOString(),
    points,
  }
}

export function mockProductionPoints(): ProductionPoint[] {
  return hourLabels(6).map((h, i) => ({
    ...h,
    goodCount: 480 + i * 62,
    rejectCount: 10 + i * 3,
    totalCount: 500 + i * 65,
    targetCount: 550 + i * 55,
    scrapPct: 2.2 + i * 0.15,
  }))
}

export function mockReasonBuckets(): ReasonBucket[] {
  return [
    { category: 'Breakdown', kind: 'Breakdown', reason: 'Jam — infeed', count: 3, totalMin: 18 },
    { category: 'SetupAndAdjustment', kind: 'SetupAndAdjustment', reason: 'Changeover', count: 2, totalMin: 24 },
    { category: 'SmallStop', kind: 'SmallStop', reason: 'Sensor fault', count: 5, totalMin: 8 },
    { category: 'ReducedSpeed', kind: 'ReducedSpeed', reason: 'Low air pressure', count: 2, totalMin: 12 },
    { category: 'Unattributed', kind: 'Unattributed', reason: '', count: 1, totalMin: 4 },
  ]
}

export function mockReliabilityTrend(from?: string, to?: string): ReliabilityTrendResult {
  const points = hourLabels(6).map((h, i) => ({
    ...h,
    mttrMin: 11 + (i % 3),
    mtbfMin: 130 + i * 8,
    stopsPerHour: 1.2 + (i % 4) * 0.3,
    downtimeMin: 5 + i,
    uptimeMin: 55 - i,
  }))
  return {
    level: 'Line',
    entityId: MOCK_LINE_ID,
    entityName: 'Line 1',
    resolvedGranularity: 'Hour',
    from: from ?? shiftStart.toISOString(),
    to: to ?? new Date().toISOString(),
    points,
  }
}

export function mockDowntimeEvents(): DowntimeEvent[] {
  const base = new Date(now - 2 * 3600_000).toISOString()
  return [
    {
      id: 'evt-1',
      lineId: MOCK_LINE_ID,
      machineId: MOCK_MACHINE_ID,
      startUtc: base,
      endUtc: new Date(now - 1.85 * 3600_000).toISOString(),
      durationSec: 540,
      category: 'Breakdown',
      kind: 'Breakdown',
      reason: 'Jam — infeed',
      faultCode: 1042,
      isMicroStop: false,
      requiresOperatorReason: false,
    },
    {
      id: 'evt-2',
      lineId: MOCK_LINE_ID,
      machineId: MOCK_MACHINE_ID,
      startUtc: new Date(now - 45 * 60_000).toISOString(),
      durationSec: 720,
      category: 'SetupAndAdjustment',
      kind: 'SetupAndAdjustment',
      reason: 'SKU changeover',
      faultCode: null,
      isMicroStop: false,
      requiresOperatorReason: false,
    },
    {
      id: 'evt-3',
      lineId: MOCK_LINE_ID,
      machineId: MOCK_MACHINE_ID,
      startUtc: new Date(now - 12 * 60_000).toISOString(),
      durationSec: 180,
      category: 'SmallStop',
      kind: 'SmallStop',
      reason: null,
      faultCode: null,
      isMicroStop: true,
      requiresOperatorReason: true,
    },
  ]
}

export function mockLossBuckets(): LossBucket[] {
  return [
    { category: 'Breakdown', count: 3, totalSec: 1080 },
    { category: 'SetupAndAdjustment', count: 2, totalSec: 1440 },
    { category: 'SmallStop', count: 5, totalSec: 480 },
    { category: 'ReducedSpeed', count: 2, totalSec: 720 },
    { category: 'ProductionReject', count: 4, totalSec: 0 },
  ]
}

export function mockReliability(): Reliability {
  return {
    mttrMin: 12.4,
    mtbfMin: 145.2,
    mttfMin: 145.2,
    mttdMin: 3.8,
    meanLostTimePerDowntimeMin: 12.4,
    failureRatePerHour: 0.42,
    availabilityFromReliabilityPct: 92.1,
    stopsPerHour: 1.8,
    downtimeCount: 6,
    failureCount: 3,
    plannedDowntimeMin: 18,
    unplannedDowntimeMin: 30,
  }
}

export function mockCurrentShift(): ShiftInstance {
  return {
    id: 'shift-audit',
    shiftName: 'Day',
    startUtc: shiftStart.toISOString(),
    endUtc: new Date(shiftStart.getTime() + 8 * 3600_000).toISOString(),
    isClosed: false,
    oeePct: 72.4,
    availabilityPct: 88.2,
    performancePct: 84.6,
    qualityPct: 97.1,
    goodCount: 6920,
    rejectCount: 230,
    downtimeMinutes: 78,
  }
}

export function mockOperatorDowntime(): OperatorDowntime[] {
  return [
    { operatorId: 'op-1', operatorName: 'Alex M.', stopCount: 4, totalMin: 22, unplannedMin: 18 },
    { operatorId: 'op-2', operatorName: 'Jordan K.', stopCount: 2, totalMin: 14, unplannedMin: 10 },
  ]
}

const nodeKpi = {
  oeePct: 72.4,
  availabilityPct: 88.2,
  performancePct: 84.6,
  qualityPct: 97.1,
  goodCount: 6920,
  rejectCount: 230,
  status: 'Running',
  connectionState: 'Connected',
  activeRecipeCode: 'PKG-STD',
  activeRecipeName: 'Standard Pack',
  idealCycleTimeSec: 1.66,
  actualCycleTimeSec: 2.05,
  actualRatePph: 1180,
  idealRatePph: 2169,
  recipeIsAutoCreated: false,
}

export function mockHierarchyTree(): PlantNode[] {
  return [
    {
      id: MOCK_PLANT_ID,
      name: 'Demo Plant',
      kpi: nodeKpi,
      departments: [
        {
          id: 'dept-1',
          name: 'Packaging',
          kpi: nodeKpi,
          lines: [
            {
              id: MOCK_LINE_ID,
              name: 'Line 1',
              kpi: nodeKpi,
              activeProductCode: 'PKG-STD',
              machines: [
                {
                  id: MOCK_MACHINE_ID,
                  name: 'Filler 1',
                  kpi: nodeKpi,
                  state: 'Running',
                  faultCode: null,
                  speed: 1180,
                },
                {
                  id: '44444444-4444-4444-4444-444444444444',
                  name: 'Capper 1',
                  kpi: { ...nodeKpi, oeePct: 58.2, goodCount: 2100, status: 'Idle' },
                  state: 'Idle',
                  faultCode: null,
                  speed: 0,
                },
              ],
            },
          ],
        },
      ],
    },
  ]
}

export function mockTagValues(paths: { path: string }[]): TagValueSample[] {
  return paths.map((p, i) => ({
    fullPath: p.path,
    value: 1180 + i * 12,
    quality: 'Good',
    timestampUtc: new Date().toISOString(),
    display: `${1180 + i * 12}`,
  }))
}

/** No-op granularity export for typing in historian wrappers. */
export type AuditGranularity = Granularity
