import { Card, Group, Text, Badge, SimpleGrid, Stack, RingProgress, Divider } from '@mantine/core'
import { statusColors } from '../theme/tokens'
import type { MachineSnapshot } from '../lib/liveHub'
import { factorColorByLabel, oeeColor, formatDurationMinutes } from './widgets/common'
import { RingGaugeLabel } from './widgets/charts/RingGaugeLabel'
import { HelpTrigger, MetricLabel } from './help/HelpTrigger'

function Metric({ label, value, helpId }: { label: string; value: string | number; helpId?: string }) {
  return (
    <Stack gap={0}>
      <MetricLabel label={label} helpId={helpId} />
      <Text size="xl" fw={700}>
        {value}
      </Text>
    </Stack>
  )
}

function stateColor(state: string): string {
  switch (state) {
    case 'Running':
      return statusColors.running
    case 'Idle':
    case 'Starved':
    case 'Blocked':
      return statusColors.idle
    case 'Down':
    case 'Setup':
      return statusColors.fault
    case 'PlannedDown':
      return statusColors.idle
    default:
      return statusColors.warning
  }
}

const FACTOR_HELP: Record<'A' | 'P' | 'Q', string> = {
  A: 'availabilityPct',
  P: 'performancePct',
  Q: 'qualityPct',
}

function FactorBar({ label, value }: { label: 'A' | 'P' | 'Q'; value: number }) {
  const color = factorColorByLabel(label)
  return (
    <Stack gap={2} align="center">
      <Group gap={2} wrap="nowrap" justify="center">
        <Text size="xs" c="dimmed" fw={700}>
          {label}
        </Text>
        <HelpTrigger helpId={FACTOR_HELP[label]} size="xs" />
      </Group>
      <Text size="sm" fw={700} c={color}>
        {value.toFixed(0)}%
      </Text>
    </Stack>
  )
}

export function MachineTile({ snapshot }: { snapshot: MachineSnapshot }) {
  const color = stateColor(snapshot.state)
  const oee = snapshot.oeePct ?? 0
  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="sm">
        <Group gap={8}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: color,
              boxShadow: `0 0 0 4px ${color}22`,
            }}
          />
          <Text fw={600}>{snapshot.machineName}</Text>
        </Group>
        <Badge color="gray" variant="light" style={{ backgroundColor: `${color}22`, color }}>
          {snapshot.state}
        </Badge>
      </Group>

      <Group align="center" gap="lg" wrap="nowrap">
        <Stack align="center" gap={4}>
          <RingProgress
            size={108}
            thickness={11}
            roundCaps
            sections={[{ value: Math.min(100, oee), color: oeeColor() }]}
            label={
              <RingGaugeLabel size="lg" color={oeeColor()} sublabel="OEE">
                {oee.toFixed(0)}%
              </RingGaugeLabel>
            }
          />
          <HelpTrigger helpId="oeePct" size="xs" />
        </Stack>
        <SimpleGrid cols={3} style={{ flex: 1 }} spacing="xs">
          <FactorBar label="A" value={snapshot.availabilityPct ?? 0} />
          <FactorBar label="P" value={snapshot.performancePct ?? 0} />
          <FactorBar label="Q" value={snapshot.qualityPct ?? 0} />
        </SimpleGrid>
      </Group>

      <Divider my="sm" />

      <SimpleGrid cols={3}>
        <Metric label="Good" value={snapshot.goodCount.toLocaleString()} helpId="goodCount" />
        <Metric label="Reject" value={snapshot.rejectCount.toLocaleString()} helpId="rejectCount" />
        <Metric label="Rate" value={`${Math.round(snapshot.actualRatePph)}`} helpId="actualRatePph" />
      </SimpleGrid>

      <Group justify="space-between" mt="sm">
        <Badge variant="light" color="blue">
          {snapshot.shiftName || 'Shift'}
        </Badge>
        <Group gap="xs">
          {snapshot.downtimeCount > 0 ? (
            <Text size="xs" c="dimmed">
              {snapshot.downtimeCount} stops · MTTR {formatDurationMinutes(snapshot.mttrMin ?? 0)}
            </Text>
          ) : null}
          {snapshot.faultCode || snapshot.downtimeReasonText ? (
            <Badge color="red" variant="light">
              {snapshot.downtimeReasonText ?? `Code ${snapshot.faultCode}`}
            </Badge>
          ) : null}
        </Group>
      </Group>
    </Card>
  )
}
