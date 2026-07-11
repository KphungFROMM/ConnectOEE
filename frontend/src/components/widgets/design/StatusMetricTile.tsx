import { Group, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { WidgetDensity } from './widgetTheme'

/**
 * Premium status / connection / clock tile — replaces bare Badge/Text widgets.
 */
export function StatusMetricTile({
  label,
  value,
  subtitle,
  color,
  density,
  icon,
  toneBar = true,
}: {
  label?: string
  value: string
  subtitle?: string
  color?: string
  density?: WidgetDensity
  icon?: ReactNode
  toneBar?: boolean
}) {
  const valueSize = density === 'kiosk' ? 40 : 28
  const accent = color ?? 'var(--mantine-color-blue-6)'

  return (
    <Stack gap={density === 'kiosk' ? 10 : 6} justify="center" h="100%" style={{ position: 'relative' }}>
      {toneBar ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            top: '10%',
            bottom: '10%',
            width: 4,
            borderRadius: 4,
            background: accent,
          }}
        />
      ) : null}
      <Stack gap={4} pl={toneBar ? 14 : 0}>
        {label ? (
          <Text size={density === 'kiosk' ? 'sm' : 'xs'} c="dimmed" fw={600} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            {label}
          </Text>
        ) : null}
        <Group gap={10} wrap="nowrap" align="center">
          {icon ? (
            <div
              style={{
                width: density === 'kiosk' ? 40 : 32,
                height: density === 'kiosk' ? 40 : 32,
                borderRadius: 10,
                background: `color-mix(in srgb, ${accent} 14%, transparent)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accent,
                flexShrink: 0,
              }}
            >
              {icon}
            </div>
          ) : null}
          <Text fw={800} lh={1.1} c={accent} style={{ fontSize: valueSize, fontVariantNumeric: 'tabular-nums' }}>
            {value}
          </Text>
        </Group>
        {subtitle ? (
          <Text size={density === 'kiosk' ? 'sm' : 'xs'} c="dimmed">
            {subtitle}
          </Text>
        ) : null}
      </Stack>
    </Stack>
  )
}
