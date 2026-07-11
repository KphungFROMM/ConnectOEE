export type StatusStyle = 'beacon' | 'pill' | 'minimal' | 'tower' | 'strip'

export const STATUS_STYLE_OPTIONS: { value: StatusStyle; label: string }[] = [
  { value: 'beacon', label: 'beacon' },
  { value: 'pill', label: 'pill' },
  { value: 'minimal', label: 'minimal' },
  { value: 'tower', label: 'tower' },
  { value: 'strip', label: 'strip' },
]

/** Widgets that expose options.statusStyle. */
export const STATUS_STYLE_WIDGET_TYPES = new Set([
  'run-state-badge',
  'status-light',
  'andon-stack',
  'oee-traffic-light',
  'line-status-indicator',
])

export function resolveStatusStyle(raw: unknown, fallback: StatusStyle = 'beacon'): StatusStyle {
  if (raw === 'beacon' || raw === 'pill' || raw === 'minimal' || raw === 'tower' || raw === 'strip') {
    return raw
  }
  return fallback
}

export function defaultStatusStyleForType(type: string, profile: 'kioskWall' | 'plantWall' | 'builderFreeform'): StatusStyle {
  if (type === 'andon-stack') {
    return profile === 'plantWall' ? 'strip' : 'tower'
  }
  if (type === 'oee-traffic-light') {
    return profile === 'kioskWall' ? 'beacon' : 'pill'
  }
  if (profile === 'kioskWall') return 'beacon'
  if (profile === 'plantWall') return 'pill'
  return 'beacon'
}
