import { useMemo } from 'react'
import { AreaChart, LineChart } from '@mantine/charts'
import type { TrendResult } from '../../lib/historian'
import { AnalyticsEmpty } from './AnalyticsEmpty'

export type OeeTrendMode = 'factors' | 'timeBalance'

interface Props {
  trend: TrendResult | null
  priorTrend?: TrendResult | null
  compare?: boolean
  loading?: boolean
  mode?: OeeTrendMode
}

export function OeeTrendChart({ trend, priorTrend, compare, loading, mode = 'factors' }: Props) {
  const chartData = useMemo(() => {
    const points = trend?.points ?? []
    const priorMap = new Map((priorTrend?.points ?? []).map((p, i) => [i, p]))
    return points.map((p, i) => ({
      label: p.label,
      OEE: p.oee.oeePct,
      A: p.oee.availabilityPct,
      P: p.oee.performancePct,
      Q: p.oee.qualityPct,
      Target: p.targetOeePct,
      PriorOEE: compare ? (priorMap.get(i)?.oee.oeePct ?? null) : null,
      Uptime: p.uptimeMin,
      Planned: p.plannedDowntimeMin,
      Unplanned: p.unplannedDowntimeMin,
      _point: p,
    }))
  }, [trend, priorTrend, compare])

  if (!loading && chartData.length === 0) return <AnalyticsEmpty />

  if (mode === 'timeBalance') {
    return (
      <AreaChart
        h={280}
        data={chartData}
        dataKey="label"
        withDots={chartData.length <= 60}
        series={[
          { name: 'Uptime', color: 'teal.6' },
          { name: 'Planned', color: 'blue.5' },
          { name: 'Unplanned', color: 'red.5' },
        ]}
        type="stacked"
        valueFormatter={(v) => `${v.toFixed(0)}m`}
        withLegend
        curveType="monotone"
      />
    )
  }

  const series = [
    { name: 'OEE', color: 'teal.6' },
    { name: 'A', color: 'blue.6' },
    { name: 'P', color: 'indigo.5' },
    { name: 'Q', color: 'grape.6' },
    { name: 'Target', color: 'gray.4' },
  ]
  if (compare) series.push({ name: 'PriorOEE', color: 'gray.6' })

  return (
    <LineChart
      h={280}
      data={chartData}
      dataKey="label"
      withDots={chartData.length <= 60}
      series={series}
      valueFormatter={(v) => `${v.toFixed(0)}%`}
      yAxisProps={{ domain: [0, 100] }}
      withLegend
      curveType="monotone"
    />
  )
}
