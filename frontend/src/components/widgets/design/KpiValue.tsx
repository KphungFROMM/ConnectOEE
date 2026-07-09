import { Badge, Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { MetricLabel } from '../../help/HelpTrigger'
import { Sparkline } from '../charts/Sparkline'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

export function KpiValue({
  value,
  unit,
  label,
  delta,
  deltaLabel,
  color,
  sparklineData,
  sparklineColor,
  density,
  megaCount,
  wallBoard,
  helpId,
}: {
  value: string
  unit?: string
  label?: string
  delta?: number | null
  deltaLabel?: string
  color?: string
  sparklineData?: { label: string; v: number }[]
  sparklineColor?: string
  density?: WidgetDensity
  wallBoard?: boolean
  megaCount?: boolean
  footer?: ReactNode
  helpId?: string
}) {
  const fontSize = megaCount
    ? scaledSize(density === 'kiosk' ? 52 : 40, density)
    : scaledSize(density === 'kiosk' ? 36 : 28, density)
  const hideExtras = megaCount || wallBoard
  const deltaPct = !hideExtras && delta != null && Number.isFinite(delta) ? delta : null

  return (
    <Stack gap={density === 'kiosk' ? 8 : 4} justify="center" h="100%" align={megaCount ? 'center' : undefined}>
      {label ? (
        <MetricLabel
          label={label}
          helpId={helpId}
          density={density}
          centered={megaCount}
          touchTarget={density === 'kiosk'}
        />
      ) : null}
      <Group gap={8} align="baseline" wrap="nowrap" justify={megaCount ? 'center' : undefined}>
        <Text fw={800} lh={1} c={color} style={{ fontSize, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Text>
        {unit ? (
          <Text size={density === 'kiosk' ? 'md' : 'sm'} c="dimmed">
            {unit}
          </Text>
        ) : null}
        {deltaPct != null ? (
          <Badge size={density === 'kiosk' ? 'md' : 'sm'} color={deltaPct >= 0 ? 'teal' : 'red'} variant="light">
            {deltaPct >= 0 ? '+' : ''}
            {deltaPct.toFixed(1)}
            {deltaLabel ?? '%'}
          </Badge>
        ) : null}
      </Group>
      {sparklineData && sparklineData.length >= 2 && !hideExtras ? (
        <Sparkline data={sparklineData} color={sparklineColor} filled showLastPoint height={density === 'kiosk' ? 40 : 28} />
      ) : null}
    </Stack>
  )
}
