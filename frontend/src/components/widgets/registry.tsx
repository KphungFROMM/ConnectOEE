import type { ComponentType } from 'react'
import type { WidgetProps } from './common'
import { WidgetFrame } from './common'
import {
  OeeGaugeWidget,
  FactorGaugeWidget,
  KpiTileWidget,
  CountTileWidget,
  StatusLightWidget,
  FaultBannerWidget,
} from './tiles'
import {
  ShiftSummaryWidget,
  TargetVsActualWidget,
  DowntimeListWidget,
  ParetoWidget,
  LossesDonutWidget,
  ReliabilityPanelWidget,
  StateTimelineWidget,
  PlantGridWidget,
  MachineGridWidget,
  LiveTagValueWidget,
  AttainmentTileWidget,
} from './data'
import {
  HourlyProductionBarWidget,
  ScrapTrendWidget,
  ProductionVsTargetWidget,
  CurrentJobBannerWidget,
  ProductionRunListWidget,
  FieldTileWidget,
  ScrapYieldTileWidget,
  CycleTimeTileWidget,
  ThroughputTileWidget,
  ShiftProgressWidget,
  ConnectionStaleWidget,
  LastUpdateClockWidget,
  MttfTileWidget,
  MttdTileWidget,
  StateDistributionWidget,
  StateTimeBreakdownWidget,
  MicroStopCounterWidget,
  StopsPerHourWidget,
  TopFaultCodesWidget,
  TimeSeriesTrendWidget,
  CountToTargetWidget,
  MeanLostTimeWidget,
  FailureRateWidget,
  PlannedUnplannedSplitWidget,
  OperatorDowntimePadWidget,
  FaultAckButtonWidget,
  PlcWriteControlsWidget,
} from './extended'
import {
  AndonStackWidget,
  ApqClusterWidget,
  DowntimeHeatmapWidget,
  EventFeedWidget,
  KpiStatCardWidget,
  LineLeaderboardWidget,
  MultiTrendWidget,
  OeeHeroWidget,
  OeeWaterfallWidget,
  PlantSummaryHeroWidget,
  ShiftProgressBarWidget,
  WorstLinesWidget,
} from './premium'
import {
  ReliabilityClusterWidget,
  LossMinutesBridgeWidget,
  CycleTimeCompareWidget,
  RateVarianceWidget,
  TimeBalanceWidget,
  ReliabilityTrendWidget,
  LossTrendWidget,
  OperatorDowntimeLeaderboardWidget,
} from './kpiPremium'
import {
  TextLabelWidget,
  RichNotesWidget,
  ImageLogoWidget,
  DividerWidget,
  ContainerPanelWidget,
  TabbedPanelWidget,
  IframeEmbedWidget,
  ClockDateWidget,
  MarqueeTickerWidget,
  QrLinkTileWidget,
  DashboardLinkWidget,
  NavigationDrillWidget,
  UdtMemberValueWidget,
} from './layoutWidgets'
import {
  DataTableWidget,
  TopNTableWidget,
  DrillThroughListWidget,
  KpiTileGroupWidget,
} from './tableWidgets'
import {
  MttrTileWidget,
  MtbfTileWidget,
  TeepTileWidget,
  TotalCountTileWidget,
  CountToGoWidget,
  TargetPaceTileWidget,
  SpeedTrendWidget,
  SparklineTileWidget,
  LinearGaugeWidget,
  OeeByShiftWidget,
  TaktVsActualWidget,
  UnitsPerShiftWidget,
  LineStatusIndicatorWidget,
  RunStateBadgeWidget,
  FaultCodeSummaryWidget,
  HistogramWidget,
  UnattributedDowntimeCounterWidget,
  ShiftComparisonCardWidget,
} from './extraKpiWidgets'
import { ExpectedVsActualCountWidget, PartsLossWaterfallWidget } from './partsLossWidgets'
import {
  OeeTrafficLightWidget,
  GapClusterWidget,
  ShiftContextStripWidget,
  ActiveDowntimeTimerWidget,
  QuickLinksBarWidget,
  LineStatusStripWidget,
  PaceGaugeWidget,
  RecipeProductStripWidget,
  UnassignedStopsBannerWidget,
} from './templateWidgets'
import { Text } from '@mantine/core'
import { assertWidgetCatalogIntegrity } from './widgetCatalog.test'

