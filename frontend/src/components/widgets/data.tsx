import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Card, Group, Progress, RingProgress, ScrollArea, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import { Sparkline } from './charts/Sparkline'
import { ComboParetoChart } from './charts/ComboParetoChart'
import { RingGaugeLabel } from './charts/RingGaugeLabel'
import { ChartShell, SummaryChip } from './design/ChartShell'
import { MetricHero } from './design/MetricHero'
import { WidgetFrame, oeeColor, stateColor, fmtNumber, formatDurationMinutes, formatDurationSeconds, resolveFrameVariant } from './common'
import type { WidgetProps } from './common'
import { usePolling } from './usePolling'
import { useHistorianTrend } from './useHistorianWidget'
import {
  getCurrentShift,
  getDowntime,
  getLosses,
  getReliability,
  type DowntimeEvent,
  type LossBucket,
  type Reliability,
  type ShiftInstance,
} from '../../lib/metrics'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { readTagValues } from '../../lib/tags'
import { aggregateSnapshots } from './resolveBindingScope'
import { resolveScopedSnapshot } from './resolveScopedSnapshot'
import { MachineGridCard } from './MachineGridCard'
import { buildMachineGridGroups, flattenMachineGridGroups, type MachineSortBy } from './machineGridUtils'

const STATUS_PALETTE: Record<string, string> = {
  Breakdown: 'red.6',
  SetupAndAdjustment: 'orange.5',
  SmallStop: 'yellow.5',
  ReducedSpeed: 'grape.5',
  StartupReject: 'cyan.5',
  ProductionReject: 'blue.5',
  Unattributed: 'gray.5',
}

const STATE_LEGEND = ['Running', 'Idle', 'Down', 'Setup', 'Starved', 'Blocked'] as const

