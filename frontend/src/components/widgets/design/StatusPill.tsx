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

export function StatusPill({ state, density }: { state?: string | null; density?: WidgetDensity }) {
  const color = stateColor(state)
  const Icon = stateIcon(state)
  const size = scaledSize(density === 'kiosk' ? 20 : 14, density)

  return (
    <Group gap={density === 'kiosk' ? 12 : 8} justify="center" wrap="nowrap">
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: scaledSize(density === 'kiosk' ? 72 : 48, density),
          height: scaledSize(density === 'kiosk' ? 72 : 48, density),
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 0 ${scaledSize(8, density)}px ${color}33, 0 0 ${scaledSize(24, density)}px ${color}44`,
        }}
      >
        <Icon size={size} color="#fff" stroke={2.5} />
      </span>
      <Text fw={800} size={density === 'kiosk' ? 'xl' : 'md'}>
        {state ?? 'Unknown'}
      </Text>
    </Group>
  )
}
