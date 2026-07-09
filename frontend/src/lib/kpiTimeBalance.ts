import type { KpiSnapshot } from './historian'
import type { Reliability } from './metrics'
import type { TimeBalanceData } from '../components/analytics/TimeBalanceChart'

/** Build time-balance chart data from historian snapshot + optional reliability rollups. */
export function buildTimeBalanceFromSnapshot(
  snapshot: KpiSnapshot,
  reliability?: Reliability | null,
  plannedMinOverride?: number,
  unplannedMinOverride?: number,
): TimeBalanceData | null {
  const uptimeMin = snapshot.uptimeMin ?? 0
  const downtimeMin = snapshot.downtimeMin ?? 0
  const plannedMin = plannedMinOverride ?? snapshot.plannedDowntimeMin ?? reliability?.plannedDowntimeMin ?? 0
  const unplannedMin =
    unplannedMinOverride ?? snapshot.unplannedDowntimeMin ?? reliability?.unplannedDowntimeMin ?? 0
  if (uptimeMin <= 0 && downtimeMin <= 0 && plannedMin <= 0 && unplannedMin <= 0) return null
  return { uptimeMin, downtimeMin, plannedMin, unplannedMin }
}
