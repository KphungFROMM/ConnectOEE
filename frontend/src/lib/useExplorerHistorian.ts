import { useEffect, useMemo, useRef, useState } from 'react'
import { getReliability, type Reliability } from './metrics'
import {
  getDrillDown,
  getHistorianLosses,
  getProduction,
  getReasons,
  getReliabilityTrend,
  getSnapshot,
  getTrend,
  type DrillNode,
  type EntityLevel,
  type HistorianLossBucket,
  type KpiSnapshot,
  type ProductionPoint,
  type ReasonBucket,
  type ReliabilityTrendResult,
  type TrendResult,
} from './historian'
import type { ExplorerRange } from '../components/explorer/explorerTypes'

export interface ExplorerHistorianScope {
  level: EntityLevel
  id: string
  lineId?: string
  plantId?: string
}

export interface ExplorerHistorianState {
  snapshot: KpiSnapshot | null
  trend: TrendResult | null
  production: ProductionPoint[]
  children: DrillNode[]
  reasons: ReasonBucket[]
  losses: HistorianLossBucket[]
  reliability: Reliability | null
  reliabilityTrend: ReliabilityTrendResult | null
  from: string
  to: string
  /** True only on first load for a scope — avoids skeleton flicker on refresh. */
  initialLoading: boolean
}

const emptyState: ExplorerHistorianState = {
  snapshot: null,
  trend: null,
  production: [],
  children: [],
  reasons: [],
  losses: [],
  reliability: null,
  reliabilityTrend: null,
  from: '',
  to: '',
  initialLoading: true,
}

function resolveRange(
  range: ExplorerRange,
  shiftStartUtc?: string | null,
  shiftEndUtc?: string | null,
): { from: string; to: string } {
  const now = Date.now()
  if (range === 'shift' && shiftStartUtc) {
    const end = shiftEndUtc && new Date(shiftEndUtc).getTime() > now ? new Date(now).toISOString() : shiftEndUtc ?? new Date(now).toISOString()
    return { from: shiftStartUtc, to: end }
  }
  return {
    from: new Date(now - 8 * 3600_000).toISOString(),
    to: new Date(now).toISOString(),
  }
}

export function useExplorerHistorian(
  scope: ExplorerHistorianScope | null,
  range: ExplorerRange,
  shiftStartUtc?: string | null,
  shiftEndUtc?: string | null,
) {
  const [state, setState] = useState<ExplorerHistorianState>(emptyState)
  const reqId = useRef(0)
  const scopeKey = scope
    ? `${scope.level}:${scope.id}:${scope.lineId ?? ''}:${scope.plantId ?? ''}:${range}`
    : ''

  const { from, to } = useMemo(
    () => resolveRange(range, shiftStartUtc, shiftEndUtc),
    [range, shiftStartUtc, shiftEndUtc],
  )

  const rangeKey = `${from}|${to}`
  const shiftReady = range !== 'shift' || Boolean(shiftStartUtc)

  useEffect(() => {
    if (!scope) {
      setState({ ...emptyState, initialLoading: false })
      return
    }

    if (!shiftReady) {
      setState((s) => ({ ...s, initialLoading: true, from: '', to: '' }))
      return
    }

    setState({ ...emptyState, from, to })

    const load = (isInitial: boolean) => {
      const id = ++reqId.current
      const stale = () => id !== reqId.current

      if (isInitial) {
        setState((s) => ({ ...s, initialLoading: true, from, to }))
      }

      const level = scope.level
      const lineId = scope.lineId ?? (scope.level === 'Line' ? scope.id : null)
      const plantId = scope.plantId ?? (scope.level === 'Plant' ? scope.id : null)

      void Promise.all([
        getSnapshot(level, scope.id, from, to).catch(() => null),
        getTrend(level, scope.id, 'Hour', from, to).catch(() => null),
        getProduction(level, scope.id, 'Hour', from, to).catch(() => [] as ProductionPoint[]),
        scope.level !== 'Machine'
          ? getDrillDown(level, scope.id, from, to).catch(() => [] as DrillNode[])
          : Promise.resolve([] as DrillNode[]),
        getReasons(level, scope.id, from, to).catch(() => [] as ReasonBucket[]),
        getHistorianLosses(level, scope.id, from, to).catch(() => [] as HistorianLossBucket[]),
        getReliability(lineId, plantId, from, to).catch(() => null),
        getReliabilityTrend(level, scope.id, 'Hour', from, to).catch(() => null),
      ]).then(([snapshot, trend, production, children, reasons, losses, reliability, reliabilityTrend]) => {
        if (stale()) return
        setState((prev) => ({
          snapshot: snapshot ?? (isInitial ? null : prev.snapshot),
          trend: trend ?? (isInitial ? null : prev.trend),
          production: production.length > 0 ? production : isInitial ? [] : prev.production,
          children: children.length > 0 ? children : isInitial ? [] : prev.children,
          reasons: reasons.length > 0 ? reasons : isInitial ? [] : prev.reasons,
          losses: losses.length > 0 ? losses : isInitial ? [] : prev.losses,
          reliability: reliability ?? (isInitial ? null : prev.reliability),
          reliabilityTrend: reliabilityTrend ?? (isInitial ? null : prev.reliabilityTrend),
          from,
          to,
          initialLoading: false,
        }))
      })
    }

    load(true)
    const interval = setInterval(() => load(false), 60_000)
    return () => {
      reqId.current++
      clearInterval(interval)
    }
    // scopeKey/rangeKey/shiftReady pin stable identity; scope/from/to read from latest closure when keys change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, rangeKey, shiftReady])

  return state
}
