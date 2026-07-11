import { Group, Stack, Text } from '@mantine/core'
import { IconPlayerPause, IconPlayerPlay, IconTool } from '@tabler/icons-react'
import { getStatusColors } from '../../../theme/statusColorsRuntime'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

type StackState = 'running' | 'warning' | 'fault'
type AndonLayout = 'tower' | 'strip' | 'beacon' | 'pill' | 'minimal'

const LIGHT_DEFS: { key: StackState; label: string }[] = [
  { key: 'running', label: 'Run' },
  { key: 'warning', label: 'Warn' },
  { key: 'fault', label: 'Stop' },
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

export function AndonStackVisual({
  state,
  density,
  caption,
  layout = 'tower',
}: {
  state?: string | null
  density?: WidgetDensity
  caption?: string | null
  /** tower = vertical lamps; strip = horizontal; beacon = single calm disc (no duplicate hero text) */
  layout?: AndonLayout
}) {
  const status = getStatusColors()
  const lights = LIGHT_DEFS.map((l) => ({ ...l, color: status[l.key] }))
  const active = resolveStackState(state)
  const isKiosk = density === 'kiosk'
  const activeColor = lights.find((l) => l.key === active)?.color ?? status.idle
  const Icon = stateIcon(state)
  const dot = scaledSize(isKiosk ? 14 : 10, density)
  const iconSize = scaledSize(isKiosk ? 20 : 16, density)
  const disc = scaledSize(isKiosk ? 48 : 40, density)

  if (layout === 'beacon') {
    return (
      <Stack align="center" justify="center" h="100%" gap={isKiosk ? 10 : 6} style={{ minHeight: 0 }}>
        {caption ? (
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center" style={{ letterSpacing: 0.8 }}>
            {caption}
          </Text>
        ) : null}
        <div
          style={{
            flexShrink: 0,
            width: disc,
            height: disc,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${activeColor} 88%, #fff)`,
            boxShadow: `0 0 0 3px color-mix(in srgb, ${activeColor} 22%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={iconSize} color="#fff" stroke={2.5} />
        </div>
        <Text fw={800} size={isKiosk ? 'md' : 'sm'} lh={1.15} ta="center">
          {state ?? 'Unknown'}
        </Text>
      </Stack>
    )
  }

  if (layout === 'strip') {
    return (
      <Stack align="stretch" justify="center" h="100%" gap={isKiosk ? 10 : 6} px={isKiosk ? 4 : 0}>
        {caption ? (
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center" style={{ letterSpacing: 0.8 }}>
            {caption}
          </Text>
        ) : null}
        <Group gap={isKiosk ? 10 : 6} grow wrap="nowrap" align="stretch">
          {lights.map((l) => {
            const on = l.key === active
            return (
              <Stack
                key={l.key}
                gap={6}
                align="center"
                justify="center"
                py={isKiosk ? 10 : 8}
                style={{
                  borderRadius: 10,
                  border: `1.5px solid ${on ? l.color : 'var(--mantine-color-default-border)'}`,
                  background: on
                    ? `color-mix(in srgb, ${l.color} 16%, var(--mantine-color-body))`
                    : 'transparent',
                  opacity: on ? 1 : 0.4,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    width: dot,
                    height: dot,
                    borderRadius: '50%',
                    background: on ? l.color : 'var(--mantine-color-default-border)',
                    flexShrink: 0,
                  }}
                />
                <Text fw={on ? 800 : 500} size="xs" tt="uppercase" c={on ? undefined : 'dimmed'} ta="center">
                  {l.label}
                </Text>
              </Stack>
            )
          })}
        </Group>
        <Text fw={700} size="sm" ta="center" c="dimmed">
          {state ?? 'Unknown'}
        </Text>
      </Stack>
    )
  }

  if (layout === 'pill') {
    return (
      <Stack align="center" justify="center" h="100%" gap={8}>
        {caption ? (
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center" style={{ letterSpacing: 0.8 }}>
            {caption}
          </Text>
        ) : null}
        <Group
          gap={10}
          wrap="nowrap"
          px={isKiosk ? 16 : 12}
          py={isKiosk ? 12 : 8}
          style={{
            borderRadius: 999,
            border: `2px solid ${activeColor}`,
            background: `color-mix(in srgb, ${activeColor} 14%, var(--mantine-color-body))`,
          }}
        >
          <div
            style={{
              width: dot,
              height: dot,
              borderRadius: '50%',
              background: activeColor,
              boxShadow: `0 0 8px ${activeColor}`,
              flexShrink: 0,
            }}
          />
          <Text fw={800} size={isKiosk ? 'md' : 'sm'} style={{ whiteSpace: 'nowrap' }}>
            {state ?? 'Unknown'}
          </Text>
          <Icon size={iconSize} color={activeColor} stroke={2.25} style={{ flexShrink: 0 }} />
        </Group>
      </Stack>
    )
  }

  if (layout === 'minimal') {
    return (
      <Stack align="center" justify="center" h="100%" gap={6}>
        {caption ? (
          <Text size="xs" c="dimmed" tt="uppercase" fw={600} ta="center">
            {caption}
          </Text>
        ) : null}
        <Group gap={8} wrap="nowrap" align="center">
          <div
            style={{
              width: scaledSize(isKiosk ? 12 : 9, density),
              height: scaledSize(isKiosk ? 12 : 9, density),
              borderRadius: '50%',
              background: activeColor,
            }}
          />
          <Text fw={700} size={isKiosk ? 'lg' : 'md'} lh={1}>
            {state ?? '—'}
          </Text>
        </Group>
      </Stack>
    )
  }

  // tower — lamps only; state is the lit row (no overlapping bottom hero)
  return (
    <Stack align="stretch" justify="center" h="100%" gap={isKiosk ? 8 : 6} px={isKiosk ? 4 : 0} style={{ minHeight: 0 }}>
      {caption ? (
        <Text size="xs" c="dimmed" tt="uppercase" fw={700} ta="center" style={{ letterSpacing: 0.8, flexShrink: 0 }}>
          {caption}
        </Text>
      ) : null}
      <Stack gap={isKiosk ? 6 : 5} justify="center" style={{ flex: 1, minHeight: 0 }}>
        {lights.map((l) => {
          const on = l.key === active
          return (
            <Group
              key={l.key}
              gap={isKiosk ? 12 : 8}
              wrap="nowrap"
              px={isKiosk ? 12 : 10}
              py={isKiosk ? 10 : 7}
              style={{
                borderRadius: 10,
                border: `1.5px solid ${on ? l.color : 'color-mix(in srgb, var(--mantine-color-default-border) 80%, transparent)'}`,
                background: on
                  ? `color-mix(in srgb, ${l.color} 14%, var(--mantine-color-body))`
                  : 'transparent',
                opacity: on ? 1 : 0.38,
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: dot,
                  height: dot,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: on ? l.color : 'var(--mantine-color-default-border)',
                }}
              />
              <Text fw={on ? 800 : 500} size={isKiosk ? 'sm' : 'xs'} tt="uppercase" c={on ? undefined : 'dimmed'} style={{ flex: 1 }}>
                {l.label}
              </Text>
              {on ? <Icon size={iconSize} color={l.color} stroke={2.25} style={{ flexShrink: 0 }} /> : null}
            </Group>
          )
        })}
      </Stack>
    </Stack>
  )
}
