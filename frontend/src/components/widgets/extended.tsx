import { Badge, Button, Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarChart, DonutChart, LineChart } from '@mantine/charts'
import { notifications } from '@mantine/notifications'
import { useEffect, useMemo, useState } from 'react'
import { WidgetFrame, fmtNumber, oeeColor, resolveField, formatDurationMinutes, resolveFrameVariant } from './common'
import type { WidgetProps } from './common'
import { ChartShell, SummaryChip } from './design/ChartShell'
import { MetricHero } from './design/MetricHero'
import { KpiTileWidget } from './tiles'
import { aggregateSnapshots } from './resolveBindingScope'
import { resolveScopedField, resolveScopedSnapshot } from './resolveScopedSnapshot'
import { CountToGoWidget } from './extraKpiWidgets'
import { getDowntime, getReliability, setDowntimeReason, type DowntimeEvent, type Reliability } from '../../lib/metrics'
import { sendPlcCommand } from '../../lib/admin'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import { useHistorianProduction, useHistorianReasons, useHistorianTrend, trendField } from './useHistorianWidget'
import { usePolling } from './usePolling'
import { ReasonQuickButtons } from '../operator/ReasonAssignModal'
/** Re-export KPI tile as generic field binder for tranche A/B widgets. */
export function FieldTileWidget(props: WidgetProps) {
  return <KpiTileWidget {...props} />
}

export function CurrentJobBannerWidget({ widget, ctx }: WidgetProps) {
  const code = ctx.snapshot?.activeRecipeCode
  const name = ctx.snapshot?.activeRecipeName
  const cycle = ctx.snapshot?.idealCycleTimeSec
  const autoCreated = ctx.snapshot?.recipeIsAutoCreated
  return (
    <WidgetFrame title={widget.title ?? 'Current Job'} noData={!ctx.snapshot} stale={!ctx.hubConnected}>
      <Stack justify="center" h="100%" gap={4}>
        {autoCreated ? (
          <Badge color="orange" variant="light" size="sm">
            Auto-created — review ideal cycle
          </Badge>
        ) : null}
        <Text fw={800} size="xl" lh={1}>
          {name ?? code ?? 'No active recipe'}
        </Text>
        {code ? (
          <Text size="sm" c="dimmed">
            {code}
          </Text>
        ) : null}
        {cycle != null ? (
          <Text size="sm">
            Ideal cycle: <strong>{cycle.toFixed(2)}s</strong>
          </Text>
        ) : null}
      </Stack>
    </WidgetFrame>
  )
}

export function ScrapYieldTileWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field ?? 'scrapPct'
  return <KpiTileWidget widget={{ ...widget, binding: { ...widget.binding, field }, options: { ...widget.options, kind: 'percent' } }} ctx={ctx} />
}

