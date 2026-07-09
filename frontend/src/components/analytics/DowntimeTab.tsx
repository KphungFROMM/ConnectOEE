import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Drawer,
  Group,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { listPendingDowntimeReasons } from '../../lib/admin'
import type { DrillNode, EntityLevel, HistorianEvent, HistorianLossBucket, ReasonBucket } from '../../lib/historian'
import { getProductionPartsLoss } from '../../lib/historian'
import type { ProductionPartsLossByCategory } from '../../lib/partsLoss'
import { formatDurationMinutes, formatDurationSeconds } from '../../lib/formatDuration'
import { correctDowntimeReason, getDowntimeByOperator, setDowntimeReason, type DowntimeEvent, type OperatorDowntime } from '../../lib/metrics'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import { DowntimeByMachineChart } from '../explorer/DowntimeByMachineChart'
import { TopReasonChips } from '../explorer/ExplorerDetailSections'
import { LossParetoChart } from './LossParetoChart'
import { LossesDonut } from './LossesDonut'
import { BarChart } from '@mantine/charts'

const CORRECT_CATEGORIES = ['Breakdown', 'SetupAndAdjustment', 'SmallStop', 'ReducedSpeed', 'StartupReject', 'ProductionReject']

interface Props {
  reasons: ReasonBucket[]
  losses: HistorianLossBucket[]
  events: HistorianEvent[]
  children?: DrillNode[]
  drilldownLevels?: string[]
  downtimeChartTitle?: string
  loading?: boolean
  categoryFilter?: string | null
  onCategoryFilter?: (cat: string | null) => void
  lineId?: string
  plantId?: string
  scopeLevel?: EntityLevel
  scopeId?: string
  from?: string
  to?: string
  onEventsRefresh?: () => Promise<void>
}

