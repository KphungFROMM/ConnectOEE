import { Badge, Group, Progress, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarChart, LineChart } from '@mantine/charts'
import { useMemo } from 'react'
import { getHierarchyTree } from '../../lib/hierarchy'
import { getDowntime, getReliability, getUnassignedDowntime, type DowntimeEvent, type Reliability } from '../../lib/metrics'
import { Sparkline } from './charts/Sparkline'
import { WidgetFrame, fmtNumber, oeeColor, stateColor, formatDurationMinutes } from './common'
import type { WidgetProps } from './common'
import { ChartShell, SummaryChip } from './design/ChartShell'
import { MetricHero } from './design/MetricHero'
import { KpiTileWidget } from './tiles'
import { flatLines } from './plantLineRanking'
import { resolveScopedField, resolveScopedSnapshot } from './resolveScopedSnapshot'
import { useHistorianProduction, useHistorianReasons, useHistorianTrend, trendField } from './useHistorianWidget'
import { usePolling } from './usePolling'

const STATE_RANK: Record<string, number> = { Down: 0, Setup: 1, Idle: 2, Starved: 3, Blocked: 4, Running: 5 }

export function MttrTileWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const mttr = data?.mttrMin ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'MTTR'} helpId="mttrMin" noData={!data && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800}>
        {formatDurationMinutes(mttr)}
      </Text>
    </WidgetFrame>
  )
}

export function MtbfTileWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const mtbf = data?.mtbfMin ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'MTBF'} helpId="mtbfMin" noData={!data && !ctx.snapshot} stale={!ctx.hubConnected}>
      <Text size="30px" fw={800}>
        {formatDurationMinutes(mtbf)}
      </Text>
    </WidgetFrame>
  )
}

export function TeepTileWidget(props: WidgetProps) {
  return (
    <KpiTileWidget
      {...props}
      widget={{
        ...props.widget,
        binding: { ...props.widget.binding, field: 'teepPct' },
        options: { ...props.widget.options, kind: 'percent' },
      }}
    />
  )
}

export function TotalCountTileWidget({ widget, ctx }: WidgetProps) {
  const good = (resolveScopedField(ctx, widget.binding, 'goodCount') as number) ?? 0
  const reject = (resolveScopedField(ctx, widget.binding, 'rejectCount') as number) ?? 0
  const total = good + reject
  return (
    <WidgetFrame title={widget.title ?? 'Total Count'} noData={!resolveScopedSnapshot(ctx, widget.binding)} stale={!ctx.hubConnected}>
      <MetricHero value={fmtNumber(total)} />
    </WidgetFrame>
  )
}

export function CountToGoWidget({ widget, ctx }: WidgetProps) {
  const target = (widget.options.target as number) ?? 0
  const good = (resolveScopedField(ctx, widget.binding, 'goodCount') as number) ?? 0
  const remaining = Math.max(0, target - good)
  const pct = target > 0 ? Math.min(100, (good / target) * 100) : 0
  return (
    <WidgetFrame title={widget.title ?? 'Count to Go'} noData={target <= 0} stale={!ctx.hubConnected}>
      <Stack gap={6} justify="center" h="100%">
        <Text size="30px" fw={800} style={{ fontVariantNumeric: 'tabular-nums' }}>
          {fmtNumber(remaining)}
        </Text>
        <Text size="xs" c="dimmed">
          {fmtNumber(good)} / {fmtNumber(target)} ({pct.toFixed(0)}%)
        </Text>
        <Progress value={pct} size="sm" radius="xl" color="teal" />
      </Stack>
    </WidgetFrame>
  )
}

