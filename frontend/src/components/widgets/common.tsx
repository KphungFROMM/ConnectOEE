import type { DashboardWidget } from '../../lib/dashboards'
import type { EntityLevel } from '../../lib/historian'
import type { MachineSnapshot } from '../../lib/liveHub'
import { factorKeyFromField, lightTheme, oeeFactorColors, statusColors } from '../../theme/tokens'
import type { WidgetDensity } from './design/widgetTheme'

export type { WidgetDensity }
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

/** OEE metric identity (teal). Use for gauges, rings, and KPI values — never implies fault. */
export function oeeColor(_pct?: number): string {
  return oeeFactorColors.oee.hex
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
      return oeeFactorColors.oee.hex
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

/** Run-state dot color; Unknown + offline reads as neutral gray, not amber. */
export function explorerRunStateColor(status: string, connectionState: string): string {
  if (status === 'Unknown' && connectionState !== 'Connected') return statusColors.idle
  return stateColor(status)
}

export function factorColor(field?: string | null): string {
  const key = factorKeyFromField(field)
  return key ? oeeFactorColors[key].hex : statusColors.idle
}

export function factorMantineColor(field?: string | null): string {
  const key = factorKeyFromField(field)
  return key ? oeeFactorColors[key].mantine : 'gray.6'
}

export function factorColorByLabel(label: 'OEE' | 'A' | 'P' | 'Q'): string {
  switch (label) {
    case 'OEE':
      return oeeFactorColors.oee.hex
    case 'A':
      return oeeFactorColors.availability.hex
    case 'P':
      return oeeFactorColors.performance.hex
    case 'Q':
      return oeeFactorColors.quality.hex
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
