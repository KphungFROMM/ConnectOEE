import { DonutChart } from '@mantine/charts'
import { Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { MetricLabel } from '../help/HelpTrigger'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { AnalyticsEmpty } from './AnalyticsEmpty'

export interface TimeBalanceData {
  uptimeMin: number
  downtimeMin: number
  plannedMin?: number
  unplannedMin?: number
}

interface Props {
  data: TimeBalanceData | null
  size?: number
  /** Stack donut above legend — avoids overlap in narrow panels */
  stacked?: boolean
}

export function TimeBalanceChart({ data, size = 130, stacked = false }: Props) {
  if (!data) return <AnalyticsEmpty message="No time balance data yet." />

  const planned = data.plannedMin ?? 0
  const unplanned = data.unplannedMin ?? 0
  // Downtime already includes planned + unplanned — show mutually exclusive segments only.
  const segments = [
    { name: 'Uptime', value: Math.round(data.uptimeMin), color: 'teal.6' },
    ...(planned > 0 ? [{ name: 'Planned', value: Math.round(planned), color: 'blue.5' as const }] : []),
    ...(unplanned > 0 ? [{ name: 'Unplanned', value: Math.round(unplanned), color: 'red.5' as const }] : []),
    ...(planned <= 0 && unplanned <= 0 && data.downtimeMin > 0
      ? [{ name: 'Downtime', value: Math.round(data.downtimeMin), color: 'orange.6' as const }]
      : []),
  ].filter((x) => x.value > 0)

  if (segments.length === 0) return <AnalyticsEmpty message="No time balance data yet." />

  const trackedMin = data.uptimeMin + data.downtimeMin
  const uptimePct = trackedMin > 0 ? Math.round((data.uptimeMin / trackedMin) * 100) : 0
  const chartSize = stacked ? Math.min(size, 88) : size

  const legend = (
    <SimpleGrid cols={stacked ? 2 : 2} spacing="xs" w="100%">
      {segments.map((seg) => {
        const helpId =
          seg.name === 'Uptime'
            ? 'uptimeMin'
            : seg.name === 'Downtime'
              ? 'downtimeMin'
              : seg.name === 'Planned'
                ? 'plannedDowntimeMin'
                : seg.name === 'Unplanned'
                  ? 'unplannedDowntimeMin'
                  : undefined
        return (
          <div key={seg.name}>
            <MetricLabel label={seg.name} helpId={helpId} />
            <Text size="sm" fw={700}>
              {formatDurationMinutes(seg.value)}
            </Text>
          </div>
        )
      })}
    </SimpleGrid>
  )

  if (stacked) {
    return (
      <Stack gap="xs" align="stretch" h="100%">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
          Time balance
        </Text>
        <Stack gap="md" align="center" style={{ flex: 1 }}>
          <DonutChart data={segments} size={chartSize} thickness={14} withTooltip />
          {legend}
          <Text size="xs" c="dimmed" ta="center">
            {uptimePct}% uptime of tracked time
          </Text>
        </Stack>
      </Stack>
    )
  }

  return (
    <Stack gap="xs">
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        Time balance
      </Text>
      <Group align="flex-start" wrap="nowrap" gap="lg">
        <DonutChart data={segments} size={chartSize} thickness={22} withTooltip />
        <Stack gap="xs" style={{ flex: 1, minWidth: 0 }}>
          {legend}
          <Text size="xs" c="dimmed">
            {uptimePct}% uptime of tracked time
          </Text>
        </Stack>
      </Group>
    </Stack>
  )
}
