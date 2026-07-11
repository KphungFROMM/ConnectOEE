// ConnectOEE design tokens derived from docs/01-product-overview-ux.md.
// Neutral surfaces + single blue accent + consistent industrial status colors.

/** Shipped defaults — Admin → Appearance can override the live `statusColors` map. */
export const defaultStatusColors = {
  running: '#2E9E5B', // running / good / connected
  warning: '#E0A800', // warning / stale / reduced speed
  fault: '#D64545', // fault / stopped / disconnected
  idle: '#8A929E', // idle / planned-down / neutral
} as const

export type StatusColorKey = keyof typeof defaultStatusColors

/** Live status palette (mutated by AppearanceProvider). Prefer reading this at use/render time. */
export const statusColors: Record<StatusColorKey, string> = {
  running: defaultStatusColors.running,
  warning: defaultStatusColors.warning,
  fault: defaultStatusColors.fault,
  idle: defaultStatusColors.idle,
}

export const lightTheme = {
  canvas: '#FFFFFF',
  sunken: '#F4F5F7',
  surface: '#FFFFFF',
  border: '#E3E5E8',
  primary: '#2563EB',
  primaryHover: '#1D4FD7',
  navActiveBg: '#E8F0FE',
  infoBg: '#EAF2FE',
  infoBorder: '#CFE0FB',
  textPrimary: '#1F2329',
  textMuted: '#6B7280',
  sectionLabel: '#9097A1',
} as const

export const darkTheme = {
  canvas: '#121417',
  sunken: '#1A1D21',
  surface: '#20242A',
  border: '#2C313A',
  primary: '#4C8DFF',
  primaryHover: '#6BA1FF',
  navActiveBg: '#1E2A44',
  infoBg: '#16233B',
  infoBorder: '#274063',
  textPrimary: '#E6E9ED',
  textMuted: '#9BA3AE',
  sectionLabel: '#9097A1',
} as const

/** High-contrast wall / kiosk floor monitors (10 ft readability). */
export const wallTheme = {
  canvas: '#0B0D10',
  surface: '#161A20',
  surfaceElevated: '#1E242C',
  border: '#343B46',
  textPrimary: '#F0F2F5',
  textMuted: '#A0A8B4',
  shadowHero: '0 4px 24px rgba(0,0,0,0.35)',
  shadowTile: '0 2px 12px rgba(0,0,0,0.22)',
  typeRamp: { hero: 56, kpi: 40, label: 14, caption: 12 },
} as const

/** CSS custom properties injected for wall boards (see widgetTheme). */
export const wallCssVars = {
  '--coee-wall-canvas': wallTheme.canvas,
  '--coee-wall-surface': wallTheme.surface,
  '--coee-wall-surface-elevated': wallTheme.surfaceElevated,
  '--coee-wall-border': wallTheme.border,
  '--coee-wall-shadow-hero': wallTheme.shadowHero,
  '--coee-wall-shadow-tile': wallTheme.shadowTile,
} as const

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'stale'
  | 'disconnected'
  | 'faulted'

/** Live connection → status color map (kept in sync by AppearanceProvider). */
export const connectionColor: Record<ConnectionStatus, string> = {
  connected: defaultStatusColors.running,
  connecting: defaultStatusColors.warning,
  stale: defaultStatusColors.warning,
  disconnected: defaultStatusColors.fault,
  faulted: defaultStatusColors.fault,
}

/** Shipped defaults for OEE factor identity — overridden at runtime via Admin → Appearance. */
export const oeeFactorColors = {
  oee: { hex: defaultStatusColors.running, mantine: 'teal.6' },
  availability: { hex: lightTheme.primary, mantine: 'blue.6' },
  performance: { hex: '#6366F1', mantine: 'indigo.5' },
  quality: { hex: '#9333EA', mantine: 'grape.6' },
} as const

export type OeeFactorKey = keyof typeof oeeFactorColors

export function factorKeyFromField(field?: string | null): OeeFactorKey | null {
  switch (field) {
    case 'oeePct':
      return 'oee'
    case 'availabilityPct':
      return 'availability'
    case 'performancePct':
      return 'performance'
    case 'qualityPct':
      return 'quality'
    default:
      return null
  }
}
