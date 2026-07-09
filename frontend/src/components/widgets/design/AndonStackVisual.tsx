import { Group, Stack, Text } from '@mantine/core'
import { IconPlayerPause, IconPlayerPlay, IconTool } from '@tabler/icons-react'
import { statusColors } from '../../../theme/tokens'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

type StackState = 'running' | 'warning' | 'fault'

const LIGHTS: { key: StackState; color: string; label: string }[] = [
  { key: 'running', color: statusColors.running, label: 'Run' },
  { key: 'warning', color: statusColors.warning, label: 'Warn' },
  { key: 'fault', color: statusColors.fault, label: 'Stop' },
]

function resolveStackState(state?: string | null): StackState {
  if (state === 'Running') return 'running'
  if (state === 'Down' || state === 'Setup') return 'fault'
  if (state === 'Idle' || state === 'Starved' || state === 'Blocked') return 'warning'
  return 'warning'
}

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

export function AndonStackVisual({ state, density }: { state?: string | null; density?: WidgetDensity }) {
  const active = resolveStackState(state)
  const isKiosk = density === 'kiosk'
  const activeColor = LIGHTS.find((l) => l.key === active)?.color ?? statusColors.idle
  const Icon = stateIcon(state)
  const dot = scaledSize(isKiosk ? 14 : 10, density)
  const iconSize = scaledSize(isKiosk ? 22 : 16, density)

  return (
    <Stack align="stretch" justify="center" h="100%" gap={isKiosk ? 10 : 8} px={isKiosk ? 4 : 0}>
      <Stack gap={isKiosk ? 8 : 6} justify="center" style={{ flex: 1 }}>
        {LIGHTS.map((l) => {
          const on = l.key === active
          return (
            <Group
              key={l.key}
              gap={isKiosk ? 12 : 8}
              wrap="nowrap"
              px={isKiosk ? 14 : 10}
              py={isKiosk ? 12 : 8}
              style={{
                borderRadius: 10,
                border: `2px solid ${on ? l.color : 'var(--mantine-color-default-border)'}`,
                background: on
                  ? `color-mix(in srgb, ${l.color} 12%, var(--mantine-color-body))`
                  : 'color-mix(in srgb, var(--mantine-color-default-border) 40%, transparent)',
                transition: 'background 0.2s ease, border-color 0.2s ease',
              }}
            >
              <div
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: on ? l.color : 'var(--mantine-color-default-border)',
                  boxShadow: on ? `0 0 ${scaledSize(10, density)}px ${l.color}` : undefined,
                }}
              />
              <Text
                fw={on ? 800 : 600}
                size={isKiosk ? 'sm' : 'xs'}
                tt="uppercase"
                c={on ? undefined : 'dimmed'}
                style={{ letterSpacing: 0.6, flex: 1 }}
              >
                {l.label}
              </Text>
            </Group>
          )
        })}
      </Stack>

      <Stack
        align="center"
        justify="center"
        gap={6}
        py={isKiosk ? 10 : 6}
        style={{
          borderRadius: 12,
          background: `color-mix(in srgb, ${activeColor} 10%, var(--mantine-color-body))`,
          border: `1px solid color-mix(in srgb, ${activeColor} 35%, var(--mantine-color-default-border))`,
        }}
      >
        <div
          style={{
            width: scaledSize(isKiosk ? 52 : 40, density),
            height: scaledSize(isKiosk ? 52 : 40, density),
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeColor,
            color: '#fff',
            boxShadow: `0 0 0 ${scaledSize(4, density)}px color-mix(in srgb, ${activeColor} 30%, transparent)`,
          }}
        >
          <Icon size={iconSize} stroke={2.5} />
        </div>
        <Text fw={900} size={isKiosk ? '26px' : 'lg'} ta="center" lh={1.1}>
          {state ?? 'Unknown'}
        </Text>
      </Stack>
    </Stack>
  )
}
