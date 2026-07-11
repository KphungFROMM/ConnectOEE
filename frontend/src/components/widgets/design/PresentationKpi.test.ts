import { describe, expect, it } from 'vitest'
import { resolveKpiPresentation } from './PresentationKpi'
import {
  PRESENTATION_WIDGET_TYPES,
  supportsFrameVariant,
  kpiAccentColor,
  resolveKpiColorMode,
  kpiBandHexColor,
} from '../common'
import { oeeFactorColors, lightTheme, statusColors } from '../../../theme/tokens'

describe('PresentationKpi helpers', () => {
  it('resolves known presentations', () => {
    expect(resolveKpiPresentation('ring')).toBe('ring')
    expect(resolveKpiPresentation('bar')).toBe('bar')
    expect(resolveKpiPresentation('spark')).toBe('spark')
    expect(resolveKpiPresentation('number')).toBe('number')
    expect(resolveKpiPresentation('ringSpark')).toBe('ringSpark')
    expect(resolveKpiPresentation('barSpark')).toBe('barSpark')
    expect(resolveKpiPresentation('tile')).toBe('tile')
    expect(resolveKpiPresentation('delta')).toBe('delta')
    expect(resolveKpiPresentation('gauge')).toBe('gauge')
  })

  it('falls back to number for unknown values', () => {
    expect(resolveKpiPresentation(undefined)).toBe('number')
    expect(resolveKpiPresentation('nope')).toBe('number')
  })
})

describe('frame / presentation coverage', () => {
  it('supports frame variants for typical widgets', () => {
    expect(supportsFrameVariant('kpi-tile')).toBe(true)
    expect(supportsFrameVariant('connection-stale')).toBe(true)
    expect(supportsFrameVariant('divider')).toBe(false)
  })

  it('lists presentation-capable KPI types', () => {
    expect(PRESENTATION_WIDGET_TYPES.has('kpi-tile')).toBe(true)
    expect(PRESENTATION_WIDGET_TYPES.has('mttr-tile')).toBe(true)
    expect(PRESENTATION_WIDGET_TYPES.has('divider')).toBe(false)
  })
})

describe('kpiAccentColor', () => {
  it('defaults to factor identity even when value kind would have been number', () => {
    expect(kpiAccentColor({ field: 'availabilityPct', value: 99 })).toBe(oeeFactorColors.availability.hex)
    expect(kpiAccentColor({ field: 'performancePct', value: 100 })).toBe(oeeFactorColors.performance.hex)
    expect(kpiAccentColor({ field: 'qualityPct', value: 97 })).toBe(oeeFactorColors.quality.hex)
    expect(kpiAccentColor({ field: 'oeePct', value: 85 })).toBe(oeeFactorColors.oee.hex)
  })

  it('band mode uses target-scaled explorer tiers', () => {
    expect(resolveKpiColorMode('band')).toBe('band')
    expect(
      kpiAccentColor({ field: 'oeePct', value: 90, mode: 'band', connectionState: 'Connected', targetOeePct: 85 }),
    ).toBe(oeeFactorColors.oee.hex)
    expect(kpiBandHexColor(60, 'Connected', 85)).toBe(statusColors.warning)
    expect(kpiBandHexColor(40, 'Connected', 85)).toBe(statusColors.fault)
    expect(kpiBandHexColor(75, 'Connected', 85)).toBe(lightTheme.primary)
  })
})
