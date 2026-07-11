import type { DashboardWidget } from '../../lib/dashboards'
import type { EntityLevel } from '../../lib/historian'
import type { MachineSnapshot } from '../../lib/liveHub'
import { factorKeyFromField, lightTheme, statusColors } from '../../theme/tokens'
import { getFactorColors } from '../../theme/factorColorsRuntime'
import type { SurfaceTone, WidgetDensity } from './design/widgetTheme'

export type { WidgetDensity, SurfaceTone }
export { WidgetFrame } from './design/WidgetFrame'
export type { WidgetFrameVariant } from './design/WidgetFrame'

export interface WidgetCtx {
  lineId?: string | null
  machineId?: string | null
  plantId?: string | null
  snapshot?: MachineSnapshot
  lineSnapshots: MachineSnapshot[]
  hubConnected: boolean
  density?: WidgetDensity
  wallBoard?: boolean
  /** Per-line topology for Continuous vs Independent rollups (from hierarchy tree / line OEE). */
  lineTopologyByLineId?: Record<string, import('../../lib/lineTopology').LineTopologyInfo>
  /**
   * When true, interactive widgets may call write APIs (live dashboards / Operator Station).
   * False/undefined in builder, preview, and audit gallery.
   */
  allowInteractiveWrites?: boolean
}

export interface WidgetProps {
  widget: DashboardWidget
  ctx: WidgetCtx
}

export interface BindingScope {
  lineId?: string | null
  machineId?: string | null
  plantId?: string | null
  historianLevel: EntityLevel
  historianId: string | null
}

import type { WidgetFrameVariant } from './design/WidgetFrame'

export function resolveFrameVariant(widget: DashboardWidget, ctx: WidgetCtx): WidgetFrameVariant {
  const opt = widget.options.frameVariant as WidgetFrameVariant | undefined
  if (opt) return opt
  if (ctx.wallBoard || ctx.density === 'kiosk') return 'kiosk'
  return 'default'
}

/**
 * Metric label shown inside widget content when WidgetFrame hides its header
 * (wall / kiosk / preview / wall-profile builder edit). Admin freeform keeps the frame title instead.
 */
export function wallContentLabel(
  widget: { title?: string | null },
  ctx: WidgetCtx,
  fallback?: string,
): string | undefined {
  if (!(ctx.wallBoard || ctx.density === 'kiosk')) return undefined
  const t = widget.title?.trim()
  return t || fallback || undefined
}

/** Frame density variants available for nearly all framed widgets. */
export function supportsFrameVariant(type: string): boolean {
  return type !== 'divider'
}

/** @deprecated Prefer supportsFrameVariant — kept for callers that still import the Set. */
export const FRAME_VARIANT_WIDGET_TYPES = new Set([
  'oee-gauge',
  'oee-hero',
  'kpi-tile',
  'factor-gauge',
  'apq-cluster',
  'pareto',
  'losses-donut',
  'downtime-list',
  'machine-grid',
  'status-light',
  'count-tile',
  'shift-progress',
  'plant-summary-hero',
  'connection-stale',
  'last-update-clock',
  'run-state-badge',
  'line-status-indicator',
  'andon-stack',
  'oee-traffic-light',
  'active-downtime-timer',
  'line-status-strip',
  'mttr-tile',
  'mtbf-tile',
  'mttf-tile',
  'mttd-tile',
  'teep-tile',
  'scrap-tile',
  'yield-tile',
  'fpy-tile',
  'throughput-tile',
  'cycle-time-tile',
  'mean-lost-time',
  'failure-rate',
  'stops-per-hour',
  'micro-stop-counter',
  'count-to-go',
  'target-pace-tile',
  'total-count-tile',
  'units-per-shift',
  'sparkline-tile',
  'linear-gauge',
  'pace-gauge',
  'kpi-stat-card',
])

export type { KpiPresentation } from './design/PresentationKpi'
export { KPI_PRESENTATION_OPTIONS } from './design/PresentationKpi'
export type { StatusStyle } from './design/statusStyle'
export {
  STATUS_STYLE_OPTIONS,
  STATUS_STYLE_WIDGET_TYPES,
  resolveStatusStyle,
  defaultStatusStyleForType,
} from './design/statusStyle'

/** Widgets that expose options.presentation (number/ring/bar/spark/combos). */
export const PRESENTATION_WIDGET_TYPES = new Set([
  'kpi-tile',
  'count-tile',
  'scrap-tile',
  'yield-tile',
  'fpy-tile',
  'teep-tile',
  'mttr-tile',
  'mtbf-tile',
  'mttf-tile',
  'mttd-tile',
  'throughput-tile',
  'cycle-time-tile',
  'mean-lost-time',
  'failure-rate',
  'stops-per-hour',
  'micro-stop-counter',
  'total-count-tile',
  'units-per-shift',
  'sparkline-tile',
  'kpi-stat-card',
  'linear-gauge',
])


export function stateColor(state?: string | null): string {
  switch (state) {
    case 'Running':
      return statusColors.running
    case 'Idle':
    case 'Starved':
    case 'Blocked':
      return statusColors.idle
    case 'Down':
    case 'Setup':
      return statusColors.fault
    case 'PlannedDown':
      return statusColors.idle
    default:
      return statusColors.warning
  }
}