export function ShiftSummaryWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<ShiftInstance | null>(
    () => getCurrentShift(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const { data: trend } = useHistorianTrend(ctx, 'Hour')
  const sparkData = useMemo(
    () =>
      (trend?.points ?? []).slice(-8).map((p) => ({
        label: p.label,
        v: p.oee.oeePct,
      })),
    [trend],
  )

  return (
    <WidgetFrame title={widget.title ?? 'Shift'} noData={!data} tone="info" accentColor="var(--mantine-color-blue-6)">
      {data ? (
        <Stack gap={8} justify="center" h="100%">
          <Group justify="space-between">
            <Badge size="lg" variant="light" color="blue">
              {data.shiftName}
            </Badge>
            <Text size="xs" c="dimmed">
              {new Date(data.startUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(data.endUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </Group>
          <SimpleGrid cols={4} spacing="md">
            <MetricHero label="Good" value={fmtNumber(data.goodCount)} color="var(--mantine-color-teal-6)" helpId="goodCount" />
            <MetricHero label="Reject" value={fmtNumber(data.rejectCount)} color="var(--mantine-color-red-6)" helpId="rejectCount" />
            <MetricHero label="Downtime" value={formatDurationMinutes(data.downtimeMinutes)} helpId="downtimeMin" />
            <MetricHero
              label="Uptime"
              value={formatDurationMinutes(aggregateSnapshots(ctx.lineSnapshots).uptimeMin)}
              helpId="uptimeMin"
            />
          </SimpleGrid>
          {sparkData.length >= 2 ? (
            <Stack gap={2}>
              <Text size="10px" c="dimmed" tt="uppercase" fw={700}>
                OEE trend
              </Text>
              <Sparkline data={sparkData} color={oeeColor()} filled height={36} />
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </WidgetFrame>
  )
}

export function TargetVsActualWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const override = widget.options.targets as Record<string, number> | undefined
  const targetA = override?.A ?? snap?.targetAvailabilityPct ?? 90
  const targetP = override?.P ?? snap?.targetPerformancePct ?? 95
  const targetQ = override?.Q ?? snap?.targetQualityPct ?? 99
  const targetOee = override?.OEE ?? snap?.targetOeePct ?? 85
  const data = [
    { factor: 'A', Actual: snap?.availabilityPct ?? 0, Target: targetA },
    { factor: 'P', Actual: snap?.performancePct ?? 0, Target: targetP },
    { factor: 'Q', Actual: snap?.qualityPct ?? 0, Target: targetQ },
    { factor: 'OEE', Actual: snap?.oeePct ?? 0, Target: targetOee },
  ]
  return (
    <WidgetFrame title={widget.title ?? 'Target vs Actual'} noData={!snap} stale={!ctx.hubConnected}>
      <ChartShell bucketCount={4} summary={<SummaryChip label="Scope" value={widget.binding.source ?? 'line'} />}>
        <BarChart
          h="100%"
          data={data}
          dataKey="factor"
          series={[
            { name: 'Actual', color: 'blue.6' },
            { name: 'Target', color: 'gray.4' },
          ]}
          withLegend
          gridAxis="y"
          tickLine="y"
          valueFormatter={(v) => `${v.toFixed(0)}%`}
          barProps={{ radius: 4 }}
        />
      </ChartShell>
    </WidgetFrame>
  )
}

export function DowntimeListWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )
  const rows = data ?? []
  const maxDur = Math.max(...rows.map((e) => e.durationSec ?? 0), 1)
  const variant = resolveFrameVariant(widget, ctx)
  return (
    <WidgetFrame title={widget.title ?? 'Downtime'} noData={rows.length === 0} emptyHint="No downtime events this shift" tone="warn" variant={variant} density={ctx.density}>
      <ScrollArea h="100%" type="auto">
        <Table stickyHeader highlightOnHover fz="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Start</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Dur</Table.Th>
              <Table.Th>Reason</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>{new Date(e.startUtc).toLocaleTimeString()}</Table.Td>
                <Table.Td>
                  <Badge size="xs" variant="light" color={(STATUS_PALETTE[e.category] ?? 'gray.5').split('.')[0]}>
                    {e.category}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Stack gap={2}>
                    <Text size="xs">{e.durationSec ? formatDurationSeconds(e.durationSec) : '—'}</Text>
                    <Progress
                      value={((e.durationSec ?? 0) / maxDur) * 100}
                      size={4}
                      color="red"
                    />
                  </Stack>
                </Table.Td>
                <Table.Td c={e.reason ? undefined : 'dimmed'}>{e.reason ?? 'unassigned'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function ParetoWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<LossBucket[]>(
    () => getLosses(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const sorted = [...(data ?? [])].sort((a, b) => b.totalSec - a.totalSec)
  const totalMin = sorted.reduce((s, b) => s + b.totalSec / 60, 0) || 1
  let cumulative = 0
  const buckets = sorted.map((b) => {
    const minutes = Math.round(b.totalSec / 60)
    cumulative += minutes
    return {
      category: b.category.replace(/([A-Z])/g, ' $1').trim(),
      Minutes: minutes,
      Cumulative: Math.round((cumulative / totalMin) * 100),
    }
  })
  const variant = resolveFrameVariant(widget, ctx)
  return (
    <WidgetFrame title={widget.title ?? 'Downtime Pareto'} noData={buckets.length === 0} emptyHint="No loss data yet" tone="warn" variant={variant} density={ctx.density}>
      <ChartShell
        bucketCount={buckets.length}
        summary={<SummaryChip label="Total loss" value={formatDurationMinutes(totalMin)} />}
      >
        <ComboParetoChart
          data={buckets.map((b) => ({ category: b.category, minutes: b.Minutes, cumulative: b.Cumulative }))}
        />
      </ChartShell>
    </WidgetFrame>
  )
}

export function LossesDonutWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<LossBucket[]>(
    () => getLosses(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const segments = (data ?? []).map((b) => ({
    name: b.category,
    value: Math.round(b.totalSec / 60),
    color: STATUS_PALETTE[b.category] ?? 'gray.5',
  }))
  const total = segments.reduce((s, x) => s + x.value, 0)
  const variant = resolveFrameVariant(widget, ctx)
  const compact = variant === 'compact'
  return (
    <WidgetFrame title={widget.title ?? 'Six Big Losses'} helpId="sixBigLosses" noData={segments.length === 0} variant={variant} density={ctx.density}>
      <ChartShell bucketCount={segments.length} summary={<SummaryChip label="Total" value={formatDurationMinutes(total)} />}>
        <Group align="center" h="100%" wrap="nowrap" gap="md">
          <DonutChart data={segments} withLabelsLine size={compact ? 100 : 150} thickness={compact ? 16 : 24} strokeWidth={2} />
          {!compact ? (
          <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
            {segments.map((s) => (
              <Group key={s.name} justify="space-between" gap={4}>
                <Text size="xs" truncate>
                  {s.name}
                </Text>
                <Text size="xs" fw={700} c="dimmed">
                  {formatDurationMinutes(s.value)} ({total > 0 ? Math.round((s.value / total) * 100) : 0}%)
                </Text>
              </Group>
            ))}
          </Stack>
          ) : null}
        </Group>
      </ChartShell>
    </WidgetFrame>
  )
}

export function ReliabilityPanelWidget({ widget, ctx }: WidgetProps) {
  const isPlant = widget.binding.source === 'plant' || (ctx.plantId != null && !ctx.lineId && !ctx.machineId)
  const agg = aggregateSnapshots(ctx.lineSnapshots)
  const { data } = usePolling<Reliability | null>(
    () => getReliability(ctx.lineId, ctx.plantId),
    10000,
    [ctx.lineId, ctx.plantId],
  )
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const mttr = isPlant ? agg.mttrMin : data?.mttrMin ?? snap?.mttrMin ?? 0
  const mtbf = isPlant ? agg.mtbfMin : data?.mtbfMin ?? snap?.mtbfMin ?? 0
  const mttf = isPlant ? agg.mttfMin : data?.mttfMin ?? snap?.mttfMin ?? 0
  const mttd = isPlant ? agg.mttdMin : data?.mttdMin ?? snap?.mttdMin ?? 0
  const stops = isPlant ? agg.stopsPerHour : data?.stopsPerHour ?? snap?.stopsPerHour ?? 0
  const failures = isPlant ? agg.failureCount : data?.failureCount ?? snap?.failureCount ?? 0
  const availRel = isPlant ? agg.availabilityFromReliabilityPct : data?.availabilityFromReliabilityPct ?? snap?.availabilityFromReliabilityPct ?? 0
  const uptimeMin = isPlant ? agg.uptimeMin : snap?.uptimeMin ?? 0
  const downtimeMin = isPlant ? agg.downtimeMin : snap?.downtimeMin ?? 0
  const hasData = isPlant ? ctx.lineSnapshots.length > 0 : !!data || !!snap
  const bars = [
    { label: 'MTTR', value: mttr, max: 60 },
    { label: 'MTBF', value: mtbf, max: 1440 },
    { label: 'MTTF', value: mttf, max: 1440 },
    { label: 'MTTD', value: mttd, max: 60 },
  ]

  return (
    <WidgetFrame title={widget.title ?? 'Reliability'} helpId="widgetReliability" noData={!hasData} tone="info">
      {hasData ? (
        <Stack gap="sm" h="100%">
          {(uptimeMin > 0 || downtimeMin > 0) && (
            <SimpleGrid cols={2} spacing="xs">
              <MetricHero label="Uptime (shift)" value={formatDurationMinutes(uptimeMin)} helpId="uptimeMin" />
              <MetricHero label="Downtime (shift)" value={formatDurationMinutes(downtimeMin)} helpId="downtimeMin" />
            </SimpleGrid>
          )}
          <SimpleGrid cols={2} spacing="xs">
            <MetricHero label="MTTR" value={formatDurationMinutes(mttr)} helpId="mttrMin" />
            <MetricHero label="MTBF" value={formatDurationMinutes(mtbf)} helpId="mtbfMin" />
            <MetricHero label="MTTF" value={formatDurationMinutes(mttf)} helpId="mttfMin" />
            <MetricHero label="MTTD" value={formatDurationMinutes(mttd)} helpId="mttdMin" />
            <MetricHero label="Stops/hr" value={stops.toFixed(2)} helpId="stopsPerHour" />
            <MetricHero label="Failures" value={`${failures}`} helpId="failureCount" />
            <MetricHero label="Avail (rel)" value={`${availRel.toFixed(0)}%`} helpId="availabilityFromReliabilityPct" />
          </SimpleGrid>
          <Stack gap={4}>
            {bars.map((b) => (
              <Stack key={b.label} gap={2}>
                <Group justify="space-between">
                  <Text size="10px" c="dimmed" fw={700}>
                    {b.label}
                  </Text>
                  <Text size="10px">{formatDurationMinutes(b.value)}</Text>
                </Group>
                <Progress value={Math.min(100, (b.value / b.max) * 100)} size="sm" color="blue" radius="xl" />
              </Stack>
            ))}
          </Stack>
        </Stack>
      ) : null}
    </WidgetFrame>
  )
}

interface StatePoint {
  t: number
  state: string
}

export function StateTimelineWidget({ widget, ctx }: WidgetProps) {
  const [points, setPoints] = useState<StatePoint[]>([])
  const lastState = useRef<string | null>(null)

  useEffect(() => {
    const state = ctx.snapshot?.state
    if (!state) return
    if (state !== lastState.current) {
      lastState.current = state
      setPoints((prev) => [...prev.slice(-300), { t: Date.now(), state }])
    }
  }, [ctx.snapshot?.state, ctx.snapshot?.timestampUtc])

  const now = Date.now()
  const windowMs = 30 * 60 * 1000
  const start = now - windowMs
  const segs = points.filter((p) => p.t >= start - windowMs)
  const presentStates = new Set(segs.map((s) => s.state))

  return (
    <WidgetFrame title={widget.title ?? 'State Timeline'} noData={!ctx.snapshot}>
      <Stack gap={8} h="100%" justify="center">
        <div style={{ display: 'flex', width: '100%', height: 36, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--mantine-color-default-border)' }}>
          {segs.length === 0 ? (
            <div style={{ width: '100%', backgroundColor: stateColor(ctx.snapshot?.state) }} title={ctx.snapshot?.state} />
          ) : (
            segs.map((p, i) => {
              const next = segs[i + 1]?.t ?? now
              const from = Math.max(p.t, start)
              const width = Math.max(0.5, ((next - from) / windowMs) * 100)
              return (
                <div
                  key={`${p.t}-${i}`}
                  title={`${p.state} · ${new Date(p.t).toLocaleTimeString()}`}
                  style={{ width: `${width}%`, backgroundColor: stateColor(p.state), minWidth: 2 }}
                />
              )
            })
          )}
        </div>
        <Group gap="xs">
          {STATE_LEGEND.filter((s) => presentStates.has(s) || s === ctx.snapshot?.state).map((s) => (
            <Badge key={s} size="xs" variant="dot" color={stateColor(s)} style={{ textTransform: 'none' }}>
              {s}
            </Badge>
          ))}
        </Group>
        <Text size="xs" c="dimmed">
          Last 30 min · now: <b>{ctx.snapshot?.state}</b>
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

function LineCard({ plant, dept, line }: { plant: string; dept: string; line: PlantNode['departments'][0]['lines'][0] }) {
  const oee = line.kpi.oeePct
  const total = line.kpi.goodCount + line.kpi.rejectCount
  const goodPct = total > 0 ? (line.kpi.goodCount / total) * 100 : 100
  const apqSpark = [
    { label: 'A', v: line.kpi.availabilityPct ?? 0 },
    { label: 'P', v: line.kpi.performancePct ?? 0 },
    { label: 'Q', v: line.kpi.qualityPct ?? 0 },
  ]
  return (
    <Card withBorder padding="md" radius="md" style={{ borderLeft: `4px solid ${oeeColor()}`, minHeight: 132 }}>
      <Group justify="space-between" mb={4}>
        <Text fw={600} size="sm" truncate>
          {line.name}
        </Text>
        <Badge size="xs" variant="dot" color={stateColor(line.kpi.status)}>
          {line.kpi.status}
        </Badge>
      </Group>
      <Group align="center" gap="md" wrap="nowrap">
        <RingProgress
          size={56}
          thickness={6}
          roundCaps
          sections={[{ value: Math.min(100, oee), color: oeeColor() }]}
          label={
            <RingGaugeLabel size="xs" color={oeeColor()}>
              {oee.toFixed(0)}
            </RingGaugeLabel>
          }
        />
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Text size="xs" c="dimmed" truncate>
            {plant} · {dept}
          </Text>
          <Group gap={6}>
            <Badge size="xs" variant="light" color="green">
              A {line.kpi.availabilityPct?.toFixed(0) ?? '—'}%
            </Badge>
            <Badge size="xs" variant="light" color="blue">
              P {line.kpi.performancePct?.toFixed(0) ?? '—'}%
            </Badge>
            <Badge size="xs" variant="light" color="grape">
              Q {line.kpi.qualityPct?.toFixed(0) ?? '—'}%
            </Badge>
          </Group>
          <Progress value={goodPct} size="sm" color="green" />
          <Group gap="md">
            <Text size="xs">Good {fmtNumber(line.kpi.goodCount)}</Text>
            <Text size="xs" c="red">
              Rej {fmtNumber(line.kpi.rejectCount)}
            </Text>
          </Group>
          <Sparkline data={apqSpark} color={oeeColor()} height={28} />
        </Stack>
      </Group>
    </Card>
  )
}

export function PlantGridWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<PlantNode[]>(() => getHierarchyTree(), 5000, [])
  const lines = (data ?? [])
    .filter((p) => !ctx.plantId || p.id === ctx.plantId)
    .flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ plant: p.name, dept: d.name, line: l }))))
    .sort((a, b) => b.line.kpi.oeePct - a.line.kpi.oeePct)
  return (
    <WidgetFrame title={widget.title ?? 'Plant Overview'} noData={lines.length === 0}>
      <ScrollArea h="100%">
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 3 }} spacing="sm">
          {lines.map(({ plant, dept, line }) => (
            <LineCard key={line.id} plant={plant} dept={dept} line={line} />
          ))}
        </SimpleGrid>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function MachineGridWidget({ widget, ctx }: WidgetProps) {
  const groupByLine = (widget.options.groupByLine as boolean | undefined) !== false
  const sortBy = ((widget.options.sortBy as MachineSortBy | undefined) ?? 'name') as MachineSortBy
  const { data } = usePolling<PlantNode[]>(() => getHierarchyTree(), 5000, [ctx.plantId])
  const groups = useMemo(
    () => buildMachineGridGroups(data ?? [], ctx.lineSnapshots, ctx.plantId ?? undefined, sortBy),
    [data, ctx.lineSnapshots, ctx.plantId, sortBy],
  )
  const flat = useMemo(() => flattenMachineGridGroups(groups, sortBy), [groups, sortBy])
  const totalMachines = flat.length
  const compact = resolveFrameVariant(widget, ctx) === 'compact'

  return (
    <WidgetFrame
      title={widget.title ?? 'All Machines'}
      noData={totalMachines === 0}
      stale={!ctx.hubConnected}
      variant={resolveFrameVariant(widget, ctx)}
      footer={
        !ctx.hubConnected ? (
          <Text size="xs" c="dimmed">
            Live hub disconnected — showing last known values where available
          </Text>
        ) : undefined
      }
    >
      <ScrollArea h="100%">
        {groupByLine ? (
          <Stack gap="md">
            {groups.map((group) => (
              <Stack key={group.lineId} gap="xs">
                <Text size="sm" fw={600}>
                  {group.lineName}
                  <Text span size="xs" c="dimmed" ml={8}>
                    {group.plantName} · {group.deptName}
                  </Text>
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
                  {group.machines.map((entry) => (
                    <MachineGridCard key={entry.machineId} snapshot={entry.snapshot} compact={compact} />
                  ))}
                </SimpleGrid>
              </Stack>
            ))}
          </Stack>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="sm">
            {flat.map((entry) => (
              <MachineGridCard key={entry.machineId} snapshot={entry.snapshot} compact={compact} />
            ))}
          </SimpleGrid>
        )}
      </ScrollArea>
    </WidgetFrame>
  )
}

export function LiveTagValueWidget({ widget }: WidgetProps) {
  const tagPath = widget.binding.tagPath
  const connectionId = widget.binding.connectionId
  const decimals = (widget.options.decimals as number) ?? 2
  const unit = (widget.options.unit as string) ?? ''

  const { data: sample } = usePolling(
    () =>
      connectionId && tagPath
        ? readTagValues(connectionId, [{ path: tagPath }]).then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    2000,
    [connectionId, tagPath],
  )

  const display =
    sample?.display ??
    (sample?.value !== undefined && sample?.value !== null ? Number(sample.value).toFixed(decimals) : '—')

  return (
    <WidgetFrame
      title={widget.title ?? 'PLC Tag'}
      noData={!tagPath}
      stale={sample?.quality === 'Stale'}
      footer={
        sample ? (
          <Text size="10px" c="dimmed" truncate>
            {tagPath} · {new Date(sample.timestampUtc).toLocaleTimeString()}
          </Text>
        ) : undefined
      }
    >
      <Stack gap={4} justify="center" h="100%">
        <MetricHero label={tagPath?.split(':').pop() ?? 'Tag'} value={`${display}${unit ? ` ${unit}` : ''}`} />
        {sample ? (
          <Badge size="xs" variant="light" color={sample.quality === 'Good' ? 'teal' : 'gray'} w="fit-content">
            {sample.quality}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">
            Bind a PLC tag in the builder.
          </Text>
        )}
      </Stack>
    </WidgetFrame>
  )
}

export function AttainmentTileWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const runPct = snap?.runAttainmentPct
  const shiftPct = snap?.shiftAttainmentPct
  const hasRun = runPct != null && snap?.runTargetQuantity != null
  const hasShift = shiftPct != null && snap?.shiftTargetQuantity != null
  return (
    <WidgetFrame title={widget.title ?? 'Production attainment'} noData={!hasRun && !hasShift} stale={!ctx.hubConnected}>
      <Stack gap="sm" justify="center" h="100%">
        {hasRun ? (
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Run / order</Text>
              <Text size="xs" fw={600}>{runPct!.toFixed(1)}%</Text>
            </Group>
            <Progress value={Math.min(100, runPct!)} size="lg" radius="xl" />
            <Text size="xs" c="dimmed">
              {fmtNumber(snap!.goodCount)} / {fmtNumber(snap!.runTargetQuantity!)} good
              {snap!.runPartsRemaining != null ? ` · ${fmtNumber(snap!.runPartsRemaining)} left` : ''}
            </Text>
          </Stack>
        ) : null}
        {hasShift ? (
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Shift plan</Text>
              <Text size="xs" fw={600}>{shiftPct!.toFixed(1)}%</Text>
            </Group>
            <Progress value={Math.min(100, shiftPct!)} size="lg" radius="xl" color="cyan" />
            <Text size="xs" c="dimmed">
              {fmtNumber(snap!.goodCount)} / {fmtNumber(snap!.shiftTargetQuantity!)} good
            </Text>
          </Stack>
        ) : null}
      </Stack>
    </WidgetFrame>
  )
}
