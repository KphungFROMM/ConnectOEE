import { Badge, Card, Group, Progress, ScrollArea, Stack, Text } from '@mantine/core'
import { LineChart } from '@mantine/charts'
import { IconClock, IconTool } from '@tabler/icons-react'
import { useMemo } from 'react'
import { lightTheme, statusColors } from '../../theme/tokens'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { getDowntime, getCurrentShift, type DowntimeEvent } from '../../lib/metrics'
import { HeatmapGrid, type HeatmapCell } from './charts/HeatmapGrid'
import { LeaderboardBars } from './charts/LeaderboardBars'
import { OeeGaugeVisual } from './charts/OeeGaugeVisual'
import { FactorGaugeVisual } from './charts/FactorGaugeVisual'
import { WaterfallChart } from './charts/WaterfallChart'
import {
  WidgetFrame,
  factorColor,
  fmtNumber,
  oeeBadgeMantineColor,
  oeeColor,
  resolveField,
  formatDurationMinutes,
  formatDurationSeconds,
  isDurationMinutesField,
  resolveFrameVariant,
} from './common'
import type { WidgetProps } from './common'
import { AndonStackVisual } from './design/AndonStackVisual'
import { ChartShell, SummaryChip } from './design/ChartShell'
import { chartSeries } from './design/widgetTheme'
import { KpiValue } from './design/KpiValue'
import { PlantKpiStrip } from './design/PlantKpiStrip'
import { atRiskLines, flatLines, mergeLineRanking } from './plantLineRanking'
import { aggregateSnapshots } from './resolveBindingScope'
import { resolveScopedSnapshot, resolveScopedField } from './resolveScopedSnapshot'
import { useHistorianTrend, trendField } from './useHistorianWidget'
import { usePolling } from './usePolling'
import { hasMetricHelp } from '../../lib/help'
import { oeeFactorColors } from '../../theme/tokens'
const EVENT_CATEGORY_COLORS: Record<string, string> = {
  Breakdown: 'red',
  SetupAndAdjustment: 'orange',
  SmallStop: 'yellow',
  ReducedSpeed: 'grape',
  StartupReject: 'cyan',
  ProductionReject: 'blue',
  Unattributed: 'gray',
}

function usePlantLines(_plantId?: string | null) {
  return usePolling<PlantNode[]>(() => getHierarchyTree(), 10000, [])
}

function oeeBadgeColor(pct: number): string {
  return oeeBadgeMantineColor(pct)
}
function treePlantAgg(lines: ReturnType<typeof flatLines>) {
  if (!lines.length) return null
  return {
    oeePct: lines.reduce((s, x) => s + x.line.kpi.oeePct, 0) / lines.length,
    availabilityPct: lines.reduce((s, x) => s + (x.line.kpi.availabilityPct ?? 0), 0) / lines.length,
    performancePct: lines.reduce((s, x) => s + (x.line.kpi.performancePct ?? 0), 0) / lines.length,
    qualityPct: lines.reduce((s, x) => s + (x.line.kpi.qualityPct ?? 0), 0) / lines.length,
    goodCount: lines.reduce((s, x) => s + x.line.kpi.goodCount, 0),
    rejectCount: lines.reduce((s, x) => s + x.line.kpi.rejectCount, 0),
  }
}

function resolvePlantField(
  field: string,
  live: ReturnType<typeof aggregateSnapshots>,
  lines: ReturnType<typeof flatLines>,
  preferLive: boolean,
): number | null {
  const pick = (src: {
    oeePct: number
    availabilityPct: number
    performancePct: number
    qualityPct: number
    goodCount: number
    rejectCount: number
    teepPct?: number
    uptimeMin?: number
    downtimeMin?: number
    plannedDowntimeMin?: number
    unplannedDowntimeMin?: number
    availabilityLossMin?: number
    performanceLossMin?: number
    qualityLossMin?: number
  }) => {
    if (field === 'goodCount') return src.goodCount
    if (field === 'rejectCount') return src.rejectCount
    if (field === 'oeePct') return src.oeePct
    if (field === 'availabilityPct') return src.availabilityPct
    if (field === 'performancePct') return src.performancePct
    if (field === 'qualityPct') return src.qualityPct
    if (field === 'teepPct') return src.teepPct ?? null
    if (field === 'uptimeMin') return src.uptimeMin ?? null
    if (field === 'downtimeMin') return src.downtimeMin ?? null
    if (field === 'plannedDowntimeMin') return src.plannedDowntimeMin ?? null
    if (field === 'unplannedDowntimeMin') return src.unplannedDowntimeMin ?? null
    if (field === 'availabilityLossMin') return src.availabilityLossMin ?? null
    if (field === 'performanceLossMin') return src.performanceLossMin ?? null
    if (field === 'qualityLossMin') return src.qualityLossMin ?? null
    return null
  }
  const tree = treePlantAgg(lines)
  if (preferLive) {
    const v = pick(live)
    if (v != null) return v
  }
  if (tree) return pick({ ...tree, teepPct: live.teepPct })
  return preferLive ? pick(live) : null
}

