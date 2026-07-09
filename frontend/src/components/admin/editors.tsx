import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Flex,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconAlertCircle, IconLink, IconRefresh, IconUnlink, IconX } from '@tabler/icons-react'
import { TagBrowseTree } from '../tags/TagBrowseTree'
import { TagPickerModal } from '../tags/TagPickerModal'
import { SignalMappingCards } from '../tags/SignalMappingCards'
import { MachineMappingChecklist } from '../tags/MachineMappingChecklist'
import { HierarchyAdminTree } from './HierarchyAdminTree'
import {
  buildMachineStatuses,
  checklistFilterLabel,
  countCompleteStatuses,
  firstIncompleteMachineId,
} from '../tags/machineMappingStatus'
import { AUX_RUN_STATE_ROLES } from '../tags/tagBrowseUtils'
import { useTagBrowse } from '../tags/useTagBrowse'
import {
  createConnection,
  createDepartment,
  createLine,
  createMachine,
  createPlant,
  deleteConnection,
  getDriverStatus,
  getLineOee,
  listConnections,
  listPlants,
  listSignals,
  mapTag,
  updateConnection,
  updateCountIngestMode,
  updateRunStateIngestMode,
  type DriverStatus,
  type PlantDto,
  type PlcConnection,
  type SignalDto,
} from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import {
  DEFAULT_PLC_DRIVER,
  driverRequiresEndpoint,
  driverRequiresPath,
  getPlcDriver,
  getPlcDriverLabel,
  plcDriverSelectData,
} from '../../lib/plcDriverCatalog'
import { mapTagBound, unmapSignal, browseTags, type BrowseResult, type BrowseTag } from '../../lib/tags'

export type TagSignalFilter = 'required' | 'optional' | 'all'

export type HierarchyWizardStep = 'plant' | 'department' | 'line' | 'machine' | 'full'

function getDefaultTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

const COMMON_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
]

function timeZoneOptions(): { value: string; label: string }[] {
  const detected = getDefaultTimeZone()
  const zones = new Set([detected, ...COMMON_TIME_ZONES])
  return [...zones].map((z) => ({ value: z, label: z === detected ? `${z} (detected)` : z }))
}

function useTree(): [PlantNode[], () => void] {
  const [tree, setTree] = useState<PlantNode[]>([])
  const reload = () => void getHierarchyTree().then(setTree).catch(() => undefined)
  useEffect(reload, [])
  return [tree, reload]
}

