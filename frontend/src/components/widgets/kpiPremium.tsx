import { Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarChart, LineChart } from '@mantine/charts'
import { TimeBalanceChart } from '../analytics/TimeBalanceChart'
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useMemo } from 'react'
import { getDowntimeByOperator, getReliability, type Reliability } from '../../lib/metrics'
import { oeeFactorColors } from '../../theme/tokens'
import { WaterfallChart } from './charts/WaterfallChart'
import { LeaderboardBars } from './charts/LeaderboardBars'
import { WidgetFrame, fmtNumber, formatDurationMinutes } from './common'
import type { WidgetProps } from './common'
import { ChartShell, SummaryChip } from './design/ChartShell'
import { MetricHero } from './design/MetricHero'
import { chartSeries } from './design/widgetTheme'
import { aggregateSnapshots } from './resolveBindingScope'
import { useHistorianReliabilityTrend, useHistorianTrend, trendField } from './useHistorianWidget'
import { usePolling } from './usePolling'

function isPlantScope(widget: WidgetProps['widget'], ctx: WidgetProps['ctx']) {
  return widget.binding.source === 'plant' || (ctx.plantId != null && !ctx.lineId && !ctx.machineId)
}

function pickReliability(
  isPlant: boolean,
  agg: ReturnType<typeof aggregateSnapshots>,
  snapshot: WidgetProps['ctx']['snapshot'],
  api: Reliability | null,
) {
  if (isPlant) {
    return {
      mttrMin: agg.mttrMin,
      mtbfMin: agg.mtbfMin,
      mttfMin: agg.mttfMin,
      mttdMin: agg.mttdMin,
      meanLostTimePerDowntimeMin: agg.meanLostTimePerDowntimeMin,
      failureRatePerHour: agg.failureRatePerHour,
      stopsPerHour: agg.stopsPerHour,
      availabilityFromReliabilityPct: agg.availabilityFromReliabilityPct,
      failureCount: agg.failureCount,
    }
  }
  return {
    mttrMin: snapshot?.mttrMin ?? api?.mttrMin ?? 0,
    mtbfMin: snapshot?.mtbfMin ?? api?.mtbfMin ?? 0,
    mttfMin: snapshot?.mttfMin ?? api?.mttfMin ?? 0,
    mttdMin: snapshot?.mttdMin ?? api?.mttdMin ?? 0,
    meanLostTimePerDowntimeMin: snapshot?.meanLostTimePerDowntimeMin ?? api?.meanLostTimePerDowntimeMin ?? 0,
    failureRatePerHour: snapshot?.failureRatePerHour ?? api?.failureRatePerHour ?? 0,
    stopsPerHour: snapshot?.stopsPerHour ?? api?.stopsPerHour ?? 0,
    availabilityFromReliabilityPct: snapshot?.availabilityFromReliabilityPct ?? api?.availabilityFromReliabilityPct ?? 0,
    failureCount: snapshot?.failureCount ?? api?.failureCount ?? 0,
  }
}

export function ReliabilityClusterWidget({ widget, ctx }: WidgetProps) {
  const isPlant = isPlantScope(widget, ctx)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const { data: api } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const r = pickReliability(isPlant, agg, ctx.snapshot, api)
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!ctx.snapshot || !!api

  return (
    <WidgetFrame title={widget.title ?? 'Reliability'} helpId="widgetReliability" noData={!hasData} stale={!ctx.hubConnected} tone="info">
      <SimpleGrid cols={3} spacing="xs">
        <MetricHero label="MTTR" value={formatDurationMinutes(r.mttrMin)} helpId="mttrMin" />
        <MetricHero label="MTBF" value={formatDurationMinutes(r.mtbfMin)} helpId="mtbfMin" />
        <MetricHero label="MTTF" value={formatDurationMinutes(r.mttfMin)} helpId="mttfMin" />
        <MetricHero label="MTTD" value={formatDurationMinutes(r.mttdMin)} helpId="mttdMin" />
        <MetricHero label="Stops/hr" value={r.stopsPerHour.toFixed(2)} helpId="stopsPerHour" />
        <MetricHero label="Mean lost" value={formatDurationMinutes(r.meanLostTimePerDowntimeMin)} helpId="meanLostTimePerDowntimeMin" />
      </SimpleGrid>
    </WidgetFrame>
  )
}

