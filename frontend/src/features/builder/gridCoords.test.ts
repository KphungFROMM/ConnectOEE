import { describe, expect, it } from 'vitest'
import { pointerToGridCell, resolvePaletteDropCell } from './gridCoords'
import { GRID_COLS, GRID_MARGIN, GRID_ROW_HEIGHT } from './gridConstants'

const WIDTH = 1200
const rect = new DOMRect(100, 50, WIDTH, 800)

describe('pointerToGridCell', () => {
  it('maps pointer at top-left to cell (0,0) when not scrolled', () => {
    const { x, y } = pointerToGridCell(100, 50, rect, { width: WIDTH }, 1, 1, 0, 0)
    expect(x).toBe(0)
    expect(y).toBe(0)
  })

  it('accounts for scrollTop when mapping Y coordinate', () => {
    const rowStride = GRID_ROW_HEIGHT + GRID_MARGIN[1]
    const scrollTop = rowStride * 5
    const clientY = rect.top + 20
    const { y } = pointerToGridCell(rect.left, clientY, rect, { width: WIDTH }, 1, 1, 0, scrollTop)
    expect(y).toBe(5)
  })

  it('clamps X within grid columns minus item width', () => {
    const { x } = pointerToGridCell(rect.right - 1, rect.top, rect, { width: WIDTH }, 3, 2, 0, 0)
    expect(x).toBe(GRID_COLS - 3)
  })

  it('never returns negative coordinates', () => {
    const { x, y } = pointerToGridCell(rect.left - 50, rect.top - 50, rect, { width: WIDTH }, 1, 1, 0, 0)
    expect(x).toBeGreaterThanOrEqual(0)
    expect(y).toBeGreaterThanOrEqual(0)
  })
})

describe('resolvePaletteDropCell', () => {
  it('prefers React drag-type state over empty MIME during dragover', () => {
    const result = resolvePaletteDropCell({
      clientX: rect.left + 40,
      clientY: rect.top + 40,
      containerRect: rect,
      metrics: { width: WIDTH },
      itemW: 4,
      itemH: 4,
      dragTypeState: 'downtime-list',
      mimeType: null,
    })
    expect(result.type).toBe('downtime-list')
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('falls back to MIME type when state is cleared', () => {
    const result = resolvePaletteDropCell({
      clientX: rect.left,
      clientY: rect.top,
      containerRect: rect,
      metrics: { width: WIDTH },
      dragTypeState: null,
      mimeType: 'pareto',
    })
    expect(result.type).toBe('pareto')
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('maps scrolled drop using state type + pointer', () => {
    const rowStride = GRID_ROW_HEIGHT + GRID_MARGIN[1]
    const result = resolvePaletteDropCell({
      clientX: rect.left + 10,
      clientY: rect.top + 10,
      containerRect: rect,
      metrics: { width: WIDTH },
      itemW: 3,
      scrollTop: rowStride * 8,
      dragTypeState: 'oee-gauge',
    })
    expect(result.type).toBe('oee-gauge')
    expect(result.y).toBe(8)
  })
})
