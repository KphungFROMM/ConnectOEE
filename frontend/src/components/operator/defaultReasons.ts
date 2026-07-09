/** Fallback reasons when no downtime reason catalog exists yet. */
export const DEFAULT_DOWNTIME_REASONS: { label: string; category: string }[] = [
  { label: 'Changeover', category: 'SetupAndAdjustment' },
  { label: 'Material shortage', category: 'SmallStop' },
  { label: 'Mechanical jam', category: 'Breakdown' },
  { label: 'Maintenance', category: 'Breakdown' },
  { label: 'Quality check', category: 'SmallStop' },
  { label: 'Planned break', category: 'SetupAndAdjustment' },
]