export function TargetPaceTileWidget({ widget, ctx }: WidgetProps) {
  const target = (widget.options.target as number) ?? 0
  const good = (resolveScopedField(ctx, widget.binding, 'goodCount') as number) ?? 0
  const snap = ctx.snapshot ?? ctx.lineSnapshots[0]
  const start = snap?.shiftStartUtc ? new Date(snap.shiftStartUtc).getTime() : Date.now() - 3600_000
  const end = snap?.shiftEndUtc ? new Date(snap.shiftEndUtc).getTime() : Date.now()
  const elapsed = Math.max(1, Date.now() - start)
  const total = Math.max(1, end - start)
  const expected = target > 0 ? (target * elapsed) / total : 0
  const pace = expected > 0 ? ((good - expected) / expected) * 100 : 0
  return (
    <WidgetFrame title={widget.title ?? 'Target Pace'} noData={target <= 0} stale={!ctx.hubConnected}>
      <Stack gap={4} justify="center" h="100%">
        <MetricHero
          label="vs expected"
          value={`${pace >= 0 ? '+' : ''}${pace.toFixed(1)}%`}
          color={pace >= 0 ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-orange-6)'}
        />
        <Text size="xs" c="dimmed">
          Expected {fmtNumber(Math.round(expected))} · Actual {fmtNumber(good)}
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

export function SpeedTrendWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field === 'speed' ? 'actualRatePph' : (widget.binding.field ?? 'actualRatePph')
  const { data: trend } = useHistorianTrend(ctx, 'Hour')
  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        label: p.label,
        Rate: trendField(p, field),
      })),
    [trend, field],
  )
  const liveRaw = resolveScopedField(ctx, widget.binding, 'actualRatePph')
  const live = typeof liveRaw === 'number' ? liveRaw : 0
  const hasChart = chartData.length >= 2

  return (
    <WidgetFrame title={widget.title ?? 'Rate trend'} noData={!hasChart && live === 0} stale={!ctx.hubConnected}>
      {hasChart ? (
        <LineChart h="100%" data={chartData} dataKey="label" series={[{ name: 'Rate', color: 'blue.6' }]} gridAxis="y" />
      ) : (
        <MetricHero value={fmtNumber(live)} unit="pph" />
      )}
    </WidgetFrame>
  )
}

export function SparklineTileWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field ?? 'oeePct'
  const { data: trend } = useHistorianTrend(ctx, 'Hour')
  const sparkData = useMemo(
    () => (trend?.points ?? []).slice(-12).map((p) => ({ label: p.label, v: trendField(p, field) })),
    [trend, field],
  )
  const live = resolveScopedField(ctx, widget.binding, field)
  return (
    <WidgetFrame title={widget.title ?? String(field)} noData={sparkData.length < 2 && live == null} stale={!ctx.hubConnected}>
      <Stack gap={4} justify="center" h="100%">
        <Text fw={800} size="lg">
          {typeof live === 'number' ? live.toFixed(1) : '—'}
          {field.includes('Pct') && typeof live === 'number' ? '%' : ''}
        </Text>
        {sparkData.length >= 2 ? <Sparkline data={sparkData} color={oeeColor()} filled height={40} /> : null}
      </Stack>
    </WidgetFrame>
  )
}

export function LinearGaugeWidget({ widget, ctx }: WidgetProps) {
  const field = widget.binding.field ?? 'oeePct'
  const raw = resolveScopedField(ctx, widget.binding, field)
  const pct = typeof raw === 'number' ? Math.min(100, Math.max(0, raw)) : 0
  return (
    <WidgetFrame title={widget.title ?? String(field)} noData={raw == null} stale={!ctx.hubConnected}>
      <Stack gap={6} justify="center" h="100%">
        <Progress value={pct} size="xl" radius="xl" color="teal" />
        <Text size="sm" fw={700} ta="center">
          {pct.toFixed(1)}%
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

export function OeeByShiftWidget({ widget, ctx }: WidgetProps) {
  const { data: trend } = useHistorianTrend(ctx, 'Hour')
  const chartData = useMemo(
    () => (trend?.points ?? []).map((p) => ({ label: p.label, OEE: p.oee.oeePct })),
    [trend],
  )
  const live = resolveScopedField(ctx, widget.binding, 'oeePct') as number ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'OEE by Hour'} noData={chartData.length === 0 && live === 0} stale={!ctx.hubConnected}>
      {chartData.length > 0 ? (
        <ChartShell bucketCount={chartData.length}>
          <BarChart h="100%" data={chartData} dataKey="label" series={[{ name: 'OEE', color: 'teal.6' }]} gridAxis="y" />
        </ChartShell>
      ) : (
        <MetricHero value={`${live.toFixed(1)}%`} />
      )}
    </WidgetFrame>
  )
}

