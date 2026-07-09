import { RingProgress, Stack, Text } from '@mantine/core'
import { oeeColor, factorColorByLabel } from '../common'
import { RingGaugeLabel } from '../charts/RingGaugeLabel'

const VALUE_OUTSIDE_MAX_SIZE = 112

export function GaugeRing({
  value,
  label,
  size = 160,
  thickness,
  sublabel,
  showLabelBelow = false,
  compact = false,
  ringColor,
  valueOutside,
}: {
  value: number
  label?: string
  size?: number
  thickness?: number
  sublabel?: string
  showLabelBelow?: boolean
  compact?: boolean
  ringColor?: string
  /** Render % below the ring instead of inside (defaults to true when size ≤ 112) */
  valueOutside?: boolean
}) {
  const color =
    ringColor ??
    (label === 'A' || label === 'P' || label === 'Q'
      ? factorColorByLabel(label)
      : oeeColor())
  const outside = valueOutside ?? size <= VALUE_OUTSIDE_MAX_SIZE
  const ringThickness = thickness ?? (size > 180 ? 18 : size > 120 ? 14 : compact ? 11 : outside ? 8 : 10)
  const mainSize = compact
    ? size >= 112
      ? 'lg'
      : 'md'
    : size > 200
      ? '52px'
      : size > 160
        ? '42px'
        : size > 120
          ? '32px'
          : '24px'
  const inRingSublabel = outside || showLabelBelow || compact ? undefined : sublabel
  const pct = `${value.toFixed(label === 'OEE' || sublabel || compact || outside ? 1 : 0)}%`

  return (
    <Stack align="center" justify="center" gap={showLabelBelow || outside ? 4 : 2} h="100%">
      <RingProgress
        size={size}
        thickness={ringThickness}
        roundCaps
        rootColor="var(--mantine-color-default-border)"
        sections={[{ value: Math.min(100, Math.max(0, value)), color }]}
        label={
          outside ? undefined : (
            <RingGaugeLabel size={mainSize} color={color} sublabel={inRingSublabel}>
              {pct}
            </RingGaugeLabel>
          )
        }
      />
      {outside ? (
        <Text
          size={size >= 96 ? 'sm' : 'xs'}
          fw={800}
          c={color}
          lh={1}
          ta="center"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {pct}
        </Text>
      ) : null}
      {showLabelBelow && label ? (
        <Stack gap={0} align="center">
          <Text size="xs" c="dimmed" fw={700} tt="uppercase">
            {label}
          </Text>
          {sublabel ? (
            <Text size="10px" c="dimmed" fw={600}>
              {sublabel}
            </Text>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  )
}
