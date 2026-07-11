import { useEffect, useMemo, useState } from 'react'
import { Badge, Group, Progress, Stack, Text, Tooltip } from '@mantine/core'
import type { MachineSnapshot } from '../../lib/liveHub'
import { getCurrentShift, type ShiftInstance } from '../../lib/metrics'
import { formatDurationSeconds } from '../../lib/formatDuration'
import { WidgetSurface } from '../widgets/design/WidgetSurface'

const FALLBACK = 'all day'

function isFallback(name: string) {
  return name.trim().toLowerCase() === FALLBACK
}

function useShift(lineId?: string | null, plantId?: string | null) {
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

  return shift
}

function useShiftProgress(shift: ShiftInstance | null, snapshot?: MachineSnapshot) {
  const name = shift?.shiftName ?? snapshot?.shiftName ?? '—'
  const startUtc = shift?.startUtc ?? snapshot?.shiftStartUtc
  const endUtc = shift?.endUtc ?? snapshot?.shiftEndUtc
  const fallback = isFallback(name)

  return useMemo(() => {
    if (fallback || !startUtc || !endUtc) {
      return { name, fallback, progress: null as null | { pct: number; elapsedSec: number; remainingSec: number } }
    }
    const start = new Date(startUtc).getTime()
    const end = new Date(endUtc).getTime()
    const now = Date.now()
    const total = Math.max(1, end - start)
    const elapsed = Math.max(0, Math.min(total, now - start))
    return {
      name,
      fallback,
      startUtc,
      endUtc,
      progress: {
        pct: (elapsed / total) * 100,
        elapsedSec: elapsed / 1000,
        remainingSec: Math.max(0, (end - now) / 1000),
      },
    }
  }, [name, fallback, startUtc, endUtc])
}

/**
 * Shared shift atom for Explorer — full panel in the command bar, compact chip on plant tiles.
 * Gate is (lineId || plantId) only — never requires live PLC.
 */
export function ExplorerShiftPanel({
  lineId,
  plantId,
  snapshot,
  variant = 'full',
}: {
  lineId?: string | null
  plantId?: string | null
  snapshot?: MachineSnapshot
  variant?: 'full' | 'compact'
}) {
  const shift = useShift(lineId, plantId)
  const meta = useShiftProgress(shift, snapshot)

  if (!lineId && !plantId) return null

  if (variant === 'compact') {
    if (meta.fallback || !meta.progress) return null
    const label = `${meta.name} · ${formatDurationSeconds(meta.progress.remainingSec)} left`
    return (
      <Tooltip label="Current shift" withArrow>
        <Badge variant="light" color="blue" size="sm" maw={170} style={{ overflow: 'hidden' }}>
          <Text size="xs" truncate>
            {label}
          </Text>
        </Badge>
      </Tooltip>
    )
  }

  return (
    <WidgetSurface tone="info" padding="sm" radius="md" withBorder={false} style={{ background: 'transparent' }}>
      <Group justify="space-between" mb={6} wrap="wrap" gap="xs">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Current shift
          </Text>
          <Text fw={700} size="sm">
            {meta.fallback ? 'No shift assigned' : meta.name}
          </Text>
        </div>
        {!meta.fallback && meta.startUtc && meta.endUtc ? (
          <Text size="xs" c="dimmed">
            {new Date(meta.startUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {new Date(meta.endUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </Group>
      {meta.progress && !meta.fallback ? (
        <Stack gap={4}>
          <Progress value={meta.progress.pct} size="sm" radius="xl" color="blue" />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {formatDurationSeconds(meta.progress.elapsedSec)} elapsed
            </Text>
            <Text size="xs" c="dimmed">
              {formatDurationSeconds(meta.progress.remainingSec)} remaining
            </Text>
          </Group>
        </Stack>
      ) : null}
    </WidgetSurface>
  )
}
