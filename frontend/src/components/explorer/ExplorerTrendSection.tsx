import { useState } from 'react'
import { Card, Group, SegmentedControl, Skeleton, Text } from '@mantine/core'
import { OeeTrendChart, type OeeTrendMode } from '../analytics/OeeTrendChart'
import type { TrendResult } from '../../lib/historian'
import type { ExplorerRange } from './explorerTypes'

interface Props {
  trend: TrendResult | null
  initialLoading?: boolean
  range: ExplorerRange
  onRangeChange: (r: ExplorerRange) => void
}

export function ExplorerTrendSection({ trend, initialLoading, range, onRangeChange }: Props) {
  const [chartMode, setChartMode] = useState<OeeTrendMode>('factors')

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Text fw={600}>{chartMode === 'timeBalance' ? 'Time balance trend' : 'OEE trend'}</Text>
        <Group gap="xs" wrap="wrap">
          <SegmentedControl
            size="xs"
            value={chartMode}
            onChange={(v) => setChartMode(v as OeeTrendMode)}
            data={[
              { label: 'OEE factors', value: 'factors' },
              { label: 'Time balance', value: 'timeBalance' },
            ]}
          />
          <SegmentedControl
            size="xs"
            value={range}
            onChange={(v) => onRangeChange(v as ExplorerRange)}
            data={[
              { label: 'Current shift', value: 'shift' },
              { label: 'Last 8h', value: '8h' },
            ]}
          />
        </Group>
      </Group>
      {initialLoading && !trend ? (
        <Skeleton height={280} radius="md" />
      ) : (
        <OeeTrendChart trend={trend} mode={chartMode} />
      )}
    </Card>
  )
}
