import { Badge, Card, Group, RingProgress, Stack, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../lib/liveHub'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { oeeColor, stateColor, fmtNumber } from './common'
import { RingGaugeLabel } from './charts/RingGaugeLabel'

export function MachineGridCard({
  snapshot,
  lineName,
  compact = false,
}: {
  snapshot: MachineSnapshot
  lineName?: string
  compact?: boolean
}) {
  const color = stateColor(snapshot.state)
  const oee = snapshot.oeePct ?? 0

  if (compact) {
    return (
      <Card withBorder padding="sm" radius="md" style={{ borderLeft: `4px solid ${color}` }}>
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm" truncate>
            {snapshot.machineName}
          </Text>
          <Badge size="xs" variant="light" style={{ backgroundColor: `${color}22`, color }}>
            {snapshot.state}
          </Badge>
        </Group>
        <Group justify="space-between" mt={6}>
          <Text size="lg" fw={800} c={oeeColor()}>
            {oee.toFixed(0)}%
          </Text>
          <Text size="xs" c="dimmed">
            Good {fmtNumber(snapshot.goodCount)}
          </Text>
        </Group>
      </Card>
    )
  }
  return (
    <Card withBorder padding="md" radius="md" style={{ borderLeft: `4px solid ${color}`, minHeight: 120 }}>
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: color,
              flexShrink: 0,
            }}
          />
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            {lineName ? (
              <Text size="xs" c="dimmed" fw={600} truncate>
                {lineName}
              </Text>
            ) : null}
            <Text fw={600} size="sm" truncate>
              {snapshot.machineName}
            </Text>
          </Stack>
        </Group>
        <Badge size="xs" variant="light" style={{ backgroundColor: `${color}22`, color, flexShrink: 0 }}>
          {snapshot.state}
        </Badge>
      </Group>
      <Group align="center" gap="sm" wrap="nowrap">
        <RingProgress
          size={52}
          thickness={6}
          roundCaps
          sections={[{ value: Math.min(100, oee), color: oeeColor() }]}
          label={
            <RingGaugeLabel size="xs" color={oeeColor()}>
              {oee.toFixed(0)}
            </RingGaugeLabel>
          }
        />
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group gap={4}>
            <Badge size="xs" variant="light" color="green">
              A {snapshot.availabilityPct?.toFixed(0) ?? '—'}%
            </Badge>
            <Badge size="xs" variant="light" color="blue">
              P {snapshot.performancePct?.toFixed(0) ?? '—'}%
            </Badge>
            <Badge size="xs" variant="light" color="grape">
              Q {snapshot.qualityPct?.toFixed(0) ?? '—'}%
            </Badge>
          </Group>
          <Group gap="md" mt={4}>
            <Text size="xs">Good {fmtNumber(snapshot.goodCount)}</Text>
            <Text size="xs" c="red">
              Rej {fmtNumber(snapshot.rejectCount)}
            </Text>
          </Group>
          <Group gap={4}>
            <Badge size="xs" variant="light" color="teal">
              Up {formatDurationMinutes(snapshot.uptimeMin ?? 0)}
            </Badge>
            <Badge size="xs" variant="light" color="orange">
              Down {formatDurationMinutes(snapshot.downtimeMin ?? 0)}
            </Badge>
          </Group>
          {snapshot.faultCode || snapshot.downtimeReasonText ? (
            <Badge size="xs" color="red" variant="light" w="fit-content">
              {snapshot.downtimeReasonText ?? `Code ${snapshot.faultCode}`}
            </Badge>
          ) : null}
        </Stack>
      </Group>
    </Card>
  )
}
