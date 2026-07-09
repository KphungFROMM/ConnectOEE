/** Optional palette descriptions, icons, visual families, and presentation hints. */
export type WidgetVisualFamily = 'oee' | 'downtime' | 'production' | 'status' | 'layout'

const FAMILY_THUMBS: Record<WidgetVisualFamily, string> = {
  oee: '/widget-thumbs/oee.svg',
  downtime: '/widget-thumbs/downtime.svg',
  production: '/widget-thumbs/production.svg',
  status: '/widget-thumbs/status.svg',
  layout: '/widget-thumbs/layout.svg',
}

export const VISUAL_FAMILY_LABELS: Record<WidgetVisualFamily, string> = {
  oee: 'OEE & KPI',
  downtime: 'Downtime & Loss',
  production: 'Production & Shift',
  status: 'Status & Machines',
  layout: 'Layout & Utility',
}

export const WIDGET_PALETTE_META: Record<
  string,
  {
    description?: string
    icon?: string
    visualFamily?: WidgetVisualFamily
    defaultVariant?: 'default' | 'hero' | 'compact' | 'kiosk'
    searchTerms?: string[]
  }
> = {
  'oee-gauge': {
    description: 'Radial OEE gauge with A/P/Q breakdown',
    icon: 'IconGauge',
    visualFamily: 'oee',
    defaultVariant: 'default',
    searchTerms: ['oee ring', 'oee gauge'],
  },
  'oee-hero': {
    description: 'Large hero OEE ring with A/P/Q mini gauges',
    icon: 'IconGauge',
    visualFamily: 'oee',
    defaultVariant: 'hero',
    searchTerms: ['oee hero', 'lobby'],
  },
  'factor-gauge': { description: 'Single A, P, or Q ring gauge', icon: 'IconChartDonut', visualFamily: 'oee' },
  'apq-cluster': { description: 'Three ring gauges for A/P/Q', icon: 'IconChartDonut', visualFamily: 'oee' },
  'kpi-tile': { description: 'Single KPI value with optional plant roll-up', icon: 'IconNumber', visualFamily: 'oee' },
  'count-tile': { description: 'Production count with good/bad tone', icon: 'IconHash', visualFamily: 'production' },
  'plant-summary-hero': {
    description: 'Plant-wide OEE, A/P/Q, TEEP strip',
    icon: 'IconBuildingFactory',
    visualFamily: 'oee',
    defaultVariant: 'hero',
  },
  'machine-grid': {
    description: 'All machines grouped by line — compact or full cards',
    icon: 'IconLayoutGrid',
    visualFamily: 'status',
    defaultVariant: 'default',
    searchTerms: ['machine status grid'],
  },
  'multi-trend': {
    description: 'Hourly OEE or single-field trend chart with optional target line',
    icon: 'IconChartLine',
    visualFamily: 'production',
  },
  'downtime-list': { description: 'Sortable downtime event table', icon: 'IconList', visualFamily: 'downtime' },
  pareto: { description: 'Downtime Pareto by loss category', icon: 'IconChartBar', visualFamily: 'downtime', searchTerms: ['pareto downtime'] },
  'losses-donut': { description: 'Six Big Losses donut chart', icon: 'IconChartDonut', visualFamily: 'downtime' },
  'andon-stack': { description: 'Stack-light tower for wall displays', icon: 'IconTrafficLights', visualFamily: 'status', defaultVariant: 'kiosk' },
  'status-light': { description: 'Machine run-state beacon', icon: 'IconActivity', visualFamily: 'status' },
  'shift-progress': { description: 'Shift elapsed and production pace', icon: 'IconClock', visualFamily: 'production' },
  'text-label': { description: 'Static title or body text block', icon: 'IconTypography', visualFamily: 'layout' },
  'live-tag-value': { description: 'Raw PLC tag with quality and timestamp', icon: 'IconCpu', visualFamily: 'layout' },
  'data-table': { description: 'Generic sortable lines or downtime table', icon: 'IconTable', visualFamily: 'layout' },
  'count-to-go': { description: 'Remaining units to hit shift target', icon: 'IconTarget', visualFamily: 'production' },
  'expected-vs-actual-count': { description: 'Good count vs expected pace at ideal rate', icon: 'IconChartBar', visualFamily: 'production' },
  'parts-loss-waterfall': { description: 'Parts lost to downtime, slow running, and quality', icon: 'IconStairsDown', visualFamily: 'production' },
  histogram: { description: 'Downtime duration bucket chart', icon: 'IconChartHistogram', visualFamily: 'downtime' },
  'unattributed-downtime-counter': {
    description: 'Count of downtime events awaiting operator reason',
    icon: 'IconAlertTriangle',
    visualFamily: 'downtime',
  },
  'shift-comparison-card': {
    description: 'Current vs prior shift OEE, A, P, Q comparison',
    icon: 'IconArrowsLeftRight',
    visualFamily: 'production',
  },
  'oee-waterfall': { description: 'OEE loss waterfall bridge', icon: 'IconChartBar', visualFamily: 'oee' },
  'line-leaderboard': { description: 'Horizontal OEE ranking bars', icon: 'IconChartBar', visualFamily: 'oee' },
  'event-feed': { description: 'Live downtime and fault feed', icon: 'IconList', visualFamily: 'downtime' },
  'reliability-cluster': {
    description: 'MTTR, MTBF, MTTF, MTTD, stops/hr, and mean lost time grid',
    icon: 'IconTool',
    visualFamily: 'downtime',
  },
  'plant-grid': { description: 'Line-level KPI card grid', icon: 'IconLayoutGrid', visualFamily: 'status' },
  'sparkline-tile': { description: 'Mini trend sparkline KPI', icon: 'IconChartLine', visualFamily: 'production' },
  'teep-tile': { description: 'TEEP % KPI tile', icon: 'IconGauge', visualFamily: 'oee' },
  'mttr-tile': { description: 'Mean time to repair', icon: 'IconTool', visualFamily: 'downtime' },
  'mtbf-tile': { description: 'Mean time between failures', icon: 'IconTool', visualFamily: 'downtime' },
  'oee-traffic-light': { description: 'Large OEE % with green/amber/red status', icon: 'IconGauge', visualFamily: 'oee' },
  'gap-cluster': { description: 'A/P/Q gap vs target cluster', icon: 'IconChartBar', visualFamily: 'oee' },
  'shift-context-strip': { description: 'Shift name, window, and elapsed time', icon: 'IconClock', visualFamily: 'production' },
  'active-downtime-timer': { description: 'Live downtime duration for current stop', icon: 'IconPlayerPause', visualFamily: 'downtime' },
  'quick-links-bar': { description: 'Navigation shortcuts to Explorer, Analytics, Operator', icon: 'IconLink', visualFamily: 'layout' },
  'line-status-strip': { description: 'Horizontal line status pills with OEE', icon: 'IconLayoutGrid', visualFamily: 'status' },
  'pace-gauge': { description: 'Actual vs ideal rate pace indicator', icon: 'IconGauge', visualFamily: 'production' },
  'recipe-product-strip': { description: 'Active recipe and product context', icon: 'IconPackage', visualFamily: 'production' },
  'unassigned-stops-banner': { description: 'Count of unassigned downtime stops', icon: 'IconAlertTriangle', visualFamily: 'downtime' },
}

