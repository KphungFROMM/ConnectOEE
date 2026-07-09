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