export function HierarchyEditor({
  onChange,
  wizardStep = 'full',
}: {
  onChange?: () => void
  wizardStep?: HierarchyWizardStep
}) {
  const isWizard = wizardStep !== 'full'
  const [tree, reload] = useTree()
  const [plantMeta, setPlantMeta] = useState<PlantDto[]>([])
  const refresh = () => {
    reload()
    if (!isWizard) void listPlants().then(setPlantMeta).catch(() => undefined)
    onChange?.()
  }

  useEffect(() => {
    if (!isWizard) void listPlants().then(setPlantMeta).catch(() => undefined)
  }, [isWizard])

  const isPlantWizard = wizardStep === 'plant'
  const isDeptWizard = wizardStep === 'department'
  const isLineWizard = wizardStep === 'line'
  const isMachineWizard = wizardStep === 'machine'
  const showPlant = wizardStep === 'full' || wizardStep === 'plant'
  const showDept = wizardStep === 'full' || wizardStep === 'department'
  const showLine = wizardStep === 'full' || wizardStep === 'line'
  const showMachine = wizardStep === 'full' || wizardStep === 'machine'

  const [plantName, setPlantName] = useState('')
  const [plantCode, setPlantCode] = useState('')
  const [plantLocation, setPlantLocation] = useState('')
  const [plantTimeZone, setPlantTimeZone] = useState(getDefaultTimeZone)
  const [plantNameTouched, setPlantNameTouched] = useState(false)
  const [deptPlant, setDeptPlant] = useState<string | null>(null)
  const [deptName, setDeptName] = useState('')
  const [deptNameTouched, setDeptNameTouched] = useState(false)
  const [lineDept, setLineDept] = useState<string | null>(null)
  const [lineName, setLineName] = useState('')
  const [lineNameTouched, setLineNameTouched] = useState(false)
  const [lineRate, setLineRate] = useState<number>(1800)
  const [machineLine, setMachineLine] = useState<string | null>(null)
  const [machineName, setMachineName] = useState('')
  const [machineNameTouched, setMachineNameTouched] = useState(false)

  const plantOpts = tree.map((p) => ({ value: p.id, label: p.name }))
  const deptOpts = tree.flatMap((p) => p.departments.map((d) => ({ value: d.id, label: `${p.name} / ${d.name}` })))
  const lineOpts = tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${d.name} / ${l.name}` }))))
  const deptCount = tree.reduce((n, p) => n + p.departments.length, 0)
  const lineCount = tree.reduce((n, p) => n + p.departments.reduce((m, d) => m + d.lines.length, 0), 0)
  const machineCount = tree.reduce(
    (n, p) => n + p.departments.reduce((m, d) => m + d.lines.reduce((k, l) => k + l.machines.length, 0), 0),
    0,
  )

  useEffect(() => {
    if (wizardStep === 'department' && tree.length === 1 && !deptPlant) {
      setDeptPlant(tree[0].id)
    }
  }, [wizardStep, tree, deptPlant])

  useEffect(() => {
    if (wizardStep === 'line' && deptOpts.length === 1 && !lineDept) {
      setLineDept(deptOpts[0].value)
    }
  }, [wizardStep, deptOpts, lineDept])

  useEffect(() => {
    if (wizardStep === 'machine' && lineOpts.length === 1 && !machineLine) {
      setMachineLine(lineOpts[0].value)
    }
  }, [wizardStep, lineOpts, machineLine])

  async function run(fn: () => Promise<unknown>, reset: () => void) {
    try {
      await fn()
      reset()
      refresh()
      notifications.show({ message: 'Saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save', color: 'red' })
    }
  }

  async function addPlant(e?: React.FormEvent) {
    e?.preventDefault()
    setPlantNameTouched(true)
    if (!plantName.trim()) return
    await run(
      () =>
        createPlant({
          name: plantName.trim(),
          code: plantCode.trim() || undefined,
          location: plantLocation.trim() || undefined,
          timeZoneId: plantTimeZone.trim() || undefined,
        }),
      () => {
        setPlantName('')
        setPlantCode('')
        setPlantLocation('')
      },
    )
  }

  const plantNameInvalid = plantNameTouched && !plantName.trim()
  const deptNameInvalid = deptNameTouched && !deptName.trim()
  const lineNameInvalid = lineNameTouched && !lineName.trim()
  const machineNameInvalid = machineNameTouched && !machineName.trim()

  async function addDepartment(e?: React.FormEvent) {
    e?.preventDefault()
    setDeptNameTouched(true)
    if (!deptPlant || !deptName.trim()) return
    await run(
      () => createDepartment({ plantId: deptPlant, name: deptName.trim() }),
      () => setDeptName(''),
    )
  }

  async function addLine(e?: React.FormEvent) {
    e?.preventDefault()
    setLineNameTouched(true)
    if (!lineDept || !lineName.trim()) return
    await run(
      () => createLine({ departmentId: lineDept, name: lineName.trim(), idealRatePerHour: lineRate }),
      () => setLineName(''),
    )
  }

  async function addMachine(e?: React.FormEvent) {
    e?.preventDefault()
    setMachineNameTouched(true)
    if (!machineLine || !machineName.trim()) return
    await run(
      () => createMachine({ lineId: machineLine, name: machineName.trim() }),
      () => setMachineName(''),
    )
  }

  function renderWizardPreview() {
    if (isPlantWizard) {
      if (tree.length === 0) return null
      return (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Plants ({tree.length})
          </Text>
          <Stack gap="xs">
            {tree.map((p) => (
              <Group key={p.id} justify="space-between" wrap="nowrap">
                <Text fw={600} size="sm">
                  {p.name}
                </Text>
                <Badge variant="light" color="blue">
                  Plant
                </Badge>
              </Group>
            ))}
          </Stack>
        </Card>
      )
    }

    if (isDeptWizard) {
      if (deptCount === 0) return null
      return (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Departments ({deptCount})
          </Text>
          {tree.map((p) => (
            <div key={p.id} style={{ marginBottom: 8 }}>
              <Text fw={600} size="sm">
                {p.name}
              </Text>
              {p.departments.map((d) => (
                <Group key={d.id} pl={16} justify="space-between" wrap="nowrap">
                  <Text size="sm">{d.name}</Text>
                  <Badge variant="light" size="sm">
                    Department
                  </Badge>
                </Group>
              ))}
            </div>
          ))}
        </Card>
      )
    }

    if (isLineWizard) {
      if (lineCount === 0) return null
      return (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Lines ({lineCount})
          </Text>
          {tree.map((p) =>
            p.departments.map((d) => (
              <div key={d.id} style={{ marginBottom: 8 }}>
                <Text fw={600} size="sm">
                  {p.name} / {d.name}
                </Text>
                {d.lines.map((l) => (
                  <Group key={l.id} pl={16} justify="space-between" wrap="nowrap">
                    <Text size="sm">{l.name}</Text>
                    <Badge variant="light" size="sm">
                      Line
                    </Badge>
                  </Group>
                ))}
              </div>
            )),
          )}
        </Card>
      )
    }

    if (isMachineWizard) {
      if (machineCount === 0) return null
      return (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Machines ({machineCount})
          </Text>
          {tree.map((p) =>
            p.departments.flatMap((d) =>
              d.lines.map((l) => (
                <div key={l.id} style={{ marginBottom: 8 }}>
                  <Text fw={600} size="sm">
                    {d.name} / {l.name}
                  </Text>
                  {l.machines.map((m) => (
                    <Group key={m.id} pl={16} justify="space-between" wrap="nowrap">
                      <Text size="sm">{m.name}</Text>
                      <Badge variant="light" size="sm">
                        Machine
                      </Badge>
                    </Group>
                  ))}
                </div>
              )),
            ),
          )}
        </Card>
      )
    }

    return null
  }

  function renderPrerequisiteAlert() {
    if (isDeptWizard && tree.length === 0) {
      return (
        <Alert color="yellow" variant="light">
          No plants yet. Go back to step 2 to add a plant.
        </Alert>
      )
    }
    if (isLineWizard && deptOpts.length === 0) {
      return (
        <Alert color="yellow" variant="light">
          No departments yet. Go back to step 3 to add a department.
        </Alert>
      )
    }
    if (isMachineWizard && lineOpts.length === 0) {
      return (
        <Alert color="yellow" variant="light">
          No lines yet. Go back to step 4 to add a line.
        </Alert>
      )
    }
    return null
  }

  const prerequisiteBlocksForm =
    (isDeptWizard && tree.length === 0) ||
    (isLineWizard && deptOpts.length === 0) ||
    (isMachineWizard && lineOpts.length === 0)

  return (
    <Stack>
      {isWizard ? renderWizardPreview() : (
        <Card withBorder radius="md" padding="md">
          <Text fw={600} mb="xs">
            Hierarchy
          </Text>
          <HierarchyAdminTree tree={tree} plantMeta={plantMeta} onRefresh={refresh} />
        </Card>
      )}

      {renderPrerequisiteAlert()}
      {showPlant && !prerequisiteBlocksForm ? (
        isPlantWizard ? (
          <form onSubmit={addPlant}>
            <Stack gap="md">
              <TextInput
                label="Plant name"
                placeholder="e.g. FrommConnect"
                value={plantName}
                onChange={(e) => setPlantName(e.currentTarget.value)}
                onBlur={() => setPlantNameTouched(true)}
                error={plantNameInvalid ? 'Plant name is required' : undefined}
                required
              />
              <Select
                label="Time zone"
                description="Used for shift boundaries and OEE roll-ups"
                data={timeZoneOptions()}
                value={plantTimeZone}
                onChange={(v) => setPlantTimeZone(v ?? getDefaultTimeZone())}
                searchable
                required
              />
              <TextInput
                label="Code"
                description="Optional short identifier"
                placeholder="FC01"
                value={plantCode}
                onChange={(e) => setPlantCode(e.currentTarget.value)}
              />
              <TextInput
                label="Location"
                description="Optional"
                placeholder="Building A"
                value={plantLocation}
                onChange={(e) => setPlantLocation(e.currentTarget.value)}
              />
              <Button type="submit" disabled={!plantName.trim()} fullWidth>
                Add plant
              </Button>
              <Text size="sm" c="dimmed">
                Add another plant or click <strong>Next</strong> when ready.
              </Text>
            </Stack>
          </form>
        ) : (
          <Group grow align="flex-end">
            <TextInput label="New plant" placeholder="Plant name" value={plantName} onChange={(e) => setPlantName(e.currentTarget.value)} />
            <Button disabled={!plantName.trim()} onClick={() => addPlant()}>
              Add plant
            </Button>
          </Group>
        )
      ) : null}

      {showDept && !prerequisiteBlocksForm ? (
        isDeptWizard ? (
          <form onSubmit={addDepartment}>
            <Stack gap="md">
              {tree.length === 1 ? (
                <TextInput label="Plant" value={tree[0].name} readOnly />
              ) : (
                <Select
                  label="Plant"
                  data={plantOpts}
                  value={deptPlant}
                  onChange={setDeptPlant}
                  placeholder="Pick plant"
                  required
                />
              )}
              <TextInput
                label="Department name"
                placeholder="e.g. Production"
                value={deptName}
                onChange={(e) => setDeptName(e.currentTarget.value)}
                onBlur={() => setDeptNameTouched(true)}
                error={deptNameInvalid ? 'Department name is required' : undefined}
                required
              />
              <Button type="submit" disabled={!deptPlant || !deptName.trim()} fullWidth>
                Add department
              </Button>
              <Text size="sm" c="dimmed">
                Add another department or click <strong>Next</strong> when ready.
              </Text>
            </Stack>
          </form>
        ) : (
          <Group grow align="flex-end">
            <Select label="Plant" data={plantOpts} value={deptPlant} onChange={setDeptPlant} placeholder="Pick plant" />
            <TextInput label="New department" value={deptName} onChange={(e) => setDeptName(e.currentTarget.value)} />
            <Button disabled={!deptPlant || !deptName.trim()} onClick={() => addDepartment()}>
              Add dept
            </Button>
          </Group>
        )
      ) : null}

      {showLine && !prerequisiteBlocksForm ? (
        isLineWizard ? (
          <form onSubmit={addLine}>
            <Stack gap="md">
              <Select
                label="Department"
                data={deptOpts}
                value={lineDept}
                onChange={setLineDept}
                placeholder="Pick department"
                required
              />
              <TextInput
                label="Line name"
                placeholder="e.g. Line 1"
                value={lineName}
                onChange={(e) => setLineName(e.currentTarget.value)}
                onBlur={() => setLineNameTouched(true)}
                error={lineNameInvalid ? 'Line name is required' : undefined}
                required
              />
              <NumberInput
                label="Line fallback rate (pph)"
                description="Fallback when no product is active. Per-SKU ideals are set in Recipes → Line speeds."
                value={lineRate}
                onChange={(v) => setLineRate(Number(v) || 0)}
                min={1}
                required
              />
              <Button type="submit" disabled={!lineDept || !lineName.trim()} fullWidth>
                Add line
              </Button>
              <Text size="sm" c="dimmed">
                Add another line or click <strong>Next</strong> when ready.
              </Text>
            </Stack>
          </form>
        ) : (
          <Group grow align="flex-end">
            <Select label="Department" data={deptOpts} value={lineDept} onChange={setLineDept} placeholder="Pick dept" />
            <TextInput label="New line" value={lineName} onChange={(e) => setLineName(e.currentTarget.value)} />
            <NumberInput label="Line fallback rate (pph)" value={lineRate} onChange={(v) => setLineRate(Number(v) || 0)} min={1} />
            <Button disabled={!lineDept || !lineName.trim()} onClick={() => addLine()}>
              Add line
            </Button>
          </Group>
        )
      ) : null}

      {showMachine && !prerequisiteBlocksForm ? (
        isMachineWizard ? (
          <form onSubmit={addMachine}>
            <Stack gap="md">
              <Select
                label="Line"
                data={lineOpts}
                value={machineLine}
                onChange={setMachineLine}
                placeholder="Pick line"
                required
              />
              <TextInput
                label="Machine name"
                placeholder="e.g. Filler 1"
                value={machineName}
                onChange={(e) => setMachineName(e.currentTarget.value)}
                onBlur={() => setMachineNameTouched(true)}
                error={machineNameInvalid ? 'Machine name is required' : undefined}
                required
              />
              <Button type="submit" disabled={!machineLine || !machineName.trim()} fullWidth>
                Add machine
              </Button>
              <Text size="sm" c="dimmed">
                Add another machine or click <strong>Next</strong> when ready.
              </Text>
            </Stack>
          </form>
        ) : (
          <Group grow align="flex-end">
            <Select label="Line" data={lineOpts} value={machineLine} onChange={setMachineLine} placeholder="Pick line" />
            <TextInput label="New machine" value={machineName} onChange={(e) => setMachineName(e.currentTarget.value)} />
            <Button disabled={!machineLine || !machineName.trim()} onClick={() => addMachine()}>
              Add machine
            </Button>
          </Group>
        )
      ) : null}
    </Stack>
  )
}

export function PlcEditor({ onChange, wizardMode = false }: { onChange?: () => void; wizardMode?: boolean }) {
  const [tree] = useTree()
  const [conns, setConns] = useState<PlcConnection[]>([])
  const [driverHealth, setDriverHealth] = useState<DriverStatus[]>([])
  const [name, setName] = useState('')
  const [driverType, setDriverType] = useState(DEFAULT_PLC_DRIVER)
  const [endpoint, setEndpoint] = useState('')
  const [path, setPath] = useState('1,0')
  const [lineId, setLineId] = useState<string | null>(null)
  const [pollIntervalMs, setPollIntervalMs] = useState(1000)
  const [enabled, setEnabled] = useState(true)
  const [editConn, setEditConn] = useState<PlcConnection | null>(null)
  const [nameTouched, setNameTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const driverDef = getPlcDriver(driverType)
  const needsEndpoint = driverRequiresEndpoint(driverDef.profile)
  const needsPath = driverRequiresPath(driverDef.profile)
  const driverOptions = plcDriverSelectData()

  const reload = () => {
    void listConnections().then(setConns).catch(() => undefined)
    void getDriverStatus().then(setDriverHealth).catch(() => setDriverHealth([]))
  }
  useEffect(() => {
    reload()
    const t = setInterval(() => {
      void getDriverStatus().then(setDriverHealth).catch(() => undefined)
    }, 10_000)
    return () => clearInterval(t)
  }, [])

  const lineOpts = tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${d.name} / ${l.name}` }))))
  const lineLabelById = new Map(lineOpts.map((o) => [o.value, o.label]))
  const healthByConnId = new Map(
    driverHealth.filter((d) => d.connectionId).map((d) => [d.connectionId!, d]),
  )

  function endpointSummary(type: string, endpointValue?: string | null): string {
    if (type === 'Mock') return 'Simulator'
    return endpointValue ?? '—'
  }

  function healthBadge(conn: PlcConnection) {
    const h = healthByConnId.get(conn.id)
    if (!h) return <Badge size="xs" variant="light" color="gray">Unknown</Badge>
    const color = h.state === 'Connected' ? 'green' : h.state === 'Faulted' ? 'red' : 'yellow'
    return <Badge size="xs" variant="light" color={color}>{h.state}</Badge>
  }

  function healthDetail(conn: PlcConnection) {
    const h = healthByConnId.get(conn.id)
    if (!h?.statusDetail) return null
    return (
      <Text size="xs" c={h.state === 'Faulted' ? 'red' : 'dimmed'}>
        {h.statusDetail}
      </Text>
    )
  }

  function onDriverChange(value: string | null) {
    if (!value) return
    const next = getPlcDriver(value)
    if (!next.implemented) return
    setDriverType(value)
    if (driverRequiresPath(next.profile) && !path.trim()) {
      setPath(next.defaultPath ?? '1,0')
    }
  }

  function canSubmit(formName: string, formDriver: string, formEndpoint: string, formPath: string): boolean {
    if (!formName.trim()) return false
    const def = getPlcDriver(formDriver)
    if (driverRequiresEndpoint(def.profile) && !formEndpoint.trim()) return false
    if (driverRequiresPath(def.profile) && !formPath.trim()) return false
    return true
  }

  function connectionBody(formName: string, formDriver: string, formEndpoint: string, formPath: string) {
    const def = getPlcDriver(formDriver)
    const reqEndpoint = driverRequiresEndpoint(def.profile)
    const reqPath = driverRequiresPath(def.profile)
    return {
      name: formName.trim(),
      driverType: formDriver,
      endpoint: reqEndpoint ? formEndpoint.trim() : undefined,
      path: reqPath ? formPath.trim() : undefined,
      lineId,
      pollIntervalMs,
      enabled,
    }
  }

  async function removeConnection(id: string) {
    await deleteConnection(id)
    if (editConn?.id === id) setEditConn(null)
    reload()
    onChange?.()
  }

  function openEdit(c: PlcConnection) {
    setEditConn(c)
    setName(c.name)
    setDriverType(c.driverType)
    setEndpoint(c.endpoint ?? '')
    setPath(c.path ?? '1,0')
    setLineId(c.lineId ?? null)
    setPollIntervalMs(c.pollIntervalMs)
    setEnabled(c.enabled)
    setFormError(null)
    setNameTouched(false)
  }

  function closeEdit() {
    setEditConn(null)
    setName('')
    setEndpoint('')
    setPath('1,0')
    setLineId(null)
    setPollIntervalMs(1000)
    setEnabled(true)
    setDriverType(DEFAULT_PLC_DRIVER)
    setFormError(null)
  }

  async function saveEdit() {
    if (!editConn) return
    setNameTouched(true)
    setFormError(null)
    if (!canSubmit(name, driverType, endpoint, path)) return
    try {
      await updateConnection(editConn.id, connectionBody(name, driverType, endpoint, path))
      closeEdit()
      reload()
      onChange?.()
      notifications.show({ message: 'Connection updated', color: 'green' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update connection'
      setFormError(message)
      notifications.show({ message, color: 'red' })
    }
  }

  async function add(e?: React.FormEvent) {
    e?.preventDefault()
    setNameTouched(true)
    setFormError(null)
    if (!canSubmit(name, driverType, endpoint, path)) return
    try {
      await createConnection(connectionBody(name, driverType, endpoint, path))
      setName('')
      setEndpoint('')
      setPath(driverDef.defaultPath ?? '1,0')
      setLineId(null)
      setPollIntervalMs(1000)
      setEnabled(true)
      reload()
      onChange?.()
      notifications.show({ message: 'Connection added', color: 'green' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add connection'
      setFormError(message)
      notifications.show({ message, color: 'red' })
    }
  }

  const nameInvalid = nameTouched && !name.trim()

  function renderConnectionFields(compact = false) {
    return (
      <Stack gap={compact ? 'sm' : 'md'}>
        {formError ? (
          <Alert color="red" variant="light">
            {formError}
          </Alert>
        ) : null}
        <TextInput
          label="Connection name"
          placeholder="e.g. PlantPLC"
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
          onBlur={() => setNameTouched(true)}
          error={nameInvalid ? 'Connection name is required' : undefined}
          required
        />
        <Select
          label="Driver type"
          data={driverOptions}
          value={driverType}
          onChange={onDriverChange}
          searchable
          allowDeselect={false}
        />
        {!compact ? (
          <Alert color="blue" variant="light">
            {driverDef.hint}
          </Alert>
        ) : null}
        <Select
          label="Line"
          description="Optional — bind this connection to a line when you have multiple PLCs."
          data={lineOpts}
          value={lineId}
          onChange={setLineId}
          placeholder="All lines (default)"
          clearable
          searchable
        />
        <Group grow>
          <NumberInput
            label="Poll interval (ms)"
            min={250}
            max={60_000}
            step={250}
            value={pollIntervalMs}
            onChange={(v) => setPollIntervalMs(typeof v === 'number' ? v : 1000)}
          />
          <Switch
            label="Enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
            mt={compact ? 24 : 28}
          />
        </Group>
        {needsEndpoint ? (
          <>
            <TextInput
              label={driverDef.profile === 'opcUa' ? 'Endpoint URL' : 'IP address'}
              placeholder={driverDef.profile === 'opcUa' ? 'opc.tcp://10.0.0.49:4840' : '10.0.0.49'}
              value={endpoint}
              onChange={(e) => setEndpoint(e.currentTarget.value)}
              required
            />
            {needsPath ? (
              <TextInput
                label="CPU path / slot"
                placeholder={driverDef.defaultPath ?? '1,0'}
                value={path}
                onChange={(e) => setPath(e.currentTarget.value)}
                required
              />
            ) : null}
          </>
        ) : null}
      </Stack>
    )
  }

  function renderConnectionRow(c: PlcConnection, wizard = false) {
    return (
      <Group key={c.id} justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Text fw={600} size="sm">
              {c.name}
            </Text>
            <Badge variant="light">{getPlcDriverLabel(c.driverType)}</Badge>
            {healthBadge(c)}
            {!c.enabled ? <Badge size="xs" color="gray">Disabled</Badge> : null}
          </Group>
          <Text size="xs" c="dimmed">
            {endpointSummary(c.driverType, c.endpoint)} · {c.pollIntervalMs}ms
            {c.lineId && lineLabelById.has(c.lineId) ? ` · ${lineLabelById.get(c.lineId)}` : ''}
            {c.tagCount > 0 ? ` · ${c.tagCount} mapped tag(s)` : ''}
          </Text>
          {healthDetail(c)}
        </Stack>
        <Group gap={4} wrap="nowrap">
          <Button size="xs" variant="subtle" onClick={() => openEdit(c)}>
            Edit
          </Button>
          <Button size="xs" variant="subtle" color="red" onClick={() => void removeConnection(c.id)}>
            {wizard ? 'Remove' : 'Delete'}
          </Button>
        </Group>
      </Group>
    )
  }

  if (wizardMode) {
    return (
      <Stack gap="md">
        {conns.length > 0 ? (
          <Card withBorder radius="md" padding="md">
            <Text fw={600} mb="xs">
              PLC connections ({conns.length})
            </Text>
            <Stack gap="xs">
              {conns.map((c) => renderConnectionRow(c, true))}
            </Stack>
          </Card>
        ) : null}
        <form onSubmit={add}>
          <Stack gap="md">
            {renderConnectionFields()}
            <Button type="submit" disabled={!canSubmit(name, driverType, endpoint, path)} fullWidth>
              Add PLC connection
            </Button>
            <Text size="sm" c="dimmed">
              Add another connection or click <strong>Next</strong> when ready.
            </Text>
          </Stack>
        </form>
        <Drawer opened={!!editConn} onClose={closeEdit} title="Edit PLC connection" position="right" size="md">
          <Stack>
            {renderConnectionFields(true)}
            <Button onClick={() => void saveEdit()} disabled={!canSubmit(name, driverType, endpoint, path)}>
              Save changes
            </Button>
          </Stack>
        </Drawer>
      </Stack>
    )
  }

  return (
    <Stack>
      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="xs">
          PLC connections
        </Text>
        {conns.length === 0 ? (
          <Text size="sm" c="dimmed">
            None yet.
          </Text>
        ) : (
          <Table fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Driver</Table.Th>
                <Table.Th>Health</Table.Th>
                <Table.Th>Endpoint</Table.Th>
                <Table.Th>Poll</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {conns.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>
                    <Badge variant="light">{getPlcDriverLabel(c.driverType)}</Badge>
                  </Table.Td>
                  <Table.Td>{healthBadge(c)}</Table.Td>
                  <Table.Td>{endpointSummary(c.driverType, c.endpoint)}</Table.Td>
                  <Table.Td>{c.pollIntervalMs}ms</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="xs" variant="subtle" onClick={() => openEdit(c)}>
                        Edit
                      </Button>
                      <Button size="xs" variant="subtle" color="red" onClick={() => void removeConnection(c.id)}>
                        Delete
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      <Card withBorder radius="md" padding="md">
        <Text fw={600} mb="xs">
          Add connection
        </Text>
        {renderConnectionFields(true)}
        <Button mt="md" disabled={!canSubmit(name, driverType, endpoint, path)} onClick={() => void add()}>
          Add
        </Button>
      </Card>

      <Drawer opened={!!editConn} onClose={closeEdit} title="Edit PLC connection" position="right" size="md">
        <Stack>
          {renderConnectionFields(true)}
          <Button onClick={() => void saveEdit()} disabled={!canSubmit(name, driverType, endpoint, path)}>
            Save changes
          </Button>
        </Stack>
      </Drawer>
    </Stack>
  )
}

function findMachineLineId(tree: PlantNode[], machineId: string): string | null {
  for (const p of tree) {
    for (const d of p.departments) {
      for (const l of d.lines) {
        if (l.machines.some((m) => m.id === machineId)) return l.id
      }
    }
  }
  return null
}

function filterVisibleSignals(signals: SignalDto[], signalFilter: TagSignalFilter, reworkTracking: import('../../lib/idealRate').ReworkTrackingMode = 'Auto'): SignalDto[] {
  const runState = signals.find((s) => s.role === 'RunState')
  const isMultiBool = runState?.runStateIngestMode === 'MultiBool'

  const hideAux = (s: SignalDto) => !AUX_RUN_STATE_ROLES.has(s.role) || isMultiBool
  const hideSpeed = (s: SignalDto) => s.role !== 'Speed'
  const hideRework = (s: SignalDto) => reworkTracking === 'Off' && s.role === 'ReworkCount'

  if (signalFilter === 'required') {
    return signals.filter((s) => s.required && hideSpeed(s) && !hideRework(s))
  }
  if (signalFilter === 'optional') {
    return signals.filter((s) => !s.required && hideAux(s) && hideSpeed(s) && !hideRework(s))
  }
  return signals.filter((s) => hideAux(s) && hideSpeed(s) && !hideRework(s))
}

export function TagMappingEditor({
  onChange,
  wizardMode = false,
  signalFilter = 'all',
  onRequiredProgressChange,
}: {
  onChange?: () => void
  wizardMode?: boolean
  signalFilter?: TagSignalFilter
  onRequiredProgressChange?: (mapped: number, total: number) => void
}) {
  const [tree] = useTree()
  const [connections, setConnections] = useState<PlcConnection[]>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [machineId, setMachineId] = useState<string | null>(null)
  const [signals, setSignals] = useState<SignalDto[]>([])
  const [paths, setPaths] = useState<Record<string, string>>({})
  const [machineInitialized, setMachineInitialized] = useState(false)
  const [pickerSignal, setPickerSignal] = useState<SignalDto | null>(null)
  const [wizardBrowseMeta, setWizardBrowseMeta] = useState<BrowseResult | null>(null)
  const [allMachineSignals, setAllMachineSignals] = useState<SignalDto[]>([])
  const [reworkTracking, setReworkTracking] = useState<import('../../lib/idealRate').ReworkTrackingMode>('Auto')
  const [lineReworkMode, setLineReworkMode] = useState<Map<string, import('../../lib/idealRate').ReworkTrackingMode>>(new Map())

  const excludeRolesForMachine = useCallback(
    (machineId: string) => {
      const lineId = findMachineLineId(tree, machineId)
      if (lineId && lineReworkMode.get(lineId) === 'Off') return new Set(['ReworkCount'])
      return new Set<string>()
    },
    [tree, lineReworkMode],
  )

  const adminBrowse = useTagBrowse(wizardMode ? null : connectionId)

  const machineOpts = useMemo(
    () =>
      tree.flatMap((p) =>
        p.departments.flatMap((d) => d.lines.flatMap((l) => l.machines.map((m) => ({ value: m.id, label: `${l.name} / ${m.name}` })))),
      ),
    [tree],
  )

  const connOpts = connections.map((c) => ({
    value: c.id,
    label: c.name,
  }))

  const selectedConnection = connections.find((c) => c.id === connectionId)
  const connectionDriverLabel = selectedConnection ? getPlcDriverLabel(selectedConnection.driverType) : undefined

  useEffect(() => {
    const lineIds = tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => l.id)))
    if (lineIds.length === 0) {
      setLineReworkMode(new Map())
      return
    }
    let cancelled = false
    void Promise.all(lineIds.map((id) => getLineOee(id).then((cfg) => [id, cfg.reworkTracking ?? 'Auto'] as const))).then((entries) => {
      if (!cancelled) setLineReworkMode(new Map(entries))
    })
    return () => {
      cancelled = true
    }
  }, [tree])

  useEffect(() => {
    if (!wizardMode || !connectionId) {
      setWizardBrowseMeta(null)
      return
    }
    void browseTags(connectionId)
      .then(setWizardBrowseMeta)
      .catch(() => setWizardBrowseMeta(null))
  }, [wizardMode, connectionId])

  const refreshMachineProgress = useCallback(async () => {
    if (!wizardMode || machineOpts.length === 0) return
    const all = await listSignals()
    setAllMachineSignals(all)
    if (signalFilter === 'required' && onRequiredProgressChange) {
      const statuses = buildMachineStatuses(machineOpts, all, 'required', excludeRolesForMachine)
      onRequiredProgressChange(countCompleteStatuses(statuses), machineOpts.length)
    }
  }, [wizardMode, machineOpts, signalFilter, onRequiredProgressChange, excludeRolesForMachine])

  const showMachineChecklist = wizardMode && (signalFilter === 'required' || signalFilter === 'optional')
  const machineStatuses = useMemo(() => {
    if (!showMachineChecklist || machineOpts.length === 0) return []
    return buildMachineStatuses(machineOpts, allMachineSignals, signalFilter as 'required' | 'optional', excludeRolesForMachine)
  }, [showMachineChecklist, machineOpts, allMachineSignals, signalFilter, excludeRolesForMachine])

  const statusByMachine = useMemo(
    () => new Map(machineStatuses.map((s) => [s.machineId, s])),
    [machineStatuses],
  )

  useEffect(() => {
    void listConnections().then((c) => {
      setConnections(c)
      if (c.length > 0) setConnectionId((prev) => prev ?? c[0].id)
    })
  }, [])

  useEffect(() => {
    if (machineInitialized || machineOpts.length === 0) return
    setMachineId(machineOpts[0].value)
    setMachineInitialized(true)
  }, [machineOpts, machineInitialized])

  useEffect(() => {
    if (!machineId || connections.length === 0) return
    const lineId = findMachineLineId(tree, machineId)
    const lineConn = lineId ? connections.find((c) => c.lineId === lineId) : undefined
    setConnectionId((prev) => lineConn?.id ?? prev ?? connections[0]?.id ?? null)
  }, [machineId, connections, tree])

  useEffect(() => {
    void refreshMachineProgress()
  }, [refreshMachineProgress])

  useEffect(() => {
    if (!machineId) {
      setSignals([])
      return
    }
    void listSignals(machineId).then((s) => {
      setSignals(s)
      setPaths(Object.fromEntries(s.map((x) => [x.id, x.mappedPath ?? ''])))
    })
  }, [machineId])

  useEffect(() => {
    if (!machineId) {
      setReworkTracking('Auto')
      return
    }
    const lineId = findMachineLineId(tree, machineId)
    if (!lineId) return
    let cancelled = false
    void getLineOee(lineId).then((cfg) => {
        if (!cancelled) setReworkTracking(cfg.reworkTracking ?? 'Auto')
      })
    return () => {
      cancelled = true
    }
  }, [machineId, tree])

  const visibleSignals = useMemo(
    () => filterVisibleSignals(signals, signalFilter, reworkTracking),
    [signals, signalFilter, reworkTracking],
  )

  const isCountRole = (role: string) => role === 'GoodCount' || role === 'RejectCount' || role === 'TotalCount'
  const isRunStateRole = (role: string) => role === 'RunState'

  const browse = wizardMode ? wizardBrowseMeta : adminBrowse.browse
  const supportsBrowsing = browse?.supportsBrowsing ?? false
  const browseLoading = adminBrowse.loading
  const filter = adminBrowse.filter
  const selected = adminBrowse.selected
  const scrollTop = adminBrowse.scrollTop
  const values = adminBrowse.values
  const rows = adminBrowse.rows
  const loadBrowse = adminBrowse.loadBrowse
  const toggle = adminBrowse.toggle
  const setFilter = adminBrowse.setFilter
  const setSelected = adminBrowse.setSelected
  const setScrollTop = adminBrowse.setScrollTop
  const treeHeight = 460

  async function reloadSignals() {
    if (!machineId) return
    const s = await listSignals(machineId)
    setSignals(s)
    setPaths(Object.fromEntries(s.map((x) => [x.id, x.mappedPath ?? ''])))
    await refreshMachineProgress()
  }

  async function save(signalId: string) {
    try {
      await mapTag({ logicalSignalId: signalId, tagPath: paths[signalId] ?? '', plcConnectionId: connectionId })
      await reloadSignals()
      onChange?.()
      notifications.show({ message: 'Mapping saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to map', color: 'red' })
    }
  }

  async function bindFromTag(signal: SignalDto, tag: BrowseTag) {
    try {
      const res = await mapTagBound({
        logicalSignalId: signal.id,
        tagPath: tag.fullPath,
        plcConnectionId: connectionId,
        dataType: tag.dataType,
      })
      await reloadSignals()
      onChange?.()
      if (res.warning) {
        notifications.show({ title: 'Mapped with warning', message: res.warning, color: 'yellow', autoClose: 6000 })
      } else {
        notifications.show({ message: `Bound ${signal.name}`, color: 'green' })
      }
    } catch {
      notifications.show({ message: 'Failed to bind tag', color: 'red' })
    }
  }

  async function handlePickerSelect(tag: BrowseTag) {
    if (!pickerSignal) return
    await bindFromTag(pickerSignal, tag)
    setPickerSignal(null)
  }

  async function bind(signal: SignalDto) {
    if (!selected?.bindable) {
      notifications.show({ message: 'Select a bindable tag from the tree first', color: 'yellow' })
      return
    }
    try {
      const res = await mapTagBound({
        logicalSignalId: signal.id,
        tagPath: selected.fullPath,
        plcConnectionId: connectionId,
        dataType: selected.dataType,
      })
      await reloadSignals()
      onChange?.()
      if (res.warning) {
        notifications.show({ title: 'Mapped with warning', message: res.warning, color: 'yellow', autoClose: 6000 })
      } else {
        notifications.show({ message: `Bound ${signal.name}`, color: 'green' })
      }
    } catch {
      notifications.show({ message: 'Failed to bind tag', color: 'red' })
    }
  }

  async function clearMapping(signal: SignalDto) {
    try {
      await unmapSignal(signal.id)
      await reloadSignals()
      onChange?.()
      notifications.show({ message: `Unmapped ${signal.name}`, color: 'gray' })
    } catch {
      notifications.show({ message: 'Failed to unmap', color: 'red' })
    }
  }

  async function saveRunStateMode(signal: SignalDto, mode: string | null) {
    if (!mode) return
    try {
      await updateRunStateIngestMode(signal.id, mode)
      await reloadSignals()
      onChange?.()
      notifications.show({ message: 'Run state mode updated', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to update run state mode', color: 'red' })
    }
  }

  async function saveIngestMode(signal: SignalDto, mode: string | null) {
    if (!mode) return
    try {
      await updateCountIngestMode(signal.id, mode)
      await reloadSignals()
      onChange?.()
      notifications.show({ message: 'Count source updated', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to update count source', color: 'red' })
    }
  }

  const runStateMultiBool = signals.find((s) => s.role === 'RunState')?.runStateIngestMode === 'MultiBool'

  function renderSignalTable(compact = false) {
    if (visibleSignals.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          {machineId ? 'No signals match this step.' : 'Pick a machine to map tags.'}
        </Text>
      )
    }

    return (
      <ScrollArea type="auto">
        <Table fz="sm" verticalSpacing={compact ? 4 : 6} style={{ minWidth: compact ? 360 : 480 }}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Signal</Table.Th>
              <Table.Th>Ingest mode</Table.Th>
              <Table.Th>Tag path</Table.Th>
              <Table.Th w={72}>Status</Table.Th>
              <Table.Th w={64} />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visibleSignals.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    <Text size="sm">{s.name}</Text>
                    {s.required ? (
                      <Badge size="xs" color="orange">
                        required
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {s.expectedType}
                    {s.unit ? ` · ${s.unit}` : ''}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {isCountRole(s.role) ? (
                    <Select
                      size="xs"
                      data={[
                        { value: 'CumulativeDelta', label: 'Cumulative delta' },
                        { value: 'PulseRisingEdge', label: 'Pulse (rising edge)' },
                      ]}
                      value={s.countIngestMode ?? 'CumulativeDelta'}
                      onChange={(v) => saveIngestMode(s, v)}
                    />
                  ) : isRunStateRole(s.role) ? (
                    <Select
                      size="xs"
                      data={[
                        { value: 'DirectEnum', label: 'Direct enum (INT)' },
                        { value: 'SingleBool', label: 'Single BOOL' },
                        { value: 'MultiBool', label: 'Multi BOOL' },
                      ]}
                      value={s.runStateIngestMode ?? 'DirectEnum'}
                      onChange={(v) => saveRunStateMode(s, v)}
                    />
                  ) : (
                    <Text size="xs" c="dimmed">
                      —
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  {supportsBrowsing ? (
                    s.isMapped ? (
                      <Text size="xs" ff="monospace" style={{ wordBreak: 'break-all' }}>
                        {s.mappedPath}
                      </Text>
                    ) : (
                      <Text size="xs" c="dimmed">
                        Select a tag, then bind
                      </Text>
                    )
                  ) : (
                    <TextInput
                      size="xs"
                      placeholder="Program:MainProgram.Tag"
                      value={paths[s.id] ?? ''}
                      onChange={(e) => setPaths((p) => ({ ...p, [s.id]: e.currentTarget.value }))}
                    />
                  )}
                </Table.Td>
                <Table.Td>
                  <Tooltip label={s.isMapped ? 'Mapped' : 'Unmapped'}>
                    {s.isMapped ? (
                      <ThemeIconMapped />
                    ) : (
                      <ThemeIconUnmapped />
                    )}
                  </Tooltip>
                </Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap" justify="flex-end">
                    {supportsBrowsing ? (
                      <Tooltip label={selected?.bindable ? `Bind to ${selected.name}` : 'Select a tag first'}>
                        <ActionIcon
                          variant="light"
                          color="blue"
                          size="sm"
                          disabled={!selected?.bindable}
                          onClick={() => bind(s)}
                          aria-label="Bind selected tag"
                        >
                          <IconLink size={14} />
                        </ActionIcon>
                      </Tooltip>
                    ) : (
                      <Button size="xs" variant="light" onClick={() => save(s.id)} disabled={!(paths[s.id] ?? '').trim()}>
                        Save
                      </Button>
                    )}
                    {s.isMapped ? (
                      <Tooltip label="Unmap">
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => clearMapping(s)} aria-label="Unmap">
                          <IconUnlink size={14} />
                        </ActionIcon>
                      </Tooltip>
                    ) : null}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    )
  }

  const selectors = (
    <Stack gap="md">
      <Select
        label="PLC connection"
        description={connectionDriverLabel}
        data={connOpts}
        value={connectionId}
        onChange={setConnectionId}
        searchable
        nothingFoundMessage="No connections"
        disabled={connOpts.length === 0}
      />
      <Stack gap={4}>
        <Group justify="space-between" align="flex-end" wrap="nowrap">
          <Select
            label="Machine"
            data={machineOpts}
            value={machineId}
            onChange={setMachineId}
            placeholder="Pick a machine"
            searchable
            style={{ flex: 1 }}
            renderOption={({ option }) => {
              const st = statusByMachine.get(option.value)
              return (
                <Group gap={8} wrap="nowrap">
                  {st?.complete ? (
                    <IconCheck size={14} color="var(--mantine-color-green-filled)" />
                  ) : st ? (
                    <IconAlertCircle size={14} color="var(--mantine-color-orange-filled)" />
                  ) : null}
                  <Box style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" truncate>
                      {option.label}
                    </Text>
                    {st && !st.complete ? (
                      <Text size="xs" c="dimmed" truncate>
                        Missing {st.missingSignals.length} signal{st.missingSignals.length === 1 ? '' : 's'}
                      </Text>
                    ) : null}
                  </Box>
                </Group>
              )
            }}
          />
          {machineStatuses.some((s) => !s.complete) ? (
            <Button
              variant="light"
              size="compact-sm"
              onClick={() => {
                const next = firstIncompleteMachineId(machineStatuses, machineId)
                if (next) setMachineId(next)
              }}
            >
              Next incomplete
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Stack>
  )

  const machineLabel = machineOpts.find((m) => m.value === machineId)?.label ?? null

  if (wizardMode) {
    return (
      <>
        <Stack gap="lg">
          {showMachineChecklist && machineStatuses.length > 0 ? (
            <MachineMappingChecklist
              statuses={machineStatuses}
              selectedMachineId={machineId}
              onSelectMachine={setMachineId}
              filterLabel={checklistFilterLabel(signalFilter as 'required' | 'optional')}
            />
          ) : null}
          {selectors}
          {runStateMultiBool && signalFilter !== 'required' ? (
            <Alert color="blue" variant="light">
              Multi BOOL mode — map Running, Idle, and Faulted tags for this machine.
            </Alert>
          ) : null}
          {!supportsBrowsing && browse ? (
            <Alert color="gray" variant="light">
              This driver does not support live browsing yet. Enter tag paths manually on each signal card.
            </Alert>
          ) : null}
          <SignalMappingCards
            signals={visibleSignals}
            machineLabel={machineLabel}
            supportsBrowsing={supportsBrowsing}
            paths={paths}
            onPathChange={(signalId, path) => setPaths((p) => ({ ...p, [signalId]: path }))}
            onBrowse={setPickerSignal}
            onUnmap={clearMapping}
            onSaveManual={save}
            onRunStateModeChange={saveRunStateMode}
            onIngestModeChange={saveIngestMode}
            emptyMessage={machineId ? 'No signals match this step.' : 'Pick a machine to map tags.'}
          />
          {signalFilter === 'required' ? (
            <Text size="sm" c="dimmed">
              Map Run State and Good Count on each machine, then click <strong>Next</strong>.
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Optional tags enrich analytics — skip any you do not need and continue when ready.
            </Text>
          )}
        </Stack>
        <TagPickerModal
          opened={pickerSignal !== null}
          onClose={() => setPickerSignal(null)}
          connectionId={connectionId}
          signalName={pickerSignal?.name ?? ''}
          onSelect={(tag) => void handlePickerSelect(tag)}
        />
      </>
    )
  }

  const selectorsAdmin = (
    <Group grow align="flex-end" wrap="wrap">
      <Stack gap={4} style={{ flex: 1 }}>
        <Select
          label="PLC connection"
          description={connectionDriverLabel}
          data={connOpts}
          value={connectionId}
          onChange={setConnectionId}
          searchable
          nothingFoundMessage="No connections"
          disabled={connOpts.length === 0}
        />
      </Stack>
      <Select
        label="Machine"
        data={machineOpts}
        value={machineId}
        onChange={setMachineId}
        placeholder="Pick a machine"
        searchable
        style={{ flex: 1 }}
      />
    </Group>
  )

  const browseHeader = (
    <Group justify="space-between" align="center" mb="xs">
      <Text fw={600} size="sm">
        Controller tags
      </Text>
      <Group gap="xs">
        {browse ? (
          <Badge color={supportsBrowsing ? 'green' : 'gray'} variant="light" size="sm">
            {supportsBrowsing ? 'Browsable' : 'Manual only'}
          </Badge>
        ) : null}
        <Tooltip label="Refresh tag list">
          <ActionIcon
            variant="default"
            size="sm"
            disabled={!connectionId}
            onClick={() => connectionId && loadBrowse(connectionId)}
            aria-label="Refresh tags"
          >
            <IconRefresh size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  )

  if (connections.length > 0) {
    return (
      <Stack gap="md">
        {selectorsAdmin}
        {runStateMultiBool && signalFilter !== 'required' ? (
          <Alert color="blue" variant="light">
            Multi BOOL mode — map Running, Idle, and Faulted tags below the main Run State signal.
          </Alert>
        ) : null}
        {!supportsBrowsing && browse ? (
          <Alert color="gray" variant="light">
            This driver does not support live browsing yet. Enter tag paths manually below.
          </Alert>
        ) : null}
        <Flex gap="md" direction={{ base: 'column', md: 'row' }} align="stretch">
          <Box style={{ flex: '1 1 50%', minWidth: 0 }}>
            <Card withBorder padding="sm" radius="md">
              {browseHeader}
              <TagBrowseTree
                supportsBrowsing={supportsBrowsing}
                loading={browseLoading}
                filter={filter}
                onFilterChange={setFilter}
                rows={rows}
                selected={selected}
                onSelect={setSelected}
                onToggle={toggle}
                values={values}
                scrollTop={scrollTop}
                onScrollTopChange={setScrollTop}
                viewportHeight={treeHeight}
                compact={false}
              />
            </Card>
          </Box>
          <Box style={{ flex: '1 1 50%', minWidth: 0 }}>
            <Card withBorder padding="sm" radius="md" h="100%">
              <Text fw={600} size="sm" mb="xs">
                Signals for this machine
              </Text>
              {renderSignalTable(false)}
            </Card>
          </Box>
        </Flex>
      </Stack>
    )
  }

  return (
    <Stack>
      <Select label="Machine" data={machineOpts} value={machineId} onChange={setMachineId} placeholder="Pick a machine" searchable />
      {renderSignalTable()}
    </Stack>
  )
}

function ThemeIconMapped() {
  return (
    <Box
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'var(--mantine-color-green-light)',
        color: 'var(--mantine-color-green-filled)',
      }}
    >
      <IconCheck size={14} />
    </Box>
  )
}

function ThemeIconUnmapped() {
  return (
    <Box
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'var(--mantine-color-gray-light)',
        color: 'var(--mantine-color-gray-filled)',
      }}
    >
      <IconX size={14} />
    </Box>
  )
}
