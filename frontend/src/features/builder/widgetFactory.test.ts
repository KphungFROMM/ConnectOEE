import { describe, expect, it } from 'vitest'
import type { DashboardWidget } from '../../lib/dashboards'
import { clickAddPosition, defaultBinding, defaultOptions } from './widgetFactory'
import { MOCK_LINE_ID, MOCK_PLANT_ID } from './mockWidgetCtx'

describe('widgetFactory', () => {
  it('clickAddPosition appends below lowest widget', () => {
    const widgets: DashboardWidget[] = [
      { id: 'a', type: 'kpi-tile', title: 'A', x: 0, y: 0, w: 3, h: 2, binding: {}, options: {} },
      { id: 'b', type: 'kpi-tile', title: 'B', x: 0, y: 5, w: 3, h: 3, binding: {}, options: {} },
    ]
    expect(clickAddPosition('kpi-tile', widgets).y).toBe(8)
  })

  it('defaultBinding uses line scope when lineId present', () => {
    const binding = defaultBinding('kpi-tile', { lineId: MOCK_LINE_ID, plantId: MOCK_PLANT_ID })
    expect(binding.source).toBe('line')
    expect(binding.field).toBeTruthy()
  })

  it('defaultOptions sets targets for count widgets', () => {
    expect(defaultOptions('count-to-target').target).toBe(5500)
    expect(defaultOptions('target-pace-tile').target).toBe(5500)
  })

  it('defaultBinding includes tag path for live-tag-value', () => {
    const binding = defaultBinding('live-tag-value', {})
    expect(binding.tagPath).toBeTruthy()
    expect(binding.connectionId).toBeTruthy()
  })
})
