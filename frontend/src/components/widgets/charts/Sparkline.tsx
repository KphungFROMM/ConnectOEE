import { lightTheme } from '../../../theme/tokens'
import { Area, AreaChart, Line, LineChart, ResponsiveContainer } from 'recharts'

export function Sparkline({
  data,
  dataKey = 'v',
  color = lightTheme.primary,
  height = 36,
  filled = false,
  showLastPoint = false,
}: {
  data: { label: string; v: number }[]
  dataKey?: string
  color?: string
  height?: number
  filled?: boolean
  showLastPoint?: boolean
}) {
  if (data.length < 2) return null

  if (filled) {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} fill="url(#sparkFill)" strokeWidth={2} dot={false} />
          {showLastPoint ? (
            <Line type="monotone" dataKey={dataKey} stroke="transparent" dot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }} />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          dot={
            showLastPoint
              ? (props) => {
                  const { cx, cy, index } = props as { cx: number; cy: number; index: number }
                  if (index !== data.length - 1) return <g key={index} />
                  return <circle key={index} cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />
                }
              : false
          }
        />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function sparklineFromValues(values: number[], prefix = ''): { label: string; v: number }[] {
  return values.map((v, i) => ({ label: `${prefix}${i}`, v }))
}
