import { lightTheme, statusColors } from '../../../theme/tokens'
import { Bar, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'

export interface ParetoPoint {
  category: string
  minutes: number
  cumulative: number
}

export function ComboParetoChart({ data }: { data: ParetoPoint[] }) {
  if (data.length === 0) return null
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 40 }}>
        <XAxis dataKey="category" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} interval={0} />
        <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
        <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
        <Bar yAxisId="left" dataKey="minutes" fill={statusColors.fault} radius={[4, 4, 0, 0]} barSize={24} name="Minutes" />
        <Line yAxisId="right" type="monotone" dataKey="cumulative" stroke={lightTheme.primary} strokeWidth={2} dot={false} name="Cumulative %" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
