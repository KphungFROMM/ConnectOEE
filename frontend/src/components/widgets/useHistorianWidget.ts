import { useMemo } from 'react'
import type { Granularity, ProductionPoint, ReasonBucket, ReliabilityTrendResult, TrendPoint, TrendResult } from '../../lib/historian'
import { getProduction, getReasons, getReliabilityTrend, getTrend } from '../../lib/historian'
import { getDowntime } from '../../lib/metrics'
import type { WidgetCtx } from './common'
import { resolveBindingScope } from './resolveBindingScope'
import { usePolling } from './usePolling'

function shiftWindow(snapshot?: WidgetCtx['snapshot']) {
  const to = new Date().toISOString()
  const from = snapshot?.shiftStartUtc ?? new Date(Date.now() - 8 * 3600_000).toISOString()
  return { from, to }
}

export function useHistorianTrend(
  ctx: WidgetCtx,
  granularity: Granularity = 'Hour',
  _preferMachine = false,
  intervalMs = 30_000,
  bindingSource?: 'machine' | 'line' | 'plant',
) {
  const scope = resolveBindingScope(ctx, bindingSource ? { source: bindingSource } : undefined)
  const { from, to } = useMemo(() => shiftWindow(ctx.snapshot), [ctx.snapshot?.shiftStartUtc])
  const id = scope.historianId

  return usePolling<TrendResult | null>(
    () => (id ? getTrend(scope.historianLevel, id, granularity, from, to) : Promise.resolve(null)),
    intervalMs,
    [scope.historianLevel, id, from, to, granularity],
  )
}

export function useHistorianProduction(
  ctx: WidgetCtx,
  granularity: Granularity = 'Hour',
  bindingSource?: 'machine' | 'line' | 'plant',
  intervalMs = 30_000,
) {
  const scope = resolveBindingScope(
    ctx,
    bindingSource ? { source: bindingSource } : ctx.plantId && !ctx.lineId ? { source: 'plant' } : { source: 'line' },
  )
  const { from, to } = useMemo(() => shiftWindow(ctx.snapshot), [ctx.snapshot?.shiftStartUtc])
  const id = scope.historianId

  return usePolling<ProductionPoint[]>(
    () => (id ? getProduction(scope.historianLevel, id, granularity, from, to) : Promise.resolve([])),
    intervalMs,
    [scope.historianLevel, id, from, to, granularity],
  )
}

export function useHistorianReasons(
  ctx: WidgetCtx,
  bindingSource?: 'machine' | 'line' | 'plant',
  intervalMs = 30_000,
) {
  const scope = resolveBindingScope(ctx, bindingSource ? { source: bindingSource } : undefined)
  const { from, to } = useMemo(() => shiftWindow(ctx.snapshot), [ctx.snapshot?.shiftStartUtc])
  const lineId = ctx.lineId
  const plantId = ctx.plantId

  return usePolling<ReasonBucket[]>(
    async () => {
      if (scope.historianLevel === 'Plant' && scope.historianId) {
        const events = await getDowntime(undefined, scope.historianId)
        const map = new Map<string, ReasonBucket>()
        for (const e of events) {
          const key = e.reason || e.category
          const existing = map.get(key)
          if (existing) existing.count += 1
          else map.set(key, { reason: e.reason ?? '', category: e.category, count: 1, kind: e.category, totalMin: (e.durationSec ?? 0) / 60 })
        }
        return [...map.values()]
      }
      if (lineId) return getReasons(lineId, from, to)
      if (plantId && scope.historianLevel === 'Line' && scope.historianId) {
        return getReasons(scope.historianId, from, to)
      }
      return []
    },
    intervalMs,
    [scope.historianLevel, scope.historianId, lineId, plantId, from, to],
  )
}

export function useHistorianReliabilityTrend(
  ctx: WidgetCtx,
  granularity: Granularity = 'Hour',
  intervalMs = 30_000,
  bindingSource?: 'machine' | 'line' | 'plant',
) {
  const scope = resolveBindingScope(ctx, bindingSource ? { source: bindingSource } : undefined)
  const { from, to } = useMemo(() => shiftWindow(ctx.snapshot), [ctx.snapshot?.shiftStartUtc])
  const id = scope.historianId

  return usePolling<ReliabilityTrendResult | null>(
    () => (id ? getReliabilityTrend(scope.historianLevel, id, granularity, from, to) : Promise.resolve(null)),
    intervalMs,
    [scope.historianLevel, id, from, to, granularity],
  )
}

export function trendField(point: TrendPoint, field: string): number {
  switch (field) {
    case 'availabilityPct':
      return point.oee.availabilityPct
    case 'performancePct':
      return point.oee.performancePct
    case 'qualityPct':
      return point.oee.qualityPct
    case 'scrapPct':
      return point.oee.scrapPct
    case 'teepPct':
      return point.oee.teepPct
    case 'uptimeMin':
      return point.uptimeMin
    case 'downtimeMin':
      return point.downtimeMin
    case 'availabilityLossMin':
      return point.oee.availabilityLossMin
    case 'performanceLossMin':
      return point.oee.performanceLossMin
    case 'qualityLossMin':
      return point.oee.qualityLossMin
    case 'oeePct':
    default:
      return point.oee.oeePct
  }
}

export function useMetricsScope(ctx: WidgetCtx) {
  return { lineId: ctx.lineId, plantId: ctx.plantId }
}
