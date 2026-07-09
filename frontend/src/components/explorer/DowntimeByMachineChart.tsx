import { useMemo } from 'react'
import { Box, Card, Text } from '@mantine/core'
import type { DrillNode } from '../../lib/historian'
import type { DowntimeEvent } from '../../lib/metrics'
import type { MachineSnapshot } from '../../lib/liveHub'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { LeaderboardBars } from '../widgets/charts/LeaderboardBars'
import { AnalyticsEmpty } from '../analytics/AnalyticsEmpty'

function eventMachineId(e: DowntimeEvent): string | null {
  const raw = e as DowntimeEvent & { MachineId?: string | null }
  return e.machineId ?? raw.MachineId ?? null
}

function rollupFromEvents(events: DowntimeEvent[], machineNames: Record<string, string>) {
  const map = new Map<string, { name: string; minutes: number }>()
  for (const e of events) {
    const mid = eventMachineId(e)
    const key = mid ?? '__unknown__'
    const name = mid ? (machineNames[mid] ?? `Machine ${mid.slice(0, 6)}`) : 'Unassigned'
    const prev = map.get(key) ?? { name, minutes: 0 }
    prev.minutes += e.durationSec > 0 ? e.durationSec / 60 : 0
    map.set(key, prev)
  }
  return [...map.values()].filter((x) => x.minutes > 0).sort((a, b) => b.minutes - a.minutes)
}

function rollupFromDrilldown(children: DrillNode[], levels?: string[]) {
  const allowed = levels?.length ? new Set(levels) : new Set(['Machine'])
  return children
    .filter((c) => allowed.has(c.level) && c.downtimeMin > 0)
    .map((c) => ({ name: c.name, minutes: c.downtimeMin }))
    .sort((a, b) => b.minutes - a.minutes)
}

function rollupFromSnapshots(snapshots: MachineSnapshot[], lineId?: string) {
  return snapshots
    .filter((s) => !lineId || s.lineId === lineId)
    .map((s) => ({ name: s.machineName, minutes: s.downtimeMin ?? 0 }))
    .filter((x) => x.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)
}

interface Props {
  events: DowntimeEvent[]
  machineNames: Record<string, string>
  drilldown?: DrillNode[]
  drilldownLevels?: string[]
  liveSnapshots?: MachineSnapshot[]
  lineId?: string
  title?: string
}

export function DowntimeByMachineChart({
  events,
  machineNames,
  drilldown,
  drilldownLevels,
  liveSnapshots,
  lineId,
  title = 'Downtime by machine',
}: Props) {
  const items = useMemo(() => {
    const fromEvents = rollupFromEvents(events, machineNames)
    if (fromEvents.length > 0) {
      return fromEvents.map((x) => ({ name: x.name, value: Math.round(x.minutes * 10) / 10 }))
    }
    const fromDrill = rollupFromDrilldown(drilldown ?? [], drilldownLevels)
    if (fromDrill.length > 0) {
      return fromDrill.map((x) => ({ name: x.name, value: Math.round(x.minutes * 10) / 10 }))
    }
    const fromLive = rollupFromSnapshots(liveSnapshots ?? [], lineId)
    return fromLive.map((x) => ({ name: x.name, value: Math.round(x.minutes * 10) / 10 }))
  }, [events, machineNames, drilldown, drilldownLevels, liveSnapshots, lineId])

  const maxMin = items.length > 0 ? Math.max(...items.map((x) => x.value), 1) : 1

  if (items.length === 0) {
    return (
      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="sm">
          {title}
        </Text>
        <AnalyticsEmpty message="No machine downtime in range." />
      </Card>
    )
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Text fw={600} mb="xs">
        {title}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Total {formatDurationMinutes(items.reduce((s, x) => s + x.value, 0))} across {items.length} machine
        {items.length === 1 ? '' : 's'}
      </Text>
      <Box h={Math.max(120, items.length * 36)}>
        <LeaderboardBars items={items} maxValue={maxMin} />
      </Box>
    </Card>
  )
}