export function DowntimeTab({
  reasons,
  losses,
  events,
  children = [],
  drilldownLevels,
  downtimeChartTitle,
  loading,
  categoryFilter,
  onCategoryFilter,
  lineId,
  plantId,
  scopeLevel,
  scopeId,
  from,
  to,
  onEventsRefresh,
}: Props) {
  const [selected, setSelected] = useState<HistorianEvent | null>(null)
  const [reviewCodes, setReviewCodes] = useState<Set<number>>(new Set())
  const [operatorRows, setOperatorRows] = useState<OperatorDowntime[]>([])
  const [operatorLoading, setOperatorLoading] = useState(false)
  const [partsByCategory, setPartsByCategory] = useState<ProductionPartsLossByCategory[]>([])

  useEffect(() => {
    if (!scopeLevel || !scopeId) {
      setPartsByCategory([])
      return
    }
    void getProductionPartsLoss(scopeLevel, scopeId, from, to)
      .then((r) => setPartsByCategory(r.byCategory ?? []))
      .catch(() => setPartsByCategory([]))
  }, [scopeLevel, scopeId, from, to])

  useEffect(() => {
    void listPendingDowntimeReasons(lineId)
      .then((rows) => setReviewCodes(new Set(rows.map((r) => r.code))))
      .catch(() => setReviewCodes(new Set()))
  }, [lineId])

  useEffect(() => {
    if (!lineId && !plantId) {
      setOperatorRows([])
      return
    }
    setOperatorLoading(true)
    void getDowntimeByOperator(lineId, plantId, from, to)
      .then(setOperatorRows)
      .catch(() => setOperatorRows([]))
      .finally(() => setOperatorLoading(false))
  }, [lineId, plantId, from, to])

  const filteredReasons = useMemo(
    () => (categoryFilter ? reasons.filter((r) => r.category === categoryFilter) : reasons),
    [reasons, categoryFilter],
  )

  const filteredEvents = useMemo(
    () => (categoryFilter ? events.filter((e) => e.category === categoryFilter) : events),
    [events, categoryFilter],
  )

  const totalMin = filteredReasons.reduce((s, r) => s + r.totalMin, 0) || 1

  const sortedReasons = useMemo(
    () => [...filteredReasons].sort((a, b) => b.totalMin - a.totalMin),
    [filteredReasons],
  )

  const machineNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const e of events) {
      if (e.machineId && e.machineName) map[e.machineId] = e.machineName
    }
    return map
  }, [events])

  return (
    <Stack gap="md">
      {categoryFilter ? (
        <Group>
          <Badge variant="light">Category: {categoryFilter}</Badge>
          <Text size="sm" c="blue" style={{ cursor: 'pointer' }} onClick={() => onCategoryFilter?.(null)}>
            Clear filter
          </Text>
        </Group>
      ) : null}

      {loading ? (
        <Text c="dimmed" size="sm">
          Loading downtime breakdown…
        </Text>
      ) : (
        <DowntimeByMachineChart
          events={events as DowntimeEvent[]}
          machineNames={machineNames}
          drilldown={children}
          drilldownLevels={drilldownLevels}
          lineId={lineId}
          title={downtimeChartTitle}
        />
      )}

      <Group align="stretch" grow preventGrowOverflow={false} wrap="wrap">
        <Stack gap="xs" style={{ flex: 1, minWidth: 280 }}>
          <Text fw={600} size="sm">
            Loss Pareto
          </Text>
          {loading ? <Text c="dimmed">Loading…</Text> : <LossParetoChart reasons={reasons} />}
        </Stack>
        <Stack gap="xs" style={{ flex: 1, minWidth: 280 }}>
          <Text fw={600} size="sm">
            Six Big Losses
          </Text>
          {loading ? <Text c="dimmed">Loading…</Text> : <LossesDonut losses={losses} />}
        </Stack>
      </Group>

      {partsByCategory.length > 0 ? (
        <Stack gap="xs">
          <Text fw={600} size="sm">
            Parts lost by category (at ideal rate)
          </Text>
          <BarChart
            h={220}
            data={partsByCategory.map((c) => ({ category: c.category, Parts: c.partsLost }))}
            dataKey="category"
            series={[{ name: 'Parts', color: 'red.6' }]}
            withLegend={false}
          />
        </Stack>
      ) : null}

      {filteredReasons.length > 0 ? <TopReasonChips reasons={filteredReasons} /> : null}

      <div>
        <Text fw={600} mb="xs">
          Downtime by operator
        </Text>
        <ScrollArea.Autosize mah={240}>
          <Table highlightOnHover stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Operator</Table.Th>
                <Table.Th ta="right">Stops</Table.Th>
                <Table.Th ta="right">Total min</Table.Th>
                <Table.Th ta="right">Unplanned min</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {operatorLoading ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed" ta="center">
                      Loading…
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : (
                operatorRows.map((row) => (
                  <Table.Tr key={row.operatorId ?? row.operatorName}>
                    <Table.Td>{row.operatorName}</Table.Td>
                    <Table.Td ta="right">{row.stopCount}</Table.Td>
                    <Table.Td ta="right">{row.totalMin.toFixed(1)}</Table.Td>
                    <Table.Td ta="right">{row.unplannedMin.toFixed(1)}</Table.Td>
                  </Table.Tr>
                ))
              )}
              {!operatorLoading && operatorRows.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text size="sm" c="dimmed" ta="center">
                      No operator downtime in range.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </div>

      <div>
        <Text fw={600} mb="xs">
          Top reasons
        </Text>
        <ScrollArea.Autosize mah={280}>
          <Table highlightOnHover stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Count</Table.Th>
                <Table.Th ta="right">Minutes</Table.Th>
                <Table.Th ta="right">% of total</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedReasons.map((r, i) => (
                <Table.Tr
                  key={`${r.category}-${r.reason}-${i}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onCategoryFilter?.(r.category)}
                >
                  <Table.Td>{r.reason}</Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light">
                      {r.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{r.count}</Table.Td>
                  <Table.Td ta="right">{r.totalMin.toFixed(1)}</Table.Td>
                  <Table.Td ta="right">{((r.totalMin / totalMin) * 100).toFixed(0)}%</Table.Td>
                </Table.Tr>
              ))}
              {sortedReasons.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center">
                      No downtime in range.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </div>

      <div>
        <Text fw={600} mb="xs">
          Events
        </Text>
        <ScrollArea.Autosize mah={320}>
          <Table highlightOnHover stickyHeader>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Start</Table.Th>
                <Table.Th>Machine</Table.Th>
                <Table.Th>Reason</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th ta="right">Duration</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredEvents.map((e) => (
                <Table.Tr key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(e)}>
                  <Table.Td>
                    <Text size="xs">{new Date(e.startUtc).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>{e.machineName ?? '—'}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {e.reason ?? '—'}
                      {e.faultCode != null && reviewCodes.has(e.faultCode) ? (
                        <Badge size="xs" color="yellow">
                          Needs review
                        </Badge>
                      ) : null}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="xs" variant="light">
                      {e.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">{formatDurationSeconds(e.durationSec)}</Table.Td>
                </Table.Tr>
              ))}
              {filteredEvents.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center">
                      No events in range.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </div>

      <EventDrawer
        event={selected}
        onClose={() => setSelected(null)}
        needsReview={selected?.faultCode != null && reviewCodes.has(selected.faultCode)}
        onUpdated={async (updatedReason) => {
          if (selected) setSelected({ ...selected, reason: updatedReason })
          await onEventsRefresh?.()
        }}
      />
    </Stack>
  )
}

function EventDrawer({
  event,
  onClose,
  needsReview,
  onUpdated,
}: {
  event: HistorianEvent | null
  onClose: () => void
  needsReview?: boolean
  onUpdated?: (reason: string) => void | Promise<void>
}) {
  const { hasPermission } = useAuth()
  const canEdit = hasPermission(Permissions.EnterDowntimeReason)
  const isUnassigned = !event?.reason?.trim()
  const [editOpen, setEditOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState('Breakdown')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (event) {
      setReason(event.reason ?? '')
      setCategory(event.category)
    }
  }, [event])

  async function saveReason() {
    if (!event || !reason.trim()) return
    setSaving(true)
    try {
      if (isUnassigned) {
        await setDowntimeReason({ downtimeEventId: event.id, reason: reason.trim(), category })
        notifications.show({ message: 'Reason assigned', color: 'green' })
      } else {
        await correctDowntimeReason(event.id, { reason: reason.trim(), category })
        notifications.show({ message: 'Reason corrected', color: 'green' })
      }
      setEditOpen(false)
      await onUpdated?.(reason.trim())
    } catch (err) {
      notifications.show({ message: err instanceof Error ? err.message : 'Save failed', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Drawer opened={!!event} onClose={onClose} title="Downtime event" position="right" size="md">
        {event ? (
          <Stack gap="sm">
            <Text size="sm">
              <strong>Machine:</strong> {event.machineName ?? '—'}
            </Text>
            <Text size="sm">
              <strong>Start:</strong> {new Date(event.startUtc).toLocaleString()}
            </Text>
            {event.endUtc ? (
              <Text size="sm">
                <strong>End:</strong> {new Date(event.endUtc).toLocaleString()}
              </Text>
            ) : null}
            <Text size="sm">
              <strong>Duration:</strong> {formatDurationMinutes(event.durationSec / 60)}
            </Text>
            <Text size="sm">
              <strong>Category:</strong> {event.category} ({event.kind})
            </Text>
            <Text size="sm">
              <strong>Reason:</strong> {event.reason ?? '—'}
              {needsReview ? (
                <Badge ml="xs" size="sm" color="yellow">
                  PLC code needs review
                </Badge>
              ) : null}
            </Text>
            {event.faultCode != null ? (
              <Text size="sm">
                <strong>PLC code:</strong> {event.faultCode}
              </Text>
            ) : null}
            {event.isMicroStop ? <Badge color="gray">Micro-stop</Badge> : null}
            {canEdit ? (
              <Button variant="light" onClick={() => setEditOpen(true)}>
                {isUnassigned ? 'Assign reason' : 'Correct reason'}
              </Button>
            ) : null}
          </Stack>
        ) : null}
      </Drawer>

      <Modal opened={editOpen} onClose={() => setEditOpen(false)} title={isUnassigned ? 'Assign downtime reason' : 'Correct downtime reason'} centered>
        <Stack gap="sm">
          <TextInput label="Reason" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Select label="Category" data={CORRECT_CATEGORIES} value={category} onChange={(v) => setCategory(v ?? 'Breakdown')} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button loading={saving} disabled={!reason.trim()} onClick={() => void saveReason()}>
              Save
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
