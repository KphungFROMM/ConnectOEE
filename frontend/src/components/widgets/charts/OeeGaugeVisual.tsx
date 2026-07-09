import { Group, Stack, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../../lib/liveHub'
import { GaugeRing } from '../design/GaugeRing'
import { factorColorByLabel } from '../common'

function FactorChip({ label, value }: { label: 'A' | 'P' | 'Q'; value: number }) {
  const color = factorColorByLabel(label)
  return (
    <Stack gap={0} align="center" style={{ minWidth: 52 }}>
      <Text size="10px" c="dimmed" fw={700} tt="uppercase">
        {label}
      </Text>
      <Text size="sm" fw={800} c={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value.toFixed(0)}%
      </Text>
    </Stack>
  )
}

export function OeeGaugeVisual({
  snapshot,
  size = 160,
  showBreakdown = true,
  wallBoard = false,
}: {
  snapshot?: MachineSnapshot
  size?: number
  showBreakdown?: boolean
  wallBoard?: boolean
}) {
  const oee = snapshot?.oeePct ?? 0
  const showTarget = !wallBoard
  const showApq = showBreakdown && !wallBoard

  return (
    <Stack align="center" justify="center" h="100%" gap={wallBoard ? 'xs' : 'sm'}>
      <GaugeRing
        value={oee}
        size={size}
        thickness={wallBoard ? Math.round(size * 0.1) : 16}
        sublabel={showTarget ? 'target 85%' : undefined}
        label="OEE"
      />
      {showApq && snapshot ? (
        <Group gap="md" justify="center" wrap="nowrap">
          <FactorChip label="A" value={snapshot.availabilityPct ?? 0} />
          <FactorChip label="P" value={snapshot.performancePct ?? 0} />
          <FactorChip label="Q" value={snapshot.qualityPct ?? 0} />
        </Group>
      ) : null}
    </Stack>
  )
}
