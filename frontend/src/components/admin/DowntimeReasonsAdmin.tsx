import { useEffect, useMemo, useState } from 'react'
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core'
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
const SYNTHETIC_MIN = 9000

function prettyCategory(c: string) {
  return c.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function DowntimeReasonsAdmin() {
  const [items, setItems] = useState<DowntimeReasonDto[]>([])
  const [pending, setPending] = useState<DowntimeReasonDto[]>([])
  const [tree, setTree] = useState<PlantNode[]>([])
  const [lineId, setLineId] = useState<string | null>(null)
  /** null = auto-assign synthetic code (Operator quick reason without PLC mapping). */
  const [code, setCode] = useState<number | null>(null)
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

  const previewByCategory = useMemo(() => {
    const map = new Map<string, DowntimeReasonDto[]>()
    for (const f of items.filter((x) => !x.needsReview)) {
      const list = map.get(f.category) ?? []
      list.push(f)
      map.set(f.category, list)
    }
    return map
  }, [items])

  async function save() {
    try {
      const body = {
        code,
        reason: reason.trim(),
        category,
        kind,
        lineId,
        machineId,
      }
      if (editId) await updateDowntimeReason(editId, body)
      else await createDowntimeReason(body)
      setEditId(null)
      setReason('')
      setCode(null)
      setMachineId(null)
      reload()
      notifications.show({ message: 'Reason saved — appears on Operator Station quick buttons', color: 'green' })
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

  function resetForm() {
    setEditId(null)
    setReason('')
    setCode(null)
    setMachineId(null)
    setCategory('Breakdown')
    setKind('Unplanned')
  }

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        These descriptions become <strong>Operator Station</strong> quick-reason buttons, grouped by loss category. Leave PLC
        code blank for operator-only reasons (auto code {SYNTHETIC_MIN}+). Map a real PLC stop code when the controller
        sends numeric faults. Unknown PLC codes appear under Pending review. Stop history:{' '}
        <Anchor component={Link} to="/analytics?tab=downtime" size="sm">
          Analytics → Downtime
        </Anchor>
        .
      </Text>
      <Select label="Filter by line" data={lineOpts} value={lineId} onChange={setLineId} clearable searchable placeholder="All lines (plant-wide)" />

      {pending.length > 0 ? (
        <Card withBorder padding="md" style={{ borderColor: 'var(--mantine-color-amber-4)' }}>
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Pending review (PLC stubs)</Text>
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
        <Group justify="space-between" mb="xs">
          <Text fw={600}>{editId ? 'Edit reason' : 'Add quick reason'}</Text>
          {editId ? (
            <Button size="xs" variant="subtle" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </Group>
        <Stack gap="sm">
          <Group grow align="flex-end">
            <TextInput
              label="Description (button label)"
              placeholder="e.g. Material shortage"
              value={reason}
              onChange={(e) => setReason(e.currentTarget.value)}
            />
            <Select label="Category" data={CATEGORIES} value={category} onChange={(v) => setCategory(v ?? 'Breakdown')} />
            <Select label="Kind" data={KINDS} value={kind} onChange={(v) => setKind(v ?? 'Unplanned')} />
          </Group>
          <Group grow align="flex-end">
            <NumberInput
              label="PLC code (optional)"
              description={code == null ? `Auto ${SYNTHETIC_MIN}+ when blank` : code >= SYNTHETIC_MIN ? 'Operator-only (synthetic)' : 'Mapped PLC fault'}
              placeholder="Leave blank for Operator-only"
              value={code ?? undefined}
              onChange={(v) => setCode(v === '' || v == null ? null : Number(v))}
              min={0}
              allowDecimal={false}
              clearable
            />
            <Select
              label="Machine (optional)"
              data={machineOpts}
              value={machineId}
              onChange={setMachineId}
              clearable
              searchable
              placeholder="Line / plant-wide"
            />
            <Button onClick={() => void save()} disabled={!reason.trim()}>
              {editId ? 'Update' : 'Add'}
            </Button>
          </Group>
        </Stack>
      </Card>

      {previewByCategory.size > 0 ? (
        <Card withBorder padding="md">
          <Text fw={600} mb="xs">
            Operator Station preview
          </Text>
          <Text size="xs" c="dimmed" mb="sm">
            How quick buttons group in “Why did the line stop?”
          </Text>
          <Tabs defaultValue={[...previewByCategory.keys()][0]}>
            <Tabs.List>
              {[...previewByCategory.keys()].map((c) => (
                <Tabs.Tab key={c} value={c}>
                  {prettyCategory(c)}
                </Tabs.Tab>
              ))}
            </Tabs.List>
            {[...previewByCategory.entries()].map(([c, rows]) => (
              <Tabs.Panel key={c} value={c} pt="sm">
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {rows.map((r) => (
                    <Button key={r.id} variant="light" size="md" h={48} style={{ pointerEvents: 'none' }}>
                      {r.reason}
                    </Button>
                  ))}
                </SimpleGrid>
              </Tabs.Panel>
            ))}
          </Tabs>
        </Card>
      ) : null}

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
              <Table.Td>
                {f.code}
                {f.code >= SYNTHETIC_MIN ? (
                  <Badge ml={6} size="xs" variant="light" color="blue">
                    Quick
                  </Badge>
                ) : null}
              </Table.Td>
              <Table.Td>{f.reason}</Table.Td>
              <Table.Td>{prettyCategory(f.category)}</Table.Td>
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
