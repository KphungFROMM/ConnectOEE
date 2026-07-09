import type { KpiSnapshot, TrendResult } from '../../lib/historian'

export function exportAnalyticsCsv(snapshot: KpiSnapshot | null, trend: TrendResult | null) {
  const lines: string[] = []
  if (snapshot) {
    lines.push('section,metric,value')
    lines.push(`snapshot,OEE,${snapshot.oee.oeePct}`)
    lines.push(`snapshot,Availability,${snapshot.oee.availabilityPct}`)
    lines.push(`snapshot,Performance,${snapshot.oee.performancePct}`)
    lines.push(`snapshot,Quality,${snapshot.oee.qualityPct}`)
    lines.push(`snapshot,Good,${snapshot.goodCount}`)
    lines.push(`snapshot,Reject,${snapshot.rejectCount}`)
    lines.push(`snapshot,DowntimeMin,${snapshot.downtimeMin}`)
  }
  if (trend && trend.points.length > 0) {
    lines.push('bucket,label,oee,availability,performance,quality,good,reject,downtimeMin')
    for (const p of trend.points) {
      lines.push(
        [
          p.bucketUtc,
          `"${p.label.replace(/"/g, '""')}"`,
          p.oee.oeePct,
          p.oee.availabilityPct,
          p.oee.performancePct,
          p.oee.qualityPct,
          p.goodCount,
          p.rejectCount,
          p.downtimeMin,
        ].join(','),
      )
    }
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `connectoee-analytics-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
