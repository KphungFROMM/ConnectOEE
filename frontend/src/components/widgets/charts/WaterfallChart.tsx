import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts'

export interface WaterfallStep {
  name: string
  value: number
  fill?: string
}

export function WaterfallChart({ steps, max = 100, unit = '%' }: { steps: WaterfallStep[]; max?: number; unit?: string }) {
  if (steps.length === 0) return null
  let running = max
  const data = steps.map((s) => {
    if (s.name === 'Start') {
      running = s.value
      return {
        name: s.name,
        base: 0,
        height: s.value,
        fill: s.fill ?? '#8A929E',
      }
    }
    if (s.name === 'OEE') {
      running = s.value
      return {
        name: s.name,
        base: 0,
        height: s.value,
        fill: s.fill ?? '#2E9E5B',
      }
    }
    const loss = Math.abs(s.value)
    running = Math.max(0, running - loss)
    return {
      name: s.name,
      base: running,
      height: loss,
      fill: s.fill ?? '#E0A800',
    }
  })

  const yMax = Math.max(max, ...data.map((d) => d.base + d.height), 1)

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, yMax]} tick={{ fontSize: 10 }} unit={unit} tickFormatter={(v) => `${Math.round(Number(v))}`} />
        <Bar dataKey="base" stackId="a" fill="transparent" />
        <Bar dataKey="height" stackId="a" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
