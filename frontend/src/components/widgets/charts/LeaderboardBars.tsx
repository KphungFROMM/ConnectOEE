import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'

export interface LeaderboardItem {
  name: string
  value: number
  sublabel?: string
}

/** Distinct per-line colors — bar length shows performance; color identifies the line. */
const LINE_RANK_COLORS = ['#2563EB', '#6366F1', '#0D9488', '#9333EA', '#0891B2', '#CA8A04', '#64748B', '#DB2777']

export function LeaderboardBars({
  items,
  maxItems = 8,
  maxValue,
}: {
  items: LeaderboardItem[]
  maxItems?: number
  maxValue?: number
}) {
  const sorted = [...items].sort((a, b) => b.value - a.value).slice(0, maxItems)
  if (sorted.length === 0) return null
  const domainMax = maxValue ?? Math.max(...sorted.map((x) => x.value), 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
        <XAxis type="number" domain={[0, domainMax]} tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
          {sorted.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={LINE_RANK_COLORS[index % LINE_RANK_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