export function PlantSummaryHeroWidget({ widget, ctx }: WidgetProps) {
  const { data: tree } = usePlantLines(ctx.plantId)
  const lines = flatLines(tree, ctx.plantId)
  const live = aggregateSnapshots(ctx.lineSnapshots)
  const treeAgg = treePlantAgg(lines)
  const hasLive = ctx.lineSnapshots.length > 0
  const aggFromTree = treeAgg ? { ...treeAgg, teepPct: live.teepPct } : live
  const agg = hasLive
    ? {
        oeePct: live.oeePct,
        availabilityPct: live.availabilityPct,
        performancePct: live.performancePct,
        qualityPct: live.qualityPct,
        goodCount: live.goodCount,
        rejectCount: live.rejectCount,
        teepPct: live.teepPct || aggFromTree.teepPct,
      }
    : aggFromTree

  return (
    <WidgetFrame
      title={widget.title ?? 'Plant KPIs'}
      variant={resolveFrameVariant(widget, ctx)}
      tone="info"
      noData={lines.length === 0 && ctx.lineSnapshots.length === 0}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
    >
      <PlantKpiStrip
        oeePct={agg.oeePct}
        availabilityPct={agg.availabilityPct}
        performancePct={agg.performancePct}
        qualityPct={agg.qualityPct}
        goodCount={agg.goodCount}
        rejectCount={agg.rejectCount}
        teepPct={agg.teepPct}
      />
    </WidgetFrame>
  )
}

export function LineLeaderboardWidget({ widget, ctx }: WidgetProps) {
  const { data: tree } = usePlantLines(ctx.plantId)
  const ranked = mergeLineRanking(tree, ctx.plantId, ctx.lineSnapshots)
  const items = ranked.map(({ name, value }) => ({ name, value }))
  return (
    <WidgetFrame title={widget.title ?? 'Line OEE Ranking'} noData={items.length === 0}>
      <Stack h="100%" gap={0} style={{ minHeight: 120 }}>
        <LeaderboardBars items={items} maxItems={Math.max(4, widget.h * 2)} />
      </Stack>
    </WidgetFrame>
  )
}

