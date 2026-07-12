/** Last-resort UI when the reason-catalog API fails. Prefer Admin → Reason catalog (DB) as the source of truth. */
export const DEFAULT_DOWNTIME_REASONS: { label: string; category: string }[] = [
  { label: 'Changeover', category: 'SetupAndAdjustment' },
  { label: 'Material shortage', category: 'SmallStop' },
  { label: 'Mechanical jam', category: 'Breakdown' },
  { label: 'Maintenance', category: 'Breakdown' },
  { label: 'Quality check', category: 'SmallStop' },
  { label: 'Planned break', category: 'SetupAndAdjustment' },
]
