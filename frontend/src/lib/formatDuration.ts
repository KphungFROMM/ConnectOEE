/** Minute-valued KPI fields displayed as Xh Ym in the UI. */
const DURATION_MINUTES_FIELDS = new Set([
  'uptimeMin',
  'downtimeMin',
  'plannedDowntimeMin',
  'unplannedDowntimeMin',
  'availabilityLossMin',
  'performanceLossMin',
  'qualityLossMin',
  'mttrMin',
  'mtbfMin',
  'mttfMin',
  'mttdMin',
  'meanLostTimePerDowntimeMin',
])

/** Always show both parts: 0h 7m, 1h 37m */
export function formatDurationMinutes(minutes: number): string {
  const total = Math.max(0, Math.round(minutes))
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}h ${m}m`
}

/** Round seconds to nearest minute, then format as Xh Ym */
export function formatDurationSeconds(seconds: number): string {
  return formatDurationMinutes(seconds / 60)
}

export function isDurationMinutesField(field: string | null | undefined): boolean {
  return !!field && DURATION_MINUTES_FIELDS.has(field)
}

export function formatMetricDuration(field: string, value: number): string | null {
  if (!isDurationMinutesField(field)) return null
  return formatDurationMinutes(value)
}