function UnknownWidget({ widget }: WidgetProps) {
  return (
    <WidgetFrame title={widget.title ?? widget.type}>
      <Text size="sm" c="dimmed">
        Unknown widget: {widget.type}
      </Text>
    </WidgetFrame>
  )
}

/**
 * Typed widget registry. New widget types register here without touching the render
 * engine; the builder (Phase 10) will enumerate this map to populate its palette.
 */
export const widgetRegistry: Record<string, ComponentType<WidgetProps>> = {
  'oee-gauge': OeeGaugeWidget,
  'factor-gauge': FactorGaugeWidget,
  'kpi-tile': KpiTileWidget,
  'count-tile': CountTileWidget,
  'status-light': StatusLightWidget,
  'fault-banner': FaultBannerWidget,
  'shift-summary': ShiftSummaryWidget,
  'target-vs-actual': TargetVsActualWidget,
  'attainment-tile': AttainmentTileWidget,
  'downtime-list': DowntimeListWidget,
  pareto: ParetoWidget,
  'losses-donut': LossesDonutWidget,
  'reliability-panel': ReliabilityPanelWidget,
  'state-timeline': StateTimelineWidget,
  'plant-grid': PlantGridWidget,
  'machine-grid': MachineGridWidget,
  'live-tag-value': LiveTagValueWidget,
  'current-job-banner': CurrentJobBannerWidget,
  'production-run-list': ProductionRunListWidget,
  'scrap-tile': ScrapYieldTileWidget,
  'yield-tile': FieldTileWidget,
  'fpy-tile': FieldTileWidget,
  'count-to-target': CountToTargetWidget,
  'throughput-tile': ThroughputTileWidget,
  'cycle-time-tile': CycleTimeTileWidget,
  'hourly-production-bar': HourlyProductionBarWidget,
  'scrap-trend': ScrapTrendWidget,
  'production-vs-target': ProductionVsTargetWidget,
  'time-series-trend': TimeSeriesTrendWidget,
  'mttf-tile': MttfTileWidget,
  'mttd-tile': MttdTileWidget,
  'mean-lost-time': MeanLostTimeWidget,
  'failure-rate': FailureRateWidget,
  'stops-per-hour': StopsPerHourWidget,
  'micro-stop-counter': MicroStopCounterWidget,
  'planned-unplanned-split': PlannedUnplannedSplitWidget,
  'top-fault-codes': TopFaultCodesWidget,
  'state-distribution': StateDistributionWidget,
  'state-time-breakdown': StateTimeBreakdownWidget,
  'shift-progress': ShiftProgressWidget,
  'connection-stale': ConnectionStaleWidget,
  'last-update-clock': LastUpdateClockWidget,
  'operator-downtime-pad': OperatorDowntimePadWidget,
  'fault-ack-button': FaultAckButtonWidget,
  'plc-write-controls': PlcWriteControlsWidget,
  'plant-summary-hero': PlantSummaryHeroWidget,
  'line-leaderboard': LineLeaderboardWidget,
  'worst-lines': WorstLinesWidget,
  'oee-hero': OeeHeroWidget,
  'apq-cluster': ApqClusterWidget,
  'kpi-stat-card': KpiStatCardWidget,
  'andon-stack': AndonStackWidget,
  'oee-waterfall': OeeWaterfallWidget,
  'downtime-heatmap': DowntimeHeatmapWidget,
  'multi-trend': MultiTrendWidget,
  'event-feed': EventFeedWidget,
  'shift-progress-bar': ShiftProgressBarWidget,
  'reliability-cluster': ReliabilityClusterWidget,
  'loss-minutes-bridge': LossMinutesBridgeWidget,
  'cycle-time-compare': CycleTimeCompareWidget,
  'rate-variance': RateVarianceWidget,
  'time-balance': TimeBalanceWidget,
  'reliability-trend': ReliabilityTrendWidget,
  'loss-trend': LossTrendWidget,
  'operator-downtime-leaderboard': OperatorDowntimeLeaderboardWidget,
  'text-label': TextLabelWidget,
  'rich-notes': RichNotesWidget,
  'image-logo': ImageLogoWidget,
  divider: DividerWidget,
  'container-panel': ContainerPanelWidget,
  'tabbed-panel': TabbedPanelWidget,
  'iframe-embed': IframeEmbedWidget,
  'clock-date': ClockDateWidget,
  'marquee-ticker': MarqueeTickerWidget,
  'qr-link-tile': QrLinkTileWidget,
  'dashboard-link': DashboardLinkWidget,
  'navigation-drill': NavigationDrillWidget,
  'udt-member-value': UdtMemberValueWidget,
  'data-table': DataTableWidget,
  'top-n-table': TopNTableWidget,
  'drill-through-list': DrillThroughListWidget,
  'kpi-tile-group': KpiTileGroupWidget,
  'mttr-tile': MttrTileWidget,
  'mtbf-tile': MtbfTileWidget,
  'teep-tile': TeepTileWidget,
  'total-count-tile': TotalCountTileWidget,
  'count-to-go': CountToGoWidget,
  'target-pace-tile': TargetPaceTileWidget,
  'expected-vs-actual-count': ExpectedVsActualCountWidget,
  'parts-loss-waterfall': PartsLossWaterfallWidget,
  'speed-trend': SpeedTrendWidget,
  'sparkline-tile': SparklineTileWidget,
  'linear-gauge': LinearGaugeWidget,
  'oee-by-shift': OeeByShiftWidget,
  'takt-vs-actual': TaktVsActualWidget,
  'units-per-shift': UnitsPerShiftWidget,
  'line-status-indicator': LineStatusIndicatorWidget,
  'run-state-badge': RunStateBadgeWidget,
  'fault-code-summary': FaultCodeSummaryWidget,
  histogram: HistogramWidget,
  'unattributed-downtime-counter': UnattributedDowntimeCounterWidget,
  'shift-comparison-card': ShiftComparisonCardWidget,
  'oee-traffic-light': OeeTrafficLightWidget,
  'gap-cluster': GapClusterWidget,
  'shift-context-strip': ShiftContextStripWidget,
  'active-downtime-timer': ActiveDowntimeTimerWidget,
  'quick-links-bar': QuickLinksBarWidget,
  'line-status-strip': LineStatusStripWidget,
  'pace-gauge': PaceGaugeWidget,
  'recipe-product-strip': RecipeProductStripWidget,
  'unassigned-stops-banner': UnassignedStopsBannerWidget,
}

