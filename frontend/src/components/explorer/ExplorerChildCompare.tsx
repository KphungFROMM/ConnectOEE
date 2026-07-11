import { useMemo } from 'react'
import { Box, SimpleGrid, Stack, Text } from '@mantine/core'
import type { DrillNode, EntityLevel, KpiSnapshot } from '../../lib/historian'
import { DrillDownTable } from '../analytics/DrillDownTable'
import { AnalyticsEmpty } from '../analytics/AnalyticsEmpty'
import { OeeWaterfall } from '../analytics/OeeWaterfall'
import { LeaderboardBars } from '../widgets/charts/LeaderboardBars'
import { WidgetFrame } from '../widgets/common'

interface Props {
  parentLevel: EntityLevel
  children: DrillNode[]
  initialLoading?: boolean
  snapshot?: KpiSnapshot | null
  /** Compact leaderboard only (no waterfall) — used when KPI hero already shows losses. */
  compact?: boolean
  onSelect: (node: DrillNode) => void
}

export function ExplorerChildCompare({ parentLevel, children, initialLoading, snapshot, compact, onSelect }: Props) {
  const barItems = useMemo(() => {
    const sorted = [...children].sort((a, b) => a.oee.oeePct - b.oee.oeePct)
    return sorted.map((c) => ({
      name: c.name,
      value: c.oee.oeePct,
      sublabel: `${c.oee.availabilityPct.toFixed(0)}/${c.oee.performancePct.toFixed(0)}/${c.oee.qualityPct.toFixed(0)}`,
    }))
  }, [children])

  if (parentLevel === 'Machine') return null

  const leaderboard = (
    <WidgetFrame title={compact ? 'Child OEE leaderboard' : 'OEE comparison'}>
      {initialLoading && barItems.length === 0 ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : barItems.length === 0 ? (
        <AnalyticsEmpty message="No child data in range." />
      ) : (
        <Box h={Math.max(compact ? 160 : 200, barItems.length * (compact ? 32 : 40))}>
          <LeaderboardBars items={barItems} maxValue={100} />
        </Box>
      )}
    </WidgetFrame>
  )

  if (compact) {
    return (
      <Stack gap="sm">
        <Text fw={700} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.03em' }}>
          Compare
        </Text>
        {leaderboard}
        <DrillDownTable
          parentLevel={parentLevel}
          children={children}
          loading={Boolean(initialLoading && children.length === 0)}
          onSelect={onSelect}
        />
      </Stack>
    )
  }

  return (
    <Stack gap="md">
      <Text fw={700} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.03em' }}>
        Compare
      </Text>
      {snapshot ? (
        <WidgetFrame title="OEE loss waterfall">
          <OeeWaterfall snapshot={snapshot} mode="minutes" />
        </WidgetFrame>
      ) : null}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        {leaderboard}
        <DrillDownTable
          parentLevel={parentLevel}
          children={children}
          loading={Boolean(initialLoading && children.length === 0)}
          onSelect={onSelect}
        />
      </SimpleGrid>
    </Stack>
  )
}