const CATEGORY_FAMILY: Record<string, WidgetVisualFamily> = {
  'KPI & OEE': 'oee',
  'Reliability & downtime': 'downtime',
  'Charts & trends': 'production',
  'Production & shift': 'production',
  'State & status': 'status',
  Interactive: 'layout',
  'Layout, media & utility': 'layout',
  'Tables & lists': 'layout',
}

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'attainment-tile': 'Run and shift production attainment bars',
  'state-time-breakdown': 'Shift time by run state (idle, down, starved…)',
  'target-vs-actual': 'A/P/Q/OEE bars vs line-configured targets',
  'machine-grid': 'Live machine cards grouped by line',
  'plant-grid': 'Line-level KPI summary cards',
  'time-series-trend': 'Historian trend for OEE or bound field',
  'hourly-production-bar': 'Hourly good/reject production bars',
  'operator-downtime-pad': 'Touch-friendly downtime reason entry',
  'plc-write-controls': 'Supervisor PLC write actions (permission gated)',
  'navigation-drill': 'Drill-through link to Explorer or Analytics',
  'clock-date': 'Live plant clock and date display',
  'marquee-ticker': 'Scrolling announcement ticker',
  'iframe-embed': 'Embed external URL in dashboard frame',
  'container-panel': 'Visual section container with title',
  'tabbed-panel': 'Tabbed layout container',
}

const CATEGORY_ICONS: Record<string, string> = {
  'KPI & OEE': 'IconGauge',
  'Reliability & downtime': 'IconTool',
  'Charts & trends': 'IconChartLine',
  'Production & shift': 'IconClock',
  'State & status': 'IconActivity',
  Interactive: 'IconClick',
  'Layout, media & utility': 'IconLayout',
  'Tables & lists': 'IconTable',
}

export function enrichWidgetMeta<T extends { type: string; label: string; category?: string }>(
  item: T,
): T & {
  description?: string
  icon?: string
  visualFamily?: WidgetVisualFamily
  thumbnail?: string
  defaultVariant?: string
  searchTerms?: string[]
} {
  const extra = WIDGET_PALETTE_META[item.type]
  const categoryIcon = item.category ? CATEGORY_ICONS[item.category] : 'IconBox'
  const family = extra?.visualFamily ?? (item.category ? CATEGORY_FAMILY[item.category] : undefined)
  return {
    ...item,
    description: extra?.description ?? CATEGORY_DESCRIPTIONS[item.type] ?? `${item.label} for ${item.category ?? 'dashboards'}`,
    icon: extra?.icon ?? categoryIcon,
    visualFamily: family,
    thumbnail: family ? FAMILY_THUMBS[family] : undefined,
    defaultVariant: extra?.defaultVariant,
    searchTerms: extra?.searchTerms,
  }
}

export function matchesPaletteSearch(
  item: { label: string; type: string; description?: string; category?: string; searchTerms?: string[] },
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const hay = [item.label, item.type, item.description, item.category, ...(item.searchTerms ?? [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(q)
}
