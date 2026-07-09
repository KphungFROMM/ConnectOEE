import { useMemo } from 'react'
import { DonutChart } from '@mantine/charts'
import { Group, Stack, Text } from '@mantine/core'
import type { HistorianLossBucket } from '../../lib/historian'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { AnalyticsEmpty } from './AnalyticsEmpty'

const PALETTE: Record<string, string> = {
  Breakdown: 'red.6',
  SetupAndAdjustment: 'orange.5',
  SmallStop: 'yellow.5',
  ReducedSpeed: 'grape.5',
  StartupReject: 'cyan.5',
  ProductionReject: 'blue.5',
  Unattributed: 'gray.5',
}

function prettyCategory(c: string) {
  return c.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function LossesDonut({ losses }: { losses: HistorianLossBucket[] }) {
  const { segments, totalMin } = useMemo(() => {
    const segs = losses
      .filter((l) => l.totalSec > 0)
      .map((l) => ({
        name: prettyCategory(l.category),
        value: l.totalSec / 60,
        color: PALETTE[l.category] ?? 'gray.5',
      }))
    const total = segs.reduce((s, x) => s + x.value, 0)
    return { segments: segs, totalMin: total }
  }, [losses])

  if (segments.length === 0) return <AnalyticsEmpty message="No categorized losses in range." />

  return (
    <Group align="center" wrap="nowrap" gap="md" h={280}>
      <DonutChart data={segments} withLabelsLine size={140} thickness={22} strokeWidth={2} />
      <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
        {segments.slice(0, 6).map((s) => (
          <Group key={s.name} justify="space-between" gap={4}>
            <Text size="xs" truncate>
              {s.name}
            </Text>
            <Text size="xs" fw={700} c="dimmed">
              {formatDurationMinutes(s.value)}
            </Text>
          </Group>
        ))}
        <Text size="xs" c="dimmed" mt={4}>
          {formatDurationMinutes(totalMin)} total
        </Text>
      </Stack>
    </Group>
  )
}