export function CycleTimeTileWidget({ widget, ctx }: WidgetProps) {
  const isPlant = widget.binding.source === 'plant'
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const s = ctx.snapshot
  const actual = isPlant ? agg.actualCycleTimeSec : s?.actualCycleTimeSec
  const ideal = isPlant ? agg.idealCycleTimeSec : s?.idealCycleTimeSec
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : actual != null

  return (
    <WidgetFrame title={widget.title ?? 'Cycle Time'} noData={!hasData} stale={!ctx.hubConnected}>
      <Stack gap={4} justify="center" h="100%">
        <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {(actual ?? 0).toFixed(2)}
          <Text span size="sm" c="dimmed">
            {' '}
            s actual
          </Text>
        </Text>
        <Text size="xs" c="dimmed">
          Ideal {(ideal ?? 0).toFixed(2)}s
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

export function ThroughputTileWidget({ widget, ctx }: WidgetProps) {
  const rateRaw = resolveScopedField(ctx, widget.binding, 'actualRatePph')
  const rate = typeof rateRaw === 'number' ? rateRaw : Number(rateRaw ?? 0)
  return (
    <WidgetFrame title={widget.title ?? 'Throughput'} noData={rateRaw == null} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtNumber(rate)}
        <Text span size="sm" c="dimmed">
          {' '}
          pph
        </Text>
      </Text>
    </WidgetFrame>
  )
}

export function ShiftProgressWidget({ widget, ctx }: WidgetProps) {
  const snap = ctx.snapshot
  if (!snap) {
    return (
      <WidgetFrame title={widget.title ?? 'Shift Progress'} noData stale={!ctx.hubConnected}>
        <span />
      </WidgetFrame>
    )
  }
  const start = new Date(snap.shiftStartUtc).getTime()
  const end = new Date(snap.shiftEndUtc).getTime()
  const now = Date.now()
  const pct = end > start ? Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100)) : 0
  const variant = resolveFrameVariant(widget, ctx)
  const hero = variant === 'hero' || variant === 'kiosk'
  return (
    <WidgetFrame title={widget.title ?? snap.shiftName} stale={!ctx.hubConnected} variant={variant} density={ctx.density} wallBoard={ctx.wallBoard}>
      <Stack gap={6} justify="center" h="100%">
        <Progress value={pct} size={hero ? 'xl' : 'lg'} radius="xl" />
        <Text size={hero ? 'sm' : 'xs'} c="dimmed">
          {pct.toFixed(0)}% of shift elapsed
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

export function ConnectionStaleWidget({ widget, ctx }: WidgetProps) {
  const stale = !ctx.hubConnected || ctx.snapshot?.connectionState === 'Stale'
  return (
    <WidgetFrame title={widget.title ?? 'Connection'} stale={stale}>
      <Stack align="center" justify="center" h="100%">
        <Badge size="lg" color={stale ? 'orange' : 'green'} variant="light">
          {ctx.snapshot?.connectionState ?? (ctx.hubConnected ? 'Connected' : 'Disconnected')}
        </Badge>
      </Stack>
    </WidgetFrame>
  )
}

export function LastUpdateClockWidget({ widget, ctx }: WidgetProps) {
  const ts = ctx.snapshot?.timestampUtc
  return (
    <WidgetFrame title={widget.title ?? 'Last Update'} noData={!ts} stale={!ctx.hubConnected}>
      <Stack justify="center" h="100%">
        <Text fw={700}>{ts ? new Date(ts).toLocaleTimeString() : '—'}</Text>
      </Stack>
    </WidgetFrame>
  )
}

export function ProductionRunListWidget({ widget, ctx }: WidgetProps) {
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const good = snap?.goodCount ?? agg.goodCount
  const reject = snap?.rejectCount ?? agg.rejectCount
  const oee = snap?.oeePct ?? agg.oeePct
  const hasData = ctx.lineSnapshots.length > 0 || !!ctx.snapshot
  return (
    <WidgetFrame title={widget.title ?? 'Production'} noData={!hasData} stale={!ctx.hubConnected}>
      <Stack gap={4} justify="center" h="100%">
        <Group justify="space-between">
          <Text size="sm">Good</Text>
          <Text fw={700}>{fmtNumber(good)}</Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">Reject</Text>
          <Text fw={700} c="red">
            {fmtNumber(reject)}
          </Text>
        </Group>
        <Group justify="space-between">
          <Text size="sm">OEE</Text>
          <Text fw={700} c={oeeColor()}>
            {oee.toFixed(1)}%
          </Text>
        </Group>
      </Stack>
    </WidgetFrame>
  )
}

export function MttfTileWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const mttf = data?.mttfMin ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'MTTF'} helpId="mttfMin" noData={!data && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800}>
        {mttf.toFixed(1)}
        <Text span size="sm" c="dimmed">
          {' '}
          min
        </Text>
      </Text>
    </WidgetFrame>
  )
}

export function MttdTileWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const mttd = data?.mttdMin ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'MTTD'} helpId="mttdMin" noData={!data && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800}>
        {mttd.toFixed(1)}
        <Text span size="sm" c="dimmed">
          {' '}
          min
        </Text>
      </Text>
    </WidgetFrame>
  )
}

