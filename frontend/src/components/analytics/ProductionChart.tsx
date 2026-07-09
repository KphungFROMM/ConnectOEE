import { BarChart, LineChart } from '@mantine/charts'
import type { ProductionPoint } from '../../lib/historian'
import { AnalyticsEmpty } from './AnalyticsEmpty'

interface Props {
  production: ProductionPoint[]
  showScrapTrend?: boolean
  loading?: boolean
}

export function ProductionChart({ production, showScrapTrend, loading }: Props) {
  if (!loading && production.length === 0) return <AnalyticsEmpty />

  if (showScrapTrend) {
    const data = production.map((p) => ({
      label: p.label,
      Scrap: p.scrapPct,
      Good: p.goodCount,
      Reject: p.rejectCount,
    }))
    return (
      <LineChart
        h={280}
        data={data}
        dataKey="label"
        series={[
          { name: 'Scrap', color: 'red.6' },
          { name: 'Good', color: 'teal.6' },
        ]}
        withLegend
      />
    )
  }

  const data = production.map((p) => ({
    label: p.label,
    Good: p.goodCount,
    Reject: p.rejectCount,
    Target: p.targetCount,
  }))

  return (
    <BarChart
      h={280}
      data={data}
      dataKey="label"
      type="stacked"
      series={[
        { name: 'Good', color: 'teal.6' },
        { name: 'Reject', color: 'red.6' },
        { name: 'Target', color: 'gray.5' },
      ]}
      withLegend
    />
  )
}
