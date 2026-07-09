import { useMemo } from 'react'
import { Box, Card, SimpleGrid, Stack, Text } from '@mantine/core'
import type { DrillNode, EntityLevel, KpiSnapshot } from '../../lib/historian'
import { DrillDownTable } from '../analytics/DrillDownTable'
import { AnalyticsEmpty } from '../analytics/AnalyticsEmpty'
import { OeeWaterfall } from '../analytics/OeeWaterfall'
import { LeaderboardBars } from '../widgets/charts/LeaderboardBars'

interface Props {
  parentLevel: EntityLevel
  children: DrillNode[]
  initialLoading?: boolean
  snapshot?: KpiSnapshot | null
  onSelect: (node: DrillNode) => void
}

export function ExplorerChildCompare({ parentLevel, children, initialLoading, snapshot, onSelect }: Props) {
  const barItems = useMemo(() => {
    const sorted = [...children].sort((a, b) => a.oee.oeePct - b.oee.oeePct)
    return sorted.map((c) => ({
      name: c.name,
      value: c.oee.oeePct,
      sublabel: `${c.oee.availabilityPct.toFixed(0)}/${c.oee.performancePct.toFixed(0)}/${c.oee.qualityPct.toFixed(0)}`,
    }))
  }, [children])

  if (parentLevel === 'Machine') return null

  return (
    <Stack gap="md">
      {snapshot ? (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="sm">
            OEE loss waterfall
          </Text>
          <OeeWaterfall snapshot={snapshot} mode="minutes" />
        </Card>
      ) : null}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="sm">
          OEE comparison
        </Text>
        {initialLoading && barItems.length === 0 ? (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        ) : barItems.length === 0 ? (
          <AnalyticsEmpty message="No child data in range." />
        ) : (
          <Box h={Math.max(200, barItems.length * 40)}>
            <LeaderboardBars items={barItems} maxValue={100} />
          </Box>
        )}
      </Card>
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
