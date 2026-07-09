import { apiGet, apiPatch, apiPost } from './api'
import { isAuditApiMode } from '../features/builder/auditApiMode'
import {
  mockCurrentShift,
  mockDowntimeEvents,
  mockLossBuckets,
  mockOperatorDowntime,
  mockReliability,
} from '../features/builder/mockAuditApi'

export interface DowntimeEvent {
  id: string
  lineId: string
  machineId?: string | null
  startUtc: string
  endUtc?: string | null
  durationSec: number
  category: string
  kind: string
  reason?: string | null
  faultCode?: number | null
  isMicroStop: boolean
  requiresOperatorReason?: boolean
}
export interface LossBucket {
  category: string
  count: number
  totalSec: number
}
export interface Reliability {
  mttrMin: number
  mtbfMin: number
  mttfMin: number
  mttdMin: number
  meanLostTimePerDowntimeMin: number
  failureRatePerHour: number
  availabilityFromReliabilityPct: number
  stopsPerHour: number
  downtimeCount: number
  failureCount: number
  plannedDowntimeMin: number
  unplannedDowntimeMin: number
}
export interface ShiftInstance {
  id: string
  shiftName: string
  startUtc: string
  endUtc: string
  isClosed: boolean
  oeePct?: number | null
  availabilityPct?: number | null
  performancePct?: number | null
  qualityPct?: number | null
  goodCount: number
  rejectCount: number
  downtimeMinutes: number
}

export interface OperatorDowntime {
  operatorId: string | null
  operatorName: string
  stopCount: number
  totalMin: number
  unplannedMin: number
}

function scopeQuery(lineId?: string | null, plantId?: string | null, machineId?: string | null): string {
  const p = new URLSearchParams()
  if (lineId) p.set('lineId', lineId)
  if (plantId) p.set('plantId', plantId)
  if (machineId) p.set('machineId', machineId)
  return p.toString()
}

export const getDowntime = (
  lineId?: string | null,
  plantId?: string | null,
  machineId?: string | null,
  from?: string | null,
  to?: string | null,
  needsReason?: boolean,
  take?: number,
) => {
  if (isAuditApiMode()) {
    let events = mockDowntimeEvents()
    if (needsReason) events = events.filter((e) => e.requiresOperatorReason)
    if (take != null) events = events.slice(0, take)
    return Promise.resolve(events)
  }
  const p = new URLSearchParams(scopeQuery(lineId, plantId, machineId))
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  if (needsReason) p.set('needsReason', 'true')
  if (take != null) p.set('take', String(take))
  const q = p.toString()
  return q.includes('lineId') || q.includes('plantId')
    ? apiGet<DowntimeEvent[]>(`/api/events/downtime?${q}`)
    : Promise.resolve([])
}

export const getUnassignedDowntime = (
  lineId?: string | null,
  plantId?: string | null,
  machineId?: string | null,
  take = 200,
) => getDowntime(lineId, plantId, machineId, null, null, true, take)

export const getLosses = (
  lineId?: string | null,
  plantId?: string | null,
  machineId?: string | null,
  from?: string | null,
  to?: string | null,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockLossBuckets())
  const p = new URLSearchParams(scopeQuery(lineId, plantId, machineId))
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  const q = p.toString()
  return q.includes('lineId') || q.includes('plantId')
    ? apiGet<LossBucket[]>(`/api/events/losses?${q}`)
    : Promise.resolve([])
}

export const getReliability = (
  lineId?: string | null,
  plantId?: string | null,
  from?: string | null,
  to?: string | null,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockReliability())
  const q = scopeQuery(lineId, plantId)
  if (!q) return Promise.resolve(null)
  const p = new URLSearchParams(q)
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  return apiGet<Reliability>(`/api/events/reliability?${p}`)
}

export const getCurrentShift = (lineId?: string | null, plantId?: string | null) => {
  if (isAuditApiMode()) return Promise.resolve(mockCurrentShift())
  if (lineId) return apiGet<ShiftInstance>(`/api/shifts/current?lineId=${lineId}`)
  if (plantId) return apiGet<ShiftInstance>(`/api/shifts/current?plantId=${plantId}`)
  return Promise.resolve(null)
}

export const setDowntimeReason = (body: {
  downtimeEventId: string
  reason: string
  category?: string
}) => apiPost<void>('/api/shifts/downtime-reason', body)

export const correctDowntimeReason = (eventId: string, body: { reason: string; category?: string }) =>
  apiPatch<void>(`/api/events/downtime/${eventId}/reason`, body)

export const getDowntimeByOperator = (
  lineId?: string | null,
  plantId?: string | null,
  from?: string,
  to?: string,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockOperatorDowntime())
  const q = scopeQuery(lineId, plantId)
  if (!q) return Promise.resolve([])
  const p = new URLSearchParams(q)
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  return apiGet<OperatorDowntime[]>(`/api/events/downtime-by-operator?${p}`)
}