export function HourlyProductionBarWidget({ widget, ctx }: WidgetProps) {
  const { data: production, error } = useHistorianProduction(ctx, 'Hour')
  const chartData = useMemo(
    () =>
      (production ?? []).map((p) => ({
        label: p.label,
        Good: p.goodCount,
        Target: p.targetCount,
      })),
    [production],
  )
  const liveGood = ctx.lineSnapshots.reduce((s, x) => s + x.goodCount, 0)
  const hasChart = chartData.length > 0
  const shiftTotal = chartData.reduce((s, p) => s + p.Good, 0)

  return (
    <WidgetFrame
      title={widget.title ?? 'Hourly Production'}
      noData={!hasChart && ctx.lineSnapshots.length === 0}
      stale={!ctx.hubConnected}
      loading={!hasChart && !error && (ctx.lineId != null || ctx.plantId != null)}
      emptyHint={liveGood > 0 ? `Shift total: ${fmtNumber(liveGood)} — accumulating hourly history` : undefined}
    >
      {hasChart ? (
        <ChartShell
          bucketCount={chartData.length}
          summary={
            <Group gap="xs">
              <SummaryChip label="Shift good" value={fmtNumber(shiftTotal || liveGood)} />
              <SummaryChip label="Hours" value={String(chartData.length)} />
            </Group>
          }
        >
          <BarChart
            h="100%"
            data={chartData}
            dataKey="label"
            series={[
              { name: 'Good', color: 'green.6' },
              { name: 'Target', color: 'gray.4' },
            ]}
            withLegend
            gridAxis="y"
            tickLine="y"
          />
        </ChartShell>
      ) : liveGood > 0 ? (
        <Stack justify="center" h="100%" align="center">
          <Text fw={800} size="xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtNumber(liveGood)}
          </Text>
          <Text size="xs" c="dimmed" ta="center">
            Shift good count · hourly chart building
          </Text>
        </Stack>
      ) : null}
    </WidgetFrame>
  )
}

