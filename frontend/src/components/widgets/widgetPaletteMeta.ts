/** Palette descriptions, icons, visual families, and presentation hints for every catalog widget. */
export type WidgetVisualFamily = 'oee' | 'downtime' | 'production' | 'status' | 'layout'

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
    description: string
    icon: string
    visualFamily: WidgetVisualFamily
    defaultVariant?: 'default' | 'hero' | 'compact' | 'kiosk'
    searchTerms?: string[]
  }
> = {
  // KPI & OEE
  'oee-gauge': {
    description: 'Radial OEE gauge with A/P/Q breakdown',
    icon: 'IconGauge',
    visualFamily: 'oee',
    defaultVariant: 'default',
    searchTerms: ['oee ring', 'oee gauge'],
  },
  'factor-gauge': { description: 'Single A, P, or Q ring gauge', icon: 'IconChartDonut', visualFamily: 'oee' },
  'kpi-tile': { description: 'Single KPI value with optional plant roll-up', icon: 'IconNumber', visualFamily: 'oee' },
  'count-tile': { description: 'Production count with good/bad tone', icon: 'IconHash', visualFamily: 'production' },
  'scrap-tile': { description: 'Scrap percentage KPI tile', icon: 'IconTrash', visualFamily: 'oee' },
  'yield-tile': { description: 'Yield percentage KPI tile', icon: 'IconPercentage', visualFamily: 'oee' },
  'fpy-tile': { description: 'First-pass yield percentage', icon: 'IconCircleCheck', visualFamily: 'oee' },
  'plant-grid': { description: 'Line-level KPI card grid', icon: 'IconLayoutGrid', visualFamily: 'status' },
  'machine-grid': {
    description: 'All machines grouped by line — compact or performance tiles',
    icon: 'IconDevicesPc',
    visualFamily: 'status',
    defaultVariant: 'default',
    searchTerms: ['machine status grid', 'machine tiles', 'performance dashboard'],
  },
  'plant-summary-hero': {
    description: 'OEE + A/P/Q strip for the selected plant, line, or machine',
    icon: 'IconBuildingFactory',
    visualFamily: 'oee',
    defaultVariant: 'hero',
    searchTerms: ['plant summary', 'line summary', 'kpi strip', 'scope summary'],
  },
  'line-leaderboard': { description: 'Horizontal OEE ranking bars', icon: 'IconTrophy', visualFamily: 'oee' },
  'worst-lines': { description: 'Lowest-performing lines by OEE', icon: 'IconArrowDown', visualFamily: 'oee' },
  'oee-hero': {
    description: 'Large hero OEE ring with A/P/Q mini gauges',
    icon: 'IconChartDonut',
    visualFamily: 'oee',
    defaultVariant: 'hero',
    searchTerms: ['oee hero', 'lobby'],
  },
  'apq-cluster': { description: 'Three ring gauges for A/P/Q', icon: 'IconCircles', visualFamily: 'oee' },
  'kpi-stat-card': { description: 'Labeled KPI with delta and unit', icon: 'IconCardboards', visualFamily: 'oee' },
  'mttr-tile': { description: 'Mean time to repair', icon: 'IconTool', visualFamily: 'downtime' },
  'mtbf-tile': { description: 'Mean time between failures', icon: 'IconHeartbeat', visualFamily: 'downtime' },
  'teep-tile': { description: 'TEEP % KPI tile', icon: 'IconChartPie', visualFamily: 'oee' },
  'total-count-tile': { description: 'Total production count', icon: 'IconSum', visualFamily: 'production' },
  'linear-gauge': { description: 'Horizontal linear KPI gauge', icon: 'IconAdjustmentsHorizontal', visualFamily: 'oee' },
  'gap-cluster': { description: 'A/P/Q gap vs target cluster', icon: 'IconArrowsDiff', visualFamily: 'oee' },

  // Reliability & downtime
  'downtime-list': { description: 'Sortable downtime event table', icon: 'IconList', visualFamily: 'downtime' },
  pareto: {
    description: 'Downtime Pareto by loss category',
    icon: 'IconChartBar',
    visualFamily: 'downtime',
    searchTerms: ['pareto downtime'],
  },
  'losses-donut': { description: 'Six Big Losses donut chart', icon: 'IconChartDonut3', visualFamily: 'downtime' },
  'reliability-panel': { description: 'MTTR/MTBF summary panel', icon: 'IconReportAnalytics', visualFamily: 'downtime' },
  'mttf-tile': { description: 'Mean time to failure', icon: 'IconClockExclamation', visualFamily: 'downtime' },
  'mttd-tile': { description: 'Mean time to detect', icon: 'IconEyeSearch', visualFamily: 'downtime' },
  'mean-lost-time': { description: 'Average lost time per stop', icon: 'IconHourglass', visualFamily: 'downtime' },
  'failure-rate': { description: 'Failures per operating hour', icon: 'IconAlertOctagon', visualFamily: 'downtime' },
  'stops-per-hour': { description: 'Stop events per hour', icon: 'IconPlayerStop', visualFamily: 'downtime' },
  'micro-stop-counter': { description: 'Count of short micro-stops', icon: 'IconBolt', visualFamily: 'downtime' },
  'planned-unplanned-split': { description: 'Planned vs unplanned downtime split', icon: 'IconChartPie2', visualFamily: 'downtime' },
  'top-fault-codes': { description: 'Top downtime reasons ranked', icon: 'IconListNumbers', visualFamily: 'downtime' },
  'downtime-heatmap': { description: 'Downtime intensity by hour/day', icon: 'IconGridDots', visualFamily: 'downtime' },
  'event-feed': { description: 'Live downtime and fault feed', icon: 'IconRss', visualFamily: 'downtime' },
  'reliability-cluster': {
    description: 'MTTR, MTBF, MTTF, MTTD, stops/hr, and mean lost time grid',
    icon: 'IconLayoutBoard',
    visualFamily: 'downtime',
  },
  'loss-minutes-bridge': { description: 'Loss minutes waterfall bridge', icon: 'IconStairsDown', visualFamily: 'downtime' },
  'time-balance': { description: 'Available vs lost time balance', icon: 'IconScale', visualFamily: 'downtime' },
  'operator-downtime-leaderboard': { description: 'Operator downtime ranking', icon: 'IconUsers', visualFamily: 'downtime' },
  'fault-code-summary': { description: 'Downtime reason summary cards', icon: 'IconTags', visualFamily: 'downtime' },
  histogram: { description: 'Downtime duration bucket chart', icon: 'IconChartHistogram', visualFamily: 'downtime' },
  'unattributed-downtime-counter': {
    description: 'Count of downtime events awaiting operator reason',
    icon: 'IconAlertTriangle',
    visualFamily: 'downtime',
  },
  'unassigned-stops-banner': { description: 'Banner for unassigned downtime stops', icon: 'IconFlag', visualFamily: 'downtime' },

  // Charts & trends
  'target-vs-actual': { description: 'A/P/Q/OEE bars vs line targets', icon: 'IconChartBarPopular', visualFamily: 'oee' },
  'hourly-production-bar': { description: 'Hourly good/reject production bars', icon: 'IconChartBar', visualFamily: 'production' },
  'scrap-trend': { description: 'Scrap rate over time', icon: 'IconTrendingDown', visualFamily: 'production' },
  'production-vs-target': { description: 'Production vs target trend', icon: 'IconChartAreaLine', visualFamily: 'production' },
  'time-series-trend': { description: 'Historian trend for OEE or bound field', icon: 'IconChartLine', visualFamily: 'production' },
  'oee-waterfall': { description: 'OEE loss waterfall bridge', icon: 'IconStairs', visualFamily: 'oee' },
  'multi-trend': {
    description: 'Hourly OEE or single-field trend with optional target',
    icon: 'IconChartDots',
    visualFamily: 'production',
  },
  'reliability-trend': { description: 'Reliability metrics over time', icon: 'IconTimeline', visualFamily: 'downtime' },
  'loss-trend': { description: 'Loss minutes trend chart', icon: 'IconChartArea', visualFamily: 'downtime' },
  'speed-trend': { description: 'Machine speed trend', icon: 'IconSpeedboat', visualFamily: 'production' },
  'sparkline-tile': { description: 'Mini trend sparkline KPI', icon: 'IconActivityHeartbeat', visualFamily: 'production' },
  'oee-by-shift': { description: 'OEE comparison across shifts', icon: 'IconChartBarOff', visualFamily: 'oee' },

  // Production & shift
  'shift-summary': { description: 'Shift production and OEE summary', icon: 'IconCalendarStats', visualFamily: 'production' },
  'attainment-tile': { description: 'Run and shift production attainment bars', icon: 'IconTargetArrow', visualFamily: 'production' },
  'current-job-banner': { description: 'Active job / work order banner', icon: 'IconBriefcase', visualFamily: 'production' },
  'production-run-list': { description: 'Recent production run summary', icon: 'IconListDetails', visualFamily: 'production' },
  'count-to-target': { description: 'Progress toward shift count target', icon: 'IconTarget', visualFamily: 'production' },
  'throughput-tile': { description: 'Units per hour throughput', icon: 'IconTransfer', visualFamily: 'production' },
  'cycle-time-tile': { description: 'Actual cycle time', icon: 'IconStopwatch', visualFamily: 'production' },
  'shift-progress': {
    description: 'Shift elapsed and production pace',
    icon: 'IconClock',
    visualFamily: 'production',
    searchTerms: ['win the shift', 'shift pace', 'shift progress'],
  },
  'shift-progress-bar': {
    description: 'Wide shift progress bar',
    icon: 'IconProgress',
    visualFamily: 'production',
    searchTerms: ['win the shift', 'shift bar'],
  },
  'cycle-time-compare': { description: 'Actual vs ideal cycle time', icon: 'IconArrowsLeftRight', visualFamily: 'production' },
  'rate-variance': { description: 'Rate variance vs ideal', icon: 'IconDelta', visualFamily: 'production' },
  'count-to-go': { description: 'Remaining units to hit shift target', icon: 'IconArrowForwardUp', visualFamily: 'production' },
  'target-pace-tile': { description: 'Required pace to hit target', icon: 'IconPlayerPlay', visualFamily: 'production' },
  'expected-vs-actual-count': {
    description: 'Good count vs expected pace at ideal rate',
    icon: 'IconChartArrows',
    visualFamily: 'production',
  },
  'parts-loss-waterfall': {
    description: 'Parts lost to downtime, slow running, and quality',
    icon: 'IconStairsDown',
    visualFamily: 'production',
  },
  'takt-vs-actual': { description: 'Takt time vs actual cycle', icon: 'IconMetronome', visualFamily: 'production' },
  'units-per-shift': { description: 'Units produced this shift', icon: 'IconBox', visualFamily: 'production' },
  'shift-comparison-card': {
    description: 'Current vs prior shift OEE, A, P, Q comparison',
    icon: 'IconArrowsExchange',
    visualFamily: 'production',
  },
  'shift-context-strip': { description: 'Shift name, window, and elapsed time', icon: 'IconCalendarTime', visualFamily: 'production' },
  'pace-gauge': { description: 'Actual vs ideal rate pace indicator', icon: 'IconGauge', visualFamily: 'production' },
  'recipe-product-strip': { description: 'Active recipe and product context', icon: 'IconPackage', visualFamily: 'production' },

  // State & status
  'status-light': { description: 'Machine run-state beacon', icon: 'IconCircleFilled', visualFamily: 'status' },
  'fault-banner': { description: 'Active fault / alarm banner', icon: 'IconAlertCircle', visualFamily: 'status' },
  'state-timeline': { description: 'Machine state timeline strip', icon: 'IconTimelineEvent', visualFamily: 'status' },
  'state-distribution': { description: 'Time in each run state', icon: 'IconChartDonut', visualFamily: 'status' },
  'state-time-breakdown': {
    description: 'Shift time by run state (idle, down, starved…)',
    icon: 'IconChartPie',
    visualFamily: 'status',
  },
  'connection-stale': { description: 'PLC / hub connection status', icon: 'IconPlugConnected', visualFamily: 'status' },
  'last-update-clock': { description: 'Last snapshot update time', icon: 'IconClockHour4', visualFamily: 'status' },
  'andon-stack': {
    description: 'Stack-light andon lamps for line state',
    icon: 'IconTrafficLights',
    visualFamily: 'status',
    defaultVariant: 'kiosk',
    searchTerms: ['stack light', 'andon', 'tower light'],
  },
  'line-status-indicator': { description: 'Line run-state with OEE chip', icon: 'IconActivity', visualFamily: 'status' },
  'run-state-badge': { description: 'Large run-state badge', icon: 'IconBadge', visualFamily: 'status' },
  'oee-traffic-light': { description: 'Large OEE % with green/amber/red status', icon: 'IconTrafficCone', visualFamily: 'status' },
  'active-downtime-timer': { description: 'Live downtime duration for current stop', icon: 'IconPlayerPause', visualFamily: 'downtime' },
  'line-status-strip': { description: 'Horizontal line status pills with OEE', icon: 'IconLayoutNavbar', visualFamily: 'status' },

  // Interactive
  'operator-downtime-pad': { description: 'Touch-friendly downtime reason entry', icon: 'IconKeyboard', visualFamily: 'layout' },
  'fault-ack-button': { description: 'Acknowledge active fault', icon: 'IconHandClick', visualFamily: 'layout' },
  'plc-write-controls': {
    description: 'Supervisor PLC write actions (permission gated)',
    icon: 'IconCpu',
    visualFamily: 'layout',
  },

  // Layout, media & utility
  'live-tag-value': { description: 'Raw PLC tag with quality and timestamp', icon: 'IconBinary', visualFamily: 'layout' },
  'text-label': { description: 'Static title or body text block', icon: 'IconTypography', visualFamily: 'layout' },
  'rich-notes': { description: 'Multi-line notes / instructions', icon: 'IconNotes', visualFamily: 'layout' },
  'image-logo': { description: 'Image or logo from URL', icon: 'IconPhoto', visualFamily: 'layout' },
  divider: { description: 'Horizontal section divider', icon: 'IconSeparator', visualFamily: 'layout' },
  'container-panel': { description: 'Visual section container with title', icon: 'IconBoxMargin', visualFamily: 'layout' },
  'tabbed-panel': { description: 'Tabbed layout container', icon: 'IconLayoutBottombar', visualFamily: 'layout' },
  'iframe-embed': { description: 'Embed external URL in dashboard frame', icon: 'IconBrowser', visualFamily: 'layout' },
  'clock-date': { description: 'Live plant clock and date display', icon: 'IconClock12', visualFamily: 'layout' },
  'marquee-ticker': { description: 'Scrolling announcement ticker', icon: 'IconTextCaption', visualFamily: 'layout' },
  'qr-link-tile': { description: 'QR code linking to a URL', icon: 'IconQrcode', visualFamily: 'layout' },
  'dashboard-link': { description: 'Navigate to another dashboard', icon: 'IconExternalLink', visualFamily: 'layout' },
  'navigation-drill': { description: 'Drill-through link to Explorer or Analytics', icon: 'IconArrowNarrowRight', visualFamily: 'layout' },
  'udt-member-value': { description: 'UDT member value from PLC', icon: 'IconBraces', visualFamily: 'layout' },
  'quick-links-bar': {
    description: 'Navigation shortcuts to Explorer, Analytics, Operator',
    icon: 'IconLink',
    visualFamily: 'layout',
  },

  // Tables & lists
  'data-table': { description: 'Generic sortable lines or downtime table', icon: 'IconTable', visualFamily: 'layout' },
  'top-n-table': { description: 'Top-N ranked KPI table', icon: 'IconTableShortcut', visualFamily: 'layout' },
  'drill-through-list': { description: 'Clickable drill-through list', icon: 'IconListTree', visualFamily: 'layout' },
  'kpi-tile-group': { description: 'Row of related KPI tiles', icon: 'IconLayoutColumns', visualFamily: 'oee' },
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
  defaultVariant?: string
  searchTerms?: string[]
} {
  const extra = WIDGET_PALETTE_META[item.type]
  const categoryIcon = item.category ? CATEGORY_ICONS[item.category] : 'IconBox'
  const family = extra?.visualFamily ?? (item.category ? CATEGORY_FAMILY[item.category] : undefined)
  return {
    ...item,
    description: extra?.description ?? `${item.label} for ${item.category ?? 'dashboards'}`,
    icon: extra?.icon ?? categoryIcon,
    visualFamily: family,
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
