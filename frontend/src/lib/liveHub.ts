import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from '@microsoft/signalr'
import { getToken } from './auth'

export interface MachineSnapshot {
  machineId: string
  lineId: string
  machineName: string
  state: string
  goodCount: number
  rejectCount: number
  reworkCount: number
  speed: number
  faultCode: number | null
  downtimeReasonText?: string | null
  connectionState: string
  timestampUtc: string
  oeePct: number
  availabilityPct: number
  performancePct: number
  qualityPct: number
  teepPct: number
  shiftName: string
  shiftStartUtc: string
  shiftEndUtc: string
  mttrMin: number
  mtbfMin: number
  mttfMin: number
  mttdMin: number
  meanLostTimePerDowntimeMin: number
  failureRatePerHour: number
  stopsPerHour: number
  availabilityFromReliabilityPct: number
  downtimeCount: number
  microStopCount: number
  failureCount: number
  uptimeMin: number
  downtimeMin: number
  plannedDowntimeMin: number
  unplannedDowntimeMin: number
  uptimePct: number
  availabilityLossMin: number
  performanceLossMin: number
  qualityLossMin: number
  actualCycleTimeSec: number
  idealCycleTimeSec: number
  actualRatePph: number
  idealRatePph: number
  rateVariancePct: number
  scrapPct: number
  yieldPct: number
  fpyPct: number
  activeRecipeCode?: string | null
  activeRecipeName?: string | null
  recipeIsAutoCreated?: boolean
  idealCycleSource?: string | null
  targetOeePct?: number
  targetAvailabilityPct?: number
  targetPerformancePct?: number
  targetQualityPct?: number
  oeeGapPct?: number
  availabilityGapPct?: number
  performanceGapPct?: number
  qualityGapPct?: number
  utilizationPct?: number
  cycleVariancePct?: number
  reworkPct?: number | null
  reworkTrackingActive?: boolean
  runTargetQuantity?: number | null
  runTargetQuantitySource?: string | null
  runAttainmentPct?: number | null
  runPartsRemaining?: number | null
  shiftTargetQuantity?: number | null
  shiftTargetQuantitySource?: string | null
  shiftAttainmentPct?: number | null
  shiftPartsRemaining?: number | null
  theoreticalOutput?: number
  outputGap?: number
  maxPossibleParts?: number
  expectedPartsPace?: number | null
  partsLostAvailability?: number
  partsLostPerformance?: number
  partsLostQuality?: number
  partsLostBreakdown?: number
  partsCouldHaveMade?: number
  idleMin?: number
  downMin?: number
  setupMin?: number
  starvedMin?: number
  blockedMin?: number
  unknownMin?: number
  idlePct?: number | null
  downPct?: number | null
  setupPct?: number | null
  starvedPct?: number | null
  blockedPct?: number | null
  unknownPct?: number | null
}

/** Normalizes liveUpdate payloads (single snapshot or batch) from SignalR. */
export function normalizeLiveUpdates(payload: MachineSnapshot | MachineSnapshot[]): MachineSnapshot[] {
  const list = Array.isArray(payload) ? payload : [payload]
  return list.filter((s): s is MachineSnapshot => Boolean(s?.machineId))
}

/** Builds (but does not start) a SignalR connection to the live hub. */
export function createLiveConnection(options?: { useCookieAuth?: boolean }): HubConnection {
  return new HubConnectionBuilder()
    .withUrl('/hubs/live', {
      accessTokenFactory: options?.useCookieAuth
        ? undefined
        : () => getToken() ?? '',
      withCredentials: true,
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()
}

export { HubConnectionState }
