import { Badge, ScrollArea, SimpleGrid, Stack, Table, Text, UnstyledButton } from '@mantine/core'
import { useMemo, useState } from 'react'
import { getHierarchyTree } from '../../lib/hierarchy'
import { getDowntime, type DowntimeEvent } from '../../lib/metrics'
import { WidgetFrame, fmtNumber, oeeColor, formatDurationSeconds, formatMetricDuration } from './common'
import type { WidgetProps } from './common'
import { MetricHero } from './design/MetricHero'
import { flatLines } from './plantLineRanking'
import { hasMetricHelp } from '../../lib/help'
import { SNAPSHOT_FIELDS } from './registry'
import { resolveScopedField } from './resolveScopedSnapshot'
import { usePolling } from './usePolling'

type SortDir = 'asc' | 'desc'

function useSortState<T>(rows: T[], defaultKey: keyof T & string) {
  const [sortKey, setSortKey] = useState(defaultKey)
  const [dir, setDir] = useState<SortDir>('desc')
  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      const cmp =
        typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av ?? '').localeCompare(String(bv ?? ''))
      return dir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [rows, sortKey, dir])

  function toggle(key: keyof T & string) {
    if (key === sortKey) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setDir('desc')
    }
  }
  return { sorted, sortKey, dir, toggle }
}

export function DataTableWidget({ widget, ctx }: WidgetProps) {
  const dataSource = (widget.options.dataSource as 'lines' | 'downtime') ?? 'lines'
  const { data: tree } = usePolling(() => getHierarchyTree(), 10000, [])
  const { data: downtime } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )

  const lineRows = useMemo(
    () =>
      flatLines(tree, ctx.plantId).map(({ plant, dept, line }) => ({
        name: line.name,
        plant: `${plant} · ${dept}`,
        oee: line.kpi.oeePct,
        good: line.kpi.goodCount,
        status: line.kpi.status,
      })),
    [tree, ctx.plantId],
  )

  const dtRows = useMemo(
    () =>
      (downtime ?? []).map((e) => ({
        start: new Date(e.startUtc).toLocaleTimeString(),
        category: e.category,
        duration: e.durationSec ?? 0,
        reason: e.reason ?? '—',
      })),
    [downtime],
  )

  const lineSort = useSortState(lineRows, 'oee')
  const dtSort = useSortState(dtRows, 'duration')

  const isLines = dataSource === 'lines'
  const rows = isLines ? lineSort.sorted : dtSort.sorted
  const noData = rows.length === 0

  return (
    <WidgetFrame title={widget.title ?? (isLines ? 'Lines' : 'Downtime')} noData={noData} stale={!ctx.hubConnected}>
      <ScrollArea h="100%" type="auto">
        <Table stickyHeader highlightOnHover fz="xs">
          {isLines ? (
            <>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <UnstyledButton onClick={() => lineSort.toggle('name')}>Line</UnstyledButton>
                  </Table.Th>
                  <Table.Th>Plant</Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => lineSort.toggle('oee')}>OEE</UnstyledButton>
                  </Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => lineSort.toggle('good')}>Good</UnstyledButton>
                  </Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lineSort.sorted.map((r) => (
                  <Table.Tr key={r.name}>
                    <Table.Td>{r.name}</Table.Td>
                    <Table.Td c="dimmed">{r.plant}</Table.Td>
                    <Table.Td fw={700} c={oeeColor()}>{r.oee.toFixed(1)}%</Table.Td>
                    <Table.Td>{fmtNumber(r.good)}</Table.Td>
                    <Table.Td>
                      <Badge size="xs" variant="light">{r.status}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </>
          ) : (
            <>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Start</Table.Th>
                  <Table.Th>Category</Table.Th>
                  <Table.Th>
                    <UnstyledButton onClick={() => dtSort.toggle('duration')}>Duration</UnstyledButton>
                  </Table.Th>
                  <Table.Th>Reason</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {dtSort.sorted.map((r, i) => (
                  <Table.Tr key={`${r.start}-${i}`}>
                    <Table.Td>{r.start}</Table.Td>
                    <Table.Td>{r.category}</Table.Td>
                    <Table.Td>{Math.round(r.duration)}s</Table.Td>
                    <Table.Td c={r.reason === '—' ? 'dimmed' : undefined}>{r.reason}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </>
          )}
        </Table>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function TopNTableWidget({ widget, ctx }: WidgetProps) {
  const field = (widget.binding.field as string) ?? (widget.options.field as string) ?? 'oeePct'
  const limit = (widget.options.limit as number) ?? 5
  const { data: tree } = usePolling(() => getHierarchyTree(), 10000, [])

  const rows = useMemo(() => {
    return flatLines(tree, ctx.plantId)
      .map(({ line }) => ({
        name: line.name,
        value: (line.kpi as unknown as Record<string, number>)[field] ?? 0,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit)
  }, [tree, ctx.plantId, field, limit])

  return (
    <WidgetFrame title={widget.title ?? `Top ${limit}`} noData={rows.length === 0} stale={!ctx.hubConnected}>
      <Table fz="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>#</Table.Th>
            <Table.Th>Line</Table.Th>
            <Table.Th>{field}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r, i) => (
            <Table.Tr key={r.name}>
              <Table.Td>{i + 1}</Table.Td>
              <Table.Td>{r.name}</Table.Td>
              <Table.Td fw={700}>{typeof r.value === 'number' ? r.value.toFixed(1) : r.value}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </WidgetFrame>
  )
}

export function DrillThroughListWidget({ widget, ctx }: WidgetProps) {
  const { data } = usePolling<DowntimeEvent[]>(
    () => getDowntime(ctx.lineId, ctx.plantId),
    8000,
    [ctx.lineId, ctx.plantId],
  )
  const rows = data ?? []

  return (
    <WidgetFrame title={widget.title ?? 'Downtime Drill-through'} noData={rows.length === 0} stale={!ctx.hubConnected}>
      <ScrollArea h="100%" type="auto">
        <Stack gap="xs">
          {rows.map((e) => (
            <Stack key={e.id} gap={2} p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              <Text size="xs" fw={600}>
                {new Date(e.startUtc).toLocaleTimeString()} · {e.category}
              </Text>
              <Text size="sm">
                {e.durationSec ? formatDurationSeconds(e.durationSec) : '—'}
              </Text>
              <Text size="xs" c={e.reason ? undefined : 'dimmed'}>
                {e.reason ?? 'Unassigned'}
              </Text>
            </Stack>
          ))}
        </Stack>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function KpiTileGroupWidget({ widget, ctx }: WidgetProps) {
  const fields = (widget.options.fields as string[]) ?? ['oeePct', 'availabilityPct', 'performancePct', 'qualityPct']
  return (
    <WidgetFrame title={widget.title} stale={!ctx.hubConnected}>
      <SimpleGrid cols={{ base: 2, sm: Math.min(fields.length, 4) }} spacing="xs" h="100%">
        {fields.map((field) => {
          const raw = resolveScopedField(ctx, widget.binding, field)
          const isPct = field.includes('Pct')
          const durationDisplay = typeof raw === 'number' ? formatMetricDuration(field, raw) : null
          const display =
            durationDisplay ??
            (typeof raw === 'number' ? `${raw.toFixed(isPct ? 1 : 0)}${isPct ? '%' : ''}` : String(raw ?? '—'))
          const label = SNAPSHOT_FIELDS.find((f) => f.value === field)?.label ?? field
          const helpId = hasMetricHelp(field) ? field : undefined
          return <MetricHero key={field} label={label} value={display} helpId={helpId} />
        })}
      </SimpleGrid>
    </WidgetFrame>
  )
}
