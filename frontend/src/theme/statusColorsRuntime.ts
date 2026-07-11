import { defaultStatusColors, statusColors, connectionColor, type StatusColorKey } from './tokens'

export type AppearanceStatusColors = {
  runningHex: string
  warningHex: string
  faultHex: string
  idleHex: string
}

export function defaultAppearanceStatusColors(): AppearanceStatusColors {
  return {
    runningHex: defaultStatusColors.running,
    warningHex: defaultStatusColors.warning,
    faultHex: defaultStatusColors.fault,
    idleHex: defaultStatusColors.idle,
  }
}

/** Live industrial status colors — updated by AppearanceProvider after load/save. */
export function getStatusColors(): Record<StatusColorKey, string> {
  return statusColors
}

export function applyStatusColors(colors: AppearanceStatusColors): Record<StatusColorKey, string> {
  statusColors.running = colors.runningHex
  statusColors.warning = colors.warningHex
  statusColors.fault = colors.faultHex
  statusColors.idle = colors.idleHex
  connectionColor.connected = colors.runningHex
  connectionColor.connecting = colors.warningHex
  connectionColor.stale = colors.warningHex
  connectionColor.disconnected = colors.faultHex
  connectionColor.faulted = colors.faultHex
  return statusColors
}

export function resetStatusColorsToDefaults(): Record<StatusColorKey, string> {
  return applyStatusColors(defaultAppearanceStatusColors())
}

export function appearanceStatusFromMap(map: Record<StatusColorKey, string>): AppearanceStatusColors {
  return {
    runningHex: map.running,
    warningHex: map.warning,
    faultHex: map.fault,
    idleHex: map.idle,
  }
}