export function ScrapTrendWidget({ widget, ctx }: WidgetProps) {
  const { data: trend } = useHistorianTrend(ctx, 'Hour')
  const chartData = useMemo(
    () => (trend?.points ?? []).map((p) => ({ label: p.label, Scrap: p.oee.scrapPct })),
    [trend],
  )
  const live = ctx.snapshot?.scrapPct ?? 0
  const hasChart = chartData.length >= 2
  const avgScrap = hasChart ? chartData.reduce((s, p) => s + p.Scrap, 0) / chartData.length : live

  return (
    <WidgetFrame title={widget.title ?? 'Scrap Trend'} noData={!ctx.snapshot && !hasChart} stale={!ctx.hubConnected}>
      {hasChart ? (
        <ChartShell bucketCount={chartData.length} summary={<SummaryChip label="Avg scrap" value={`${avgScrap.toFixed(1)}%`} />}>
          <LineChart
            h="100%"
            data={chartData}
            dataKey="label"
            series={[{ name: 'Scrap', color: 'red.6' }]}
            curveType="monotone"
            gridAxis="y"
            valueFormatter={(v) => `${v.toFixed(1)}%`}
          />
        </ChartShell>
      ) : (
        <Stack justify="center" h="100%" align="center" gap={4}>
          <Text size="36px" fw={800} c={live > 5 ? 'red' : undefined} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {live.toFixed(1)}%
          </Text>
          <Text size="xs" c="dimmed">
            Live scrap · trend accumulating
          </Text>
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function ProductionVsTargetWidget({ widget, ctx }: WidgetProps) {
  const isPlant = widget.binding.source === 'plant' || (ctx.plantId != null && !ctx.lineId)
  const { data: production } = useHistorianProduction(ctx, 'Hour', isPlant ? 'plant' : undefined)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const chartData = useMemo(
    () =>
      (production ?? []).map((p) => ({
        label: p.label,
        Actual: p.goodCount,
        Target: p.targetCount,
      })),
    [production],
  )
  const good = isPlant ? agg.goodCount : ctx.snapshot?.goodCount ?? agg.goodCount
  const hasChart = chartData.length > 0
  const hasScope = ctx.lineId != null || ctx.plantId != null
  const shiftTotal = chartData.reduce((s, p) => s + p.Actual, 0)
  const historianMatchesLive = shiftTotal === 0 || good === 0 || Math.abs(shiftTotal - good) / Math.max(good, 1) < 0.15

  return (
    <WidgetFrame
      title={widget.title ?? 'Production vs Target'}
      noData={!hasScope && !hasChart && good === 0}
      stale={!ctx.hubConnected}
      loading={hasScope && !hasChart && production === null}
      emptyHint={good > 0 && shiftTotal === 0 ? `Live shift good: ${fmtNumber(good)} — hourly buckets populating` : undefined}
    >
      {hasChart ? (
        <ChartShell
          bucketCount={chartData.length}
          summary={
            <Group gap="xs">
              <SummaryChip
                label={historianMatchesLive ? 'Shift good' : 'Live good'}
                value={fmtNumber(historianMatchesLive ? shiftTotal || good : good)}
              />
              {shiftTotal > 0 && !historianMatchesLive ? (
                <SummaryChip label="Chart total" value={fmtNumber(shiftTotal)} />
              ) : null}
              <SummaryChip label="Hours" value={String(chartData.length)} />
            </Group>
          }
        >
          <BarChart
            h="100%"
            data={chartData}
            dataKey="label"
            series={[
              { name: 'Actual', color: 'blue.6' },
              { name: 'Target', color: 'gray.4' },
            ]}
            withLegend
            gridAxis="y"
            tickLine="y"
          />
        </ChartShell>
      ) : good > 0 ? (
        <Stack gap={4} justify="center" h="100%" align="center">
          <Text fw={800} size="xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtNumber(good)} good
          </Text>
          <Text size="sm" c="dimmed" ta="center">
            Shift-to-date · hourly chart building
          </Text>
        </Stack>
      ) : null}
    </WidgetFrame>
  )
}
export function StateDistributionWidget({ widget, ctx }: WidgetProps) {
  const snaps = ctx.lineSnapshots.length > 0 ? ctx.lineSnapshots : ctx.snapshot ? [ctx.snapshot] : []
  const counts = { Running: 0, Down: 0, Idle: 0, Setup: 0 }
  for (const s of snaps) {
    const st = s.state
    if (st === 'Running') counts.Running++
    else if (st === 'Down') counts.Down++
    else if (st === 'Setup') counts.Setup++
    else if (st === 'Idle' || st === 'Starved' || st === 'Blocked') counts.Idle++
  }
  const segments = [
    { name: 'Running', value: counts.Running, color: 'teal.6' },
    { name: 'Down', value: counts.Down, color: 'red.6' },
    { name: 'Idle', value: counts.Idle, color: 'gray.5' },
    { name: 'Setup', value: counts.Setup, color: 'orange.5' },
  ].filter((s) => s.value > 0)
  return (
    <WidgetFrame title={widget.title ?? 'State Distribution'} noData={snaps.length === 0} stale={!ctx.hubConnected}>
      {segments.length > 0 ? (
        <Group align="center" h="100%" wrap="nowrap" gap="md">
          <DonutChart data={segments} size={120} thickness={20} withTooltip />
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            {segments.map((s) => (
              <Group key={s.name} justify="space-between">
                <Text size="xs">{s.name}</Text>
                <Text size="xs" fw={700}>{s.value}</Text>
              </Group>
            ))}
          </Stack>
        </Group>
      ) : null}
    </WidgetFrame>
  )
}

/** Shift-to-date time in each run state (from live engine accrual). */
export function StateTimeBreakdownWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const agg = ctx.lineSnapshots.length > 0 ? aggregateSnapshots(ctx.lineSnapshots) : snap
  const segments = [
    { name: 'Idle', value: agg?.idleMin ?? 0, color: 'gray.5' },
    { name: 'Down', value: agg?.downMin ?? 0, color: 'red.6' },
    { name: 'Setup', value: agg?.setupMin ?? 0, color: 'orange.5' },
    { name: 'Starved', value: agg?.starvedMin ?? 0, color: 'yellow.6' },
    { name: 'Blocked', value: agg?.blockedMin ?? 0, color: 'grape.5' },
    { name: 'Unknown', value: agg?.unknownMin ?? 0, color: 'dark.3' },
  ].filter((s) => s.value > 0)
  return (
    <WidgetFrame title={widget.title ?? 'State time breakdown'} noData={segments.length === 0} stale={!ctx.hubConnected}>
      {segments.length > 0 ? (
        <Group align="center" h="100%" wrap="nowrap" gap="md">
          <DonutChart data={segments} size={120} thickness={20} withTooltip valueFormatter={(v) => `${v.toFixed(0)} min`} />
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            {segments.map((s) => (
              <Group key={s.name} justify="space-between">
                <Text size="xs">{s.name}</Text>
                <Text size="xs" fw={700}>{s.value.toFixed(1)} min</Text>
              </Group>
            ))}
          </Stack>
        </Group>
      ) : null}
    </WidgetFrame>
  )
}

export function MicroStopCounterWidget({ widget, ctx }: WidgetProps) {
  const isPlant = widget.binding.source === 'plant'
  const { data: events } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const fromEvents = (events ?? []).filter((e) => e.isMicroStop).length
  const plantCount = aggregateSnapshots(ctx.lineSnapshots).microStopCount
  const count = isPlant
    ? plantCount || fromEvents
    : ctx.snapshot?.microStopCount ?? fromEvents

  return (
    <WidgetFrame title={widget.title ?? 'Micro-stops'} noData={count === 0 && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {fmtNumber(count)}
      </Text>
    </WidgetFrame>
  )
}

export function StopsPerHourWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const stops = data?.stopsPerHour ?? ctx.snapshot?.stopsPerHour ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'Stops / hr'} noData={!ctx.snapshot && !data} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {typeof stops === 'number' && stops < 100 ? stops.toFixed(2) : stops}
      </Text>
    </WidgetFrame>
  )
}

export function TopFaultCodesWidget({ widget, ctx }: WidgetProps) {
  const source = widget.binding.source ?? (ctx.plantId && !ctx.lineId ? 'plant' : 'line')
  const { data: reasons } = useHistorianReasons(ctx, source)
  const top = useMemo(
    () =>
      [...(reasons ?? [])]
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
        .map((r) => ({
          reason: r.reason || r.category,
          Count: r.count,
        })),
    [reasons],
  )
  const liveCode = resolveScopedSnapshot(ctx, widget.binding)?.faultCode ?? ctx.snapshot?.faultCode

  return (
    <WidgetFrame
      title={widget.title ?? 'Top Downtime Reasons'}
      noData={top.length === 0 && liveCode == null}
      stale={!ctx.hubConnected}
      emptyHint={liveCode != null ? `Active fault: ${liveCode}` : undefined}
    >
      {top.length > 0 ? (
        <ChartShell bucketCount={top.length} summary={<SummaryChip label="Faults" value={String(top.reduce((s, r) => s + r.Count, 0))} />}>
          <BarChart
            h="100%"
            data={top}
            dataKey="reason"
            orientation="vertical"
            series={[{ name: 'Count', color: 'orange.6' }]}
            gridAxis="x"
          />
        </ChartShell>
      ) : liveCode != null ? (
        <Stack justify="center" align="center" h="100%">
          <Badge size="xl" color="red" variant="filled">
            Code {liveCode}
          </Badge>
        </Stack>
      ) : null}
    </WidgetFrame>
  )
}

export function TimeSeriesTrendWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field ?? 'oeePct'
  const source = (widget.binding.source as 'plant' | 'line' | 'machine') ?? 'line'
  const { data: trend } = useHistorianTrend(ctx, 'Hour', false, 30_000, source)
  const chartData = useMemo(
    () => (trend?.points ?? []).map((p) => ({ label: p.label, Value: trendField(p, field) })),
    [trend, field],
  )
  const live = resolveScopedField(ctx, widget.binding, field) ?? resolveField(ctx.snapshot, field)
  const hasChart = chartData.length >= 2

  return (
    <WidgetFrame title={widget.title ?? String(field)} noData={live == null && !hasChart} stale={!ctx.hubConnected}>
      {hasChart ? (
        <ChartShell bucketCount={chartData.length}>
          <LineChart
            h="100%"
            data={chartData}
            dataKey="label"
            series={[{ name: 'Value', color: 'blue.6' }]}
            curveType="monotone"
            gridAxis="y"
            valueFormatter={(v) => (field.includes('Pct') ? `${v.toFixed(1)}%` : v.toFixed(1))}
          />
        </ChartShell>
      ) : (
        <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {typeof live === 'number' ? live.toFixed(1) : String(live ?? '—')}
          {field.includes('Pct') && typeof live === 'number' ? '%' : ''}
        </Text>
      )}
    </WidgetFrame>
  )
}
export function CountToTargetWidget(props: WidgetProps) {
  return <CountToGoWidget {...props} />
}