/** OEE metric identity. Uses live Admin appearance colors when loaded. */
export function oeeColor(_pct?: number): string {
  return getFactorColors().oee.hex
}

/** Mantine badge color for OEE %: on-target vs below-target (amber). Never red. */
export function oeeBadgeMantineColor(pct: number): string {
  return pct >= 85 ? 'teal' : 'yellow'
}

/** Plant Explorer 4-tier OEE badge — gray when no live PLC data. */
export function oeeExplorerBadgeColor(pct: number, connectionState?: string): string {
  if (!connectionState || connectionState !== 'Connected') return 'gray'
  if (pct >= 85) return 'teal'
  if (pct >= 70) return 'blue'
  if (pct >= 50) return 'yellow'
  return 'red'
}

/** Text color for OEE value in explorer detail grid. */
export function oeeExplorerHexColor(pct: number, connectionState?: string): string | undefined {
  const tier = oeeExplorerBadgeColor(pct, connectionState)
  switch (tier) {
    case 'teal':
      return getFactorColors().oee.hex
    case 'blue':
      return lightTheme.primary
    case 'yellow':
      return statusColors.warning
    case 'red':
      return statusColors.fault
    default:
      return undefined
  }
}

/**
 * Value-band hex for KPI rings — same tiers as Plant Explorer, with the top
 * cutoff from line `targetOeePct` (default 85). Mid/low scale with that target.
 */
export function kpiBandHexColor(
  pct: number,
  connectionState?: string,
  targetOeePct = 85,
): string | undefined {
  if (connectionState && connectionState !== 'Connected') return statusColors.idle
  const target = targetOeePct > 0 ? targetOeePct : 85
  const mid = target * (70 / 85)
  const low = target * (50 / 85)
  if (pct >= target) return getFactorColors().oee.hex
  if (pct >= mid) return lightTheme.primary
  if (pct >= low) return statusColors.warning
  return statusColors.fault
}

export type KpiColorMode = 'identity' | 'band'

export function resolveKpiColorMode(raw: unknown): KpiColorMode {
  return raw === 'band' ? 'band' : 'identity'
}

export const KPI_COLOR_MODE_OPTIONS: { value: KpiColorMode; label: string }[] = [
  { value: 'identity', label: 'Identity' },
  { value: 'band', label: 'By value' },
]

/**
 * Accent for presentation KPIs.
 * - identity: OEE/A/P/Q factor tokens (default; scannable by metric)
 * - band: performance tiers vs target (scannable by health)
 */
export function kpiAccentColor(opts: {
  field?: string | null
  value?: number | null
  mode?: KpiColorMode
  connectionState?: string
  targetOeePct?: number
}): string | undefined {
  const mode = opts.mode ?? 'identity'
  if (mode === 'band' && opts.value != null && Number.isFinite(opts.value)) {
    return kpiBandHexColor(opts.value, opts.connectionState, opts.targetOeePct)
  }
  const key = factorKeyFromField(opts.field)
  if (key) return getFactorColors()[key].hex
  return undefined
}

/** Run-state dot color; Unknown + offline reads as neutral gray, not amber. */
export function explorerRunStateColor(status: string, connectionState: string): string {
  if (status === 'Unknown' && connectionState !== 'Connected') return statusColors.idle
  return stateColor(status)
}

/**
 * Unified surface tone for any status/OEE-aware card (hierarchy nav cards, machine
 * grid cards, KPI heroes) — one tiering rule used everywhere so Plant Explorer,
 * Analytics, and Operator Station all read the same way at a glance.
 */
export function statusSurfaceTone(status: string, connectionState: string): SurfaceTone {
  if (connectionState !== 'Connected') return 'neutral'
  if (status === 'Down' || status === 'Setup') return 'bad'
  if (status === 'Running') return 'good'
  return 'warn'
}

/** Same tiering as {@link oeeExplorerBadgeColor}, expressed as a WidgetSurface tone. */
export function oeeSurfaceTone(pct: number, connectionState?: string): SurfaceTone {
  const tier = oeeExplorerBadgeColor(pct, connectionState)
  switch (tier) {
    case 'teal':
      return 'good'
    case 'red':
      return 'bad'
    case 'yellow':
      return 'warn'
    default:
      return 'neutral'
  }
}

export function factorColor(field?: string | null): string {
  const key = factorKeyFromField(field)
  return key ? getFactorColors()[key].hex : statusColors.idle
}

export function factorMantineColor(field?: string | null): string {
  const key = factorKeyFromField(field)
  return key ? getFactorColors()[key].mantine : 'gray.6'
}

export function factorColorByLabel(label: 'OEE' | 'A' | 'P' | 'Q'): string {
  const colors = getFactorColors()
  switch (label) {
    case 'OEE':
      return colors.oee.hex
    case 'A':
      return colors.availability.hex
    case 'P':
      return colors.performance.hex
    case 'Q':
      return colors.quality.hex
  }
}

export function resolveField(s: MachineSnapshot | undefined, field?: string): number | string | null {
  if (!s || !field) return null
  const value = (s as unknown as Record<string, unknown>)[field]
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

export function fmtNumber(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

export { formatDurationMinutes, formatDurationSeconds, formatMetricDuration, isDurationMinutesField } from '../../lib/formatDuration'

export type { DashboardWidget }
