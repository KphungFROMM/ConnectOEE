import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Card,
  Group,
  ScrollArea,
  Skeleton,
  Table,
  Text,
} from '@mantine/core'
import type { DrillNode, EntityLevel } from '../../lib/historian'
import { oeeBadgeMantineColor, oeeExplorerHexColor } from '../widgets/common'
import { formatDurationMinutes } from '../../lib/formatDuration'

export type DrillSortKey = 'oee' | 'downtime' | 'uptime' | 'good'

function fmt(n: number) {
  return new Intl.NumberFormat().format(n)
}

function childLevelLabel(level: EntityLevel) {
  switch (level) {
    case 'Plant':
      return 'Departments'
    case 'Department':
      return 'Lines'
    case 'Line':
      return 'Machines'
    default:
      return ''
  }
}

interface Props {
  parentLevel: EntityLevel
  children: DrillNode[]
  loading?: boolean
  onSelect: (node: DrillNode) => void
}

export function DrillDownTable({ parentLevel, children, loading, onSelect }: Props) {
  const [sort, setSort] = useState<DrillSortKey>('oee')

  const sorted = useMemo(() => {
    const rows = [...children]
    rows.sort((a, b) => {
      if (sort === 'oee') return a.oee.oeePct - b.oee.oeePct
      if (sort === 'downtime') return b.downtimeMin - a.downtimeMin
      if (sort === 'uptime') return (b.uptimeMin ?? 0) - (a.uptimeMin ?? 0)
      return b.goodCount - a.goodCount
    })
    return rows
  }, [children, sort])

  const worst = useMemo(() => {
    if (sorted.length < 2) return null
    const low = sorted[0]
    const high = sorted[sorted.length - 1]
    if (high.oee.oeePct - low.oee.oeePct < 15) return null
    return low
  }, [sorted])

  if (parentLevel === 'Machine') return null

  return (
    <Card withBorder radius="md" padding="md">
      <Group justify="space-between" mb="xs">
        <Text fw={600}>Drill-down — {childLevelLabel(parentLevel)}</Text>
        <Group gap={6}>
          {(['oee', 'uptime', 'downtime', 'good'] as DrillSortKey[]).map((k) => (
            <Badge
              key={k}
              size="sm"
              variant={sort === k ? 'filled' : 'light'}
              style={{ cursor: 'pointer' }}
              onClick={() => setSort(k)}
            >
              {k === 'oee' ? 'OEE' : k === 'downtime' ? 'Downtime' : k === 'uptime' ? 'Uptime' : 'Good'}
            </Badge>
          ))}
        </Group>
      </Group>

      {worst ? (
        <Alert color="yellow" variant="light" mb="sm" title="Worst performer">
          {worst.name} is {worst.oee.oeePct.toFixed(0)}% OEE — largest gap vs peers in this range.
        </Alert>
      ) : null}

      {loading ? (
        <Skeleton height={200} />
      ) : (
        <ScrollArea.Autosize mah={360}>
          <Table highlightOnHover stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>OEE</Table.Th>
                <Table.Th ta="right">A/P/Q</Table.Th>
                <Table.Th ta="right">Good</Table.Th>
                <Table.Th ta="right">Up</Table.Th>
                <Table.Th ta="right">Down</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sorted.map((c) => (
                <Table.Tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(c)}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      <div
                        style={{
                          width: 48,
                          height: 8,
                          borderRadius: 4,
                          background: 'var(--mantine-color-gray-2)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, c.oee.oeePct)}%`,
                            height: '100%',
                            background: oeeExplorerHexColor(c.oee.oeePct) ?? 'var(--mantine-color-teal-6)',
                          }}
                        />
                      </div>
                      <Badge variant="light" color={oeeBadgeMantineColor(c.oee.oeePct)}>
                        {c.oee.oeePct.toFixed(0)}%
                      </Badge>
                    </Group>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text size="xs" c="dimmed">
                      {c.oee.availabilityPct.toFixed(0)}/{c.oee.performancePct.toFixed(0)}/{c.oee.qualityPct.toFixed(0)}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{fmt(c.goodCount)}</Table.Td>
                  <Table.Td ta="right">{formatDurationMinutes(c.uptimeMin ?? 0)}</Table.Td>
                  <Table.Td ta="right">{formatDurationMinutes(c.downtimeMin)}</Table.Td>
                </Table.Tr>
              ))}
              {sorted.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text size="sm" c="dimmed" ta="center">
                      No child nodes.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      )}
    </Card>
  )
}

export function DrillDownSkeleton() {
  return <Skeleton height={280} radius="md" />
}
