import { useEffect, useMemo, useState } from 'react'
import { Badge, Group, Progress, Text, Tooltip } from '@mantine/core'
import { getCurrentShift, type ShiftInstance } from '../../lib/metrics'
import { formatDurationSeconds } from '../../lib/formatDuration'

const FALLBACK_SHIFT = 'all day'

function isFallbackShift(name: string) {
  return name.trim().toLowerCase() === FALLBACK_SHIFT
}

/** Compact active-shift chip for Analytics — bound to the selected plant/line, not the global shell. */
export function AnalyticsShiftChip({
  lineId,
  plantId,
}: {
  lineId?: string | null
  plantId?: string | null
}) {
  const [shift, setShift] = useState<ShiftInstance | null>(null)

  useEffect(() => {
    if (!lineId && !plantId) {
      setShift(null)
      return
    }
    let cancelled = false
    const load = () => {
      void getCurrentShift(lineId ?? null, plantId ?? null)
        .then((s) => {
          if (!cancelled) setShift(s)
        })
        .catch(() => {
          if (!cancelled) setShift(null)
        })
    }
    load()
    const t = setInterval(load, 30_000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [lineId, plantId])

  const progress = useMemo(() => {
    if (!shift?.startUtc || !shift?.endUtc) return null
    if (isFallbackShift(shift.shiftName)) return null
    const start = new Date(shift.startUtc).getTime()
    const end = new Date(shift.endUtc).getTime()
    const now = Date.now()
    const total = Math.max(1, end - start)
    const elapsed = Math.max(0, Math.min(total, now - start))
    return {
      pct: (elapsed / total) * 100,
      remainingSec: Math.max(0, (end - now) / 1000),
    }
  }, [shift])

  if (!plantId && !lineId) return null
  if (!shift || isFallbackShift(shift.shiftName) || !progress) return null

  const label = `${shift.shiftName} · ${formatDurationSeconds(progress.remainingSec)} left`

  return (
    <Tooltip label="Active shift for the selected plant/line scope" withArrow>
      <Group gap="xs" wrap="nowrap">
        <Badge variant="light" color="blue" size="lg" radius="sm">
          {label}
        </Badge>
        <Progress value={progress.pct} size="sm" radius="xl" w={100} aria-label="Shift progress" />
        <Text size="xs" c="dimmed" visibleFrom="md">
          {Math.round(progress.pct)}%
        </Text>
      </Group>
    </Tooltip>
  )
}
