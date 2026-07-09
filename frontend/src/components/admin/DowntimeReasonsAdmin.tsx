import { useEffect, useState } from 'react'
import { Anchor, Badge, Button, Card, Group, NumberInput, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import {
  createDowntimeReason,
  deleteDowntimeReason,
  listDowntimeReasons,
  listPendingDowntimeReasons,
  updateDowntimeReason,
  type DowntimeReasonDto,
} from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'

const CATEGORIES = ['Breakdown', 'SetupAndAdjustment', 'SmallStop', 'ReducedSpeed', 'StartupReject', 'ProductionReject']
const KINDS = ['Unplanned', 'Planned']

export function DowntimeReasonsAdmin() {
  const [items, setItems] = useState<DowntimeReasonDto[]>([])
  const [pending, setPending] = useState<DowntimeReasonDto[]>([])
  const [tree, setTree] = useState<PlantNode[]>([])
  const [lineId, setLineId] = useState<string | null>(null)
  const [code, setCode] = useState<number>(0)
  const [reason, setReason] = useState('')
  const [category, setCategory] = useState('Breakdown')
  const [kind, setKind] = useState('Unplanned')
  const [machineId, setMachineId] = useState<string | null>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const lineOpts = tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${d.name} / ${l.name}` }))))
  const machineOpts = tree.flatMap((p) =>
    p.departments.flatMap((d) =>
      d.lines
        .filter((l) => !lineId || l.id === lineId)
        .flatMap((l) => l.machines.map((m) => ({ value: m.id, label: `${l.name} / ${m.name}` }))),
    ),
  )

  const reload = () => {
    void listDowntimeReasons(lineId ?? undefined).then(setItems).catch(() => undefined)
    void listPendingDowntimeReasons(lineId ?? undefined).then(setPending).catch(() => undefined)
  }
  useEffect(() => {
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])
  useEffect(reload, [lineId])

  async function save() {
    try {
      const body = { code, reason, category, kind, lineId, machineId }
      if (editId) await updateDowntimeReason(editId, body)
      else await createDowntimeReason(body)
      setEditId(null)
      setReason('')
      setCode(0)
      setMachineId(null)
      reload()
      notifications.show({ message: 'Downtime reason saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save', color: 'red' })
    }
  }

  function startEdit(f: DowntimeReasonDto) {
    setEditId(f.id)
    setCode(f.code)
    setReason(f.reason)
    setCategory(f.category)
    setKind(f.kind)
    setLineId(f.lineId ?? null)
    setMachineId(f.machineId ?? null)
  }

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Map numeric PLC stop codes to descriptions and loss categories. Unknown codes from a bound tag are added automatically for review.
        For stop history and corrections, use{' '}
        <Anchor component={Link} to="/analytics?tab=downtime" size="sm">
          Analytics → Downtime → Events
        </Anchor>
        .
      </Text>
      <Select label="Filter by line" data={lineOpts} value={lineId} onChange={setLineId} clearable searchable placeholder="All lines" />
      {pending.length > 0 ? (
        <Card withBorder padding="md" style={{ borderColor: 'var(--mantine-color-amber-4)' }}>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Pending review</Text>
            <Badge color="amber">{pending.length}</Badge>
          </Group>
          <Table fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Code</Table.Th>
                <Table.Th>Placeholder</Table.Th>
                <Table.Th>Category</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pending.map((f) => (
                <Table.Tr key={f.id}>
                  <Table.Td>{f.code}</Table.Td>
                  <Table.Td>{f.reason}</Table.Td>
                  <Table.Td>{f.category}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" onClick={() => startEdit(f)}>
                      Complete
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ) : null}
      <Card withBorder padding="md">
        <Text fw={600} mb="xs">
          {editId ? 'Edit downtime reason' : 'Add downtime reason'}
        </Text>
        <Group grow align="flex-end">
          <NumberInput label="PLC code" value={code} onChange={(v) => setCode(Number(v) || 0)} />
          <TextInput label="Description" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <Select label="Category" data={CATEGORIES} value={category} onChange={(v) => setCategory(v ?? 'Breakdown')} />
          <Select label="Kind" data={KINDS} value={kind} onChange={(v) => setKind(v ?? 'Unplanned')} />
          <Select
            label="Machine (optional)"
            data={machineOpts}
            value={machineId}
            onChange={setMachineId}
            clearable
            searchable
            placeholder="Line-wide"
          />
          <Button onClick={save} disabled={!reason.trim()}>
            {editId ? 'Update' : 'Add'}
          </Button>
        </Group>
      </Card>
      <Table fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Code</Table.Th>
            <Table.Th>Description</Table.Th>
            <Table.Th>Category</Table.Th>
            <Table.Th>Kind</Table.Th>
            <Table.Th>Machine</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {items.map((f) => (
            <Table.Tr key={f.id}>
              <Table.Td>{f.code}</Table.Td>
              <Table.Td>{f.reason}</Table.Td>
              <Table.Td>{f.category}</Table.Td>
              <Table.Td>{f.kind}</Table.Td>
              <Table.Td>
                {f.machineId
                  ? machineOpts.find((m) => m.value === f.machineId)?.label ?? f.machineId.slice(0, 8)
                  : '—'}
              </Table.Td>
              <Table.Td>
                {f.needsReview ? (
                  <Badge color="amber" size="sm">
                    Needs review
                  </Badge>
                ) : f.isAutoCreated ? (
                  <Badge color="gray" size="sm" variant="light">
                    Auto
                  </Badge>
                ) : null}
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <Button size="xs" variant="light" onClick={() => startEdit(f)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={async () => {
                      await deleteDowntimeReason(f.id)
                      reload()
                    }}
                  >
                    Delete
                  </Button>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
