import { useMemo, useState } from 'react'
import { AreaChart, LineChart } from '@mantine/charts'
import { Group, SegmentedControl, Stack, Text } from '@mantine/core'
import type { ReliabilityTrendResult } from '../../lib/historian'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { AnalyticsEmpty } from './AnalyticsEmpty'
import { MetricHero } from '../widgets/design/MetricHero'

export type ReliabilityTrendMode = 'reliability' | 'timeBalance'

interface LiveFallback {
  uptimeMin: number
  downtimeMin: number
  mttrMin?: number
  mtbfMin?: number
  stopsPerHour?: number
}

interface Props {
  trend: ReliabilityTrendResult | null
  mode?: ReliabilityTrendMode
  onModeChange?: (mode: ReliabilityTrendMode) => void
  liveFallback?: LiveFallback | null
}

export function ReliabilityTrendChart({ trend, mode: controlledMode, onModeChange, liveFallback }: Props) {
  const [internalMode, setInternalMode] = useState<ReliabilityTrendMode>('reliability')
  const mode = controlledMode ?? internalMode
  const setMode = onModeChange ?? setInternalMode

  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        label: p.label,
        MTTR: p.mttrMin,
        MTBF: p.mtbfMin,
        Stops: p.stopsPerHour,
        Uptime: p.uptimeMin,
        Downtime: p.downtimeMin,
      })),
    [trend],
  )

  const hasTrend = chartData.length >= 2

  if (!hasTrend && liveFallback) {
    return (
      <Stack gap="sm">
        <Text size="sm" c="dimmed">
          Shift-to-date live reliability (trend history still building)
        </Text>
        <Group grow>
          <MetricHero label="Uptime" value={formatDurationMinutes(liveFallback.uptimeMin)} helpId="uptimeMin" />
          <MetricHero label="Downtime" value={formatDurationMinutes(liveFallback.downtimeMin)} helpId="downtimeMin" />
          {liveFallback.mttrMin != null ? (
            <MetricHero label="MTTR" value={formatDurationMinutes(liveFallback.mttrMin)} helpId="mttrMin" />
          ) : null}
          {liveFallback.mtbfMin != null ? (
            <MetricHero label="MTBF" value={formatDurationMinutes(liveFallback.mtbfMin)} helpId="mtbfMin" />
          ) : null}
        </Group>
      </Stack>
    )
  }

  if (!hasTrend) return <AnalyticsEmpty message="Reliability trend needs more history." />

  return (
    <Stack gap="sm">
      <Group justify="flex-end">
        <SegmentedControl
          size="xs"
          value={mode}
          onChange={(v) => setMode(v as ReliabilityTrendMode)}
          data={[
            { label: 'Reliability', value: 'reliability' },
            { label: 'Uptime / Downtime', value: 'timeBalance' },
          ]}
        />
      </Group>
      {mode === 'timeBalance' ? (
        <AreaChart
          h={280}
          data={chartData}
          dataKey="label"
          series={[
            { name: 'Uptime', color: 'teal.6' },
            { name: 'Downtime', color: 'orange.6' },
          ]}
          type="stacked"
          valueFormatter={(v) => `${v.toFixed(0)}m`}
          withLegend
          curveType="monotone"
        />
      ) : (
        <LineChart
          h={280}
          data={chartData}
          dataKey="label"
          series={[
            { name: 'MTTR', color: 'orange.6' },
            { name: 'MTBF', color: 'teal.6' },
            { name: 'Stops', color: 'blue.6' },
          ]}
          curveType="monotone"
          withLegend
          gridAxis="xy"
        />
      )}
    </Stack>
  )
}
