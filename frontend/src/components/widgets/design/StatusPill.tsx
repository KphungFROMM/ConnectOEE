import { Group, Text } from '@mantine/core'
import { IconPlayerPause, IconPlayerPlay, IconTool } from '@tabler/icons-react'
import { stateColor } from '../common'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

function stateIcon(state?: string | null) {
  switch (state) {
    case 'Running':
      return IconPlayerPlay
    case 'Down':
    case 'Setup':
      return IconTool
    default:
      return IconPlayerPause
  }
}

/** Compact state chip — re-exports pill look for strips/lists. Prefer StatusVisual for widgets. */
export function StatusPill({
  state,
  density,
  context,
}: {
  state?: string | null
  density?: WidgetDensity
  context?: string | null
}) {
  const color = stateColor(state)
  const Icon = stateIcon(state)
  const isKiosk = density === 'kiosk'
  const disc = scaledSize(isKiosk ? 36 : 28, density)
  const iconSize = scaledSize(isKiosk ? 15 : 12, density)

  return (
    <Group
      gap={isKiosk ? 10 : 8}
      justify="center"
      wrap="nowrap"
      px={isKiosk ? 12 : 8}
      py={isKiosk ? 10 : 6}
      style={{
        borderRadius: 12,
        border: `1px solid color-mix(in srgb, ${color} 35%, var(--mantine-color-default-border))`,
        background: `color-mix(in srgb, ${color} 10%, var(--mantine-color-body))`,
        borderLeft: `4px solid ${color}`,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: disc,
          height: disc,
          borderRadius: '50%',
          backgroundColor: color,
          flexShrink: 0,
        }}
      >
        <Icon size={iconSize} color="#fff" stroke={2.5} />
      </span>
      <div style={{ minWidth: 0 }}>
        <Text fw={800} size={isKiosk ? 'lg' : 'sm'} lh={1.1} truncate>
          {state ?? 'Unknown'}
        </Text>
        {context ? (
          <Text size="xs" c="dimmed" truncate>
            {context}
          </Text>
        ) : null}
      </div>
    </Group>
  )
}
