import { Card } from '@mantine/core'
import type { CSSProperties, ReactNode } from 'react'
import type { SurfaceTone } from './widgetTheme'
import { toneSurfaceStyle } from './widgetTheme'

export function WidgetSurface({
  children,
  tone = 'neutral',
  wallBoard,
  padding = 'md',
  radius = 'md',
  withBorder = true,
  style,
}: {
  children: ReactNode
  tone?: SurfaceTone
  wallBoard?: boolean
  padding?: string
  radius?: string | number
  withBorder?: boolean
  style?: CSSProperties
}) {
  const toneStyle = toneSurfaceStyle(tone)

  return (
    <Card
      withBorder={withBorder && !wallBoard}
      radius={wallBoard ? 'lg' : radius}
      padding={padding}
      h="100%"
      style={{
        overflow: 'hidden',
        boxShadow: wallBoard
          ? '0 2px 12px rgba(0,0,0,0.08)'
          : '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        ...toneStyle,
        ...(wallBoard
          ? {
              background:
                tone !== 'neutral'
                  ? toneStyle.background
                  : 'linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-gray-5) 10%, var(--mantine-color-body)) 0%, var(--mantine-color-body) 50%)',
            }
          : {}),
        ...style,
      }}
    >
      {children}
    </Card>
  )
}
