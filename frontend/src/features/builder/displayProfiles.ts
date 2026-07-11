/** Wall-display row budgets for 1080p floor monitors (no scroll). */
export type DisplayProfileId = 'kioskWall' | 'plantWall' | 'builderFreeform'

export interface DisplayProfile {
  id: DisplayProfileId
  label: string
  maxRows: number | null
  viewportWidth: number
  viewportHeight: number
  chromeHeight: number
  minRowHeight: number
  gridGap: number
}

export const DISPLAY_PROFILES: Record<DisplayProfileId, DisplayProfile> = {
  kioskWall: {
    id: 'kioskWall',
    label: 'Kiosk 1080p',
    maxRows: 8,
    viewportWidth: 1920,
    viewportHeight: 1080,
    chromeHeight: 48,
    minRowHeight: 72,
    gridGap: 12,
  },
  plantWall: {
    id: 'plantWall',
    label: 'Wall 1080p',
    maxRows: 9,
    viewportWidth: 1920,
    viewportHeight: 1080,
    chromeHeight: 48,
    minRowHeight: 64,
    gridGap: 12,
  },
  builderFreeform: {
    id: 'builderFreeform',
    label: 'Freeform',
    maxRows: null,
    viewportWidth: 1920,
    viewportHeight: 1080,
    chromeHeight: 0,
    minRowHeight: 64,
    gridGap: 12,
  },
}

export const KIOSK_TEMPLATE_NAMES = new Set([
  'Operator Floor',
  'Line Andon',
  'Maintenance Wall',
])

export function profileForDashboard(scope: string, name?: string): DisplayProfileId {
  if (scope === 'PublicKiosk') return 'kioskWall'
  if (name && KIOSK_TEMPLATE_NAMES.has(name)) return 'kioskWall'
  return 'plantWall'
}

export function exceedsProfile(maxRow: number, profileId: DisplayProfileId): boolean {
  const max = DISPLAY_PROFILES[profileId].maxRows
  return max !== null && maxRow > max
}
