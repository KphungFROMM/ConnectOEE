import { Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { statusColors } from '../../../theme/tokens'
import type { WidgetDensity } from './widgetTheme'
import { scaledSize } from './widgetTheme'

export type InfoStripVariant = 'fault' | 'calm' | 'info'

/**
 * Alert variants (fault/info) stay full-bleed for attention.
 * Calm is a muted subordinate bar — never a solid teal-9 slab.
 */
function stripStyle(variant: InfoStripVariant, wallBoard?: boolean): {
  bg: string
  fg: string
  border?: string
  fullBleed: boolean
} {
  if (variant === 'fault') {
    return { bg: 'var(--mantine-color-red-9)', fg: '#fff', fullBleed: true }
  }
  if (variant === 'info') {
    return { bg: 'var(--mantine-color-blue-9)', fg: '#fff', fullBleed: true }
  }
  return {
    bg: wallBoard
      ? `color-mix(in srgb, ${statusColors.running} 10%, var(--coee-wall-surface, var(--mantine-color-body)))`
      : `color-mix(in srgb, ${statusColors.running} 8%, var(--mantine-color-body))`,
    fg: 'var(--mantine-color-text)',
    border: wallBoard
      ? `1px solid color-mix(in srgb, ${statusColors.running} 28%, var(--coee-wall-border, var(--mantine-color-default-border)))`
      : `1px solid color-mix(in srgb, ${statusColors.running} 28%, var(--mantine-color-default-border))`,
    fullBleed: false,
  }
}

export function InfoStrip({
  variant,
  title,
  subtitle,
  density,
  compact,
  wallBoard,
  children,
}: {
  variant: InfoStripVariant
  title: ReactNode
  subtitle?: ReactNode
  density?: WidgetDensity
  compact?: boolean
  wallBoard?: boolean
  children?: ReactNode
}) {
  const isKiosk = density === 'kiosk'
  const { bg, fg, border, fullBleed } = stripStyle(variant, wallBoard)
  const isCalm = variant === 'calm'
  const titleSize = isCalm || compact
    ? isKiosk
      ? 18
      : 14
    : scaledSize(isKiosk ? 48 : 32, density)

  return (
    <Stack
      justify="center"
      align="center"
      h="100%"
      gap={compact || isCalm ? 2 : 4}
      style={{
        borderRadius: compact || isCalm ? 8 : 10,
        background: bg,
        color: fg,
        border,
        padding: compact || isCalm ? 8 : scaledSize(10, density),
        boxShadow: fullBleed ? 'inset 0 1px 0 rgba(255,255,255,0.12)' : undefined,
      }}
    >
      <Text
        fw={isCalm ? 700 : 900}
        lh={1}
        ta="center"
        tt={isCalm ? 'uppercase' : undefined}
        c={isCalm ? 'dimmed' : undefined}
        style={{
          fontSize: titleSize,
          letterSpacing: isCalm ? 0.6 : undefined,
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          size={compact || isCalm ? 'xs' : isKiosk ? 'lg' : 'sm'}
          opacity={isCalm ? 0.85 : 0.9}
          ta="center"
          lineClamp={1}
          c={isCalm ? 'dimmed' : undefined}
        >
          {subtitle}
        </Text>
      ) : null}
      {children}
    </Stack>
  )
}