export function resolveWidget(type: string): ComponentType<WidgetProps> {
  return widgetRegistry[type] ?? UnknownWidget
}

/** Option keys a widget exposes in the builder's binding/config panel. */
export type WidgetOptionKey =
  | 'field'
  | 'factor'
  | 'kind'
  | 'unit'
  | 'decimals'
  | 'tone'
  | 'mode'
  | 'trendField'
  | 'source'
  | 'binding'
  | 'content'
  | 'url'
  | 'align'
  | 'fontSize'
  | 'tabs'
  | 'dashboardId'
  | 'path'
  | 'label'
  | 'dataSource'
  | 'fields'
  | 'target'
  | 'limit'
  | 'alt'
  | 'title'
  | 'groupByLine'
  | 'sortBy'
  | 'showTarget'

export interface WidgetMeta {
  type: string
  label: string
  category: string
  defaultW: number
  defaultH: number
  /** Config keys surfaced in the binding panel for this widget. */
  options: WidgetOptionKey[]
  /** Short palette tooltip (builder). */
  description?: string
  /** Tabler icon component name, e.g. IconGauge. */
  icon?: string
}

/** Numeric/string snapshot fields a value widget can bind to (MachineSnapshot). */
export const GAUGE_KPI_FIELDS: { value: string; label: string }[] = [
  { value: 'oeePct', label: 'OEE %' },
  { value: 'availabilityPct', label: 'Availability %' },
  { value: 'performancePct', label: 'Performance %' },
  { value: 'qualityPct', label: 'Quality %' },
  { value: 'teepPct', label: 'TEEP %' },
  { value: 'scrapPct', label: 'Scrap %' },
  { value: 'yieldPct', label: 'Yield %' },
  { value: 'fpyPct', label: 'FPY %' },
  { value: 'uptimePct', label: 'Uptime %' },
  { value: 'utilizationPct', label: 'Utilization %' },
]