export function WorstLinesWidget({ widget, ctx }: WidgetProps) {
  const { data: tree } = usePlantLines(ctx.plantId)
  const atRisk = atRiskLines(mergeLineRanking(tree, ctx.plantId, ctx.lineSnapshots), 4)
  return (
    <WidgetFrame
      title={widget.title ?? 'Needs Attention'}
      noData={atRisk.length === 0}
      emptyHint="All lines at or above target"
      accentColor={statusColors.warning}
    >
      <ScrollArea h="100%" type="auto">
        <Stack gap="sm">
          {atRisk.map(({ lineId, name, value, plant, dept }) => (
            <Card
              key={lineId}
              withBorder
              padding="sm"
              radius="md"
              style={{ borderLeft: `3px solid ${statusColors.warning}` }}
            >
              <Group justify="space-between">
                <Stack gap={0}>
                  <Text fw={700} size="sm">
                    {name}
                  </Text>
                  {plant && dept ? (
                    <Text size="xs" c="dimmed">
                      {plant} · {dept}
                    </Text>
                  ) : null}
                </Stack>
                <Badge color={oeeBadgeColor(value)} variant="filled">
                  OEE {value.toFixed(0)}%
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function OeeHeroWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const variant = resolveFrameVariant(widget, ctx)
  const isKiosk = variant === 'kiosk' || ctx.density === 'kiosk'
  const ringSize = isKiosk
    ? Math.min(Math.round(widget.h * (ctx.wallBoard ? 52 : 44)), ctx.wallBoard ? 280 : 220)
    : variant === 'compact'
      ? 120
      : widget.h >= 5
        ? 190
        : 160
  return (
    <WidgetFrame
      title={widget.title ?? 'OEE'}
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
      tone="info"
      noData={!snap}
      accentColor={snap && !ctx.wallBoard ? oeeColor() : undefined}
    >
      <OeeGaugeVisual snapshot={snap} size={ringSize} wallBoard={ctx.wallBoard} showBreakdown={variant !== 'compact' && !ctx.wallBoard} />
    </WidgetFrame>
  )
}

export function ApqClusterWidget({ widget, ctx }: WidgetProps) {
  const s = resolveScopedSnapshot(ctx, widget.binding)
  const variant = resolveFrameVariant(widget, ctx)
  const size = variant === 'kiosk' || ctx.density === 'kiosk' ? 110 : variant === 'compact' ? 64 : 88
  return (
    <WidgetFrame title={widget.title ?? 'A / P / Q'} noData={!s} density={ctx.density} variant={variant} wallBoard={ctx.wallBoard}>
      <Group justify="space-around" h="100%" wrap="nowrap">
        <FactorGaugeVisual value={s?.availabilityPct ?? 0} label="A" size={size} />
        <FactorGaugeVisual value={s?.performancePct ?? 0} label="P" size={size} />
        <FactorGaugeVisual value={s?.qualityPct ?? 0} label="Q" size={size} />
      </Group>
    </WidgetFrame>
  )
}

export function KpiStatCardWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field ?? 'oeePct'
  const source = widget.binding.source
  const { data: tree } = usePlantLines(ctx.plantId)
  const lines = flatLines(tree, ctx.plantId)
  const plantAgg = aggregateSnapshots(ctx.lineSnapshots)
  const { data: trend } = useHistorianTrend(ctx, 'Hour', false, 30_000, source === 'plant' ? 'plant' : undefined)
  const plantFieldValue =
    source === 'plant' ? resolvePlantField(field, plantAgg, lines, ctx.lineSnapshots.length > 0) : null
  const trendLatest =
    source === 'plant' && trend?.points?.length
      ? trendField(trend.points[trend.points.length - 1], field)
      : null
  const raw =
    source === 'plant'
      ? (plantFieldValue ?? trendLatest)
      : resolveScopedField(ctx, widget.binding, field) ?? resolveField(ctx.snapshot, field)
  const isNum = typeof raw === 'number'
  const kind = widget.options.kind ?? (field.includes('Pct') ? 'percent' : 'number')
  const spark = useMemo(
    () => (trend?.points ?? []).slice(-8).map((p, i) => ({ label: `${i}`, v: trendField(p, field) })),
    [trend, field],
  )
  const prev = spark.length >= 2 ? spark[spark.length - 2].v : null
  const delta = isNum && prev != null ? (raw as number) - prev : null
  const display = raw == null ? '—' : isNum ? `${fmtNumber(raw as number, kind === 'percent' ? 1 : 0)}${kind === 'percent' ? '%' : ''}` : String(raw)
  const hasPlantData =
    source === 'plant' &&
    (lines.length > 0 || ctx.lineSnapshots.length > 0 || (trend?.points?.length ?? 0) > 0)

  const tone = widget.options.tone
  const isWallCount =
    kind === 'number' && (ctx.wallBoard || (ctx.density === 'kiosk' && (tone === 'good' || tone === 'bad')))
  const frameTone = tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : kind === 'percent' ? 'info' : 'neutral'
  const factorKey = field.includes('Pct') ? field : null
  const identityColor = factorKey && isNum ? factorColor(factorKey) : undefined
  const valueColor =
    tone === 'good'
      ? 'var(--mantine-color-teal-6)'
      : tone === 'bad'
        ? 'var(--mantine-color-red-6)'
        : identityColor

  const helpId = field && hasMetricHelp(field) ? field : undefined

  return (
    <WidgetFrame
      title={widget.title}
      helpId={helpId}
      variant={ctx.density === 'kiosk' ? 'kiosk' : 'default'}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
      tone={frameTone}
      noData={source === 'plant' ? !hasPlantData && raw == null : raw == null}
      accentColor={!ctx.wallBoard ? identityColor : undefined}
    >
      <KpiValue
        value={display}
        label={isWallCount ? (widget.title ?? undefined) : undefined}
        helpId={helpId}
        unit={widget.options.unit}
        delta={isWallCount ? null : delta}
        color={valueColor}
        sparklineData={!isWallCount && spark.length >= 2 ? spark : undefined}
        sparklineColor={identityColor ?? lightTheme.primary}
        density={ctx.density}
        wallBoard={ctx.wallBoard}
        megaCount={isWallCount}
      />
      {!isWallCount && spark.length < 2 && isNum && kind === 'percent' ? (
        <Text size="10px" c="dimmed" mt={4}>
          History building…
        </Text>
      ) : null}
    </WidgetFrame>
  )
}

export function AndonStackWidget({ widget, ctx }: WidgetProps) {
  const state = ctx.snapshot?.state
  const frameTone =
    state === 'Running' ? 'good' : state === 'Down' || state === 'Setup' ? 'bad' : state ? 'warn' : 'neutral'
  return (
    <WidgetFrame
      title={widget.title ?? 'Andon'}
      variant="kiosk"
      density={ctx.density ?? 'kiosk'}
      wallBoard={ctx.wallBoard}
      tone={frameTone}
      noData={!ctx.snapshot}
    >
      <AndonStackVisual state={state} density={ctx.density ?? 'kiosk'} />
    </WidgetFrame>
  )
}

export function OeeWaterfallWidget({ widget, ctx }: WidgetProps) {
  const isPlant = widget.binding.source === 'plant'
  const s = isPlant ? null : ctx.snapshot
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const mode = (widget.options.mode as 'percent' | 'minutes' | undefined) ?? 'percent'

  const apq = isPlant
    ? { a: agg.availabilityPct, p: agg.performancePct, q: agg.qualityPct, oee: agg.oeePct }
    : s
      ? { a: s.availabilityPct ?? 0, p: s.performancePct ?? 0, q: s.qualityPct ?? 0, oee: s.oeePct ?? 0 }
      : null

  const losses = isPlant
    ? {
        a: agg.availabilityLossMin,
        p: agg.performanceLossMin,
        q: agg.qualityLossMin,
        uptime: agg.uptimeMin,
        downtime: agg.downtimeMin,
        oee: agg.oeePct,
      }
    : s
      ? {
          a: s.availabilityLossMin ?? 0,
          p: s.performanceLossMin ?? 0,
          q: s.qualityLossMin ?? 0,
          uptime: s.uptimeMin ?? 0,
          downtime: s.downtimeMin ?? 0,
          oee: s.oeePct ?? 0,
        }
      : null

  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!s

  const steps =
    mode === 'minutes' && losses
      ? (() => {
          const total = Math.max(losses.uptime + losses.downtime, losses.a + losses.p + losses.q, 1)
          const oeeMin = (losses.oee / 100) * total
          return [
            { name: 'Start', value: total, fill: '#8A929E' },
            { name: 'A', value: losses.a, fill: oeeFactorColors.availability.hex },
            { name: 'P', value: losses.p, fill: oeeFactorColors.performance.hex },
            { name: 'Q', value: losses.q, fill: oeeFactorColors.quality.hex },
            { name: 'OEE', value: oeeMin, fill: oeeFactorColors.oee.hex },
          ]
        })()
      : apq
        ? [
            { name: 'Start', value: 100, fill: '#8A929E' },
            { name: 'A', value: 100 - apq.a, fill: oeeFactorColors.availability.hex },
            { name: 'P', value: Math.max(0, apq.a - apq.p), fill: oeeFactorColors.performance.hex },
            { name: 'Q', value: Math.max(0, apq.p - apq.q), fill: oeeFactorColors.quality.hex },
            { name: 'OEE', value: apq.oee, fill: oeeFactorColors.oee.hex },
          ]
        : []

  const max = mode === 'minutes' && losses ? Math.max(losses.uptime + losses.downtime, losses.a + losses.p + losses.q, 1) : 100

  return (
    <WidgetFrame title={widget.title ?? 'OEE Waterfall'} noData={!hasData}>
      <WaterfallChart steps={steps} max={max} unit={mode === 'minutes' ? 'm' : '%'} />
    </WidgetFrame>
  )
}

export function DowntimeHeatmapWidget({ widget, ctx }: WidgetProps) {
  const { data: events } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    15000,
    [ctx.lineId, ctx.plantId],
  )
  const cells = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events ?? []) {
      const d = new Date(e.startUtc)
      const key = `${d.getDay()}-${d.getHours()}`
      map.set(key, (map.get(key) ?? 0) + (e.durationSec ?? 0) / 60)
    }
    const out: HeatmapCell[] = []
    map.forEach((minutes, key) => {
      const [day, hour] = key.split('-').map(Number)
      out.push({ day, hour, minutes })
    })
    return out
  }, [events])

  return (
    <WidgetFrame title={widget.title ?? 'Downtime Heatmap'} noData={cells.length === 0} emptyHint="No downtime in range">
      <HeatmapGrid cells={cells} />
    </WidgetFrame>
  )
}

