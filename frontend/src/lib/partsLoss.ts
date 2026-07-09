/** Parts-based production expectations and loss (mirrors Core ProductionPartsLoss). */
export interface ProductionPartsLoss {
  maxPossibleParts: number
  expectedPartsPace?: number | null
  theoreticalOutput: number
  partsLostAvailability: number
  partsLostPerformance: number
  partsLostQuality: number
  partsLostBreakdown: number
  partsCouldHaveMade: number
  outputGapParts: number
}

export interface ProductionPartsLossByCategory {
  category: string
  totalSec: number
  partsLost: number
}

export interface ProductionPartsLossResult {
  level: string
  entityId: string
  entityName: string
  from: string
  to: string
  summary: ProductionPartsLoss
  byCategory: ProductionPartsLossByCategory[]
}

export function partsLossFromLive(snap: {
  idealCycleTimeSec?: number
  goodCount?: number
  maxPossibleParts?: number
  expectedPartsPace?: number | null
  theoreticalOutput?: number
  partsLostAvailability?: number
  partsLostPerformance?: number
  partsLostQuality?: number
  partsLostBreakdown?: number
  partsCouldHaveMade?: number
  outputGap?: number
}): ProductionPartsLoss | null {
  if (!snap.idealCycleTimeSec || snap.idealCycleTimeSec <= 0) return null
  return {
    maxPossibleParts: snap.maxPossibleParts ?? 0,
    expectedPartsPace: snap.expectedPartsPace ?? null,
    theoreticalOutput: snap.theoreticalOutput ?? 0,
    partsLostAvailability: snap.partsLostAvailability ?? 0,
    partsLostPerformance: snap.partsLostPerformance ?? 0,
    partsLostQuality: snap.partsLostQuality ?? 0,
    partsLostBreakdown: snap.partsLostBreakdown ?? 0,
    partsCouldHaveMade: snap.partsCouldHaveMade ?? 0,
    outputGapParts: snap.outputGap ?? 0,
  }
}

export function aggregatePartsLossFromSnapshots(
  snapshots: Array<{
    idealCycleTimeSec?: number
    idealCycleSource?: string | null
    goodCount?: number
    maxPossibleParts?: number
    expectedPartsPace?: number | null
    theoreticalOutput?: number
    partsLostAvailability?: number
    partsLostPerformance?: number
    partsLostQuality?: number
    partsLostBreakdown?: number
    partsCouldHaveMade?: number
    outputGap?: number
  }>,
): { loss: ProductionPartsLoss; goodCount: number; idealRatePph: number; idealCycleSource?: string | null } | null {
  const eligible = snapshots.filter((s) => (s.idealCycleTimeSec ?? 0) > 0)
  if (eligible.length === 0) return null

  const sum = (pick: (s: (typeof eligible)[0]) => number) =>
    eligible.reduce((acc, s) => acc + pick(s), 0)

  const goodCount = sum((s) => s.goodCount ?? 0)
  const avgIdealCycle =
    eligible.reduce((acc, s) => acc + (s.idealCycleTimeSec ?? 0), 0) / eligible.length
  const idealRatePph = avgIdealCycle > 0 ? 3600 / avgIdealCycle : 0

  const loss: ProductionPartsLoss = {
    maxPossibleParts: sum((s) => s.maxPossibleParts ?? 0),
    expectedPartsPace: sum((s) => s.expectedPartsPace ?? 0) || null,
    theoreticalOutput: sum((s) => s.theoreticalOutput ?? 0),
    partsLostAvailability: sum((s) => s.partsLostAvailability ?? 0),
    partsLostPerformance: sum((s) => s.partsLostPerformance ?? 0),
    partsLostQuality: sum((s) => s.partsLostQuality ?? 0),
    partsLostBreakdown: sum((s) => s.partsLostBreakdown ?? 0),
    partsCouldHaveMade: sum((s) => s.partsCouldHaveMade ?? 0),
    outputGapParts: sum((s) => s.outputGap ?? 0),
  }

  const source = (snapshots.find((s) => s.idealCycleSource)?.idealCycleSource as string | undefined) ?? null

  return { loss, goodCount, idealRatePph, idealCycleSource: source }
}
