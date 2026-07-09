import { Card, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import type { KpiSnapshot, ProductionPoint } from '../../lib/historian'
import { cycleSecToPph, idealCycleSourceLabel } from '../../lib/idealRate'
import { ProductionChart } from './ProductionChart'
import { ProductionPartsHero } from './ProductionPartsHero'
import { PartsLossWaterfall } from './PartsLossWaterfall'
import { MetricHero } from '../widgets/design/MetricHero'

interface Props {
  production: ProductionPoint[]
  snapshot: KpiSnapshot | null
  isMachine: boolean
  loading?: boolean
}

export function ProductionTab({ production, snapshot, isMachine, loading }: Props) {
  const oee = snapshot?.oee
  const actualRate = oee ? cycleSecToPph(oee.actualCycleTimeSec) : 0
  const idealRate = oee ? cycleSecToPph(oee.idealCycleTimeSec) : 0
  const rateVariance = idealRate > 0 ? ((actualRate - idealRate) / idealRate) * 100 : 0
  const idealSource = idealCycleSourceLabel(
    (snapshot as KpiSnapshot & { idealCycleSource?: string })?.idealCycleSource,
  )

  return (
    <Stack gap="md">
      <Paper withBorder p="md" radius="md">
        <ProductionPartsHero snapshot={snapshot} />
        {!snapshot?.partsLoss ? (
          <Text size="sm" c="dimmed" mt="sm">
            Configure ideal cycle / line speed in Recipes or Admin to enable parts-based loss metrics.
          </Text>
        ) : null}
      </Paper>

      {snapshot?.partsLoss ? (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Parts loss waterfall
          </Text>
          <PartsLossWaterfall snapshot={snapshot} />
        </Card>
      ) : null}

      {isMachine && oee ? (
        <Paper withBorder p="md" radius="md">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 6 }} spacing="md">
            <MetricHero
              label="Actual cycle"
              value={`${oee.actualCycleTimeSec.toFixed(2)}s`}
              unit={`${actualRate} pph`}
              helpId="actualCycleTimeSec"
            />
            <MetricHero
              label="Ideal cycle"
              value={`${oee.idealCycleTimeSec.toFixed(2)}s`}
              unit={idealSource ? `${idealRate} pph · ${idealSource}` : `${idealRate} pph`}
              helpId="idealCycleTimeSec"
            />
            <MetricHero label="Actual rate" value={`${actualRate}`} unit="pph" helpId="actualRatePph" />
            <MetricHero
              label="Ideal rate"
              value={`${idealRate}`}
              unit={idealSource || 'pph'}
              helpId="idealRatePph"
            />
            <MetricHero label="Rate variance" value={`${rateVariance.toFixed(1)}%`} helpId="rateVariancePct" />
            <MetricHero label="Scrap" value={`${oee.scrapPct.toFixed(1)}%`} helpId="scrapPct" />
            <MetricHero label="Yield" value={`${oee.yieldPct.toFixed(1)}%`} helpId="yieldPct" />
          </SimpleGrid>
        </Paper>
      ) : null}

      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="xs">
          Production volume
        </Text>
        {loading ? <Skeleton height={280} /> : <ProductionChart production={production} />}
      </Card>

      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="xs">
          Scrap % trend
        </Text>
        {loading ? <Skeleton height={280} /> : <ProductionChart production={production} showScrapTrend />}
      </Card>
    </Stack>
  )
}
