// ConnectOEE design tokens derived from docs/01-product-overview-ux.md.
// Neutral surfaces + single blue accent + consistent industrial status colors.

export const statusColors = {
  running: '#2E9E5B', // running / good / connected
  warning: '#E0A800', // warning / stale / reduced speed
  fault: '#D64545', // fault / stopped / disconnected
  idle: '#8A929E', // idle / planned-down / neutral
} as const

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

export type ConnectionStatus =
  | 'connected'
  | 'connecting'
  | 'stale'
  | 'disconnected'
  | 'faulted'

export const connectionColor: Record<ConnectionStatus, string> = {
  connected: statusColors.running,
  connecting: statusColors.warning,
  stale: statusColors.warning,
  disconnected: statusColors.fault,
  faulted: statusColors.fault,
}

/** Fixed identity colors for OEE factors — same metric, same color everywhere. */
export const oeeFactorColors = {
  oee: { hex: statusColors.running, mantine: 'teal.6' },
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