export function LossMinutesBridgeWidget({ widget, ctx }: WidgetProps) {
  const isPlant = isPlantScope(widget, ctx)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const s = ctx.snapshot
  const aLoss = isPlant ? agg.availabilityLossMin : s?.availabilityLossMin ?? 0
  const pLoss = isPlant ? agg.performanceLossMin : s?.performanceLossMin ?? 0
  const qLoss = isPlant ? agg.qualityLossMin : s?.qualityLossMin ?? 0
  const total = Math.max(aLoss + pLoss + qLoss, 1)
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!s

  const steps = [
    { name: 'Start', value: total, fill: '#8A929E' },
    { name: 'A', value: aLoss, fill: oeeFactorColors.availability.hex },
    { name: 'P', value: pLoss, fill: oeeFactorColors.performance.hex },
    { name: 'Q', value: qLoss, fill: oeeFactorColors.quality.hex },
    {
      name: 'OEE',
      value: Math.max(0, total - aLoss - pLoss - qLoss),
      fill: oeeFactorColors.oee.hex,
    },
  ]

  return (
    <WidgetFrame title={widget.title ?? 'Loss Minutes'} noData={!hasData} stale={!ctx.hubConnected}>
      <ChartShell
        bucketCount={2}
        summary={<SummaryChip label="Total loss" value={formatDurationMinutes(aLoss + pLoss + qLoss)} />}
      >
        <WaterfallChart steps={steps} max={total} unit="m" />
      </ChartShell>
    </WidgetFrame>
  )
}

export function CycleTimeCompareWidget({ widget, ctx }: WidgetProps) {
  const isPlant = isPlantScope(widget, ctx)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const s = ctx.snapshot
  const actual = isPlant ? agg.actualCycleTimeSec : s?.actualCycleTimeSec ?? 0
  const ideal = isPlant ? agg.idealCycleTimeSec : s?.idealCycleTimeSec ?? 0
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!s
  const chartData = [{ label: 'Cycle', Actual: actual, Ideal: ideal }]
  const delta = ideal > 0 ? ((actual - ideal) / ideal) * 100 : 0

  return (
    <WidgetFrame title={widget.title ?? 'Cycle Time'} noData={!hasData} stale={!ctx.hubConnected}>
      <ChartShell
        bucketCount={2}
        summary={
          <Group gap="xs">
            <SummaryChip label="Actual" value={`${actual.toFixed(2)}s`} />
            <SummaryChip label="Ideal" value={`${ideal.toFixed(2)}s`} />
            <SummaryChip label="Delta" value={`${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`} />
          </Group>
        }
      >
        <BarChart
          h="100%"
          data={chartData}
          dataKey="label"
          series={[
            { name: 'Actual', color: 'blue.6' },
            { name: 'Ideal', color: 'gray.4' },
          ]}
          withLegend
          gridAxis="y"
          tickLine="y"
          valueFormatter={(v) => `${v.toFixed(2)}s`}
        />
      </ChartShell>
    </WidgetFrame>
  )
}

export function RateVarianceWidget({ widget, ctx }: WidgetProps) {
  const isPlant = isPlantScope(widget, ctx)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const s = ctx.snapshot
  const actualRaw = isPlant ? agg.actualRatePph : s?.actualRatePph ?? 0
  const actual = typeof actualRaw === 'number' ? actualRaw : Number(actualRaw ?? 0)
  const ideal = isPlant ? agg.idealRatePph : s?.idealRatePph ?? 0
  const variance = isPlant ? agg.rateVariancePct : s?.rateVariancePct ?? (ideal > 0 ? ((actual - ideal) / ideal) * 100 : 0)
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!s

  return (
    <WidgetFrame title={widget.title ?? 'Rate Variance'} noData={!hasData} stale={!ctx.hubConnected}>
      <Stack gap="sm" justify="center" h="100%">
        <MetricHero
          label="Variance"
          value={`${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`}
          color={variance >= 0 ? 'var(--mantine-color-teal-6)' : 'var(--mantine-color-orange-6)'}
          helpId="rateVariancePct"
        />
        <SimpleGrid cols={2} spacing="xs">
          <MetricHero label="Actual" value={fmtNumber(actual)} unit="pph" helpId="actualRatePph" />
          <MetricHero label="Ideal" value={fmtNumber(ideal)} unit="pph" helpId="idealRatePph" />
        </SimpleGrid>
      </Stack>
    </WidgetFrame>
  )
}

