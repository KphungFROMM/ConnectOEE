import { useMemo, useState } from 'react'
import { Box, Card, Group, SegmentedControl, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import type {
  DrillNode,
  EntityLevel,
  HistorianLossBucket,
  KpiSnapshot,
  ProductionPoint,
  TrendPoint,
  TrendResult,
} from '../../lib/historian'
import { OeeTrendChart, type OeeTrendMode } from './OeeTrendChart'
import { ProductionChart } from './ProductionChart'
import { OeeWaterfall } from './OeeWaterfall'
import { PartsLossWaterfall } from './PartsLossWaterfall'
import { LossesDonut } from './LossesDonut'
import { DrillDownTable } from './DrillDownTable'
import { AnalyticsEmpty } from './AnalyticsEmpty'
import { LeaderboardBars } from '../widgets/charts/LeaderboardBars'

interface Props {
  snapshot: KpiSnapshot | null
  trend: TrendResult | null
  priorTrend?: TrendResult | null
  production: ProductionPoint[]
  losses: HistorianLossBucket[]
  children: DrillNode[]
  parentLevel: EntityLevel
  compare?: boolean
  initialLoading?: boolean
  loading?: { trend?: boolean; production?: boolean; drilldown?: boolean }
  onSelectChild: (node: DrillNode) => void
  onBucketZoom?: (point: TrendPoint) => void
}

export function OverviewTab({
  snapshot,
  trend,
  priorTrend,
  production,
  losses,
  children,
  parentLevel,
  compare,
  initialLoading,
  loading,
  onSelectChild,
  onBucketZoom,
}: Props) {
  const [chartMode, setChartMode] = useState<OeeTrendMode>('factors')
  const [waterfallMode, setWaterfallMode] = useState<'oee' | 'parts'>('oee')

  const barItems = useMemo(() => {
    const sorted = [...children].sort((a, b) => a.oee.oeePct - b.oee.oeePct)
    return sorted.map((c) => ({
      name: c.name,
      value: c.oee.oeePct,
      sublabel: `${c.oee.availabilityPct.toFixed(0)}/${c.oee.performancePct.toFixed(0)}/${c.oee.qualityPct.toFixed(0)}`,
    }))
  }, [children])

  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card withBorder radius="md" padding="md">
          <Group justify="space-between" mb="xs" wrap="wrap">
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
              {trend ? (
                <Text size="xs" c="dimmed">
                  Select bucket below chart to zoom
                </Text>
              ) : null}
            </Group>
          </Group>
          {loading?.trend && !trend ? (
            <Skeleton height={280} />
          ) : (
            <>
              <OeeTrendChart trend={trend} priorTrend={priorTrend} compare={compare} mode={chartMode} />
              {onBucketZoom && trend && trend.points.length > 0 ? (
                <Group gap={6} mt="xs" wrap="wrap">
                  {trend.points.map((p) => (
                    <Text
                      key={p.bucketUtc}
                      size="xs"
                      c="blue"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onBucketZoom(p)}
                    >
                      {p.label}
                    </Text>
                  ))}
                </Group>
              ) : null}
            </>
          )}
        </Card>
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Production vs target
          </Text>
          {loading?.production && production.length === 0 ? (
            <Skeleton height={280} />
          ) : (
            <ProductionChart production={production} />
          )}
        </Card>
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <Card withBorder radius="md" padding="md">
          <Group justify="space-between" mb="xs" wrap="wrap">
            <Text fw={600}>{waterfallMode === 'parts' ? 'Parts loss waterfall' : 'OEE loss waterfall'}</Text>
            <SegmentedControl
              size="xs"
              value={waterfallMode}
              onChange={(v) => setWaterfallMode(v as 'oee' | 'parts')}
              data={[
                { label: 'OEE %', value: 'oee' },
                { label: 'Parts', value: 'parts' },
              ]}
            />
          </Group>
          {waterfallMode === 'parts' ? (
            <PartsLossWaterfall snapshot={snapshot} />
          ) : (
            <OeeWaterfall snapshot={snapshot} mode={parentLevel !== 'Machine' ? 'minutes' : 'percent'} />
          )}
        </Card>
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Six Big Losses
          </Text>
          <LossesDonut losses={losses} />
        </Card>
      </SimpleGrid>

      {parentLevel !== 'Machine' ? (
        <Stack gap="md">
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
              onSelect={onSelectChild}
            />
          </SimpleGrid>
        </Stack>
      ) : null}
    </Stack>
  )
}
