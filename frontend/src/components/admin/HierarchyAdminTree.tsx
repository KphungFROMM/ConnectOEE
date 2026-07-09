import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconTrash, IconArrowDown, IconArrowUp } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { Link } from 'react-router-dom'
import {
  deleteDepartment,
  deleteLine,
  deleteMachine,
  deletePlant,
  getLineOee,
  listLineRates,
  reorderMachines,
  updateDepartment,
  updateLine,
  updateLineOee,
  updateMachine,
  updatePlant,
  type PlantDto,
} from '../../lib/admin'
import {
  cycleSecToPph,
  CHANGEOVER_MODE_OPTIONS,
  LINE_PRODUCTION_MODE_OPTIONS,
  REWORK_TRACKING_OPTIONS,
  type ChangeoverMode,
  type LineProductionMode,
  type ReworkTrackingMode,
} from '../../lib/idealRate'
import type { PlantNode } from '../../lib/hierarchy'

type NodeType = 'plant' | 'department' | 'line' | 'machine'

interface SelectedNode {
  type: NodeType
  id: string
  plantId?: string
  departmentId?: string
  lineId?: string
}

const COMMON_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
]

interface Props {
  tree: PlantNode[]
  plantMeta: PlantDto[]
  onRefresh: () => void
}

export function HierarchyAdminTree({ tree, plantMeta, onRefresh }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(tree.map((p) => p.id)))
  const [selected, setSelected] = useState<SelectedNode | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SelectedNode | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editCode, setEditCode] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editTimeZone, setEditTimeZone] = useState('UTC')
  const [editIdealRate, setEditIdealRate] = useState(1800)
  const [editTargetOee, setEditTargetOee] = useState(85)
  const [editTargetA, setEditTargetA] = useState(90)
  const [editTargetP, setEditTargetP] = useState(95)
  const [editTargetQ, setEditTargetQ] = useState(99)
  const [editReworkTracking, setEditReworkTracking] = useState<ReworkTrackingMode>('Auto')
  const [editProductionMode, setEditProductionMode] = useState<LineProductionMode>('MultiProduct')
  const [editChangeoverMode, setEditChangeoverMode] = useState<ChangeoverMode>('SetupTracked')
  const [oeeLoading, setOeeLoading] = useState(false)
  const [dedicatedMismatch, setDedicatedMismatch] = useState(false)

  const selectedLineContext = useMemo(() => {
    if (!selected || selected.type !== 'line') return null
    for (const p of tree) {
      for (const d of p.departments) {
        const l = d.lines.find((x) => x.id === selected.id)
        if (l) return { line: l, activeProductCode: l.activeProductCode ?? l.kpi.activeRecipeCode }
      }
    }
    return null
  }, [selected, tree])

  const selectedMeta = useMemo(() => {
    if (!selected) return null
    if (selected.type === 'plant') {
      const p = tree.find((x) => x.id === selected.id)
      const meta = plantMeta.find((m) => m.id === selected.id)
      return { name: p?.name ?? '', code: meta?.code ?? '', location: meta?.location ?? '', timeZoneId: meta?.timeZoneId ?? 'UTC' }
    }
    if (selected.type === 'department') {
      for (const p of tree) {
        const d = p.departments.find((x) => x.id === selected.id)
        if (d) return { name: d.name }
      }
    }
    if (selected.type === 'line') {
      for (const p of tree) {
        for (const d of p.departments) {
          const l = d.lines.find((x) => x.id === selected.id)
          if (l) return { name: l.name }
        }
      }
    }
    if (selected.type === 'machine') {
      for (const p of tree) {
        for (const d of p.departments) {
          for (const l of d.lines) {
            const m = l.machines.find((x) => x.id === selected.id)
            if (m) return { name: m.name, lineId: l.id, machines: l.machines }
          }
        }
      }
    }
    return null
  }, [selected, tree, plantMeta])

  useEffect(() => {
    if (!selected || selected.type !== 'line') {
      setDedicatedMismatch(false)
      return
    }
    let cancelled = false
    setOeeLoading(true)
    void getLineOee(selected.id)
      .then((cfg) => {
        if (cancelled) return
        setEditIdealRate(cfg.idealRatePerHour || 1800)
        setEditTargetOee(cfg.targetOeePct ?? 85)
        setEditTargetA(cfg.targetAvailabilityPct ?? 90)
        setEditTargetP(cfg.targetPerformancePct ?? 95)
        setEditTargetQ(cfg.targetQualityPct ?? 99)
        setEditReworkTracking(cfg.reworkTracking ?? 'Auto')
        setEditProductionMode(cfg.productionMode ?? 'MultiProduct')
        setEditChangeoverMode(cfg.changeoverMode ?? 'SetupTracked')
      })
      .catch(() => {
        if (!cancelled) notifications.show({ message: 'Could not load line OEE config', color: 'red' })
      })
      .finally(() => {
        if (!cancelled) setOeeLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected?.id, selected?.type])

  useEffect(() => {
    if (!selected || selected.type !== 'line' || editProductionMode !== 'DedicatedProduct') {
      setDedicatedMismatch(false)
      return
    }
    const code = selectedLineContext?.activeProductCode
    if (!code) {
      setDedicatedMismatch(false)
      return
    }
    let cancelled = false
    void listLineRates(selected.id)
      .then((rates) => {
        if (cancelled) return
        const rate = rates.find((r) => r.code === code)
        if (!rate) {
          setDedicatedMismatch(false)
          return
        }
        const productPph = cycleSecToPph(rate.effectiveCycleSec)
        setDedicatedMismatch(Math.abs(editIdealRate - productPph) > 1)
      })
      .catch(() => setDedicatedMismatch(false))
    return () => {
      cancelled = true
    }
  }, [selected?.id, selected?.type, editProductionMode, editIdealRate, selectedLineContext?.activeProductCode])

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectNode(
    node: SelectedNode,
    name: string,
    extras?: { code?: string; location?: string; timeZoneId?: string },
  ) {
    setSelected(node)
    setEditName(name)
    setEditCode(extras?.code ?? '')
    setEditLocation(extras?.location ?? '')
    setEditTimeZone(extras?.timeZoneId ?? 'UTC')
  }

  async function syncFallbackToActiveProduct() {
    if (!selected || selected.type !== 'line') return
    const code = selectedLineContext?.activeProductCode
    if (!code) return
    try {
      const rates = await listLineRates(selected.id)
      const rate = rates.find((r) => r.code === code)
      if (!rate) return
      setEditIdealRate(cycleSecToPph(rate.effectiveCycleSec))
      notifications.show({ message: 'Fallback rate synced from active product line speed', color: 'green' })
    } catch {
      notifications.show({ message: 'Could not load line speeds', color: 'red' })
    }
  }

  async function saveSelected() {
    if (!selected) return
    try {
      if (selected.type === 'plant') {
        await updatePlant(selected.id, {
          name: editName.trim(),
          code: editCode.trim() || undefined,
          location: editLocation.trim() || undefined,
          timeZoneId: editTimeZone,
        })
      } else if (selected.type === 'department') {
        await updateDepartment(selected.id, editName.trim())
      } else if (selected.type === 'line') {
        await updateLine(selected.id, editName.trim())
        await updateLineOee(selected.id, {
          idealRatePerHour: editIdealRate,
          targetOeePct: editTargetOee,
          targetAvailabilityPct: editTargetA,
          targetPerformancePct: editTargetP,
          targetQualityPct: editTargetQ,
          reworkTracking: editReworkTracking,
          productionMode: editProductionMode,
          changeoverMode: editChangeoverMode,
        })
      } else if (selected.type === 'machine') {
        await updateMachine(selected.id, editName.trim())
      }
      notifications.show({ message: 'Saved', color: 'green' })
      onRefresh()
    } catch (err) {
      notifications.show({ message: err instanceof Error ? err.message : 'Save failed', color: 'red' })
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleteError(null)
    try {
      if (deleteTarget.type === 'plant') await deletePlant(deleteTarget.id)
      else if (deleteTarget.type === 'department') await deleteDepartment(deleteTarget.id)
      else if (deleteTarget.type === 'line') await deleteLine(deleteTarget.id)
      else await deleteMachine(deleteTarget.id)
      notifications.show({ message: 'Deleted', color: 'green' })
      setDeleteTarget(null)
      if (selected?.id === deleteTarget.id) setSelected(null)
      onRefresh()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Delete blocked')
    }
  }

  async function moveMachine(lineId: string, machineId: string, direction: -1 | 1) {
    for (const p of tree) {
      for (const d of p.departments) {
        const line = d.lines.find((l) => l.id === lineId)
        if (!line) continue
        const ids = line.machines.map((m) => m.id)
        const idx = ids.indexOf(machineId)
        const swap = idx + direction
        if (idx < 0 || swap < 0 || swap >= ids.length) return
        ;[ids[idx], ids[swap]] = [ids[swap], ids[idx]]
        await reorderMachines(lineId, ids)
        onRefresh()
        return
      }
    }
  }

  if (tree.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No plants yet. Add one below.
      </Text>
    )
  }

  return (
    <Stack gap="md">
      <Card withBorder padding="sm" radius="md">
        <Stack gap={4}>
          {tree.map((plant) => (
            <div key={plant.id}>
              <Group gap={4} wrap="nowrap">
                <ActionIcon size="sm" variant="subtle" onClick={() => toggleExpand(plant.id)}>
                  {expanded.has(plant.id) ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                </ActionIcon>
                <Badge size="xs" variant="light">
                  Plant
                </Badge>
                <Text
                  size="sm"
                  fw={600}
                  style={{ cursor: 'pointer', flex: 1 }}
                  onClick={() =>
                    selectNode({ type: 'plant', id: plant.id }, plant.name, {
                      code: plantMeta.find((m) => m.id === plant.id)?.code ?? '',
                      location: plantMeta.find((m) => m.id === plant.id)?.location ?? '',
                      timeZoneId: plantMeta.find((m) => m.id === plant.id)?.timeZoneId ?? 'UTC',
                    })
                  }
                >
                  {plant.name}
                </Text>
                <ActionIcon size="sm" color="red" variant="subtle" onClick={() => setDeleteTarget({ type: 'plant', id: plant.id })}>
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>
              {expanded.has(plant.id)
                ? plant.departments.map((dept) => (
                    <div key={dept.id} style={{ paddingLeft: 20 }}>
                      <Group gap={4} wrap="nowrap">
                        <ActionIcon size="sm" variant="subtle" onClick={() => toggleExpand(dept.id)}>
                          {expanded.has(dept.id) ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                        </ActionIcon>
                        <Badge size="xs" color="gray">
                          Dept
                        </Badge>
                        <Text
                          size="sm"
                          style={{ cursor: 'pointer', flex: 1 }}
                          onClick={() => selectNode({ type: 'department', id: dept.id, plantId: plant.id }, dept.name)}
                        >
                          {dept.name}
                        </Text>
                        <ActionIcon
                          size="sm"
                          color="red"
                          variant="subtle"
                          onClick={() => setDeleteTarget({ type: 'department', id: dept.id, plantId: plant.id })}
                        >
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                      {expanded.has(dept.id)
                        ? dept.lines.map((line) => (
                            <div key={line.id} style={{ paddingLeft: 20 }}>
                              <Group gap={4} wrap="nowrap">
                                <ActionIcon size="sm" variant="subtle" onClick={() => toggleExpand(line.id)}>
                                  {expanded.has(line.id) ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                                </ActionIcon>
                                <Badge size="xs" color="blue">
                                  Line
                                </Badge>
                                <Text
                                  size="sm"
                                  style={{ cursor: 'pointer', flex: 1 }}
                                  onClick={() =>
                                    selectNode(
                                      { type: 'line', id: line.id, plantId: plant.id, departmentId: dept.id },
                                      line.name,
                                    )
                                  }
                                >
                                  {line.name}
                                </Text>
                                <ActionIcon
                                  size="sm"
                                  color="red"
                                  variant="subtle"
                                  onClick={() =>
                                    setDeleteTarget({ type: 'line', id: line.id, plantId: plant.id, departmentId: dept.id })
                                  }
                                >
                                  <IconTrash size={14} />
                                </ActionIcon>
                              </Group>
                              {expanded.has(line.id)
                                ? line.machines.map((machine, idx) => (
                                    <Group key={machine.id} gap={4} pl={28} wrap="nowrap">
                                      <Badge size="xs" color="teal">
                                        M{idx + 1}
                                      </Badge>
                                      <Text
                                        size="sm"
                                        style={{ cursor: 'pointer', flex: 1 }}
                                        onClick={() =>
                                          selectNode(
                                            {
                                              type: 'machine',
                                              id: machine.id,
                                              lineId: line.id,
                                              departmentId: dept.id,
                                              plantId: plant.id,
                                            },
                                            machine.name,
                                          )
                                        }
                                      >
                                        {machine.name}
                                      </Text>
                                      <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        disabled={idx === 0}
                                        onClick={() => void moveMachine(line.id, machine.id, -1)}
                                      >
                                        <IconArrowUp size={14} />
                                      </ActionIcon>
                                      <ActionIcon
                                        size="sm"
                                        variant="subtle"
                                        disabled={idx === line.machines.length - 1}
                                        onClick={() => void moveMachine(line.id, machine.id, 1)}
                                      >
                                        <IconArrowDown size={14} />
                                      </ActionIcon>
                                      <ActionIcon
                                        size="sm"
                                        color="red"
                                        variant="subtle"
                                        onClick={() =>
                                          setDeleteTarget({
                                            type: 'machine',
                                            id: machine.id,
                                            lineId: line.id,
                                          })
                                        }
                                      >
                                        <IconTrash size={14} />
                                      </ActionIcon>
                                    </Group>
                                  ))
                                : null}
                            </div>
                          ))
                        : null}
                    </div>
                  ))
                : null}
            </div>
          ))}
        </Stack>
      </Card>

      {selected && selectedMeta ? (
        <Card withBorder padding="md" radius="md">
          <Text fw={600} mb="sm">
            Edit {selected.type}
          </Text>
          <Stack gap="sm" maw={480}>
            <TextInput label="Name" value={editName} onChange={(e) => setEditName(e.currentTarget.value)} />
            {selected.type === 'plant' ? (
              <>
                <TextInput label="Code" value={editCode} onChange={(e) => setEditCode(e.currentTarget.value)} />
                <TextInput label="Location" value={editLocation} onChange={(e) => setEditLocation(e.currentTarget.value)} />
                <Select
                  label="Time zone"
                  data={COMMON_TIME_ZONES.map((z) => ({ value: z, label: z }))}
                  value={editTimeZone}
                  onChange={(v) => setEditTimeZone(v ?? 'UTC')}
                  searchable
                />
              </>
            ) : null}
            {selected.type === 'line' ? (
              <>
                <Select
                  label="Line operating profile"
                  data={LINE_PRODUCTION_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={editProductionMode}
                  onChange={(v) => setEditProductionMode((v as LineProductionMode) ?? 'MultiProduct')}
                  description={LINE_PRODUCTION_MODE_OPTIONS.find((o) => o.value === editProductionMode)?.description}
                />
                <Select
                  label="Changeover mode"
                  data={CHANGEOVER_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={editChangeoverMode}
                  onChange={(v) => setEditChangeoverMode((v as ChangeoverMode) ?? 'SetupTracked')}
                  description={CHANGEOVER_MODE_OPTIONS.find((o) => o.value === editChangeoverMode)?.description}
                />
                <NumberInput
                  label="Line fallback rate (pph)"
                  description="Used when no product is active or product cycle is unknown. Live performance may use a higher per-SKU ideal."
                  min={1}
                  value={editIdealRate}
                  onChange={(v) => setEditIdealRate(typeof v === 'number' ? v : 1800)}
                  disabled={oeeLoading}
                />
                <Text fw={500} size="sm" mt="xs">
                  OEE targets (%)
                </Text>
                <Group grow>
                  <NumberInput label="OEE" min={0} max={100} value={editTargetOee} onChange={(v) => setEditTargetOee(typeof v === 'number' ? v : 85)} disabled={oeeLoading} />
                  <NumberInput label="Availability" min={0} max={100} value={editTargetA} onChange={(v) => setEditTargetA(typeof v === 'number' ? v : 90)} disabled={oeeLoading} />
                  <NumberInput label="Performance" min={0} max={100} value={editTargetP} onChange={(v) => setEditTargetP(typeof v === 'number' ? v : 95)} disabled={oeeLoading} />
                  <NumberInput label="Quality" min={0} max={100} value={editTargetQ} onChange={(v) => setEditTargetQ(typeof v === 'number' ? v : 99)} disabled={oeeLoading} />
                </Group>
                <Select
                  label="Rework tracking"
                  data={REWORK_TRACKING_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                  value={editReworkTracking}
                  onChange={(v) => setEditReworkTracking((v as ReworkTrackingMode) ?? 'Auto')}
                  description={REWORK_TRACKING_OPTIONS.find((o) => o.value === editReworkTracking)?.description}
                  disabled={oeeLoading}
                />
                {editProductionMode !== 'NoProductTracking' ? (
                  <Text size="sm">
                    <Anchor component={Link} to={`/admin?tab=recipes&recipesTab=line-speeds&lineId=${selected.id}`}>
                      Manage product line speeds →
                    </Anchor>
                  </Text>
                ) : (
                  <Alert color="blue" variant="light">
                    This line does not track products — performance uses the line fallback rate only.
                  </Alert>
                )}
                {dedicatedMismatch ? (
                  <Alert color="orange" variant="light" title="Fallback differs from active product">
                    <Stack gap="xs">
                      <Text size="sm">
                        Dedicated line: line fallback should match {selectedLineContext?.activeProductCode}&apos;s line speed.
                      </Text>
                      <Button size="xs" variant="light" onClick={() => void syncFallbackToActiveProduct()}>
                        Sync fallback to product
                      </Button>
                    </Stack>
                  </Alert>
                ) : null}
              </>
            ) : null}
            <Button onClick={() => void saveSelected()} disabled={!editName.trim() || oeeLoading}>
              Save changes
            </Button>
          </Stack>
        </Card>
      ) : null}

      <Modal opened={!!deleteTarget} onClose={() => { setDeleteTarget(null); setDeleteError(null) }} title="Confirm delete">
        <Stack>
          <Text size="sm">
            Delete this {deleteTarget?.type}? This cannot be undone. Remove PLC connections, tag mappings, and dashboards first if delete is blocked.
          </Text>
          {deleteError ? (
            <Text size="sm" c="red">
              {deleteError}
            </Text>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button color="red" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