export const SNAPSHOT_FIELDS: { value: string; label: string }[] = [
  ...GAUGE_KPI_FIELDS,
  { value: 'goodCount', label: 'Good count' },
  { value: 'rejectCount', label: 'Reject count' },
  { value: 'reworkCount', label: 'Rework count' },
  { value: 'mttrMin', label: 'MTTR (min)' },
  { value: 'mtbfMin', label: 'MTBF (min)' },
  { value: 'mttfMin', label: 'MTTF (min)' },
  { value: 'mttdMin', label: 'MTTD (min)' },
  { value: 'meanLostTimePerDowntimeMin', label: 'Mean lost time (min)' },
  { value: 'failureRatePerHour', label: 'Failure rate (/hr)' },
  { value: 'stopsPerHour', label: 'Stops / hr' },
  { value: 'availabilityFromReliabilityPct', label: 'Availability (reliability) %' },
  { value: 'downtimeCount', label: 'Downtime count' },
  { value: 'microStopCount', label: 'Micro-stop count' },
  { value: 'failureCount', label: 'Failure count' },
  { value: 'uptimeMin', label: 'Uptime (min)' },
  { value: 'downtimeMin', label: 'Downtime (min)' },
  { value: 'plannedDowntimeMin', label: 'Planned downtime (min)' },
  { value: 'unplannedDowntimeMin', label: 'Unplanned downtime (min)' },
  { value: 'availabilityLossMin', label: 'Availability loss (min)' },
  { value: 'performanceLossMin', label: 'Performance loss (min)' },
  { value: 'qualityLossMin', label: 'Quality loss (min)' },
  { value: 'actualCycleTimeSec', label: 'Actual cycle (s)' },
  { value: 'idealCycleTimeSec', label: 'Ideal cycle (s)' },
  { value: 'actualRatePph', label: 'Actual rate (pph)' },
  { value: 'idealRatePph', label: 'Ideal rate (pph)' },
  { value: 'rateVariancePct', label: 'Rate variance %' },
  { value: 'oeeGapPct', label: 'OEE gap %' },
  { value: 'cycleVariancePct', label: 'Cycle variance %' },
  { value: 'reworkPct', label: 'Rework %' },
  { value: 'runAttainmentPct', label: 'Run attainment %' },
  { value: 'shiftAttainmentPct', label: 'Shift attainment %' },
  { value: 'idleMin', label: 'Idle time (min)' },
  { value: 'downMin', label: 'Breakdown time (min)' },
  { value: 'setupMin', label: 'Setup time (min)' },
  { value: 'starvedMin', label: 'Starved time (min)' },
  { value: 'blockedMin', label: 'Blocked time (min)' },
  { value: 'targetOeePct', label: 'OEE target %' },
  { value: 'availabilityGapPct', label: 'Availability gap %' },
  { value: 'performanceGapPct', label: 'Performance gap %' },
  { value: 'qualityGapPct', label: 'Quality gap %' },
  { value: 'runPartsRemaining', label: 'Run parts remaining' },
  { value: 'shiftPartsRemaining', label: 'Shift parts remaining' },
  { value: 'theoreticalOutput', label: 'Theoretical output (parts)' },
  { value: 'outputGap', label: 'Output gap (parts)' },
  { value: 'maxPossibleParts', label: 'Max possible parts' },
  { value: 'expectedPartsPace', label: 'Expected parts (pace)' },
  { value: 'partsLostAvailability', label: 'Parts lost — downtime' },
  { value: 'partsLostPerformance', label: 'Parts lost — slow running' },
  { value: 'partsLostQuality', label: 'Parts lost — quality' },
  { value: 'partsLostBreakdown', label: 'Parts lost — breakdown' },
  { value: 'partsCouldHaveMade', label: 'Could have made (parts)' },
  { value: 'state', label: 'Run state' },
]

