/** Metric glossary entry — keep in sync with docs/06-oee-engine-metrics.md and OeeCalculator / ReliabilityCalculator. */
export type MetricHelpCategory = 'oee' | 'reliability' | 'production' | 'loss' | 'rate' | 'operational'

export interface MetricHelpEntry {
  id: string
  title: string
  summary: string
  definition?: string
  formula?: string
  unit?: string
  caveats?: string[]
  related?: string[]
  category: MetricHelpCategory
}

export interface ContextHelpEntry {
  id: string
  title: string
  summary: string
  definition?: string
  bullets?: string[]
  related?: string[]
}

export type HelpEntry = MetricHelpEntry | ContextHelpEntry

export function isMetricHelp(entry: HelpEntry): entry is MetricHelpEntry {
  return 'category' in entry
}
