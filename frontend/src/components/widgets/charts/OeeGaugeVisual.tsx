import { Group, Stack, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../../lib/liveHub'
import { GaugeRing } from '../design/GaugeRing'
import { factorColorByLabel, oeeColor, factorColor } from '../common'
import { getFactorColors } from '../../../theme/factorColorsRuntime'

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

export function gaugeLabelForField(field?: string | null): string {
  switch (field) {
    case 'availabilityPct':
      return 'Availability'
    case 'performancePct':
      return 'Performance'
    case 'qualityPct':
      return 'Quality'
    case 'teepPct':
      return 'TEEP'
    case 'scrapPct':
      return 'Scrap'
    case 'yieldPct':
      return 'Yield'
    case 'fpyPct':
      return 'FPY'
    case 'uptimePct':
      return 'Uptime'
    case 'utilizationPct':
      return 'Utilization'
    case 'oeePct':
    default:
      return 'OEE'
  }
}

export function gaugeColorForField(field?: string | null): string {
  switch (field) {
    case 'availabilityPct':
      return factorColor('availabilityPct')
    case 'performancePct':
      return factorColor('performancePct')
    case 'qualityPct':
      return factorColor('qualityPct')
    case 'oeePct':
    case undefined:
    case null:
    case '':
      return oeeColor()
    default:
      return getFactorColors().oee.hex
  }
}

export function OeeGaugeVisual({
  snapshot,
  size = 160,
  showBreakdown = true,
  wallBoard = false,
  field = 'oeePct',
  value: valueOverride,
  label: labelOverride,
  ringColor: ringColorOverride,
}: {
  snapshot?: MachineSnapshot
  size?: number
  showBreakdown?: boolean
  wallBoard?: boolean
  /** Snapshot percent field — defaults to OEE. */
  field?: string
  value?: number
  label?: string
  ringColor?: string
}) {
  const resolvedField = field || 'oeePct'
  const value =
    valueOverride ??
    (() => {
      if (!snapshot) return 0
      if (resolvedField === 'oeePct') return snapshot.oeePct ?? 0
      if (resolvedField === 'availabilityPct') return snapshot.availabilityPct ?? 0
      if (resolvedField === 'performancePct') return snapshot.performancePct ?? 0
      if (resolvedField === 'qualityPct') return snapshot.qualityPct ?? 0
      if (resolvedField === 'teepPct') return snapshot.teepPct ?? 0
      if (resolvedField === 'scrapPct') return snapshot.scrapPct ?? 0
      if (resolvedField === 'yieldPct') return snapshot.yieldPct ?? 0
      if (resolvedField === 'fpyPct') return snapshot.fpyPct ?? 0
      if (resolvedField === 'uptimePct') return snapshot.uptimePct ?? 0
      if (resolvedField === 'utilizationPct') return snapshot.utilizationPct ?? 0
      const raw = (snapshot as unknown as Record<string, unknown>)[resolvedField]
      return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
    })()
  const label = labelOverride ?? gaugeLabelForField(resolvedField)
  const ringColor = ringColorOverride ?? gaugeColorForField(resolvedField)
  const showTarget = !wallBoard && resolvedField === 'oeePct'
  const showApq = showBreakdown && !wallBoard && resolvedField === 'oeePct'

  return (
    <Stack align="center" justify="center" h="100%" gap={wallBoard ? 'xs' : 'sm'}>
      <GaugeRing
        value={Number.isFinite(value) ? value : 0}
        size={size}
        thickness={wallBoard ? Math.round(size * 0.1) : Math.max(10, Math.round(size * 0.09))}
        sublabel={showTarget ? 'target 85%' : undefined}
        label={label}
        showLabelBelow
        ringColor={ringColor}
        valueOutside={false}
        decimals={1}
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
