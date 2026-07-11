import { useMemo, useState } from 'react'
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Pagination,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { useMediaQuery } from '@mantine/hooks'
import type { DowntimeEvent } from '../../lib/metrics'
import { formatDurationSeconds } from '../../lib/formatDuration'

const PAGE_SIZE = 25
const COMPACT_MAX = 8

function formatEventTime(iso: string, relative: boolean): string {
  const d = new Date(iso)
  if (!relative) return d.toLocaleString()
  const sec = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (sec < 60) return 'just now'
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return d.toLocaleString()
}

interface Props {
  events: DowntimeEvent[]
  machineNameById: Map<string, string>
  lineNameById?: Map<string, string>
  lineNameByMachineId?: Map<string, string>
  /** When true (plant / all-lines view), show a Line column. */
  showLine?: boolean
  loading?: boolean
  onAssign: (event: DowntimeEvent) => void
  pendingReviewCodes: Set<number>
  mode?: 'line' | 'machine'
  machineName?: string
  downtimeLogHref?: string
}

export function ReasonQueue({
  events,
  machineNameById,
  lineNameById,
  lineNameByMachineId,
  showLine = false,
  loading,
  onAssign,
  pendingReviewCodes,
  mode = 'line',
  machineName,
  downtimeLogHref,
}: Props) {
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [page, setPage] = useState(1)
  const [groupByMachine, setGroupByMachine] = useState<'off' | 'on'>('off')
  const [expanded, setExpanded] = useState(false)

  const rows = useMemo(() => {
    const sorted = [...events].sort(
      (a, b) => new Date(b.startUtc).getTime() - new Date(a.startUtc).getTime(),
    )
    if (groupByMachine === 'off' || mode === 'machine') return sorted
    const byMachine = new Map<string, DowntimeEvent[]>()
    for (const e of sorted) {
      const key = e.machineId ?? 'unknown'
      const list = byMachine.get(key) ?? []
      list.push(e)
      byMachine.set(key, list)
    }
    return [...byMachine.values()].flat()
  }, [events, groupByMachine, mode])

  const compact = mode === 'machine' && !expanded
  const pageSize = compact ? COMPACT_MAX : PAGE_SIZE
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const pageRows = compact ? rows.slice(0, COMPACT_MAX) : rows.slice((page - 1) * pageSize, page * pageSize)
  const hideMachineCol = mode === 'machine'
  const showLineCol = showLine && mode !== 'machine'
  const useRelativeTime = isMobile || mode === 'machine'

  const title =
    mode === 'machine' && machineName
      ? `Unassigned stops — ${machineName}`
      : 'Reason queue'

  return (
    <Card withBorder radius="md" padding="lg">
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Text fw={700}>{title}</Text>
        <Group gap="sm">
          {mode === 'line' ? (
            <SegmentedControl
              size="xs"
              value={groupByMachine}
              onChange={(v) => {
                setGroupByMachine(v as 'off' | 'on')
                setPage(1)
              }}
              data={[
                { value: 'off', label: 'By time' },
                { value: 'on', label: 'By machine' },
              ]}
            />
          ) : null}
          <Badge color={events.length > 0 ? 'orange' : 'green'} variant="light">
            {events.length} unassigned
          </Badge>
        </Group>
      </Group>

      {loading ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : events.length === 0 ? (
        <Stack gap="xs">
          <Text size="sm" c="green">
            All recent stops have a reason. Nice work.
          </Text>
          {downtimeLogHref ? (
            <Anchor component={Link} to={downtimeLogHref} size="sm">
              View downtime log
            </Anchor>
          ) : null}
        </Stack>
      ) : (
        <>
          <ScrollArea.Autosize mah={compact ? 320 : 420}>
            <Table highlightOnHover stickyHeader>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Start</Table.Th>
                  {showLineCol ? <Table.Th>Line</Table.Th> : null}
                  {!hideMachineCol ? <Table.Th>Machine</Table.Th> : null}
                  <Table.Th>Category</Table.Th>
                  <Table.Th>Duration</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pageRows.map((e) => {
                  const mName =
                    (e.machineId && machineNameById.get(e.machineId.toLowerCase())) ?? '—'
                  const lName =
                    (e.lineId && lineNameById?.get(e.lineId.toLowerCase())) ||
                    (e.machineId && lineNameByMachineId?.get(e.machineId.toLowerCase())) ||
                    '—'
                  return (
                    <Table.Tr key={e.id}>
                      <Table.Td>
                        <Text size="sm">{formatEventTime(e.startUtc, useRelativeTime)}</Text>
                      </Table.Td>
                      {showLineCol ? (
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {lName}
                          </Text>
                        </Table.Td>
                      ) : null}
                      {!hideMachineCol ? <Table.Td>{mName}</Table.Td> : null}
                      <Table.Td>
                        <Group gap={4}>
                          <Badge size="sm" variant="light">
                            {e.category}
                          </Badge>
                          {e.faultCode != null && pendingReviewCodes.has(e.faultCode) ? (
                            <Badge size="xs" color="yellow">
                              Review
                            </Badge>
                          ) : null}
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {e.durationSec ? formatDurationSeconds(e.durationSec) : 'ongoing'}
                      </Table.Td>
                      <Table.Td>
                        <Button size={mode === 'machine' ? 'sm' : 'xs'} onClick={() => onAssign(e)}>
                          Set reason
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea.Autosize>

          {compact && rows.length > COMPACT_MAX ? (
            <Group justify="center" mt="md">
              <Button variant="light" onClick={() => setExpanded(true)}>
                Show all {rows.length} stops
              </Button>
            </Group>
          ) : null}

          {!compact && totalPages > 1 ? (
            <Group justify="center" mt="md">
              <Pagination value={page} onChange={setPage} total={totalPages} size="sm" />
            </Group>
          ) : null}
        </>
      )}
    </Card>
  )
}
