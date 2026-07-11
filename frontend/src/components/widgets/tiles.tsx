import { OeeGaugeVisual, gaugeColorForField, gaugeLabelForField } from './charts/OeeGaugeVisual'
import { FactorGaugeVisual } from './charts/FactorGaugeVisual'
import { InfoStrip } from './design/InfoStrip'
import { PresentationKpi, resolveKpiPresentation } from './design/PresentationKpi'
import { StatusVisual } from './design/StatusVisual'
import { resolveStatusStyle } from './design/statusStyle'
import { statusColors } from '../../theme/tokens'
import { WidgetFrame, factorColor, stateColor, fmtNumber, formatMetricDuration, resolveFrameVariant, wallContentLabel, kpiAccentColor, resolveKpiColorMode, oeeColor } from './common'
import type { WidgetProps } from './common'
import { hasMetricHelp } from '../../lib/help'
import { resolveScopedSnapshot, resolveScopedField, resolveWidgetField } from './resolveScopedSnapshot'
import { useHistorianTrend, trendField } from './useHistorianWidget'
import { useMemo } from 'react'
import { factorKeyFromField } from '../../theme/tokens'
export function OeeGaugeWidget({ widget, ctx }: WidgetProps) {
  const snapshot = resolveScopedSnapshot(ctx, widget.binding)
  const field = resolveWidgetField(widget, ctx) ?? widget.binding.field ?? 'oeePct'
  const noData = !snapshot
  const variant = resolveFrameVariant(widget, ctx)
  const compact = variant === 'compact'
  const hero = variant === 'hero'
  const label = gaugeLabelForField(field)
  return (
    <WidgetFrame
      title={widget.title ?? label}
      helpId={field === 'oeePct' ? 'oeePct' : undefined}
      noData={noData}
      stale={!ctx.hubConnected}
      tone="info"
      accentColor={snapshot ? gaugeColorForField(field) : undefined}
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
    >
      <OeeGaugeVisual
        snapshot={snapshot}
        field={field}
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
  const snapshot = resolveScopedSnapshot(ctx, widget.binding)
  const accent = kpiAccentColor({
    field: field ?? widget.binding.field,
    value: isNum ? (raw as number) : null,
    mode: resolveKpiColorMode(widget.options.colorMode),
    connectionState: snapshot?.connectionState,
    targetOeePct: snapshot?.targetOeePct,
  })
  const helpId = field && hasMetricHelp(field) ? field : undefined
  const variant = resolveFrameVariant(widget, ctx)
  const presentation = resolveKpiPresentation(widget.options.presentation)
  const numericValue = isNum ? (raw as number) : undefined
  const source = (widget.binding.source as 'machine' | 'line' | 'plant' | undefined) ?? undefined
  const { data: trend } = useHistorianTrend(ctx, 'Hour', false, 30_000, source)
  const sparklineData = useMemo(() => {
    if (presentation !== 'spark' && presentation !== 'ringSpark' && presentation !== 'barSpark') return undefined
    if (!field || !trend?.points?.length) return undefined
    const pts = trend.points
      .map((p) => ({ label: p.bucketStartUtc, v: trendField(p, field) }))
      .filter((p) => Number.isFinite(p.v))
    return pts.length >= 2 ? pts : undefined
  }, [presentation, field, trend])
  const pctScale = kind === 'percent' || Boolean(factorKeyFromField(field ?? widget.binding.field))
  return (
    <WidgetFrame title={widget.title} helpId={helpId} noData={raw == null} stale={!ctx.hubConnected} tone="neutral" accentColor={accent} variant={variant} density={ctx.density} wallBoard={ctx.wallBoard}>
      <PresentationKpi
        presentation={presentation}
        value={display}
        numericValue={numericValue}
        unit={widget.options.unit}
        label={wallContentLabel(widget, ctx)}
        color={accent}
        density={ctx.density}
        helpId={helpId}
        max={pctScale ? 100 : Math.max(numericValue ?? 100, 100)}
        sparklineData={sparklineData}
        decimals={decimals}
      />
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
  const presentation = resolveKpiPresentation(widget.options.presentation)
  return (
    <WidgetFrame title={widget.title} helpId={helpId} noData={!resolveScopedSnapshot(ctx, widget.binding)} stale={!ctx.hubConnected} tone={frameTone} calmMuted={tone === 'good'} accentColor={accent} variant={variant} density={ctx.density} wallBoard={ctx.wallBoard}>
      <PresentationKpi
        presentation={presentation}
        value={fmtNumber(raw)}
        numericValue={raw}
        max={Math.max(raw, 1000)}
        label={wallContentLabel(widget, ctx)}
        color={color}
        density={ctx.density}
        helpId={helpId}
      />
    </WidgetFrame>
  )
}

export function StatusLightWidget({ widget, ctx }: WidgetProps) {
  const state = ctx.snapshot?.state
  const color = stateColor(state)
  const variant = resolveFrameVariant(widget, ctx)
  const statusStyle = resolveStatusStyle(widget.options.statusStyle, 'beacon')
  return (
    <WidgetFrame
      title={widget.title ?? 'Status'}
      noData={!ctx.snapshot}
      stale={!ctx.hubConnected}
      accentColor={color}
      tone={state === 'Down' || state === 'Setup' ? 'bad' : state === 'Running' ? 'good' : 'warn'}
      calmMuted={state === 'Running'}
      density={ctx.density}
      variant={variant}
      wallBoard={ctx.wallBoard}
    >
      <StatusVisual style={statusStyle} state={state} density={ctx.density} />
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
        tone={fault ? 'bad' : 'neutral'}
        calmMuted={!fault}
      >
        <InfoStrip
          variant={fault ? 'fault' : 'calm'}
          density={ctx.density}
          wallBoard={isWall}
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
      tone={fault ? 'bad' : 'neutral'}
      calmMuted={!fault}
      accentColor={fault ? statusColors.fault : statusColors.running}
    >
      <InfoStrip
        variant={fault ? 'fault' : 'calm'}
        density={ctx.density}
        wallBoard={ctx.wallBoard}
        compact
        title={fault ? `FAULT ${fault}` : 'NO ACTIVE FAULT'}
        subtitle={fault ? 'Machine requires attention' : 'Line running normally'}
      />
    </WidgetFrame>
  )
}
