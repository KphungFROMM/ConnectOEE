/** Parts per hour from cycle time in seconds. */
export function cycleSecToPph(sec: number): number {
  return sec > 0 ? Math.round(3600 / sec) : 0
}

/** Human label for resolver source codes on live snapshots. */
export function idealCycleSourceLabel(source?: string | null): string {
  switch (source) {
    case 'line-rate':
      return 'line speed'
    case 'product-default':
      return 'catalog default'
    case 'line-default':
      return 'line fallback'
    default:
      return ''
  }
}

export type LineProductionMode = 'MultiProduct' | 'DedicatedProduct' | 'NoProductTracking'

export type ChangeoverMode = 'SetupTracked' | 'LogOnly'

export type ReworkTrackingMode = 'Off' | 'Auto' | 'On'

export const REWORK_TRACKING_OPTIONS: { value: ReworkTrackingMode; label: string; description: string }[] = [
  {
    value: 'Auto',
    label: 'Auto (when mapped)',
    description: 'Track rework and FPY only when a Rework Count tag is mapped on this line.',
  },
  {
    value: 'Off',
    label: 'Off',
    description: 'Hide rework KPIs — typical for food, beverage, and simple discrete lines.',
  },
  {
    value: 'On',
    label: 'Always on',
    description: 'Show rework KPIs even before a tag is mapped (count stays 0 until mapped).',
  },
]

export const CHANGEOVER_MODE_OPTIONS: { value: ChangeoverMode; label: string; description: string }[] = [
  {
    value: 'SetupTracked',
    label: 'Setup changeover (tracks downtime)',
    description: 'Product changes create planned setup downtime until the line returns to Running.',
  },
  {
    value: 'LogOnly',
    label: 'Quick changeover (log only)',
    description: 'Product changes update ideal rate and ProductionRun history only — no auto downtime events.',
  },
]

export const LINE_PRODUCTION_MODE_OPTIONS: { value: LineProductionMode; label: string; description: string }[] = [
  {
    value: 'MultiProduct',
    label: 'Mixed products',
    description: 'Ideal follows active SKU: line speed → catalog → line fallback.',
  },
  {
    value: 'DedicatedProduct',
    label: 'Dedicated single product',
    description: 'One SKU on this line — keep line fallback aligned with that product’s line speed.',
  },
  {
    value: 'NoProductTracking',
    label: 'No product tracking',
    description: 'Performance uses the line fallback rate only (no PartId / recipes).',
  },
]

export const LINE_TOPOLOGY_OPTIONS: {
  value: import('./lineTopology').LineTopologyMode
  label: string
  description: string
}[] = [
  {
    value: 'Independent',
    label: 'Independent machines',
    description: 'Stations are parallel peers — line counts sum all machines; A/P average across stations.',
  },
  {
    value: 'Continuous',
    label: 'Continuous line',
    description: 'Serial stations — line good/reject from the output machine; performance uses the pacing station.',
  },
]
