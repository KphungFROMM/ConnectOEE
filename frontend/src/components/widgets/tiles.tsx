import { OeeGaugeVisual } from './charts/OeeGaugeVisual'
import { FactorGaugeVisual } from './charts/FactorGaugeVisual'
import { InfoStrip } from './design/InfoStrip'
import { MetricHero } from './design/MetricHero'
import { StatusBeacon } from './design/StatusBeacon'
import { statusColors } from '../../theme/tokens'
import { WidgetFrame, factorColor, oeeColor, stateColor, fmtNumber, formatMetricDuration, resolveFrameVariant } from './common'
import type { WidgetProps } from './common'
import { hasMetricHelp } from '../../lib/help'
import { resolveScopedSnapshot, resolveScopedField, resolveWidgetField } from './resolveScopedSnapshot'

export function OeeGaugeWidget({ widget, ctx }: WidgetProps) {
  const snapshot = resolveScopedSnapshot(ctx, widget.binding)
  const noData = !snapshot
  const variant = resolveFrameVariant(widget, ctx)
  const compact = variant === 'compact'
  const hero = variant === 'hero'
  return (
    <WidgetFrame
      title={widget.title ?? 'OEE'}
      helpId="oeePct"
      noData={noData}
      stale={!ctx.hubConnected}
      tone="info"
      accentColor={snapshot ? oeeColor() : undefined}
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
    >
      <OeeGaugeVisual
        snapshot={snapshot}
        size={hero ? 200 : compact ? 100 : widget.h >= 4 ? 170 : 140}
        showBreakdown={!compact}
      />
    </WidgetFrame>
  )
}

export function FactorGaugeWidget({ widget, ctx }: WidgetProps) {
  const field = resolveWidgetField(widget, ctx) ?? widget.binding.field
  const value = (resolveScopedField(ctx, widget.binding, field) as number) ?? 0
  const label = widget.options.factor ? String(widget.options.factor) : widget.title ?? undefined
  const factorAccent =
    field === 'availabilityPct' || field === 'performancePct' || field === 'qualityPct'
      ? factorColor(field)
      : undefined
  const snapshot = resolveScopedSnapshot(ctx, widget.binding)
  const variant = resolveFrameVariant(widget, ctx)
  const compact = variant === 'compact'
  const hero = variant === 'hero'
  return (
    <WidgetFrame
      title={widget.title}
      helpId={field && hasMetricHelp(field) ? field : undefined}
      noData={!snapshot}
      stale={!ctx.hubConnected}
      tone="info"
      accentColor={factorAccent ?? oeeColor()}
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
    >
      <FactorGaugeVisual value={value} label={label} size={hero ? 120 : compact ? 72 : widget.h >= 3 ? 100 : 88} />
    </WidgetFrame>
  )
}

export function KpiTileWidget({ widget, ctx }: WidgetProps) {
  const field = resolveWidgetField(widget, ctx) ?? widget.binding.field
  const raw = resolveScopedField(ctx, widget.binding, field)
  const isNum = typeof raw === 'number'
  const kind = widget.options.kind ?? 'number'
  const decimals = widget.options.decimals ?? (kind === 'percent' ? 1 : 0)
  const durationDisplay = isNum && field ? formatMetricDuration(field, raw as number) : null
  const display =
    raw == null
      ? '—'
      : durationDisplay ?? (isNum ? `${fmtNumber(raw as number, decimals)}${kind === 'percent' ? '%' : ''}` : String(raw))
  const accent =
    kind === 'percent' && isNum && widget.binding.field
      ? factorColor(widget.binding.field) || oeeColor()
      : undefined
  const helpId = field && hasMetricHelp(field) ? field : undefined
  const variant = resolveFrameVariant(widget, ctx)
  return (
    <WidgetFrame title={widget.title} helpId={helpId} noData={raw == null} stale={!ctx.hubConnected} tone="neutral" accentColor={accent} variant={variant} density={ctx.density} wallBoard={ctx.wallBoard}>
      <MetricHero value={display} unit={widget.options.unit} color={accent} density={ctx.density} helpId={helpId} />
    </WidgetFrame>
  )
}

export function CountTileWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field
  const raw = (resolveScopedField(ctx, widget.binding, field) as number) ?? 0
  const tone = widget.options.tone
  const frameTone = tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'neutral'
  const color = tone === 'good' ? 'var(--mantine-color-teal-6)' : tone === 'bad' ? 'var(--mantine-color-red-6)' : undefined
  const accent =
    tone === 'good'
      ? 'var(--mantine-color-teal-6)'
      : tone === 'bad'
        ? 'var(--mantine-color-red-6)'
        : undefined
  const helpId = field && hasMetricHelp(field) ? field : undefined
  const variant = resolveFrameVariant(widget, ctx)
  return (
    <WidgetFrame title={widget.title} helpId={helpId} noData={!resolveScopedSnapshot(ctx, widget.binding)} stale={!ctx.hubConnected} tone={frameTone} accentColor={accent} variant={variant} density={ctx.density} wallBoard={ctx.wallBoard}>
      <MetricHero value={fmtNumber(raw)} color={color} density={ctx.density} helpId={helpId} />
    </WidgetFrame>
  )
}

export function StatusLightWidget({ widget, ctx }: WidgetProps) {
  const state = ctx.snapshot?.state
  const color = stateColor(state)
  const variant = resolveFrameVariant(widget, ctx)
  return (
    <WidgetFrame
      title={widget.title ?? 'Status'}
      noData={!ctx.snapshot}
      stale={!ctx.hubConnected}
      accentColor={color}
      tone="good"
      density={ctx.density}
      variant={variant}
      wallBoard={ctx.wallBoard}
    >
      <StatusBeacon state={state} density={ctx.density} />
    </WidgetFrame>
  )
}

export function FaultBannerWidget({ widget, ctx }: WidgetProps) {
  const fault = ctx.snapshot?.faultCode
  const isWall = ctx.wallBoard
  const isKioskPreview = ctx.density === 'kiosk' && !isWall

  if (isWall || isKioskPreview) {
    return (
      <WidgetFrame
        title={null}
        variant="kiosk"
        density={ctx.density}
        wallBoard={isWall}
        noData={!ctx.snapshot}
        stale={!ctx.hubConnected}
        live={false}
        tone={fault ? 'bad' : 'good'}
      >
        <InfoStrip
          variant={fault ? 'fault' : 'calm'}
          density={ctx.density}
          compact={isKioskPreview}
          title={fault ? `FAULT ${fault}` : 'NO ACTIVE FAULT'}
          subtitle={fault ? 'Machine requires attention' : 'Line running normally'}
        />
      </WidgetFrame>
    )
  }

  return (
    <WidgetFrame
      title={widget.title ?? 'Active Fault'}
      noData={!ctx.snapshot}
      stale={!ctx.hubConnected}
      tone={fault ? 'bad' : 'good'}
      accentColor={fault ? statusColors.fault : statusColors.running}
    >
      <InfoStrip
        variant={fault ? 'fault' : 'calm'}
        density={ctx.density}
        compact
        title={fault ? `FAULT ${fault}` : 'NO ACTIVE FAULT'}
        subtitle={fault ? 'Machine requires attention' : 'Line running normally'}
      />
    </WidgetFrame>
  )
}
