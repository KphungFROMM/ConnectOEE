import { lightTheme, oeeFactorColors, statusColors, wallTheme } from '../../../theme/tokens'
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

export type SurfaceElevation = 'default' | 'hero' | 'secondary'

export type ToneSurfaceOptions = {
  wallBoard?: boolean
  /** Soft tint for all-clear / running — never full-bleed alert green */
  calmMuted?: boolean
  elevation?: SurfaceElevation
}

export function densityScale(density: WidgetDensity | undefined): number {
  return density === 'kiosk' ? 2 : 1
}

export function scaledSize(base: number, density?: WidgetDensity): number {
  return Math.round(base * densityScale(density))
}

/** Kiosk hero numeric size (wall-first). */
export function wallHeroFontSize(density?: WidgetDensity): number {
  if (density === 'kiosk') return wallTheme.typeRamp.hero
  return scaledSize(36, density)
}

export const GRID_ROW_HEIGHT = { normal: 88, kiosk: 120 } as const

/**
 * Wall CSS vars follow the active Mantine scheme (light or dark).
 * Do not hard-code dark — the app moon toggle / wall toggle must win.
 */
export function wallBoardCssVars(scheme: 'light' | 'dark' = 'light'): CSSProperties {
  if (scheme === 'dark') {
    return {
      '--coee-wall-canvas': wallTheme.canvas,
      '--coee-wall-surface': wallTheme.surface,
      '--coee-wall-surface-elevated': wallTheme.surfaceElevated,
      '--coee-wall-border': wallTheme.border,
      '--coee-wall-shadow-hero': wallTheme.shadowHero,
      '--coee-wall-shadow-tile': wallTheme.shadowTile,
    } as CSSProperties
  }
  return {
    '--coee-wall-canvas': lightTheme.sunken,
    '--coee-wall-surface': lightTheme.surface,
    '--coee-wall-surface-elevated': '#FFFFFF',
    '--coee-wall-border': lightTheme.border,
    '--coee-wall-shadow-hero': '0 2px 12px rgba(0,0,0,0.08)',
    '--coee-wall-shadow-tile': '0 1px 4px rgba(0,0,0,0.06)',
  } as CSSProperties
}

/** Theme-aware surface tints for premium widget cards */
export function toneSurfaceStyle(tone: SurfaceTone, opts?: ToneSurfaceOptions): CSSProperties {
  const calm = opts?.calmMuted === true
  const wall = opts?.wallBoard === true
  // Prefer scheme-aware body; wall surface var only as subtle elevation hint
  const body = wall
    ? 'var(--coee-wall-surface, var(--mantine-color-body))'
    : 'var(--mantine-color-body)'

  if (calm && (tone === 'good' || tone === 'neutral')) {
    return {
      background: `linear-gradient(180deg, color-mix(in srgb, ${statusColors.running} ${wall ? 8 : 5}%, ${body}) 0%, ${body} 55%)`,
      borderColor: wall
        ? 'var(--coee-wall-border, var(--mantine-color-default-border))'
        : 'color-mix(in srgb, var(--mantine-color-teal-6) 14%, var(--mantine-color-default-border))',
    }
  }

  const mix = wall ? 10 : 8

  switch (tone) {
    case 'good':
      return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-teal-6) ${mix}%, ${body}) 0%, ${body} 48%)`,
        borderColor: 'color-mix(in srgb, var(--mantine-color-teal-6) 22%, var(--mantine-color-default-border))',
      }
    case 'bad':
      return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-red-6) ${mix}%, ${body}) 0%, ${body} 48%)`,
        borderColor: 'color-mix(in srgb, var(--mantine-color-red-6) 22%, var(--mantine-color-default-border))',
      }
    case 'info':
      return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-blue-6) ${mix}%, ${body}) 0%, ${body} 48%)`,
        borderColor: 'color-mix(in srgb, var(--mantine-color-blue-6) 22%, var(--mantine-color-default-border))',
      }
    case 'warn':
      return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-yellow-6) ${mix + 2}%, ${body}) 0%, ${body} 48%)`,
        borderColor: 'color-mix(in srgb, var(--mantine-color-yellow-6) 24%, var(--mantine-color-default-border))',
      }
    default:
      return {
        background: `linear-gradient(180deg, color-mix(in srgb, var(--mantine-color-gray-5) ${wall ? 8 : 6}%, ${body}) 0%, ${body} 50%)`,
      }
  }
}

export function wallShadow(elevation: SurfaceElevation = 'default'): string {
  if (elevation === 'hero') return 'var(--coee-wall-shadow-hero, 0 2px 12px rgba(0,0,0,0.08))'
  if (elevation === 'secondary') return '0 1px 3px rgba(0,0,0,0.06)'
  return 'var(--coee-wall-shadow-tile, 0 1px 4px rgba(0,0,0,0.06))'
}

export function kioskPreviewFrameStyle(): CSSProperties {
  return {
    background: 'var(--mantine-color-default-hover)',
    border: '1px solid var(--mantine-color-default-border)',
    borderRadius: 12,
    padding: 12,
  }
}