export function TaktVsActualWidget({ widget, ctx }: WidgetProps) {
  const ideal = (resolveScopedField(ctx, widget.binding, 'idealCycleTimeSec') as number) ?? 0
  const actual = (resolveScopedField(ctx, widget.binding, 'actualCycleTimeSec') as number) ?? 0
  const chartData = [{ label: 'Cycle', Ideal: ideal, Actual: actual }]
  return (
    <WidgetFrame title={widget.title ?? 'Takt vs Actual'} noData={ideal <= 0 && actual <= 0} stale={!ctx.hubConnected}>
      <BarChart
        h="100%"
        data={chartData}
        dataKey="label"
        series={[
          { name: 'Ideal', color: 'gray.4' },
          { name: 'Actual', color: 'blue.6' },
        ]}
        gridAxis="y"
        valueFormatter={(v) => `${v.toFixed(2)}s`}
      />
    </WidgetFrame>
  )
}

export function UnitsPerShiftWidget({ widget, ctx }: WidgetProps) {
  const { data: production } = useHistorianProduction(ctx, 'Hour')
  const total = (production ?? []).reduce((s, p) => s + p.goodCount, 0)
  const live = (resolveScopedField(ctx, widget.binding, 'goodCount') as number) ?? 0
  return (
    <WidgetFrame title={widget.title ?? 'Units / Shift'} noData={total === 0 && live === 0} stale={!ctx.hubConnected}>
      <MetricHero value={fmtNumber(total || live)} unit="good" />
    </WidgetFrame>
  )
}

export function LineStatusIndicatorWidget({ widget, ctx }: WidgetProps) {
  const { data: tree } = usePolling(() => getHierarchyTree(), 10000, [])
  const lines = flatLines(tree, ctx.plantId)
  const worst = lines.reduce<{ status: string; name: string } | null>((acc, { line }) => {
    const rank = STATE_RANK[line.kpi.status] ?? 99
    if (!acc || rank < (STATE_RANK[acc.status] ?? 99)) return { status: line.kpi.status, name: line.name }
    return acc
  }, null)

  return (
    <WidgetFrame title={widget.title ?? 'Line Status'} noData={!worst} stale={!ctx.hubConnected}>
      <Stack align="center" justify="center" h="100%" gap="xs">
        <Badge size="xl" color={stateColor(worst?.status)} variant="filled">
          {worst?.status ?? '—'}
        </Badge>
        <Text size="xs" c="dimmed">
          Worst: {worst?.name}
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

export function RunStateBadgeWidget({ widget, ctx }: WidgetProps) {
  const state = ctx.snapshot?.state ?? ctx.lineSnapshots[0]?.state
  return (
    <WidgetFrame title={widget.title ?? 'Run State'} noData={!state} stale={!ctx.hubConnected} accentColor={stateColor(state)}>
      <Stack align="center" justify="center" h="100%">
        <Badge size="xl" color={stateColor(state)} variant="light">
          {state ?? '—'}
        </Badge>
      </Stack>
    </WidgetFrame>
  )
}

export function FaultCodeSummaryWidget({ widget, ctx }: WidgetProps) {
  const { data: reasons } = useHistorianReasons(ctx)
  const top = useMemo(
    () => [...(reasons ?? [])].sort((a, b) => b.count - a.count).slice(0, 5),
    [reasons],
  )
  const liveCode = ctx.snapshot?.faultCode
  return (
    <WidgetFrame title={widget.title ?? 'Fault Summary'} noData={top.length === 0 && liveCode == null} stale={!ctx.hubConnected}>
      <Stack gap="xs">
        {liveCode != null ? (
          <Badge color="red" variant="filled" size="lg">
            Active: {liveCode}
          </Badge>
        ) : null}
        {top.map((r) => (
          <Group key={r.reason || r.category} justify="space-between">
            <Text size="sm" truncate>{r.reason || r.category}</Text>
            <Text size="sm" fw={700}>{r.count}</Text>
          </Group>
        ))}
      </Stack>
    </WidgetFrame>
  )
}

const DURATION_BUCKETS = [
  { label: '<1m', max: 60 },
  { label: '1-5m', max: 300 },
  { label: '5-15m', max: 900 },
  { label: '15-60m', max: 3600 },
  { label: '>60m', max: Infinity },
]

export function HistogramWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )
  const chartData = useMemo(() => {
    const counts = DURATION_BUCKETS.map((b) => ({ label: b.label, Count: 0 }))
    for (const e of data ?? []) {
      const sec = e.durationSec ?? 0
      let prev = 0
      for (let i = 0; i < DURATION_BUCKETS.length; i++) {
        if (sec <= DURATION_BUCKETS[i].max && sec > prev) {
          counts[i].Count++
          break
        }
        prev = DURATION_BUCKETS[i].max
      }
    }
    return counts
  }, [data])

  return (
    <WidgetFrame title={widget.title ?? 'Duration Histogram'} noData={(data ?? []).length === 0} stale={!ctx.hubConnected}>
      <ChartShell bucketCount={chartData.length} summary={<SummaryChip label="Events" value={String((data ?? []).length)} />}>
        <BarChart h="100%" data={chartData} dataKey="label" series={[{ name: 'Count', color: 'orange.6' }]} gridAxis="y" />
      </ChartShell>
    </WidgetFrame>
  )
}

export function UnattributedDowntimeCounterWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<DowntimeEvent[]>(
    () => getUnassignedDowntime(ctx.lineId, ctx.plantId, ctx.machineId),
    8000,
    [ctx.lineId, ctx.plantId, ctx.machineId],
  )
  const count = data?.length ?? 0
  return (
    <WidgetFrame
      title={widget.title ?? 'Unattributed Stops'}
      noData={count === 0}
      stale={!ctx.hubConnected}
      tone={count > 0 ? 'warn' : undefined}
    >
      <Stack align="center" justify="center" h="100%" gap={4}>
        <Text size="36px" fw={800} c={count > 0 ? 'yellow.7' : undefined}>
          {count}
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          awaiting operator reason
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

function deltaLabel(current: number, prior: number | undefined): string | null {
  if (prior == null) return null
  const d = current - prior
  if (Math.abs(d) < 0.05) return null
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}pp`
}

export function ShiftComparisonCardWidget({ widget, ctx }: WidgetProps) {
  const source = (widget.binding.source as 'plant' | 'line' | 'machine') ?? 'line'
  const { data: trend } = useHistorianTrend(ctx, 'Shift', false, 30_000, source)
  const points = trend?.points ?? []
  const current = points[points.length - 1]?.oee
  const prior = points[points.length - 2]?.oee
  const liveOee = (resolveScopedField(ctx, widget.binding, 'oeePct') as number) ?? current?.oeePct ?? 0
  const liveA = (resolveScopedField(ctx, widget.binding, 'availabilityPct') as number) ?? current?.availabilityPct ?? 0
  const liveP = (resolveScopedField(ctx, widget.binding, 'performancePct') as number) ?? current?.performancePct ?? 0
  const liveQ = (resolveScopedField(ctx, widget.binding, 'qualityPct') as number) ?? current?.qualityPct ?? 0

  const rows = [
    { label: 'OEE', value: liveOee, prior: prior?.oeePct },
    { label: 'A', value: liveA, prior: prior?.availabilityPct },
    { label: 'P', value: liveP, prior: prior?.performancePct },
    { label: 'Q', value: liveQ, prior: prior?.qualityPct },
  ]

  return (
    <WidgetFrame title={widget.title ?? 'Shift Comparison'} noData={!current && liveOee === 0} stale={!ctx.hubConnected}>
      <SimpleGrid cols={2} spacing="xs">
        {rows.map((row) => (
          <Stack key={row.label} gap={2}>
            <Text size="xs" c="dimmed">
              {row.label}
            </Text>
            <Text fw={800} size="lg">
              {row.value.toFixed(1)}%
            </Text>
            {deltaLabel(row.value, row.prior) ? (
              <Text size="xs" c={row.value >= (row.prior ?? 0) ? 'teal' : 'red'}>
                vs prior {deltaLabel(row.value, row.prior)}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                vs prior —
              </Text>
            )}
          </Stack>
        ))}
      </SimpleGrid>
    </WidgetFrame>
  )
}
