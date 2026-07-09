import { Fragment } from 'react'
import { Text, Tooltip } from '@mantine/core'
import { formatDurationMinutes } from '../../../lib/formatDuration'

export interface HeatmapCell {
  hour: number
  day: number
  minutes: number
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function heatColor(minutes: number, max: number): string {
  if (minutes <= 0) return 'var(--mantine-color-default-hover)'
  const t = Math.min(1, minutes / Math.max(max, 1))
  if (t < 0.33) return `rgba(224, 168, 0, ${0.25 + t})`
  if (t < 0.66) return `rgba(214, 69, 69, ${0.35 + t * 0.4})`
  return `rgba(214, 69, 69, ${0.75 + t * 0.2})`
}

export function HeatmapGrid({ cells }: { cells: HeatmapCell[] }) {
  const max = Math.max(...cells.map((c) => c.minutes), 1)
  const byKey = new Map(cells.map((c) => [`${c.day}-${c.hour}`, c.minutes]))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px repeat(24, 1fr)', gap: 2, fontSize: 10 }}>
      <div />
      {Array.from({ length: 24 }, (_, h) => (
        <Text key={h} size="10px" c="dimmed" ta="center">
          {h % 6 === 0 ? h : ''}
        </Text>
      ))}
      {DAYS.map((day, di) => (
        <Fragment key={day}>
          <Text size="10px" c="dimmed" fw={600}>
            {day}
          </Text>
          {Array.from({ length: 24 }, (_, h) => {
            const minutes = byKey.get(`${di}-${h}`) ?? 0
            return (
              <Tooltip key={`${di}-${h}`} label={`${day} ${h}:00 — ${formatDurationMinutes(minutes)} downtime`} withArrow>
                <div
                  style={{
                    aspectRatio: '1',
                    borderRadius: 3,
                    background: heatColor(minutes, max),
                    minHeight: 14,
                  }}
                />
              </Tooltip>
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}
