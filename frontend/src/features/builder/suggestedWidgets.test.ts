import { describe, expect, it } from 'vitest'
import { packWidgetsOnGrid, suggestedWidgetTypes } from './suggestedWidgets'

describe('suggestedWidgets', () => {
  it('suggests kiosk-oriented widgets for kioskWall + line', () => {
    const types = suggestedWidgetTypes({
      displayProfile: 'kioskWall',
      plantId: 'p1',
      lineId: 'l1',
      machineId: null,
    })
    expect(types).toContain('oee-hero')
    expect(types).toContain('andon-stack')
    expect(types.length).toBeGreaterThanOrEqual(4)
  })

  it('packs suggested widgets without overlapping columns', () => {
    const packed = packWidgetsOnGrid(
      ['oee-hero', 'andon-stack', 'connection-stale'],
      { lineId: 'l1', plantId: 'p1' },
      'kioskWall',
    )
    expect(packed.length).toBe(3)
    for (const w of packed) {
      expect(w.x + w.w).toBeLessThanOrEqual(12)
      expect(w.options.frameVariant || w.options.presentation).toBeTruthy()
    }
  })
})
