import { getMetricHelp } from './metricHelp'
import type { ContextHelpEntry } from './types'

export const CONTEXT_HELP: Record<string, ContextHelpEntry> = {
  'shift.plantTimezone': {
    id: 'shift.plantTimezone',
    title: 'Plant timezone',
    summary: 'Shift start/end times use the plant timezone, not your browser clock.',
    definition:
      "Shift boundaries are evaluated in the plant's configured timezone. If the header countdown looks wrong, set the plant timezone under Admin → Hierarchy to match the wall clock at the plant.",
    bullets: [
      'Pattern times (e.g. 14:00–22:00) are plant-local.',
      'The header pill shows time remaining until shift end in plant time.',
      'Hover the shift pill when plant and browser timezones differ.',
    ],
  },
  'shift.assignment': {
    id: 'shift.assignment',
    title: 'Shift assignment',
    summary: 'A saved pattern must be assigned to a plant or line to drive live shifts.',
    definition:
      'Without an assignment, lines fall back to an all-day shift and the header shows "No shift assigned". Assign a pattern with an effective date at or before today.',
  },
  'connection.state': {
    id: 'connection.state',
    title: 'Connection state',
    summary: 'Header status is API health; Plant Explorer pills show PLC live data per node.',
    definition:
      'The header indicator reflects whether your browser can reach the ConnectOEE API and database. In Plant Explorer, each node also shows a Live/Offline pill that reflects whether that machine or line has a current PLC snapshot.',
    bullets: [
      'System OK — API and database are reachable; the app is running.',
      'Live (tree pill) — PLC driver is polling and ingesting data for that node.',
      'Offline (tree pill) — no live snapshot yet; check PLC connections and tag mapping.',
      'Stale / Faulted — driver connected but data is old or errored.',
    ],
  },
  'tag.mapping': {
    id: 'tag.mapping',
    title: 'Tag mapping',
    summary: 'Map PLC tags to ConnectOEE signals so OEE and downtime can be calculated.',
    definition: 'Required signals (run state, good/reject counts) must be mapped before commissioning passes. Optional signals enrich analytics.',
    bullets: [
      'Good/reject: cumulative delta or pulse ingest.',
      'Run state: drives availability and downtime detection.',
      'Part ID: enables product-aware ideal cycle and changeover tracking.',
    ],
  },
  sixBigLosses: {
    id: 'sixBigLosses',
    title: 'Six Big Losses',
    summary: 'Standard OEE loss categories used in Pareto and loss widgets.',
    definition: 'Downtime and loss events are categorized for root-cause analysis.',
    bullets: [
      'Breakdowns — unplanned equipment failures.',
      'Setup & adjustments — changeovers, warm-up, planned setup.',
      'Small stops — micro-stops below threshold.',
      'Reduced speed — running below ideal rate.',
      'Startup rejects — scrap during startup.',
      'Production rejects — scrap during steady production.',
    ],
  },
  widgetReliability: {
    id: 'widgetReliability',
    title: 'Reliability cluster',
    summary: 'MTTR, MTBF, and related metrics for the current shift window.',
    definition:
      'Computed from downtime events in the shift. Failures = unplanned stops only; planned stops still affect MTTR and stop frequency.',
    related: ['mttrMin', 'mtbfMin', 'mttdMin'],
  },
}

export const CONTEXT_HELP_LIST = Object.values(CONTEXT_HELP)

export function getContextHelp(id: string | undefined | null): ContextHelpEntry | undefined {
  if (!id) return undefined
  return CONTEXT_HELP[id]
}

export function getHelpEntry(id: string | undefined | null) {
  return getMetricHelp(id) ?? getContextHelp(id)
}
