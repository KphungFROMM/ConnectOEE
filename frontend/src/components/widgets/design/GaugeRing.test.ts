import { describe, expect, it } from 'vitest'
import { fitRingValueFontPx } from './GaugeRing'

describe('fitRingValueFontPx', () => {
  it('keeps long percentages smaller than short ones for the same hole', () => {
    const inner = 100
    const short = fitRingValueFontPx(inner, '98%')
    const long = fitRingValueFontPx(inner, '95.7%')
    expect(long).toBeLessThanOrEqual(short)
  })

  it('fits 100.0% inside a kiosk ringSpark hole (~104px)', () => {
    // size 128, thickness ~12 → inner ≈ 104
    const px = fitRingValueFontPx(104, '100.0%')
    // glyph width ≈ 0.7em → 6 chars * 0.7 * px <= 0.72 * 104
    expect(px * 6 * 0.7).toBeLessThanOrEqual(104 * 0.72 + 1)
  })

  it('keeps two-digit % clear of the stroke on small appearance preview rings', () => {
    // size 88, thickness 8 → inner 72
    const px = fitRingValueFontPx(72, '92%')
    expect(px * 3 * 0.7).toBeLessThanOrEqual(72 * 0.72 + 1)
    expect(px).toBeLessThanOrEqual(Math.floor(72 * 0.34))
  })

  it('clamps to a readable minimum', () => {
    expect(fitRingValueFontPx(20, '100.0%')).toBeGreaterThanOrEqual(11)
  })
})
