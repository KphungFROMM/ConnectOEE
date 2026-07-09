import type { DowntimeEvent } from './metrics'



const DOWN_STATES = new Set(['Down', 'Setup', 'PlannedDown'])



/** Returns true when a downtime reason label indicates a product changeover. */

export function isChangeoverReason(reason: string, category: string): boolean {

  return category === 'SetupAndAdjustment' && /changeover/i.test(reason)

}



export function changeoverModeHint(mode: import('./idealRate').ChangeoverMode): string {

  return mode === 'LogOnly'

    ? 'Quick changeover — product changes are logged, not counted as downtime'

    : 'Setup changeover — product changes track planned setup downtime'

}



export const CHANGEOVER_REASON_SAVED_MESSAGE = 'Changeover reason saved'



export interface OfferProductAfterChangeoverOptions {

  machineState?: string | null

  maxAgeMinutes?: number

}



/** True when a live/recent stop may warrant an optional product picker after Changeover reason. */

export function shouldOfferProductAfterChangeover(

  event: DowntimeEvent,

  options?: OfferProductAfterChangeoverOptions,

): boolean {

  const maxAgeMinutes = options?.maxAgeMinutes ?? 60

  const maxAgeMs = maxAgeMinutes * 60 * 1000

  const now = Date.now()

  const machineState = options?.machineState ?? null



  const isDown = machineState != null && DOWN_STATES.has(machineState)

  const isOpenStop = !event.endUtc

  if (isDown && isOpenStop) return true



  const referenceUtc = event.endUtc ?? event.startUtc

  const referenceMs = new Date(referenceUtc).getTime()

  if (Number.isFinite(referenceMs) && now - referenceMs <= maxAgeMs) return true



  return false

}


