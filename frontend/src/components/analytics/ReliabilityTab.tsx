import { Card, Paper, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import type { ReliabilityTrendResult } from '../../lib/historian'
import type { Reliability } from '../../lib/metrics'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { ReliabilityTrendChart } from './ReliabilityTrendChart'
import { MetricHero } from '../widgets/design/MetricHero'

interface Props {
  reliability: Reliability | null
  reliabilityTrend: ReliabilityTrendResult | null
  loading?: boolean
}

export function ReliabilityTab({ reliability, reliabilityTrend, loading }: Props) {
  return (
    <Stack gap="md">
      {reliability ? (
        <Paper withBorder p="md" radius="md">
          <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md">
            <MetricHero label="MTTR" value={`${reliability.mttrMin.toFixed(1)}`} unit="min" helpId="mttrMin" />
            <MetricHero label="MTBF" value={formatDurationMinutes(reliability.mtbfMin)} helpId="mtbfMin" />
            <MetricHero label="MTTF" value={formatDurationMinutes(reliability.mttfMin)} helpId="mttfMin" />
            <MetricHero label="MTTD" value={formatDurationMinutes(reliability.mttdMin)} helpId="mttdMin" />
            <MetricHero label="Stops/hr" value={reliability.stopsPerHour.toFixed(2)} helpId="stopsPerHour" />
            <MetricHero
              label="Mean lost/stop"
              value={formatDurationMinutes(reliability.meanLostTimePerDowntimeMin)}
              helpId="meanLostTimePerDowntimeMin"
            />
            <MetricHero label="Failure rate" value={`${reliability.failureRatePerHour.toFixed(2)}/hr`} helpId="failureRatePerHour" />
            <MetricHero
              label="Planned"
              value={formatDurationMinutes(reliability.plannedDowntimeMin)}
              color="var(--mantine-color-blue-6)"
              helpId="plannedDowntimeMin"
            />
            <MetricHero
              label="Unplanned"
              value={formatDurationMinutes(reliability.unplannedDowntimeMin)}
              color="var(--mantine-color-orange-6)"
              helpId="unplannedDowntimeMin"
            />
            <MetricHero
              label="Avail (rel)"
              value={`${reliability.availabilityFromReliabilityPct.toFixed(1)}%`}
              helpId="availabilityFromReliabilityPct"
            />
          </SimpleGrid>
        </Paper>
      ) : null}

      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="xs">
          Reliability trend
        </Text>
        {loading ? <Skeleton height={280} /> : <ReliabilityTrendChart trend={reliabilityTrend} />}
      </Card>
    </Stack>
  )
}
