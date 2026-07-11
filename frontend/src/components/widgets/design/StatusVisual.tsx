import { Badge, Group, Stack, Text } from '@mantine/core'
import { IconPlayerPause, IconPlayerPlay, IconTool } from '@tabler/icons-react'
import { stateColor } from '../common'
import type { StatusStyle } from './statusStyle'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'
import { AndonStackVisual } from './AndonStackVisual'

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

/** Calm disc + label — default status presentation. */
export function StatusBeacon({
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
  const ring = scaledSize(isKiosk ? 52 : 40, density)
  const iconSize = scaledSize(isKiosk ? 18 : 14, density)

  return (
    <Stack align="center" justify="center" h="100%" gap={isKiosk ? 10 : 6} style={{ minHeight: 0 }}>
      <div
        style={{
          flexShrink: 0,
          width: ring,
          height: ring,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 88%, #fff)`,
          boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 22%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={iconSize} color="#fff" stroke={2.5} />
      </div>
      <Text fw={800} size={isKiosk ? 'md' : 'sm'} lh={1.15} ta="center" style={{ flexShrink: 0 }}>
        {state ?? 'Unknown'}
      </Text>
      {context ? (
        <Text size={isKiosk ? 'sm' : 'xs'} c="dimmed" ta="center" lineClamp={1} style={{ flexShrink: 0 }}>
          {context}
        </Text>
      ) : null}
    </Stack>
  )
}

/** Horizontal pill: color rail + state. */
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
    <Stack align="stretch" justify="center" h="100%" gap={6} px={4}>
      <Group
        gap={isKiosk ? 12 : 10}
        wrap="nowrap"
        px={isKiosk ? 14 : 10}
        py={isKiosk ? 12 : 8}
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
            flexShrink: 0,
            backgroundColor: color,
          }}
        >
          <Icon size={iconSize} color="#fff" stroke={2.5} />
        </span>
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={800} size={isKiosk ? 'lg' : 'sm'} lh={1.1} truncate>
            {state ?? 'Unknown'}
          </Text>
          {context ? (
            <Text size="xs" c="dimmed" truncate>
              {context}
            </Text>
          ) : null}
        </Stack>
      </Group>
    </Stack>
  )
}

/** Dot + text — calm secondary signal. */
export function StatusMinimal({
  state,
  density,
  context,
}: {
  state?: string | null
  density?: WidgetDensity
  context?: string | null
}) {
  const color = stateColor(state)
  const isKiosk = density === 'kiosk'

  return (
    <Stack align="center" justify="center" h="100%" gap={isKiosk ? 8 : 4}>
      <Group gap={8} justify="center" wrap="nowrap">
        <span
          style={{
            width: isKiosk ? 12 : 9,
            height: isKiosk ? 12 : 9,
            borderRadius: '50%',
            background: color,
            flexShrink: 0,
          }}
        />
        <Text fw={800} size={isKiosk ? 'xl' : 'lg'} lh={1.1}>
          {state ?? 'Unknown'}
        </Text>
      </Group>
      {context ? (
        <Text size="xs" c="dimmed" ta="center" lineClamp={1}>
          {context}
        </Text>
      ) : null}
    </Stack>
  )
}

/**
 * Renders run-state / Andon / traffic status according to `statusStyle`.
 * Tower/strip delegate to AndonStackVisual for lamp layouts.
 */
export function StatusVisual({
  style = 'beacon',
  state,
  density,
  context,
  caption,
}: {
  style?: StatusStyle
  state?: string | null
  density?: WidgetDensity
  context?: string | null
  caption?: string | null
}) {
  if (style === 'tower' || style === 'strip') {
    return <AndonStackVisual state={state} density={density} caption={caption} layout={style} />
  }
  if (style === 'pill') {
    return <StatusPill state={state} density={density} context={context} />
  }
  if (style === 'minimal') {
    return <StatusMinimal state={state} density={density} context={context} />
  }
  return <StatusBeacon state={state} density={density} context={context} />
}

/** Soft band badge for OEE traffic (not a solid slab). */
export function TrafficBandBadge({
  label,
  color,
  size = 'md',
}: {
  label: string
  color: string
  size?: 'md' | 'lg'
}) {
  return (
    <Badge
      size={size}
      variant="light"
      style={{
        color,
        background: `color-mix(in srgb, ${color} 14%, var(--mantine-color-body))`,
        border: `1px solid color-mix(in srgb, ${color} 32%, var(--mantine-color-default-border))`,
      }}
    >
      {label}
    </Badge>
  )
}