export function MultiTrendWidget({ widget, ctx }: WidgetProps) {
  const source = (widget.binding.source as 'plant' | 'line' | 'machine') ?? 'line'
  const field = (widget.options.trendField as string) ?? (widget.binding.field as string) ?? 'oeePct'
  const showTarget = widget.options.showTarget === true || widget.options.showTargetLine === true
  const singleSeries = field !== 'oeePct'
  const { data: trend } = useHistorianTrend(ctx, 'Hour', false, 30_000, source)
  const live = aggregateSnapshots(ctx.lineSnapshots)
  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => {
        if (singleSeries) {
          const row: Record<string, string | number> = { label: p.label, Value: trendField(p, field) }
          if (showTarget && field === 'oeePct') row.Target = p.targetOeePct
          return row
        }
        const row: Record<string, string | number> = {
          label: p.label,
          OEE: p.oee.oeePct,
          A: p.oee.availabilityPct,
          P: p.oee.performancePct,
          Q: p.oee.qualityPct,
        }
        if (showTarget) row.Target = p.targetOeePct
        return row
      }),
    [trend, singleSeries, field, showTarget],
  )
  const avg = chartData.length
    ? chartData.reduce((s, x) => s + (singleSeries ? (x as { Value: number }).Value : (x as { OEE: number }).OEE), 0) /
      chartData.length
    : live.oeePct
  const hasChart = chartData.length >= 2
  const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace('Pct', ' %').replace('Min', ' min')

  return (
    <WidgetFrame title={widget.title ?? (singleSeries ? fieldLabel : 'OEE Trend')} noData={!hasChart && ctx.lineSnapshots.length === 0 && !ctx.plantId}>
      {hasChart ? (
        <ChartShell
          bucketCount={chartData.length}
          summary={
            <SummaryChip
              label={`Avg ${singleSeries ? fieldLabel : 'OEE'}`}
              value={isDurationMinutesField(field) ? formatDurationMinutes(avg) : `${avg.toFixed(1)}%`}
            />
          }
        >
          <LineChart
            h="100%"
            data={chartData}
            dataKey="label"
            series={
              singleSeries
                ? [
                    { name: 'Value', color: chartSeries.oee },
                    ...(showTarget ? [{ name: 'Target', color: 'gray.5' }] : []),
                  ]
                : [
                    { name: 'OEE', color: chartSeries.oee },
                    { name: 'A', color: chartSeries.availability },
                    { name: 'P', color: chartSeries.performance },
                    { name: 'Q', color: chartSeries.quality },
                    ...(showTarget ? [{ name: 'Target', color: 'gray.5' }] : []),
                  ]
            }
            curveType="monotone"
            withLegend
            gridAxis="xy"
          />
        </ChartShell>
      ) : (
        <Stack justify="center" h="100%" align="center" gap={4}>
          <Text fw={800} size="32px" c={oeeColor()} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {live.oeePct.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Shift-to-date OEE · hourly trend building
          </Text>
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function EventFeedWidget({ widget, ctx }: WidgetProps) {
  const { data: events } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )
  const rows = events ?? []
  const maxDur = Math.max(...rows.map((e) => e.durationSec ?? 0), 1)

  return (
    <WidgetFrame title={widget.title ?? 'Active Downtime'} noData={rows.length === 0} emptyHint="No downtime events this shift" tone="warn">
      <ScrollArea h="100%">
        <Stack gap="xs">
          {rows.slice(0, 12).map((e) => (
            <Card
              key={e.id}
              withBorder
              padding="sm"
              radius="md"
              style={{
                borderLeft: `3px solid var(--mantine-color-${EVENT_CATEGORY_COLORS[e.category] ?? 'gray'}-6)`,
              }}
            >
              <Group justify="space-between" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  {e.category.includes('Breakdown') ? <IconTool size={18} color="var(--mantine-color-red-6)" /> : <IconClock size={18} />}
                  <Stack gap={0}>
                    <Text size="sm" fw={700}>
                      {e.reason ?? e.category}
                    </Text>
                    <Group gap={6}>
                      <Badge size="xs" variant="light" color={EVENT_CATEGORY_COLORS[e.category] ?? 'gray'}>
                        {e.category}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {new Date(e.startUtc).toLocaleTimeString()}
                      </Text>
                    </Group>
                  </Stack>
                </Group>
                <Stack gap={2} w={88}>
                  <Text size="xs" ta="right" fw={700}>
                    {formatDurationSeconds(e.durationSec ?? 0)}
                  </Text>
                  <Progress value={((e.durationSec ?? 0) / maxDur) * 100} size="sm" color="red" radius="xl" />
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function ShiftProgressBarWidget({ widget, ctx }: WidgetProps) {
  const snap = ctx.snapshot
  const { data: shift } = usePolling(
    () => getCurrentShift(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const { data: downtimeEvents } = usePolling(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )
  if (!snap) {
    return (
      <WidgetFrame title={widget.title ?? 'Shift Progress'} noData density={ctx.density}>
        <span />
      </WidgetFrame>
    )
  }
  const start = new Date(snap.shiftStartUtc).getTime()
  const end = new Date(snap.shiftEndUtc).getTime()
  const now = Date.now()
  const pct = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0
  const good = shift?.goodCount ?? snap.goodCount
  const isWall = ctx.wallBoard
  const events = downtimeEvents ?? []
  const downtimeMin = Math.round(events.reduce((s, e) => s + (e.durationSec ?? 0), 0) / 60)
  const lastEvent = events.length > 0 ? events[events.length - 1] : null
  const downtimeSummary =
    events.length === 0
      ? 'No stops this shift'
      : `${formatDurationMinutes(downtimeMin)} downtime · ${events.length} stop${events.length === 1 ? '' : 's'} · Last: ${lastEvent?.reason ?? lastEvent?.category ?? 'Unknown'} ${new Date(lastEvent!.startUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

  return (
    <WidgetFrame
      title={isWall ? null : widget.title ?? snap.shiftName}
      variant={isWall ? 'kiosk' : ctx.density === 'kiosk' ? 'kiosk' : 'default'}
      density={ctx.density}
      wallBoard={isWall}
      tone="info"
    >
      <Stack gap={isWall ? 10 : 8} justify="center" h="100%">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text size={isWall ? 'xl' : ctx.density === 'kiosk' ? 'lg' : 'sm'} fw={700}>
            {snap.shiftName} · {pct.toFixed(0)}% elapsed
          </Text>
          <Stack gap={2} align="flex-end">
            <Text size={isWall ? 'md' : 'xs'} fw={600}>
              Good {fmtNumber(good)}
            </Text>
            {(isWall || ctx.density === 'kiosk') && (
              <Text size={isWall ? 'sm' : 'xs'} c="dimmed" ta="right">
                {downtimeSummary}
              </Text>
            )}
          </Stack>
        </Group>
        <Progress
          value={pct}
          size={isWall ? 'xl' : ctx.density === 'kiosk' ? 'xl' : 'lg'}
          radius="xl"
          color="blue"
          styles={{
            section: {
              background: 'linear-gradient(90deg, var(--mantine-color-blue-6), var(--mantine-color-indigo-5))',
            },
          }}
        />
        <Text size={isWall ? 'sm' : 'xs'} c="dimmed">
          {new Date(snap.shiftStartUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {' – '}
          {new Date(snap.shiftEndUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Stack>
    </WidgetFrame>
  )
}
