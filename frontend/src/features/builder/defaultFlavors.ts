import type { KpiPresentation, KpiColorMode } from '../../components/widgets/common'
import {
  PRESENTATION_WIDGET_TYPES,
  STATUS_STYLE_WIDGET_TYPES,
  supportsFrameVariant,
} from '../../components/widgets/common'
import type { WidgetFrameVariant } from '../../components/widgets/design/WidgetFrame'
import type { StatusStyle } from '../../components/widgets/design/statusStyle'
import { defaultStatusStyleForType } from '../../components/widgets/design/statusStyle'
import type { DisplayProfileId } from './displayProfiles'

export type FlavorOptions = {
  frameVariant?: WidgetFrameVariant
  presentation?: KpiPresentation
  colorMode?: KpiColorMode
  statusStyle?: StatusStyle
  cardStyle?: 'default' | 'performance'
}

/** Smart defaults from display profile — decide for the user, allow override. */
export function flavorDefaultsForType(type: string, profile: DisplayProfileId): FlavorOptions {
  const opts: FlavorOptions = {}

  if (supportsFrameVariant(type)) {
    if (profile === 'kioskWall') opts.frameVariant = 'kiosk'
    else if (type === 'oee-hero' || type === 'plant-summary-hero' || type === 'andon-stack') opts.frameVariant = 'hero'
    else opts.frameVariant = 'default'
  }

  if (PRESENTATION_WIDGET_TYPES.has(type)) {
    if (profile === 'kioskWall') opts.presentation = 'ring'
    else opts.presentation = 'number'
  }

  // Hero OEE types prefer ring even on plant wall
  if (type === 'oee-gauge' || type === 'oee-hero') {
    opts.presentation = 'ring'
  }

  if (STATUS_STYLE_WIDGET_TYPES.has(type)) {
    opts.statusStyle = defaultStatusStyleForType(type, profile)
  }

  if (type === 'machine-grid' && profile === 'plantWall') {
    opts.cardStyle = 'performance'
  }

  return opts
}
