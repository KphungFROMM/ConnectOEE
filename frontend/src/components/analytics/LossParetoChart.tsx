import { useMemo } from 'react'
import { Box } from '@mantine/core'
import { ComboParetoChart, type ParetoPoint } from '../widgets/charts/ComboParetoChart'
import type { ReasonBucket } from '../../lib/historian'
import { AnalyticsEmpty } from './AnalyticsEmpty'

export function LossParetoChart({ reasons }: { reasons: ReasonBucket[] }) {
  const data = useMemo<ParetoPoint[]>(() => {
    const byCat = new Map<string, number>()
    for (const r of reasons) {
      byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.totalMin)
    }
    const sorted = [...byCat.entries()].sort((a, b) => b[1] - a[1])
    let cum = 0
    const total = sorted.reduce((s, [, m]) => s + m, 0) || 1
    return sorted.map(([category, minutes]) => {
      cum += minutes
      return { category, minutes, cumulative: (cum / total) * 100 }
    })
  }, [reasons])

  if (data.length === 0) return <AnalyticsEmpty message="No downtime in range." />
  return (
    <Box h={280}>
      <ComboParetoChart data={data} />
    </Box>
  )
}