/**
 * Builder catalog: drives the widget palette and the per-widget binding panel. New
 * registry entries should add a matching catalog row so they appear in the builder.
 */
export const widgetCatalog: WidgetMeta[] = [
  { type: 'oee-gauge', label: 'OEE Gauge', category: 'KPI & OEE', defaultW: 3, defaultH: 3, options: ['field'] },
  { type: 'factor-gauge', label: 'A/P/Q Gauge', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['field', 'factor'] },
  { type: 'kpi-tile', label: 'KPI Tile', category: 'KPI & OEE', defaultW: 3, defaultH: 2, options: ['field', 'kind', 'unit', 'decimals', 'source'] },
  { type: 'count-tile', label: 'Count Tile', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['field', 'tone'] },
  { type: 'status-light', label: 'Status Light', category: 'State & status', defaultW: 2, defaultH: 2, options: [] },
  { type: 'fault-banner', label: 'Active Fault', category: 'State & status', defaultW: 4, defaultH: 2, options: [] },
  { type: 'shift-summary', label: 'Shift Summary', category: 'Production & shift', defaultW: 4, defaultH: 3, options: [] },
  { type: 'target-vs-actual', label: 'Target vs Actual', category: 'Charts & trends', defaultW: 6, defaultH: 3, options: [] },
  { type: 'attainment-tile', label: 'Production Attainment', category: 'Production & shift', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'downtime-list', label: 'Downtime List', category: 'Reliability & downtime', defaultW: 4, defaultH: 4, options: [] },
  { type: 'pareto', label: 'Downtime Pareto', category: 'Reliability & downtime', defaultW: 6, defaultH: 4, options: ['source'] },
  { type: 'losses-donut', label: 'Six Big Losses', category: 'Reliability & downtime', defaultW: 4, defaultH: 4, options: [] },
  { type: 'reliability-panel', label: 'Reliability Panel', category: 'Reliability & downtime', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'state-timeline', label: 'State Timeline', category: 'State & status', defaultW: 6, defaultH: 3, options: [] },
  { type: 'plant-grid', label: 'Plant Grid', category: 'KPI & OEE', defaultW: 6, defaultH: 4, options: [] },
  { type: 'machine-grid', label: 'Machine Grid', category: 'KPI & OEE', defaultW: 12, defaultH: 6, options: ['groupByLine', 'sortBy', 'cardStyle'] },
  { type: 'current-job-banner', label: 'Current Job', category: 'Production & shift', defaultW: 4, defaultH: 2, options: [] },
  { type: 'production-run-list', label: 'Production Summary', category: 'Production & shift', defaultW: 4, defaultH: 3, options: [] },
  { type: 'scrap-tile', label: 'Scrap %', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['field'] },
  { type: 'yield-tile', label: 'Yield %', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['field'] },
  { type: 'fpy-tile', label: 'FPY %', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['field'] },
  { type: 'count-to-target', label: 'Count to Target', category: 'Production & shift', defaultW: 4, defaultH: 2, options: ['target'] },
  { type: 'throughput-tile', label: 'Throughput', category: 'Production & shift', defaultW: 2, defaultH: 2, options: [] },
  { type: 'cycle-time-tile', label: 'Cycle Time', category: 'Production & shift', defaultW: 2, defaultH: 2, options: [] },
  { type: 'hourly-production-bar', label: 'Hourly Production', category: 'Charts & trends', defaultW: 6, defaultH: 4, options: ['source'] },
  { type: 'scrap-trend', label: 'Scrap Trend', category: 'Charts & trends', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'production-vs-target', label: 'Production vs Target', category: 'Charts & trends', defaultW: 6, defaultH: 3, options: [] },
  { type: 'time-series-trend', label: 'Trend Tile', category: 'Charts & trends', defaultW: 4, defaultH: 2, options: ['field'] },
  { type: 'mttf-tile', label: 'MTTF', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'mttd-tile', label: 'MTTD', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'mean-lost-time', label: 'Mean Lost Time', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'failure-rate', label: 'Failure Rate', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'stops-per-hour', label: 'Stops / Hour', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'micro-stop-counter', label: 'Micro-stop Counter', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: [] },
  { type: 'planned-unplanned-split', label: 'Planned vs Unplanned', category: 'Reliability & downtime', defaultW: 3, defaultH: 2, options: [] },
  { type: 'top-fault-codes', label: 'Top Downtime Reasons', category: 'Reliability & downtime', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'state-distribution', label: 'State Distribution', category: 'State & status', defaultW: 3, defaultH: 2, options: [] },
  { type: 'state-time-breakdown', label: 'State Time Breakdown', category: 'State & status', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'shift-progress', label: 'Shift Progress', category: 'Production & shift', defaultW: 4, defaultH: 2, options: [] },
  { type: 'connection-stale', label: 'Connection Status', category: 'State & status', defaultW: 2, defaultH: 2, options: [] },
  { type: 'last-update-clock', label: 'Last Update', category: 'State & status', defaultW: 2, defaultH: 2, options: [] },
  { type: 'operator-downtime-pad', label: 'Downtime Pad', category: 'Interactive', defaultW: 4, defaultH: 3, options: [] },
  { type: 'fault-ack-button', label: 'Fault Ack', category: 'Interactive', defaultW: 2, defaultH: 2, options: [] },
  { type: 'plc-write-controls', label: 'PLC Controls', category: 'Interactive', defaultW: 3, defaultH: 2, options: [] },
  { type: 'plant-summary-hero', label: 'KPI Summary', category: 'KPI & OEE', defaultW: 12, defaultH: 2, options: [] },
  { type: 'line-leaderboard', label: 'Line Leaderboard', category: 'KPI & OEE', defaultW: 4, defaultH: 4, options: [] },
  { type: 'worst-lines', label: 'Worst Lines', category: 'KPI & OEE', defaultW: 4, defaultH: 3, options: [] },
  { type: 'oee-hero', label: 'OEE Hero', category: 'KPI & OEE', defaultW: 4, defaultH: 4, options: ['field'] },
  { type: 'apq-cluster', label: 'A/P/Q Cluster', category: 'KPI & OEE', defaultW: 6, defaultH: 2, options: [] },
  { type: 'kpi-stat-card', label: 'KPI Stat Card', category: 'KPI & OEE', defaultW: 3, defaultH: 2, options: ['field', 'kind', 'unit', 'decimals', 'source'] },
  { type: 'andon-stack', label: 'Andon Stack', category: 'State & status', defaultW: 3, defaultH: 4, options: [] },
  { type: 'oee-waterfall', label: 'OEE Waterfall', category: 'Charts & trends', defaultW: 6, defaultH: 3, options: ['mode'] },
  { type: 'downtime-heatmap', label: 'Downtime Heatmap', category: 'Reliability & downtime', defaultW: 12, defaultH: 3, options: ['source'] },
  { type: 'multi-trend', label: 'Multi Trend', category: 'Charts & trends', defaultW: 8, defaultH: 3, options: ['trendField', 'source', 'showTarget'] },
  { type: 'event-feed', label: 'Event Feed', category: 'Reliability & downtime', defaultW: 6, defaultH: 4, options: ['source'] },
  { type: 'shift-progress-bar', label: 'Shift Progress Bar', category: 'Production & shift', defaultW: 6, defaultH: 2, options: [] },
  { type: 'reliability-cluster', label: 'Reliability Cluster', category: 'Reliability & downtime', defaultW: 6, defaultH: 3, options: [] },
  { type: 'loss-minutes-bridge', label: 'Loss Minutes Bridge', category: 'Reliability & downtime', defaultW: 6, defaultH: 3, options: [] },
  { type: 'cycle-time-compare', label: 'Cycle Time Compare', category: 'Production & shift', defaultW: 4, defaultH: 3, options: [] },
  { type: 'rate-variance', label: 'Rate Variance', category: 'Production & shift', defaultW: 3, defaultH: 2, options: [] },
  { type: 'time-balance', label: 'Time Balance', category: 'Reliability & downtime', defaultW: 4, defaultH: 2, options: [] },
  { type: 'reliability-trend', label: 'Reliability Trend', category: 'Charts & trends', defaultW: 6, defaultH: 3, options: [] },
  { type: 'loss-trend', label: 'Loss Trend', category: 'Charts & trends', defaultW: 6, defaultH: 3, options: [] },
  { type: 'operator-downtime-leaderboard', label: 'Operator Downtime', category: 'Reliability & downtime', defaultW: 4, defaultH: 4, options: [] },
  { type: 'live-tag-value', label: 'Live PLC Tag', category: 'Layout, media & utility', defaultW: 2, defaultH: 2, options: ['unit', 'decimals', 'tone'] },
  { type: 'text-label', label: 'Text Label', category: 'Layout, media & utility', defaultW: 3, defaultH: 1, options: ['content', 'align', 'fontSize'] },
  { type: 'rich-notes', label: 'Rich Notes', category: 'Layout, media & utility', defaultW: 4, defaultH: 2, options: ['content'] },
  { type: 'image-logo', label: 'Image / Logo', category: 'Layout, media & utility', defaultW: 2, defaultH: 2, options: ['url', 'alt'] },
  { type: 'divider', label: 'Divider', category: 'Layout, media & utility', defaultW: 6, defaultH: 1, options: [] },
  { type: 'container-panel', label: 'Container Panel', category: 'Layout, media & utility', defaultW: 4, defaultH: 3, options: ['title'] },
  { type: 'tabbed-panel', label: 'Tabbed Panel', category: 'Layout, media & utility', defaultW: 6, defaultH: 3, options: ['tabs'] },
  { type: 'iframe-embed', label: 'Iframe Embed', category: 'Layout, media & utility', defaultW: 6, defaultH: 4, options: ['url'] },
  { type: 'clock-date', label: 'Clock & Date', category: 'Layout, media & utility', defaultW: 3, defaultH: 2, options: [] },
  { type: 'marquee-ticker', label: 'Marquee Ticker', category: 'Layout, media & utility', defaultW: 8, defaultH: 1, options: ['source'] },
  { type: 'qr-link-tile', label: 'QR Link Tile', category: 'Layout, media & utility', defaultW: 2, defaultH: 3, options: ['url'] },
  { type: 'dashboard-link', label: 'Dashboard Link', category: 'Layout, media & utility', defaultW: 3, defaultH: 2, options: ['dashboardId', 'label'] },
  { type: 'navigation-drill', label: 'Navigation Drill', category: 'Layout, media & utility', defaultW: 3, defaultH: 2, options: ['path', 'label'] },
  { type: 'udt-member-value', label: 'UDT Member', category: 'Layout, media & utility', defaultW: 2, defaultH: 2, options: ['unit', 'decimals', 'binding'] },
  { type: 'data-table', label: 'Data Table', category: 'Tables & lists', defaultW: 6, defaultH: 4, options: ['dataSource', 'source'] },
  { type: 'top-n-table', label: 'Top N Table', category: 'Tables & lists', defaultW: 4, defaultH: 3, options: ['field', 'limit', 'source'] },
  { type: 'drill-through-list', label: 'Drill-through List', category: 'Tables & lists', defaultW: 4, defaultH: 4, options: ['source'] },
  { type: 'kpi-tile-group', label: 'KPI Tile Group', category: 'Tables & lists', defaultW: 6, defaultH: 2, options: ['fields', 'source'] },
  { type: 'mttr-tile', label: 'MTTR', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'mtbf-tile', label: 'MTBF', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'teep-tile', label: 'TEEP', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'total-count-tile', label: 'Total Count', category: 'KPI & OEE', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'count-to-go', label: 'Count to Go', category: 'Production & shift', defaultW: 3, defaultH: 2, options: ['target', 'source'] },
  { type: 'target-pace-tile', label: 'Target Pace', category: 'Production & shift', defaultW: 3, defaultH: 2, options: ['target', 'source'] },
  { type: 'expected-vs-actual-count', label: 'Expected vs Actual Count', category: 'Production & shift', defaultW: 4, defaultH: 2, options: ['source'] },
  { type: 'parts-loss-waterfall', label: 'Parts Loss Waterfall', category: 'Production & shift', defaultW: 6, defaultH: 3, options: ['source'] },
  { type: 'speed-trend', label: 'Speed Trend', category: 'Charts & trends', defaultW: 4, defaultH: 3, options: ['field', 'source'] },
  { type: 'sparkline-tile', label: 'Sparkline Tile', category: 'Charts & trends', defaultW: 3, defaultH: 2, options: ['field', 'source'] },
  { type: 'linear-gauge', label: 'Linear Gauge', category: 'KPI & OEE', defaultW: 3, defaultH: 2, options: ['field', 'source'] },
  { type: 'oee-by-shift', label: 'OEE by Shift', category: 'Charts & trends', defaultW: 6, defaultH: 3, options: ['source'] },
  { type: 'takt-vs-actual', label: 'Takt vs Actual', category: 'Production & shift', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'units-per-shift', label: 'Units per Shift', category: 'Production & shift', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'line-status-indicator', label: 'Line Status', category: 'State & status', defaultW: 3, defaultH: 2, options: ['source'] },
  { type: 'run-state-badge', label: 'Run State Badge', category: 'State & status', defaultW: 2, defaultH: 2, options: [] },
  { type: 'fault-code-summary', label: 'Downtime Reason Summary', category: 'Reliability & downtime', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'histogram', label: 'Duration Histogram', category: 'Reliability & downtime', defaultW: 6, defaultH: 3, options: ['source'] },
  { type: 'unattributed-downtime-counter', label: 'Unattributed Stops', category: 'Reliability & downtime', defaultW: 2, defaultH: 2, options: ['source'] },
  { type: 'shift-comparison-card', label: 'Shift Comparison', category: 'Production & shift', defaultW: 4, defaultH: 3, options: ['source'] },
  { type: 'oee-traffic-light', label: 'OEE Traffic Light', category: 'State & status', defaultW: 3, defaultH: 3, options: ['source'] },
  { type: 'gap-cluster', label: 'Gap vs Target', category: 'KPI & OEE', defaultW: 6, defaultH: 2, options: ['source'] },
  { type: 'shift-context-strip', label: 'Shift Context Strip', category: 'Production & shift', defaultW: 8, defaultH: 1, options: [] },
  { type: 'active-downtime-timer', label: 'Active Downtime Timer', category: 'State & status', defaultW: 4, defaultH: 2, options: [] },
  { type: 'quick-links-bar', label: 'Quick Links', category: 'Layout, media & utility', defaultW: 8, defaultH: 1, options: [] },
  { type: 'line-status-strip', label: 'Line Status Strip', category: 'State & status', defaultW: 12, defaultH: 2, options: ['source'] },
  { type: 'pace-gauge', label: 'Pace Gauge', category: 'Production & shift', defaultW: 4, defaultH: 3, options: ['source', 'target'] },
  { type: 'recipe-product-strip', label: 'Recipe / Product Strip', category: 'Production & shift', defaultW: 6, defaultH: 2, options: ['source'] },
  { type: 'unassigned-stops-banner', label: 'Unassigned Stops Banner', category: 'Reliability & downtime', defaultW: 6, defaultH: 2, options: ['source'] },
]

export const widgetMetaByType: Record<string, WidgetMeta> = Object.fromEntries(
  widgetCatalog.map((w) => [w.type, w]),
)

assertWidgetCatalogIntegrity(widgetCatalog, widgetRegistry)
