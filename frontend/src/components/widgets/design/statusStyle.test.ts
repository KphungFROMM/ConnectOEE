import { describe, expect, it } from 'vitest'
import {
  defaultStatusStyleForType,
  resolveStatusStyle,
  STATUS_STYLE_WIDGET_TYPES,
} from './statusStyle'

describe('statusStyle', () => {
  it('resolves known styles', () => {
    expect(resolveStatusStyle('beacon')).toBe('beacon')
    expect(resolveStatusStyle('pill')).toBe('pill')
    expect(resolveStatusStyle('tower')).toBe('tower')
    expect(resolveStatusStyle('strip')).toBe('strip')
    expect(resolveStatusStyle('minimal')).toBe('minimal')
  })

  it('falls back for unknown values', () => {
    expect(resolveStatusStyle(undefined)).toBe('beacon')
    expect(resolveStatusStyle('nope', 'tower')).toBe('tower')
  })

  it('defaults andon to tower on kiosk and strip on plant', () => {
    expect(defaultStatusStyleForType('andon-stack', 'kioskWall')).toBe('tower')
    expect(defaultStatusStyleForType('andon-stack', 'plantWall')).toBe('strip')
  })

  it('covers status widget types', () => {
    expect(STATUS_STYLE_WIDGET_TYPES.has('run-state-badge')).toBe(true)
    expect(STATUS_STYLE_WIDGET_TYPES.has('andon-stack')).toBe(true)
    expect(STATUS_STYLE_WIDGET_TYPES.has('oee-traffic-light')).toBe(true)
  })
})
