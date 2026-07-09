import { SimpleGrid, Stack, Text } from '@mantine/core'
import type { KpiSnapshot } from '../../lib/historian'
import type { ProductionPartsLoss } from '../../lib/partsLoss'
import { cycleSecToPph, idealCycleSourceLabel } from '../../lib/idealRate'
import { MetricHero } from '../widgets/design/MetricHero'

interface Props {
  snapshot: KpiSnapshot | null
  partsLoss?: ProductionPartsLoss | null
}

export function ProductionPartsHero({ snapshot, partsLoss }: Props) {
  const loss = partsLoss ?? snapshot?.partsLoss ?? null
  if (!loss || !snapshot) return null

  const idealRate = cycleSecToPph(snapshot.oee.idealCycleTimeSec)
  const source = idealCycleSourceLabel((snapshot as KpiSnapshot & { idealCycleSource?: string }).idealCycleSource)
  const rateNote = source ? `${idealRate.toLocaleString()} pph · ${source}` : `${idealRate.toLocaleString()} pph`

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        Parts at ideal rate ({rateNote})
      </Text>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 7 }} spacing="md">
        <MetricHero label="Max possible" value={loss.maxPossibleParts.toLocaleString()} helpId="maxPossibleParts" />
        <MetricHero
          label="Expected by now"
          value={loss.expectedPartsPace != null ? loss.expectedPartsPace.toLocaleString() : '—'}
          helpId="expectedPartsPace"
        />
        <MetricHero label="Actual good" value={snapshot.goodCount.toLocaleString()} helpId="goodCount" />
        <MetricHero label="Lost — downtime" value={loss.partsLostAvailability.toLocaleString()} helpId="partsLostAvailability" />
        <MetricHero label="Lost — slow run" value={loss.partsLostPerformance.toLocaleString()} helpId="partsLostPerformance" />
        <MetricHero label="Lost — rejects" value={loss.partsLostQuality.toLocaleString()} helpId="partsLostQuality" />
        <MetricHero
          label="Lost — breakdown"
          value={loss.partsLostBreakdown.toLocaleString()}
          helpId="partsLostBreakdown"
        />
      </SimpleGrid>
    </Stack>
  )
}
