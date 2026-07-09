import { lightTheme, oeeFactorColors, statusColors } from '../../../theme/tokens'
import type { CSSProperties } from 'react'

export const chartSeries = {
  primary: 'blue.6',
  secondary: 'gray.4',
  good: oeeFactorColors.oee.mantine,
  bad: 'red.6',
  warn: 'yellow.6',
  accent: oeeFactorColors.performance.mantine,
  oee: oeeFactorColors.oee.mantine,
  availability: oeeFactorColors.availability.mantine,
  performance: oeeFactorColors.performance.mantine,
  quality: oeeFactorColors.quality.mantine,
} as const

export const chartDefaults = {
  barRadius: 6,
  gridColor: lightTheme.border,
  tickFontSize: 11,
  tooltipProps: { cursor: { strokeDasharray: '4 4' } },
} as const

export function seriesColorForOee(_pct: number): string {
  return chartSeries.oee
}

export function mantineColorFromHex(hex: string): string {
  if (hex === statusColors.running) return 'teal.6'
  if (hex === statusColors.warning) return 'yellow.6'
  if (hex === statusColors.fault) return 'red.6'
  return 'gray.6'
}

export type WidgetDensity = 'normal' | 'kiosk'

export type SurfaceTone = 'neutral' | 'good' | 'bad' | 'info' | 'warn'

export function densityScale(density: WidgetDensity | undefined): number {
  return density === 'kiosk' ? 2 : 1
}

export function scaledSize(base: number, density?: WidgetDensity): number {
  return Math.round(base * densityScale(density))
}

export const GRID_ROW_HEIGHT = { normal: 88, kiosk: 120 } as const

/** Theme-aware surface tints for premium widget cards */
export function toneSurfaceStyle(tone: SurfaceTone): CSSProperties {
  switch (tone) {
    case 'good':
      return {
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-teal-6) 8%, var(--mantine-color-body)) 0%, var(--mantine-color-body) 48%)',
        borderColor: 'color-mix(in srgb, var(--mantine-color-teal-6) 22%, var(--mantine-color-default-border))',
      }
    case 'bad':
      return {
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-red-6) 8%, var(--mantine-color-body)) 0%, var(--mantine-color-body) 48%)',
        borderColor: 'color-mix(in srgb, var(--mantine-color-red-6) 22%, var(--mantine-color-default-border))',
      }
    case 'info':
      return {
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-blue-6) 8%, var(--mantine-color-body)) 0%, var(--mantine-color-body) 48%)',
        borderColor: 'color-mix(in srgb, var(--mantine-color-blue-6) 22%, var(--mantine-color-default-border))',
      }
    case 'warn':
      return {
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-yellow-6) 10%, var(--mantine-color-body)) 0%, var(--mantine-color-body) 48%)',
        borderColor: 'color-mix(in srgb, var(--mantine-color-yellow-6) 24%, var(--mantine-color-default-border))',
      }
    default:
      return {
        background: 'linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-gray-5) 6%, var(--mantine-color-body)) 0%, var(--mantine-color-body) 40%)',
      }
  }
}

export function kioskPreviewFrameStyle(): CSSProperties {
  return {
    background: 'var(--mantine-color-default-hover)',
    border: '1px solid var(--mantine-color-default-border)',
    borderRadius: 12,
    padding: 12,
  }
}