export function TimeBalanceWidget({ widget, ctx }: WidgetProps) {
  const isPlant = isPlantScope(widget, ctx)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const s = ctx.snapshot
  const uptime = isPlant ? agg.uptimeMin : s?.uptimeMin ?? 0
  const downtime = isPlant ? agg.downtimeMin : s?.downtimeMin ?? 0
  const planned = isPlant ? agg.plannedDowntimeMin : s?.plannedDowntimeMin ?? 0
  const unplanned = isPlant ? agg.unplannedDowntimeMin : s?.unplannedDowntimeMin ?? 0
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!s

  return (
    <WidgetFrame title={widget.title ?? 'Time Balance'} noData={!hasData} stale={!ctx.hubConnected} tone="info">
      {hasData ? (
        <TimeBalanceChart
          data={{ uptimeMin: uptime, downtimeMin: downtime, plannedMin: planned, unplannedMin: unplanned }}
        />
      ) : (
        <Stack gap="sm" justify="center" h="100%">
          <Text size="sm" c="dimmed">No time balance data yet</Text>
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function ReliabilityTrendWidget({ widget, ctx }: WidgetProps) {
  const source = (widget.binding.source as 'plant' | 'line' | 'machine') ?? 'line'
  const { data: trend } = useHistorianReliabilityTrend(ctx, 'Hour', 30_000, source)
  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        label: p.label,
        MTTR: p.mttrMin,
        MTBF: p.mtbfMin,
        Stops: p.stopsPerHour,
      })),
    [trend],
  )
  const hasChart = chartData.length >= 2
  const agg = aggregateSnapshots(ctx.lineSnapshots)

  return (
    <WidgetFrame
      title={widget.title ?? 'Reliability Trend'}
      noData={!hasChart && ctx.lineSnapshots.length === 0}
      stale={!ctx.hubConnected}
    >
      {hasChart ? (
        <ChartShell bucketCount={chartData.length}>
          <LineChart
            h="100%"
            data={chartData}
            dataKey="label"
            series={[
              { name: 'MTTR', color: chartSeries.performance },
              { name: 'MTBF', color: chartSeries.availability },
              { name: 'Stops', color: chartSeries.quality },
            ]}
            curveType="monotone"
            withLegend
            gridAxis="xy"
          />
        </ChartShell>
      ) : (
        <Stack justify="center" h="100%" align="center" gap={4}>
          <Text fw={800} size="xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {agg.stopsPerHour.toFixed(2)} stops/hr
          </Text>
          <Text size="xs" c="dimmed">
            Live reliability · hourly trend building
          </Text>
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function LossTrendWidget({ widget, ctx }: WidgetProps) {
  const source = (widget.binding.source as 'plant' | 'line' | 'machine') ?? 'line'
  const { data: trend } = useHistorianTrend(ctx, 'Hour', false, 30_000, source)
  const chartData = useMemo(
    () =>
      (trend?.points ?? []).map((p) => ({
        label: p.label,
        A: trendField(p, 'availabilityLossMin'),
        P: trendField(p, 'performanceLossMin'),
        Q: trendField(p, 'qualityLossMin'),
      })),
    [trend],
  )
  const hasChart = chartData.length >= 2
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const liveTotal = agg.availabilityLossMin + agg.performanceLossMin + agg.qualityLossMin
  const hasProductionData = agg.goodCount + agg.rejectCount > 0 || agg.downtimeMin > 0

  return (
    <WidgetFrame
      title={widget.title ?? 'Loss Trend'}
      noData={!hasChart && ctx.lineSnapshots.length === 0}
      stale={!ctx.hubConnected}
    >
      {hasChart ? (
        <ChartShell
          bucketCount={chartData.length}
          summary={<SummaryChip label="Shift loss" value={formatDurationMinutes(liveTotal)} />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} width={32} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="A" stackId="loss" fill={oeeFactorColors.availability.hex} stroke={oeeFactorColors.availability.hex} />
              <Area type="monotone" dataKey="P" stackId="loss" fill={oeeFactorColors.performance.hex} stroke={oeeFactorColors.performance.hex} />
              <Area type="monotone" dataKey="Q" stackId="loss" fill={oeeFactorColors.quality.hex} stroke={oeeFactorColors.quality.hex} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartShell>
      ) : (
        <Stack justify="center" h="100%" align="center" gap={4}>
          {hasProductionData ? (
            <>
              <Text fw={800} size="xl" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatDurationMinutes(liveTotal)}
              </Text>
              <Text size="xs" c="dimmed">
                Shift loss minutes · trend building
              </Text>
            </>
          ) : (
            <Text size="sm" c="dimmed">
              No loss data in range
            </Text>
          )}
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function OperatorDowntimeLeaderboardWidget({ widget, ctx }: WidgetProps) {
  const { data: rows } = usePolling(
    () => getDowntimeByOperator(ctx.lineId, ctx.plantId),
    15000,
    [ctx.lineId, ctx.plantId],
  )
  const items = useMemo(
    () =>
      [...(rows ?? [])]
        .sort((a, b) => b.totalMin - a.totalMin)
        .slice(0, 8)
        .map((r) => ({
          name: r.operatorName || 'Unassigned',
          value: Math.round(r.totalMin),
          sublabel: `${r.stopCount} stops`,
        })),
    [rows],
  )

  return (
    <WidgetFrame
      title={widget.title ?? 'Downtime by Operator'}
      noData={items.length === 0}
      emptyHint="No operator-attributed downtime"
      stale={!ctx.hubConnected}
    >
      <Stack h="100%" gap={0} style={{ minHeight: 120 }}>
        <LeaderboardBars items={items} maxItems={Math.max(4, widget.h * 2)} />
      </Stack>
    </WidgetFrame>
  )
}
