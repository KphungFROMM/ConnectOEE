import { Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

export type InfoStripVariant = 'fault' | 'calm' | 'info'

const stripStyles: Record<InfoStripVariant, { bg: string; fg: string }> = {
  fault: { bg: 'var(--mantine-color-red-9)', fg: '#fff' },
  calm: { bg: 'var(--mantine-color-teal-9)', fg: '#fff' },
  info: { bg: 'var(--mantine-color-blue-9)', fg: '#fff' },
}

export function InfoStrip({
  variant,
  title,
  subtitle,
  density,
  compact,
  children,
}: {
  variant: InfoStripVariant
  title: ReactNode
  subtitle?: ReactNode
  density?: WidgetDensity
  compact?: boolean
  children?: ReactNode
}) {
  const isKiosk = density === 'kiosk'
  const { bg, fg } = stripStyles[variant]

  return (
    <Stack
      justify="center"
      align="center"
      h="100%"
      gap={compact ? 2 : 4}
      style={{
        borderRadius: compact ? 8 : 10,
        background: bg,
        color: fg,
        padding: compact ? 8 : scaledSize(10, density),
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
      }}
    >
      <Text
        fw={900}
        lh={1}
        ta="center"
        style={{ fontSize: compact ? 18 : scaledSize(isKiosk ? 48 : 32, density) }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text size={compact ? 'xs' : isKiosk ? 'lg' : 'sm'} opacity={0.9} ta="center" lineClamp={1}>
          {subtitle}
        </Text>
      ) : null}
      {children}
    </Stack>
  )
}
