import { GRID_COLS, GRID_MARGIN, GRID_ROW_HEIGHT } from './gridConstants'

export interface GridMetrics {
  width: number
  cols?: number
  rowHeight?: number
  margin?: [number, number]
  containerPadding?: [number, number]
}

/** Map viewport pointer coordinates to a snapped grid cell (react-grid-layout math). */
export function pointerToGridCell(
  clientX: number,
  clientY: number,
  containerRect: DOMRect,
  metrics: GridMetrics,
  itemW = 1,
  _itemH = 1,
  scrollLeft = 0,
  scrollTop = 0,
): { x: number; y: number } {
  const cols = metrics.cols ?? GRID_COLS
  const rowHeight = metrics.rowHeight ?? GRID_ROW_HEIGHT
  const margin = metrics.margin ?? GRID_MARGIN
  const padding = metrics.containerPadding ?? [0, 0]
  const { width } = metrics

  const innerWidth = width - padding[0] * 2
  const colWidth = (innerWidth - margin[0] * (cols - 1)) / cols

  const relX = clientX - containerRect.left + scrollLeft - padding[0]
  const relY = clientY - containerRect.top + scrollTop - padding[1]

  let x = Math.round((relX - margin[0]) / (colWidth + margin[0]))
  let y = Math.round((relY - margin[1]) / (rowHeight + margin[1]))

  x = Math.max(0, Math.min(x, cols - itemW))
  y = Math.max(0, y)

  return { x, y }
}

/** Column width in px for grid background stripes (matches RGL layout). */
export function gridColumnWidthPx(width: number, cols = GRID_COLS, margin = GRID_MARGIN, padding: [number, number] = [0, 0]) {
  const innerWidth = width - padding[0] * 2
  return (innerWidth - margin[0] * (cols - 1)) / cols + margin[0]
}

/** Row stride in px for grid background stripes. */
export function gridRowStridePx(rowHeight = GRID_ROW_HEIGHT, margin = GRID_MARGIN) {
  return rowHeight + margin[1]
}

/** Repeating grid background for empty builder canvas. */
export function builderGridBackground(width: number) {
  const colStride = gridColumnWidthPx(width)
  const rowStride = gridRowStridePx()
  const line = 'color-mix(in srgb, var(--mantine-color-default-border) 40%, transparent)'
  return (
    `repeating-linear-gradient(to right, ${line} 0 1px, transparent 1px ${colStride}px), ` +
    `repeating-linear-gradient(to bottom, ${line} 0 1px, transparent 1px ${rowStride}px)`
  )
}

/**
 * Resolve palette drop cell from pointer + optional React drag-type state.
 * Prefer `dragTypeState` during dragover (getData is often empty until drop).
 */
export function resolvePaletteDropCell(args: {
  clientX: number
  clientY: number
  containerRect: DOMRect
  metrics: GridMetrics
  itemW?: number
  itemH?: number
  scrollLeft?: number
  scrollTop?: number
  dragTypeState?: string | null
  mimeType?: string | null
}): { type: string | null; x: number; y: number } {
  const type = args.dragTypeState || args.mimeType || null
  const { x, y } = pointerToGridCell(
    args.clientX,
    args.clientY,
    args.containerRect,
    args.metrics,
    args.itemW ?? 1,
    args.itemH ?? 1,
    args.scrollLeft ?? 0,
    args.scrollTop ?? 0,
  )
  return { type, x, y }
}
