import { Card } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import type { SurfaceElevation, SurfaceTone } from './widgetTheme'
import { toneSurfaceStyle, wallShadow } from './widgetTheme'

export function WidgetSurface({
  children,
  tone = 'neutral',
  wallBoard,
  calmMuted,
  elevation = 'default',
  padding = 'md',
  radius = 'md',
  withBorder = true,
  style,
}: {
  children: ReactNode
  tone?: SurfaceTone
  wallBoard?: boolean
  calmMuted?: boolean
  elevation?: SurfaceElevation
  padding?: string
  radius?: string | number
  withBorder?: boolean
  style?: CSSProperties
}) {
  const toneStyle = toneSurfaceStyle(tone, { wallBoard, calmMuted, elevation })

  return (
    <Card
      withBorder={withBorder && !wallBoard}
      radius={wallBoard ? 'lg' : radius}
      padding={padding}
      h="100%"
      bg={wallBoard ? 'transparent' : undefined}
      style={{
        overflow: 'hidden',
        boxShadow: wallBoard
          ? wallShadow(elevation)
          : elevation === 'hero'
            ? '0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.08)'
            : '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        ...toneStyle,
        ...(wallBoard && elevation === 'hero'
          ? {
              background:
                typeof toneStyle.background === 'string'
                  ? toneStyle.background.replace(
                      /var\(--coee-wall-surface[^)]*\)/g,
                      'var(--coee-wall-surface-elevated, #1E242C)',
                    )
                  : toneStyle.background,
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </Card>
  )
}
