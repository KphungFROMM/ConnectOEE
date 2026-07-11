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

/**
 * How many rows to divide the wall height into.
 * Under budget → use profile budget (stable cell size, empty band at bottom).
 * Over budget → use occupied rows (shrink to fit).
 */
export function wallFitRowCount(occupiedMaxRow: number, profileId: DisplayProfileId): number {
  const budget = DISPLAY_PROFILES[profileId].maxRows
  const occupied = Math.max(1, occupiedMaxRow)
  if (budget == null) return occupied
  return Math.max(budget, occupied)
}

/**
 * Dynamic row height for wall-fit grids.
 * `contentHeight` is the grid area only (chrome already outside the container).
 * When omitted, uses the profile's full 1080p content band.
 * Min row height scales with content height so builder stages match floor proportions.
 */
export function computeWallRowHeight(
  maxRow: number,
  profileId: DisplayProfileId,
  contentHeight?: number,
): number {
  const profile = DISPLAY_PROFILES[profileId]
  const gap = profile.gridGap
  const rows = Math.max(1, maxRow)
  const fullContent = profile.viewportHeight - profile.chromeHeight
  const contentH = contentHeight ?? fullContent
  const scale = fullContent > 0 ? contentH / fullContent : 1
  const minH = Math.max(24, Math.floor(profile.minRowHeight * scale))
  const available = contentH - gap * Math.max(0, rows - 1)
  return Math.max(minH, Math.floor(available / rows))
}

/** Content area height inside a 1080p profile (after chrome). */
export function profileContentHeight(profileId: DisplayProfileId): number {
  const p = DISPLAY_PROFILES[profileId]
  return p.viewportHeight - p.chromeHeight
}

/** Shared builder edit/preview stage — scaled wall content, not a distorted 16:9 box. */
export const WALL_STAGE_MAX_WIDTH = 960

export function wallStageHeightForWidth(width: number, profileId: DisplayProfileId): number {
  const p = DISPLAY_PROFILES[profileId]
  const contentH = p.viewportHeight - p.chromeHeight
  const w = Math.min(Math.max(1, width), WALL_STAGE_MAX_WIDTH)
  return Math.max(1, Math.round((w * contentH) / p.viewportWidth))
}
