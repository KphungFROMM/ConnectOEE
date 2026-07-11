import { describe, expect, it } from 'vitest'
import { resolveCssColorToHex } from './resolveCssColor'

describe('resolveCssColorToHex', () => {
  it('passes through #RRGGBB', () => {
    expect(resolveCssColorToHex('#2563eb')).toBe('#2563EB')
  })

  it('expands #RGB', () => {
    expect(resolveCssColorToHex('#0f0')).toBe('#00FF00')
  })

  it('resolves common CSS names', () => {
    expect(resolveCssColorToHex('blue')).toBe('#0000FF')
    expect(resolveCssColorToHex('RED')).toBe('#FF0000')
    expect(resolveCssColorToHex('cyan')).toBe('#00FFFF')
    expect(resolveCssColorToHex('purple')).toBe('#800080')
    expect(resolveCssColorToHex('rebeccapurple')).toBe('#663399')
  })

  it('rejects empty / unknown', () => {
    expect(resolveCssColorToHex('')).toBeNull()
    expect(resolveCssColorToHex('not-a-color')).toBeNull()
  })
})
