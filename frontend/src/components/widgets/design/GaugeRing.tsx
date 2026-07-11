import { RingProgress, Stack, Text } from '@mantine/core'
import { oeeColor, factorColorByLabel } from '../common'
import { RingGaugeLabel } from '../charts/RingGaugeLabel'

const VALUE_OUTSIDE_MAX_SIZE = 112

/** Cap stroke so the hole stays large enough for in-ring % text. */
function defaultThickness(size: number, outside: boolean, compact: boolean): number {
  if (outside) return size > 180 ? 18 : size > 120 ? 14 : compact ? 11 : 8
  // In-ring: thinner relative to size (≈9% of diameter, clamped).
  return Math.max(6, Math.min(12, Math.round(size * 0.09)))
}

/** Font size from inner diameter and digit string length — not outer ring size. */
export function fitRingValueFontPx(innerDiameter: number, text: string): number {
  const chars = Math.max(1, text.length)
  // Bold tabular glyphs are wider than body text; keep clear air inside the stroke.
  const fromWidth = (innerDiameter * 0.72) / (chars * 0.7)
  const fromHeight = innerDiameter * 0.34
  return Math.max(11, Math.min(36, Math.floor(Math.min(fromWidth, fromHeight))))
}

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
  decimals,
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
  /** Fractional digits for the in-ring / below-ring percentage string. */
  decimals?: number
}) {
  const color =
    ringColor ??
    (label === 'A' || label === 'P' || label === 'Q'
      ? factorColorByLabel(label)
      : oeeColor())
  const outside = valueOutside ?? size <= VALUE_OUTSIDE_MAX_SIZE
  const ringThickness = thickness ?? defaultThickness(size, outside, compact)
  const inner = Math.max(8, size - 2 * ringThickness)

  const frac =
    decimals != null && Number.isFinite(decimals)
      ? Math.max(0, Math.min(3, Math.floor(decimals)))
      : label === 'OEE' || sublabel || compact || outside
        ? 1
        : 0
  const pct = `${value.toFixed(frac)}%`
  const fontPx = fitRingValueFontPx(inner, pct)
  const mainSize = compact ? (size >= 112 ? 'lg' : 'md') : `${fontPx}px`

  // Never put the metric title inside the ring when it is shown below.
  const inRingSublabel = outside || showLabelBelow || compact ? undefined : sublabel

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
            <RingGaugeLabel size={mainSize} color={color} sublabel={inRingSublabel} maxWidth={inner * 0.82}>
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
