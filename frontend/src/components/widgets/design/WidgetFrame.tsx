import { Badge, Group, Skeleton, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { HelpTrigger } from '../../help/HelpTrigger'
import { EmptyChartState } from '../charts/EmptyChartState'
import type { SurfaceElevation, SurfaceTone, WidgetDensity } from './widgetTheme'
import { densityScale } from './widgetTheme'
import { useWallDisplay } from './WallDisplayContext'
import { WidgetSurface } from './WidgetSurface'

export type WidgetFrameVariant = 'default' | 'hero' | 'compact' | 'kiosk'

const variantPadding: Record<WidgetFrameVariant, string> = {
  default: 'md',
  hero: 'lg',
  compact: 'sm',
  kiosk: 'md',
}

function resolveElevation(variant: WidgetFrameVariant, wallBoard: boolean): SurfaceElevation {
  if (variant === 'hero' || variant === 'kiosk') return 'hero'
  if (wallBoard) return 'secondary'
  return 'default'
}

export function WidgetFrame({
  title,
  subtitle,
  children,
  stale,
  noData,
  loading,
  accentColor,
  emptyHint,
  variant = 'default',
  density,
  wallBoard,
  tone = 'neutral',
  calmMuted,
  elevation: elevationProp,
  footer,
  live,
  helpId,
}: {
  title?: string | null
  subtitle?: string | null
  children: ReactNode
  stale?: boolean
  noData?: boolean
  loading?: boolean
  accentColor?: string
  emptyHint?: string
  variant?: WidgetFrameVariant
  density?: WidgetDensity
  wallBoard?: boolean
  tone?: SurfaceTone
  calmMuted?: boolean
  elevation?: SurfaceElevation
  footer?: ReactNode
  live?: boolean
  helpId?: string
}) {
  const wallFromCtx = useWallDisplay()
  const isWall = wallBoard === true || wallFromCtx
  const isKiosk = variant === 'kiosk' || density === 'kiosk' || isWall
  const scale = densityScale(density ?? (isKiosk ? 'kiosk' : 'normal'))
  const hideHeader = isWall || isKiosk
  const padding = isWall ? 'sm' : variantPadding[variant]
  const showAccentBar = !isWall && !isKiosk && accentColor
  const elevation = elevationProp ?? resolveElevation(variant, isWall)
  // Calm-muted only on true wall boards — never half-apply dark tiles in light admin chrome
  const muted = calmMuted ?? (tone === 'good' && isWall)

  return (
    <WidgetSurface
      tone={tone}
      wallBoard={isWall}
      calmMuted={muted}
      elevation={elevation}
      padding={padding}
      radius={isKiosk ? 'lg' : 'md'}
      withBorder={!isWall}
      style={{
        borderLeft: showAccentBar ? `${Math.max(3, scale * 2)}px solid ${accentColor}` : undefined,
        ...(isWall
          ? {
              border: '1px solid var(--coee-wall-border, var(--mantine-color-default-border))',
            }
          : {}),
      }}
    >
      <Stack gap={isWall ? 4 : isKiosk ? 10 : 6} h="100%">
        {title && !hideHeader ? (
          <Group justify="space-between" gap={4} wrap="nowrap">
            <Stack gap={0}>
              <Group gap={4} wrap="nowrap" align="center">
                <Text size="xs" tt="uppercase" fw={700} c="dimmed" style={{ letterSpacing: 0.4 }}>
                  {title}
                </Text>
                {helpId ? <HelpTrigger helpId={helpId} size="xs" /> : null}
              </Group>
              {subtitle ? (
                <Text size="xs" c="dimmed">
                  {subtitle}
                </Text>
              ) : null}
            </Stack>
            <Group gap={4} wrap="nowrap">
              {live !== false && !stale ? (
                <Badge size="xs" color="green" variant="dot" radius="xl">
                  live
                </Badge>
              ) : null}
              {stale ? (
                <Badge size="xs" color="orange" variant="light">
                  stale
                </Badge>
              ) : null}
            </Group>
          </Group>
        ) : null}

        {loading ? (
          <Stack flex={1} justify="center" gap="xs">
            <Skeleton height={12} radius="sm" />
            <Skeleton height={12} radius="sm" width="70%" />
            <Skeleton height={80} radius="md" mt="xs" />
          </Stack>
        ) : noData ? (
          <EmptyChartState hint={emptyHint} />
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
        )}

        {footer && !noData && !loading ? footer : null}
      </Stack>
    </WidgetSurface>
  )
}
