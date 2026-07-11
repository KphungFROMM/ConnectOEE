import { Badge, Card, Group, RingProgress, Stack, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../lib/liveHub'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { oeeExplorerHexColor, statusSurfaceTone, stateColor, fmtNumber } from './common'
import { toneSurfaceStyle } from './design/widgetTheme'
import { RingGaugeLabel } from './charts/RingGaugeLabel'

export type MachineCardStyle = 'default' | 'performance'

export function MachineGridCard({
  snapshot,
  lineName,
  compact = false,
  interactive = true,
  cardStyle = 'default',
}: {
  snapshot: MachineSnapshot
  lineName?: string
  compact?: boolean
  /** Set false when the card isn't wrapped in a click handler (e.g. static preview). */
  interactive?: boolean
  /** performance = MachineMetrics-style band + OEE + duration + job */
  cardStyle?: MachineCardStyle
}) {
  const color = stateColor(snapshot.state)
  const oee = snapshot.oeePct ?? 0
  const oeeHex = oeeExplorerHexColor(oee, snapshot.connectionState) ?? color
  const tone = statusSurfaceTone(snapshot.state, snapshot.connectionState)
  const toneStyle = toneSurfaceStyle(tone)
  const hoverClass = interactive ? 'hoverLift' : undefined
  const job =
    snapshot.activeRecipeName || snapshot.activeRecipeCode || snapshot.downtimeReasonText || null
  const statusDuration =
    snapshot.state === 'Running' || snapshot.state === 'Idle'
      ? formatDurationMinutes(snapshot.uptimeMin ?? 0)
      : formatDurationMinutes(snapshot.downtimeMin ?? 0)

  if (cardStyle === 'performance') {
    return (
      <Card
        withBorder
        padding="sm"
        radius="md"
        className={hoverClass}
        style={{
          ...toneStyle,
          borderTop: `5px solid ${color}`,
          minHeight: compact ? 88 : 110,
        }}
      >
        <Group justify="space-between" wrap="nowrap" mb={4}>
          <Text fw={700} size="sm" truncate>
            {snapshot.machineName}
          </Text>
          <Badge size="xs" variant="filled" style={{ backgroundColor: color }}>
            {snapshot.state}
          </Badge>
        </Group>
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Text size={compact ? 'xl' : '1.75rem'} fw={800} lh={1} c={oeeHex}>
            {oee.toFixed(0)}%
          </Text>
          <Stack gap={0} align="flex-end">
            <Text size="xs" c="dimmed">
              {statusDuration}
            </Text>
            {job ? (
              <Text size="xs" fw={600} truncate maw={120}>
                {job}
              </Text>
            ) : null}
          </Stack>
        </Group>
      </Card>
    )
  }

  if (compact) {
    return (
      <Card
        withBorder
        padding="sm"
        radius="md"
        className={hoverClass}
        style={{ ...toneStyle, borderLeft: `4px solid ${color}` }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Text fw={600} size="sm" truncate>
            {snapshot.machineName}
          </Text>
          <Badge size="xs" variant="light" style={{ backgroundColor: `${color}22`, color }}>
            {snapshot.state}
          </Badge>
        </Group>
        <Group justify="space-between" mt={6}>
          <Text size="lg" fw={800} c={oeeHex}>
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
    <Card
      withBorder
      padding="md"
      radius="md"
      className={hoverClass}
      style={{ ...toneStyle, borderLeft: `4px solid ${color}`, minHeight: 120 }}
    >
      <Group justify="space-between" mb={4} wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: color,
              boxShadow: `0 0 6px ${color}`,
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
          rootColor="var(--mantine-color-default-border)"
          sections={[{ value: Math.min(100, oee), color: oeeHex }]}
          label={
            <RingGaugeLabel size="xs" color={oeeHex}>
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
