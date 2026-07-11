import { useEffect, useMemo, useState } from 'react'
import { Alert, Anchor, Badge, Card, Group, Progress, SimpleGrid, Stack, Table, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import type { ReasonBucket } from '../../lib/historian'
import type { MachineSnapshot } from '../../lib/liveHub'
import { getCurrentShift, getDowntime, type DowntimeEvent, type ShiftInstance } from '../../lib/metrics'
import { formatDurationMinutes, formatDurationSeconds } from '../../lib/formatDuration'
import { scopeToParam } from '../../lib/scopeFromUrl'
import { PresentationKpi } from '../widgets/design/PresentationKpi'
import { WidgetFrame } from '../widgets/common'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import { DowntimeByMachineChart } from './DowntimeByMachineChart'
import { liveMetricsFromSnapshot, type ExplorerLiveMetrics } from './explorerKpi'
import type { DrillNode } from '../../lib/historian'

const FALLBACK_SHIFT = 'all day'

function isFallbackShift(name: string) {
  return name.trim().toLowerCase() === FALLBACK_SHIFT
}

export function OfflineHint({ connectionState }: { connectionState: string }) {
  if (connectionState === 'Connected') return null
  if (connectionState === 'Stale' || connectionState === 'Connecting' || connectionState === 'Faulted') return null
  return (
    <Alert color="gray" variant="light" title="Not live yet">
      System is connected; this node has no live PLC snapshot yet. Map Run State and Good Count in Admin → Tag Mapping, or
      restart the API after adding machines so drivers pick up the new hierarchy.
    </Alert>
  )
}

export function ShiftContextBar({
  lineId,
  plantId,
  snapshot,
  shiftFromApi,
}: {
  lineId?: string
  plantId?: string
  snapshot?: MachineSnapshot
  shiftFromApi?: ShiftInstance | null
}) {
  const [shift, setShift] = useState<ShiftInstance | null>(shiftFromApi ?? null)

  useEffect(() => {
    if (!lineId && !plantId) return
    const load = () =>
      void getCurrentShift(lineId ?? null, plantId ?? null)
        .then(setShift)
        .catch(() => undefined)
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [lineId, plantId])

  const name = shift?.shiftName ?? snapshot?.shiftName ?? '—'
  const startUtc = shift?.startUtc ?? snapshot?.shiftStartUtc
  const endUtc = shift?.endUtc ?? snapshot?.shiftEndUtc
  const fallback = isFallbackShift(name)

  const progress = useMemo(() => {
    if (!startUtc || !endUtc) return null
    const start = new Date(startUtc).getTime()
    const end = new Date(endUtc).getTime()
    const now = Date.now()
    const total = Math.max(1, end - start)
    const elapsed = Math.max(0, Math.min(total, now - start))
    const remaining = Math.max(0, end - now)
    return {
      pct: (elapsed / total) * 100,
      elapsedSec: elapsed / 1000,
      remainingSec: remaining / 1000,
    }
  }, [startUtc, endUtc])

  return (
    <WidgetSurface tone="info" padding="md" radius="md">
      <Group justify="space-between" mb="xs" wrap="wrap">
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Current shift
          </Text>
          <Text fw={700}>{fallback ? 'No shift assigned' : name}</Text>
        </div>
        {!fallback && startUtc && endUtc ? (
          <Text size="sm" c="dimmed">
            {new Date(startUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            {' – '}
            {new Date(endUtc).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : null}
      </Group>
      {progress && !fallback ? (
        <Stack gap={6}>
          <Progress value={progress.pct} size="md" radius="xl" color="blue" />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">
              {formatDurationSeconds(progress.elapsedSec)} elapsed
            </Text>
            <Text size="xs" c="dimmed">
              {formatDurationSeconds(progress.remainingSec)} remaining
            </Text>
          </Group>
        </Stack>
      ) : null}
    </WidgetSurface>
  )
}

export function ReliabilityStrip({ live }: { live: ExplorerLiveMetrics | null }) {
  if (!live) return null
  return (
    <WidgetFrame title="Reliability (shift)">
      <SimpleGrid cols={{ base: 2, sm: 4, md: 7 }} spacing="xs">
        <PresentationKpi presentation="ring" label="MTTR" value={`${live.mttrMin.toFixed(1)}m`} numericValue={live.mttrMin} max={30} helpId="mttrMin" />
        <PresentationKpi presentation="number" label="MTBF" value={formatDurationMinutes(live.mtbfMin)} helpId="mtbfMin" />
        <PresentationKpi presentation="number" label="MTTF" value={formatDurationMinutes(live.mttfMin)} helpId="mttfMin" />
        <PresentationKpi presentation="number" label="MTTD" value={formatDurationMinutes(live.mttdMin)} helpId="mttdMin" />
        <PresentationKpi presentation="ring" label="Stops/hr" value={live.stopsPerHour.toFixed(1)} numericValue={live.stopsPerHour} max={10} helpId="stopsPerHour" />
        <PresentationKpi presentation="number" label="Failures" value={`${live.failureCount}`} helpId="failureCount" />
        <PresentationKpi presentation="number" label="Micro-stops" value={`${live.microStopCount}`} helpId="microStopCount" />
      </SimpleGrid>
    </WidgetFrame>
  )
}

const CATEGORY_COLORS: Record<string, string> = {
  Breakdown: 'red',
  SetupAndAdjustment: 'orange',
  SmallStop: 'yellow',
  ReducedSpeed: 'grape',
  StartupReject: 'cyan',
  ProductionReject: 'blue',
  Unattributed: 'gray',
}

function categoryBadgeColor(category: string): string {
  return CATEGORY_COLORS[category] ?? 'gray'
}

export function TopReasonChips({ reasons }: { reasons: ReasonBucket[] }) {
  const top = [...reasons].sort((a, b) => b.totalMin - a.totalMin).slice(0, 5)
  if (top.length === 0) return null
  return (
    <Card withBorder radius="md" padding="md">
      <Text fw={600} mb="xs">
        Top downtime reasons
      </Text>
      <Group gap="xs">
        {top.map((r) => (
          <Badge key={`${r.category}-${r.reason}`} variant="light" color={categoryBadgeColor(r.category)}>
            {r.reason} · {formatDurationMinutes(r.totalMin)}
          </Badge>
        ))}
      </Group>
    </Card>
  )
}

function sameId(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase())
}

function eventMachineId(e: DowntimeEvent): string | null | undefined {
  const raw = e as DowntimeEvent & { MachineId?: string | null }
  return raw.machineId ?? raw.MachineId
}

function scopeEvents(events: DowntimeEvent[], machineId?: string): DowntimeEvent[] {
  if (!machineId) return events
  return events.filter((e) => sameId(eventMachineId(e), machineId))
}

export function LineDowntimeSection({
  lineId,
  machineId,
  machineNames = {},
  drilldown,
  showChart = true,
}: {
  lineId: string
  machineId?: string
  machineNames?: Record<string, string>
  drilldown?: DrillNode[]
  showChart?: boolean
}) {
  const [events, setEvents] = useState<DowntimeEvent[]>([])
  const showMachine = !machineId

  useEffect(() => {
    const load = () =>
      void getDowntime(lineId, null, machineId)
        .then((rows) => setEvents(scopeEvents(rows, machineId)))
        .catch(() => setEvents([]))
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [lineId, machineId])

  const unassigned = events.filter((e) => !e.reason).length

  function machineLabel(e: DowntimeEvent): string {
    const mid = eventMachineId(e)
    if (!mid) return '—'
    return machineNames[mid] ?? `Machine ${mid.slice(0, 6)}`
  }

  return (
    <Stack gap="sm">
      {showMachine && showChart ? (
        <DowntimeByMachineChart events={events} machineNames={machineNames} drilldown={drilldown} />
      ) : null}
      <Card withBorder radius="md" padding="lg">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Recent downtime & changeovers</Text>
          <Group gap="xs">
            {unassigned > 0 ? (
              <Badge color="orange" variant="light" size="sm">
                {unassigned} unassigned
              </Badge>
            ) : null}
            <Anchor component={Link} to={`/analytics?scope=${encodeURIComponent(scopeToParam('Line', lineId))}&tab=downtime`} size="sm">
              View downtime log
            </Anchor>
          </Group>
        </Group>
        {events.length === 0 ? (
          <Text size="sm" c="dimmed">
            No downtime recorded in the last 24h.
          </Text>
        ) : (
          <Table fz="sm">
            <Table.Thead>
              <Table.Tr>
                {showMachine ? <Table.Th>Machine</Table.Th> : null}
                <Table.Th>Start</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th>Duration</Table.Th>
                <Table.Th>Reason</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {events.slice(0, 15).map((e) => (
                <Table.Tr key={e.id}>
                  {showMachine ? (
                    <Table.Td>
                      <Text size="sm" fw={600}>
                        {machineLabel(e)}
                      </Text>
                    </Table.Td>
                  ) : null}
                  <Table.Td>{new Date(e.startUtc).toLocaleString()}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={categoryBadgeColor(e.category)}>
                      {e.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{e.durationSec ? formatDurationSeconds(e.durationSec) : 'open'}</Table.Td>
                  <Table.Td c={e.reason ? undefined : 'dimmed'}>{e.reason ?? 'unassigned'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  )
}

export { liveMetricsFromSnapshot }
