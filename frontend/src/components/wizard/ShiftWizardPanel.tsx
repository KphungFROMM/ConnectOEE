import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  createAssignment,
  createPattern,
  listAssignments,
  listPatterns,
  type AssignmentDto,
  type ShiftDefinitionDto,
  type ShiftPatternDto,
} from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { applyShiftTemplate, type ShiftPatternTemplate } from '../../lib/shiftPatternCatalog'
import { HolidayTemplatePicker } from '../shifts/HolidayTemplatePicker'
import { blankShiftDef, PatternEditor } from '../shifts/PatternEditor'
import { ShiftPatternTemplatePicker } from '../shifts/ShiftPatternTemplatePicker'
import { ShiftScheduleChart } from '../shifts/ShiftScheduleChart'

type WizardTab = 'template' | 'shifts' | 'assign' | 'calendar'

interface ShiftWizardPanelProps {
  shiftsAssigned: boolean
  onChange: () => void
}

export function ShiftWizardPanel({ shiftsAssigned, onChange }: ShiftWizardPanelProps) {
  const [patterns, setPatterns] = useState<ShiftPatternDto[]>([])
  const [assignments, setAssignments] = useState<AssignmentDto[]>([])
  const [tree, setTree] = useState<PlantNode[]>([])

  const [tab, setTab] = useState<WizardTab>('template')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [defs, setDefs] = useState<ShiftDefinitionDto[]>([blankShiftDef(0)])
  const [saving, setSaving] = useState(false)
  const [activeShiftIndex, setActiveShiftIndex] = useState<number | null>(null)

  const [assignPattern, setAssignPattern] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))

  const reload = () => {
    void listPatterns().then(setPatterns).catch(() => undefined)
    void listAssignments().then(setAssignments).catch(() => undefined)
  }

  useEffect(() => {
    reload()
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])

  const plantOpts = tree.map((p) => ({ value: p.id, label: p.name }))
  const singlePlant = tree.length === 1 ? tree[0] : null
  const patternSaved = patterns.length > 0

  useEffect(() => {
    if (singlePlant && !assignTarget) {
      setAssignTarget(`plant:${singlePlant.id}`)
    }
  }, [singlePlant, assignTarget])

  useEffect(() => {
    if (patterns.length > 0 && !assignPattern) {
      setAssignPattern(patterns[patterns.length - 1].id)
    }
  }, [patterns, assignPattern])

  const targetOpts = [
    ...tree.map((p) => ({ value: `plant:${p.id}`, label: `Plant: ${p.name}` })),
    ...tree.flatMap((p) =>
      p.departments.flatMap((d) =>
        d.lines.map((l) => ({ value: `line:${l.id}`, label: `Line: ${d.name}/${l.name}` })),
      ),
    ),
  ]

  function selectTemplate(template: ShiftPatternTemplate | null) {
    if (template) {
      setSelectedTemplateId(template.id)
      const applied = applyShiftTemplate(template.id)
      setName(applied.name)
      setDefs(applied.definitions)
    } else {
      setSelectedTemplateId('blank')
      setName('')
      setDefs([blankShiftDef(0)])
    }
    setActiveShiftIndex(null)
    setTab('shifts')
  }

  async function savePattern() {
    setSaving(true)
    try {
      await createPattern({ name, definitions: defs })
      reload()
      onChange?.()
      notifications.show({ message: 'Pattern saved', color: 'green' })
      setTab('assign')
    } catch (e) {
      notifications.show({
        message: e instanceof Error ? e.message : 'Failed to save pattern',
        color: 'red',
      })
    } finally {
      setSaving(false)
    }
  }

  async function saveAssignment() {
    if (!assignPattern || !assignTarget) return
    const [kind, id] = assignTarget.split(':')
    try {
      await createAssignment({
        shiftPatternId: assignPattern,
        plantId: kind === 'plant' ? id : null,
        lineId: kind === 'line' ? id : null,
        effectiveFrom,
      })
      reload()
      onChange?.()
      notifications.show({ message: 'Assignment saved', color: 'green' })
    } catch (e) {
      notifications.show({
        message: e instanceof Error ? e.message : 'Failed to assign',
        color: 'red',
      })
    }
  }

  async function quickAssign() {
    const patternId = assignPattern ?? patterns[patterns.length - 1]?.id
    if (!patternId || !singlePlant) return
    setAssignTarget(`plant:${singlePlant.id}`)
    try {
      await createAssignment({
        shiftPatternId: patternId,
        plantId: singlePlant.id,
        lineId: null,
        effectiveFrom,
      })
      reload()
      onChange?.()
      notifications.show({ message: `Assigned to ${singlePlant.name}`, color: 'green' })
    } catch (e) {
      notifications.show({
        message: e instanceof Error ? e.message : 'Failed to assign',
        color: 'red',
      })
    }
  }

  return (
    <Card withBorder padding="xl" radius="md">
      <Stack gap="lg">
        <div>
          <Title order={3}>Configure shifts</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Pick a template, customize your schedule, then assign it to your plant or line. Holidays are optional.
          </Text>
        </div>

        <ShiftScheduleChart
          name={name}
          definitions={defs}
          activeShiftIndex={activeShiftIndex}
          variant="hero"
          sticky
        />

        <SegmentedControl
          value={tab}
          onChange={(v) => setTab(v as WizardTab)}
          data={[
            { label: 'Template', value: 'template' },
            { label: 'Shifts', value: 'shifts' },
            { label: 'Assign', value: 'assign', disabled: !patternSaved },
            { label: 'Calendar', value: 'calendar' },
          ]}
          fullWidth
        />

        {shiftsAssigned ? (
          <Alert color="green" variant="light">
            Shift pattern assigned. Continue to dashboard generation when ready.
          </Alert>
        ) : null}

        {tab === 'template' ? (
          <ShiftPatternTemplatePicker selectedId={selectedTemplateId} onSelect={selectTemplate} />
        ) : null}

        {tab === 'shifts' ? (
          selectedTemplateId === null ? (
            <Text size="sm" c="dimmed">
              Pick a template first, or choose Start blank from the Template tab.
            </Text>
          ) : (
            <PatternEditor
              name={name}
              defs={defs}
              onNameChange={setName}
              onDefsChange={setDefs}
              onSave={savePattern}
              saving={saving}
              activeShiftIndex={activeShiftIndex}
              onActiveShiftChange={setActiveShiftIndex}
              showCoverageAlerts={selectedTemplateId !== null}
            />
          )
        ) : null}

        {tab === 'assign' ? (
          <Stack gap="md">
            {assignments.length === 0 ? (
              <Text size="sm" c="dimmed">
                No assignments yet. Save a pattern first, then assign it below.
              </Text>
            ) : (
              <AssignmentTable assignments={assignments} />
            )}
            {singlePlant && patterns.length > 0 && assignments.length === 0 ? (
              <Button onClick={quickAssign}>Assign to {singlePlant.name}</Button>
            ) : null}
            <Group grow align="flex-end">
              <Select
                label="Pattern"
                data={patterns.map((p) => ({ value: p.id, label: p.name }))}
                value={assignPattern}
                onChange={setAssignPattern}
              />
              <Select label="Assign to" data={targetOpts} value={assignTarget} onChange={setAssignTarget} searchable />
              <TextInput
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.currentTarget.value)}
              />
              <Button disabled={!assignPattern || !assignTarget} onClick={saveAssignment}>
                Assign
              </Button>
            </Group>
          </Stack>
        ) : null}

        {tab === 'calendar' ? (
          <HolidayTemplatePicker
            plantOpts={plantOpts}
            defaultPlantId={singlePlant?.id ?? null}
            onApplied={onChange}
          />
        ) : null}
      </Stack>
    </Card>
  )
}

function AssignmentTable({ assignments }: { assignments: AssignmentDto[] }) {
  return (
    <Table fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Pattern</Table.Th>
          <Table.Th>Scope</Table.Th>
          <Table.Th>Effective</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {assignments.map((a) => (
          <Table.Tr key={a.id}>
            <Table.Td>{a.patternName}</Table.Td>
            <Table.Td>{a.plantId ? 'Plant' : 'Line'}</Table.Td>
            <Table.Td>{a.effectiveFrom}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
