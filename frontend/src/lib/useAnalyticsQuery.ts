import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getReliability, type Reliability } from './metrics'
import {
  getDrillDown,
  getHistorianEvents,
  getHistorianLosses,
  getProduction,
  getReasons,
  getReliabilityTrend,
  getSnapshot,
  getTrend,
  type DrillNode,
  type EntityLevel,
  type Granularity,
  type HistorianEvent,
  type HistorianLossBucket,
  type KpiSnapshot,
  type ProductionPoint,
  type ReasonBucket,
  type ReliabilityTrendResult,
  type TrendResult,
} from './historian'

export interface AnalyticsScope {
  level: EntityLevel
  id: string
  name: string
  plantId?: string
  lineId?: string
}

export type AnalyticsTab = 'overview' | 'downtime' | 'production' | 'reliability'

export interface AnalyticsQueryState {
  snapshot: KpiSnapshot | null
  priorSnapshot: KpiSnapshot | null
  trend: TrendResult | null
  priorTrend: TrendResult | null
  production: ProductionPoint[]
  children: DrillNode[]
  reasons: ReasonBucket[]
  losses: HistorianLossBucket[]
  events: HistorianEvent[]
  reliability: Reliability | null
  reliabilityTrend: ReliabilityTrendResult | null
  initialLoading: boolean
  loading: {
    snapshot: boolean
    trend: boolean
    production: boolean
    drilldown: boolean
    downtime: boolean
    reliability: boolean
  }
}

const emptyLoading = {
  snapshot: false,
  trend: false,
  production: false,
  drilldown: false,
  downtime: false,
  reliability: false,
}

function priorRange(from: string, to: string): { from: string; to: string } {
  const f = new Date(from).getTime()
  const t = new Date(to).getTime()
  const span = t - f
  return {
    from: new Date(f - span).toISOString(),
    to: new Date(f).toISOString(),
  }
}

