import { apiGet } from './api'
import type { ProductionPartsLoss, ProductionPartsLossResult } from './partsLoss'
import { isAuditApiMode } from '../features/builder/auditApiMode'
import {
  mockProductionPoints,
  mockReasonBuckets,
  mockReliabilityTrend,
  mockTrendResult,
} from '../features/builder/mockAuditApi'

// Mirrors ConnectOEE.Historian.EntityLevel (serialized as the enum name).
export type EntityLevel = 'Plant' | 'Department' | 'Line' | 'Machine'
export type Granularity = 'Auto' | 'Hour' | 'Shift' | 'Day' | 'Week' | 'Month'

export interface OeeResult {
  availabilityPct: number
  performancePct: number
  qualityPct: number
  oeePct: number
  teepPct: number
  scrapPct: number
  yieldPct: number
  fpyPct: number
  availabilityLossMin: number
  performanceLossMin: number
  qualityLossMin: number
  actualCycleTimeSec: number
  idealCycleTimeSec: number
}

export interface TrendPoint {
  bucketUtc: string
  label: string
  oee: OeeResult
  goodCount: number
  rejectCount: number
  totalCount: number
  downtimeMin: number
  targetOeePct: number
  uptimeMin: number
  plannedDowntimeMin: number
  unplannedDowntimeMin: number
  microStopCount: number
}

export interface TrendResult {
  level: EntityLevel
  entityId: string
  entityName: string
  resolvedGranularity: Granularity
  from: string
  to: string
  points: TrendPoint[]
}

export interface KpiSnapshot {
  level: EntityLevel
  entityId: string
  entityName: string
  from: string
  to: string
  oee: OeeResult
  goodCount: number
  rejectCount: number
  totalCount: number
  downtimeMin: number
  downtimeCount: number
  targetOeePct: number
  uptimeMin?: number
  plannedDowntimeMin?: number
  unplannedDowntimeMin?: number
  microStopCount?: number
  targetAvailabilityPct?: number
  targetPerformancePct?: number
  targetQualityPct?: number
  oeeGapPct?: number
  availabilityGapPct?: number
  performanceGapPct?: number
  qualityGapPct?: number
  utilizationPct?: number
  cycleVariancePct?: number
  partsLoss?: ProductionPartsLoss | null
}

export interface DrillNode {
  level: EntityLevel
  id: string
  name: string
  oee: OeeResult
  goodCount: number
  rejectCount: number
  downtimeMin: number
  downtimeCount: number
  uptimeMin?: number
}

export interface ReasonBucket {
  category: string
  kind: string
  reason: string
  count: number
  totalMin: number
}

export interface HistorianLossBucket {
  category: string
  count: number
  totalSec: number
}

export interface HistorianEvent {
  id: string
  lineId: string
  machineId?: string | null
  machineName?: string | null
  startUtc: string
  endUtc?: string | null
  durationSec: number
  category: string
  kind: string
  reason?: string | null
  faultCode?: number | null
  isMicroStop: boolean
}

export interface ProductionPoint {
  bucketUtc: string
  label: string
  goodCount: number
  rejectCount: number
  totalCount: number
  targetCount: number
  scrapPct: number
}

export interface ReliabilityTrendPoint {
  bucketUtc: string
  label: string
  mttrMin: number
  mtbfMin: number
  stopsPerHour: number
  downtimeMin: number
  uptimeMin: number
}

export interface ReliabilityTrendResult {
  level: EntityLevel
  entityId: string
  entityName: string
  resolvedGranularity: Granularity
  from: string
  to: string
  points: ReliabilityTrendPoint[]
}

const range = (from?: string, to?: string) => {
  const p = new URLSearchParams()
  if (from) p.set('from', from)
  if (to) p.set('to', to)
  return p
}

export const getTrend = (
  level: EntityLevel,
  id: string,
  granularity: Granularity,
  from?: string,
  to?: string,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockTrendResult(from, to))
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  p.set('granularity', granularity)
  return apiGet<TrendResult>(`/api/historian/trend?${p}`)
}

export const getSnapshot = (level: EntityLevel, id: string, from?: string, to?: string) => {
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  return apiGet<KpiSnapshot>(`/api/historian/snapshot?${p}`)
}

export const getDrillDown = (level: EntityLevel, id: string, from?: string, to?: string) => {
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  return apiGet<DrillNode[]>(`/api/historian/drilldown?${p}`)
}

export const getReasons = (
  levelOrLineId: EntityLevel | string,
  idOrFrom?: string,
  fromOrTo?: string,
  toOrCategory?: string,
  category?: string,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockReasonBuckets())
  // Scoped: getReasons(level, id, from, to, category?)
  const levels: EntityLevel[] = ['Plant', 'Department', 'Line', 'Machine']
  if (levels.includes(levelOrLineId as EntityLevel) && idOrFrom) {
    const p = range(fromOrTo, toOrCategory)
    p.set('level', levelOrLineId)
    p.set('id', idOrFrom)
    if (category) p.set('category', category)
    return apiGet<ReasonBucket[]>(`/api/historian/reasons?${p}`)
  }
  // Legacy: getReasons(lineId, from, to, category?)
  const lineId = levelOrLineId
  const p = range(idOrFrom, fromOrTo)
  p.set('lineId', lineId)
  if (toOrCategory && !toOrCategory.includes('T')) p.set('category', toOrCategory)
  else if (category) p.set('category', category)
  return apiGet<ReasonBucket[]>(`/api/historian/reasons?${p}`)
}

export const getHistorianLosses = (
  level: EntityLevel,
  id: string,
  from?: string,
  to?: string,
) => {
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  return apiGet<HistorianLossBucket[]>(`/api/historian/losses?${p}`)
}

export const getHistorianEvents = (
  level: EntityLevel,
  id: string,
  from?: string,
  to?: string,
  take = 100,
  category?: string,
) => {
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  p.set('take', String(take))
  if (category) p.set('category', category)
  return apiGet<HistorianEvent[]>(`/api/historian/events?${p}`)
}

export const getProduction = (
  level: EntityLevel,
  id: string,
  granularity: Granularity,
  from?: string,
  to?: string,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockProductionPoints())
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  p.set('granularity', granularity)
  return apiGet<ProductionPoint[]>(`/api/historian/production?${p}`)
}

export const getReliabilityTrend = (
  level: EntityLevel,
  id: string,
  granularity: Granularity,
  from?: string,
  to?: string,
) => {
  if (isAuditApiMode()) return Promise.resolve(mockReliabilityTrend(from, to))
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  p.set('granularity', granularity)
  return apiGet<ReliabilityTrendResult>(`/api/historian/reliability-trend?${p}`)
}

export const getProductionPartsLoss = (
  level: EntityLevel,
  id: string,
  from?: string,
  to?: string,
) => {
  const p = range(from, to)
  p.set('level', level)
  p.set('id', id)
  return apiGet<ProductionPartsLossResult>(`/api/historian/production-parts-loss?${p}`)
}