export function MeanLostTimeWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const val = data?.meanLostTimePerDowntimeMin ?? ctx.snapshot?.meanLostTimePerDowntimeMin ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'Mean lost time'} noData={!data && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800}>
        {val.toFixed(1)}
        <Text span size="sm" c="dimmed">
          {' '}
          min
        </Text>
      </Text>
    </WidgetFrame>
  )
}

export function FailureRateWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const rate = data?.failureRatePerHour ?? ctx.snapshot?.failureRatePerHour ?? 0
  const failures = data?.failureCount ?? ctx.snapshot?.failureCount ?? 0

  return (
    <WidgetFrame title={widget.title ?? 'Failure rate'} noData={!data && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {rate.toFixed(2)}
        <Text span size="sm" c="dimmed">
          {' '}
          /hr
        </Text>
      </Text>
      <Text size="xs" c="dimmed">
        {failures} failure{failures === 1 ? '' : 's'} this shift
      </Text>
    </WidgetFrame>
  )
}
export function PlannedUnplannedSplitWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const planned = data?.plannedDowntimeMin ?? ctx.snapshot?.plannedDowntimeMin ?? 0
  const unplanned = data?.unplannedDowntimeMin ?? ctx.snapshot?.unplannedDowntimeMin ?? 0
  const total = planned + unplanned
  return (
    <WidgetFrame title={widget.title ?? 'Planned vs Unplanned'} noData={total <= 0 && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Stack gap="sm" justify="center" h="100%">
        <SimpleGrid cols={2} spacing="xs">
          <MetricHero label="Planned" value={formatDurationMinutes(planned)} color="var(--mantine-color-blue-6)" helpId="plannedDowntimeMin" />
          <MetricHero label="Unplanned" value={formatDurationMinutes(unplanned)} color="var(--mantine-color-orange-6)" helpId="unplannedDowntimeMin" />
        </SimpleGrid>
        {total > 0 ? (
          <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(planned / total) * 100}%`, background: 'var(--mantine-color-blue-6)' }} />
            <div style={{ width: `${(unplanned / total) * 100}%`, background: 'var(--mantine-color-orange-6)' }} />
          </div>
        ) : (
          <Text size="sm" c="dimmed">
            {ctx.snapshot?.downtimeCount ?? 0} events this shift
          </Text>
        )}
      </Stack>
    </WidgetFrame>
  )
}

export function OperatorDowntimePadWidget({ widget, ctx }: WidgetProps) {
  const lineId = ctx.lineId ?? ctx.snapshot?.lineId
  const plantId = ctx.plantId
  const [events, setEvents] = useState<DowntimeEvent[]>([])

  useEffect(() => {
    if (!lineId && !plantId) return
    const load = () =>
      getDowntime(lineId, plantId, null, null, null, true, 20).then(setEvents).catch(() => undefined)
    void load()
    const id = setInterval(() => void load(), 8000)
    return () => clearInterval(id)
  }, [lineId, plantId])

  const unassigned = events.filter((e) => e.requiresOperatorReason !== false).slice(0, 6)

  async function assign(eventId: string, reason: string, category: string) {
    try {
      await setDowntimeReason({ downtimeEventId: eventId, reason, category })
      notifications.show({ message: 'Reason recorded', color: 'green' })
      void getDowntime(lineId, plantId, null, null, null, true, 20).then(setEvents)
    } catch {
      notifications.show({ message: 'Failed to record reason', color: 'red' })
    }
  }

  return (
    <WidgetFrame title={widget.title ?? 'Downtime Entry'} stale={!ctx.hubConnected}>
      {unassigned.length === 0 ? (
        <Text size="sm" c="dimmed">
          No unassigned downtime events
        </Text>
      ) : (
        <Stack gap="xs">
          {unassigned.map((e) => (
            <Stack key={e.id} gap={4}>
              <Text size="xs" c="dimmed">
                {new Date(e.startUtc).toLocaleTimeString()}
              </Text>
              <ReasonQuickButtons lineId={lineId} onAssign={(reason, category) => assign(e.id, reason, category)} />
            </Stack>
          ))}
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function FaultAckButtonWidget({ widget, ctx }: WidgetProps) {
  const machineId = ctx.machineId ?? ctx.snapshot?.machineId

  async function ack() {
    if (!machineId) return
    try {
      await sendPlcCommand(machineId, 'Ack')
      notifications.show({ message: 'Ack sent', color: 'green' })
    } catch {
      notifications.show({ message: 'Ack failed — check control tag mapping', color: 'red' })
    }
  }

  return (
    <WidgetFrame title={widget.title ?? 'Ack Fault'} stale={!ctx.hubConnected}>
      <Stack align="center" justify="center" h="100%">
        <Button color="orange" onClick={ack} disabled={!machineId}>
          Acknowledge fault
        </Button>
      </Stack>
    </WidgetFrame>
  )
}

export function PlcWriteControlsWidget({ widget, ctx }: WidgetProps) {
  const { hasPermission } = useAuth()
  const canWrite = hasPermission(Permissions.PlcWrite)
  const machineId = ctx.machineId ?? ctx.snapshot?.machineId

  async function cmd(command: string) {
    if (!machineId || !canWrite) return
    try {
      await sendPlcCommand(machineId, command)
      notifications.show({ message: `${command} sent`, color: 'green' })
    } catch {
      notifications.show({ message: `${command} failed`, color: 'red' })
    }
  }

  return (
    <WidgetFrame title={widget.title ?? 'PLC Controls'} stale={!ctx.hubConnected}>
      {!canWrite ? (
        <Stack align="center" justify="center" h="100%">
          <Text size="sm" c="dimmed" ta="center">
            PLC write permission required
          </Text>
        </Stack>
      ) : (
      <Group justify="center" h="100%">
        <Button variant="light" onClick={() => cmd('Reset')} disabled={!machineId}>
          Reset
        </Button>
        <Button variant="light" onClick={() => cmd('StartPermissive')} disabled={!machineId}>
          Start
        </Button>
        <Button variant="light" color="orange" onClick={() => cmd('Ack')} disabled={!machineId}>
          Ack
        </Button>
      </Group>
      )}
    </WidgetFrame>
  )
}