export function useAnalyticsQuery(
  scope: AnalyticsScope | null,
  from: string,
  to: string,
  granularity: Granularity,
  compare: boolean,
  activeTab: AnalyticsTab,
) {
  const [state, setState] = useState<AnalyticsQueryState>({
    snapshot: null,
    priorSnapshot: null,
    trend: null,
    priorTrend: null,
    production: [],
    children: [],
    reasons: [],
    losses: [],
    events: [],
    reliability: null,
    reliabilityTrend: null,
    initialLoading: true,
    loading: { ...emptyLoading, snapshot: true, trend: true },
  })

  const reqId = useRef(0)
  const prevScopeKey = useRef('')
  const scopeKey = scope ? `${scope.level}:${scope.id}` : ''
  const queryKey = scope ? `${scopeKey}:${from}:${to}:${granularity}:${compare}:${activeTab}` : ''

  const prior = useMemo(() => (compare ? priorRange(from, to) : null), [compare, from, to])

  useEffect(() => {
    if (!scope) {
      setState((s) => ({ ...s, initialLoading: false }))
      return
    }

    const scopeChanged = prevScopeKey.current !== scopeKey
    prevScopeKey.current = scopeKey

    const id = ++reqId.current
    const stale = () => id !== reqId.current

    setState((s) => {
      const isInitial = scopeChanged || !s.snapshot
      return {
        ...s,
        ...(scopeChanged
          ? {
              snapshot: null,
              priorSnapshot: null,
              trend: null,
              priorTrend: null,
              production: [],
              children: [],
              reasons: [],
              losses: [],
              events: [],
              reliability: null,
              reliabilityTrend: null,
            }
          : {}),
        initialLoading: isInitial,
        loading: {
          snapshot: true,
          trend: true,
          production: activeTab === 'overview' || activeTab === 'production',
          drilldown: scope.level !== 'Machine',
          downtime: activeTab === 'downtime' || activeTab === 'overview',
          reliability: activeTab === 'reliability' || activeTab === 'overview',
        },
      }
    })

    const patch = (partial: Partial<AnalyticsQueryState>) => {
      if (!stale()) setState((s) => ({ ...s, ...partial, initialLoading: false }))
    }
    const done = (key: keyof AnalyticsQueryState['loading']) => {
      if (!stale()) setState((s) => ({ ...s, loading: { ...s.loading, [key]: false }, initialLoading: false }))
    }

    void getSnapshot(scope.level, scope.id, from, to)
      .then((snapshot) => patch({ snapshot }))
      .catch(() => patch({ snapshot: null }))
      .finally(() => done('snapshot'))

    if (compare && prior) {
      void getSnapshot(scope.level, scope.id, prior.from, prior.to)
        .then((priorSnapshot) => patch({ priorSnapshot }))
        .catch(() => patch({ priorSnapshot: null }))
    } else {
      patch({ priorSnapshot: null })
    }

    void getTrend(scope.level, scope.id, granularity, from, to)
      .then((trend) => patch({ trend }))
      .catch(() => patch({ trend: null }))
      .finally(() => done('trend'))

    if (compare && prior) {
      void getTrend(scope.level, scope.id, granularity, prior.from, prior.to)
        .then((priorTrend) => patch({ priorTrend }))
        .catch(() => patch({ priorTrend: null }))
    } else {
      patch({ priorTrend: null })
    }

    if (activeTab === 'overview' || activeTab === 'production') {
      void getProduction(scope.level, scope.id, granularity, from, to)
        .then((production) => patch({ production }))
        .catch(() => patch({ production: [] }))
        .finally(() => done('production'))
    } else {
      done('production')
    }

    if (scope.level !== 'Machine') {
      void getDrillDown(scope.level, scope.id, from, to)
        .then((children) => patch({ children }))
        .catch(() => patch({ children: [] }))
        .finally(() => done('drilldown'))
    } else {
      patch({ children: [] })
      done('drilldown')
    }

    const loadDowntime = activeTab === 'downtime' || activeTab === 'overview'
    if (loadDowntime) {
      void Promise.all([
        getReasons(scope.level, scope.id, from, to),
        getHistorianLosses(scope.level, scope.id, from, to),
        getHistorianEvents(scope.level, scope.id, from, to, 200),
      ])
        .then(([reasons, losses, events]) => patch({ reasons, losses, events }))
        .catch(() => patch({ reasons: [], losses: [], events: [] }))
        .finally(() => done('downtime'))
    } else {
      done('downtime')
    }

    const loadReliability = activeTab === 'reliability' || activeTab === 'overview'
    if (loadReliability) {
      const lineId = scope.level === 'Line' || scope.level === 'Machine' ? scope.lineId ?? scope.id : null
      const plantId = scope.plantId ?? (scope.level === 'Plant' ? scope.id : null)
      void Promise.all([
        getReliability(lineId, plantId, from, to),
        getReliabilityTrend(scope.level, scope.id, granularity, from, to),
      ])
        .then(([reliability, reliabilityTrend]) => patch({ reliability, reliabilityTrend }))
        .catch(() => patch({ reliability: null, reliabilityTrend: null }))
        .finally(() => done('reliability'))
    } else {
      done('reliability')
    }

    return () => {
      reqId.current++
    }
  }, [queryKey])

  const coverage = useMemo(() => {
    const points = state.trend?.points ?? []
    if (points.length === 0) return null
    const withData = points.filter((p) => p.goodCount > 0 || p.downtimeMin > 0 || p.oee.oeePct > 0).length
    return { total: points.length, withData }
  }, [state.trend])

  const refreshEvents = useCallback(() => {
    if (!scope) return Promise.resolve()
    return getHistorianEvents(scope.level, scope.id, from, to, 200)
      .then((events) => setState((s) => ({ ...s, events })))
      .catch(() => undefined)
  }, [scope, from, to])

  return { ...state, coverage, refreshEvents }
}
