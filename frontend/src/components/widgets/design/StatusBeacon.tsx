import { Group, Stack, Text } from '@mantine/core'
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

export function StatusBeacon({ state, density }: { state?: string | null; density?: WidgetDensity }) {
  const color = stateColor(state)
  const Icon = stateIcon(state)
  const ring = scaledSize(density === 'kiosk' ? 76 : 52, density)
  const iconSize = scaledSize(density === 'kiosk' ? 22 : 16, density)

  return (
    <Stack align="center" justify="center" h="100%" gap={density === 'kiosk' ? 10 : 6}>
      <div
        style={{
          position: 'relative',
          width: ring,
          height: ring,
          borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${color}ee, ${color})`,
          boxShadow: `0 0 0 ${scaledSize(6, density)}px ${color}33, 0 0 ${scaledSize(28, density)}px ${color}55, inset 0 -4px 10px rgba(0,0,0,0.15)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={iconSize} color="#fff" stroke={2.5} />
      </div>
      <Group gap={8} justify="center" wrap="nowrap">
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <Text fw={800} size={density === 'kiosk' ? 'xl' : 'md'}>
          {state ?? 'Unknown'}
        </Text>
      </Group>
    </Stack>
  )
}
