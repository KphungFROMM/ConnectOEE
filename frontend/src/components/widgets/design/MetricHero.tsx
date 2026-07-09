import { Group, Stack, Text } from '@mantine/core'
import { MetricLabel } from '../../help/HelpTrigger'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

export function MetricHero({
  label,
  value,
  unit,
  color,
  density,
  centered = false,
  helpId,
}: {
  label?: string
  value: string
  unit?: string
  color?: string
  density?: WidgetDensity
  centered?: boolean
  helpId?: string
}) {
  const fontSize = scaledSize(density === 'kiosk' ? 52 : 36, density)

  return (
    <Stack gap={density === 'kiosk' ? 8 : 4} justify="center" h="100%" align={centered ? 'center' : undefined}>
      {label ? (
        <MetricLabel
          label={label}
          helpId={helpId}
          density={density}
          centered={centered}
          touchTarget={density === 'kiosk'}
        />
      ) : null}
      <Group gap={8} align="baseline" wrap="nowrap" justify={centered ? 'center' : undefined}>
        <Text fw={800} lh={1} c={color} style={{ fontSize, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </Text>
        {unit ? (
          <Text size={density === 'kiosk' ? 'md' : 'sm'} c="dimmed">
            {unit}
          </Text>
        ) : null}
      </Group>
    </Stack>
  )
}
