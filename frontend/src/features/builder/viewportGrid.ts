import { GRID_GAP, GRID_ROW_HEIGHT } from './gridConstants'
import { DISPLAY_PROFILES, type DisplayProfileId } from './displayProfiles'

export function dashboardMaxRow(widgets: { y: number; h: number }[]): number {
  if (widgets.length === 0) return 1
  return Math.max(1, ...widgets.map((w) => w.y + w.h))
}

/** Pixel height of grid at fixed row height (builder freeform). */
export function gridPixelHeight(maxRow: number, rowHeight = GRID_ROW_HEIGHT, gap = GRID_GAP): number {
  if (maxRow <= 0) return 0
  return maxRow * rowHeight + (maxRow - 1) * gap
}

/** Dynamic row height to fill a wall viewport without scrolling. */
export function computeWallRowHeight(
  maxRow: number,
  profileId: DisplayProfileId,
  containerHeight?: number,
): number {
  const profile = DISPLAY_PROFILES[profileId]
  const gap = profile.gridGap
  const viewportH = containerHeight ?? profile.viewportHeight
  const available = viewportH - profile.chromeHeight - gap * Math.max(0, maxRow - 1)
  return Math.max(profile.minRowHeight, Math.floor(available / maxRow))
}

/** Content area height inside a 1080p profile (after chrome). */
export function profileContentHeight(profileId: DisplayProfileId): number {
  const p = DISPLAY_PROFILES[profileId]
  return p.viewportHeight - p.chromeHeight
}
