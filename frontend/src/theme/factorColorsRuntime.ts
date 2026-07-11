import { oeeFactorColors, type OeeFactorKey } from './tokens'

export type FactorColorEntry = { hex: string; mantine: string }
export type FactorColorMap = Record<OeeFactorKey, FactorColorEntry>

export type AppearanceColors = {
  oeeHex: string
  availabilityHex: string
  performanceHex: string
  qualityHex: string
}

export function defaultAppearanceColors(): AppearanceColors {
  return {
    oeeHex: oeeFactorColors.oee.hex,
    availabilityHex: oeeFactorColors.availability.hex,
    performanceHex: oeeFactorColors.performance.hex,
    qualityHex: oeeFactorColors.quality.hex,
  }
}

function cloneDefaults(): FactorColorMap {
  return {
    oee: { ...oeeFactorColors.oee },
    availability: { ...oeeFactorColors.availability },
    performance: { ...oeeFactorColors.performance },
    quality: { ...oeeFactorColors.quality },
  }
}

let current: FactorColorMap = cloneDefaults()

/** Live factor identity colors — updated by AppearanceProvider after load/save. */
export function getFactorColors(): FactorColorMap {
  return current
}

export function applyAppearanceColors(colors: AppearanceColors): FactorColorMap {
  current = {
    oee: { ...current.oee, hex: colors.oeeHex },
    availability: { ...current.availability, hex: colors.availabilityHex },
    performance: { ...current.performance, hex: colors.performanceHex },
    quality: { ...current.quality, hex: colors.qualityHex },
  }
  return current
}

export function resetFactorColorsToDefaults(): FactorColorMap {
  current = cloneDefaults()
  return current
}

export function appearanceFromMap(map: FactorColorMap): AppearanceColors {
  return {
    oeeHex: map.oee.hex,
    availabilityHex: map.availability.hex,
    performanceHex: map.performance.hex,
    qualityHex: map.quality.hex,
  }
}
