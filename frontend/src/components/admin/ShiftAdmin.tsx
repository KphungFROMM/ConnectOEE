import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
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
  deleteAssignment,
  deletePattern,
  listAssignments,
  listPatterns,
  updatePattern,
  type AssignmentDto,
  type ShiftDefinitionDto,
  type ShiftPatternDto,
} from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { applyShiftTemplate, type ShiftPatternTemplate } from '../../lib/shiftPatternCatalog'
import { HolidayTemplatePicker } from '../shifts/HolidayTemplatePicker'
import { blankShiftDef, PatternEditor } from '../shifts/PatternEditor'
import { SectionLabel } from '../shifts/SectionLabel'
import { HelpTrigger } from '../help/HelpTrigger'
import { ShiftPatternTemplatePicker } from '../shifts/ShiftPatternTemplatePicker'
import { ShiftScheduleChart } from '../shifts/ShiftScheduleChart'

function cloneDefinitions(defs: ShiftDefinitionDto[]): ShiftDefinitionDto[] {
  return defs.map((d, i) => ({
    ...d,
    orderIndex: d.orderIndex ?? i,
    breaks: (d.breaks ?? []).map((b) => ({ ...b })),
  }))
}

export function ShiftAdmin({ onChange }: { onChange?: () => void }) {
  const [patterns, setPatterns] = useState<ShiftPatternDto[]>([])
  const [assignments, setAssignments] = useState<AssignmentDto[]>([])
  const [tree, setTree] = useState<PlantNode[]>([])

  const reload = () => {
    void listPatterns().then(setPatterns).catch(() => undefined)
    void listAssignments().then(setAssignments).catch(() => undefined)
  }

  useEffect(() => {
    reload()
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [defs, setDefs] = useState<ShiftDefinitionDto[]>([blankShiftDef(0)])
  const [saving, setSaving] = useState(false)
  const [activeShiftIndex, setActiveShiftIndex] = useState<number | null>(null)

  const [assignPattern, setAssignPattern] = useState<string | null>(null)
  const [assignTarget, setAssignTarget] = useState<string | null>(null)
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10))

  const plantOpts = tree.map((p) => ({ value: p.id, label: p.name }))
  const singlePlant = tree.length === 1 ? tree[0] : null

  const assignedPatternIds = useMemo(
    () => new Set(assignments.map((a) => a.shiftPatternId)),
    [assignments],
  )

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

  function resetEditor() {
    setEditingId(null)
    setSelectedTemplateId(null)
    setName('')
    setDefs([blankShiftDef(0)])
    setActiveShiftIndex(null)
  }

  function selectTemplate(template: ShiftPatternTemplate | null) {
    if (editingId) return
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
  }

  function startEdit(pattern: ShiftPatternDto) {
    setEditingId(pattern.id)
    setSelectedTemplateId(null)
    setName(pattern.name)
    setDefs(cloneDefinitions(pattern.definitions))
    setActiveShiftIndex(null)
  }

  async function savePattern() {
    setSaving(true)
    try {
      if (editingId) {
        await updatePattern(editingId, { name, definitions: defs })
        notifications.show({ message: 'Pattern updated', color: 'green' })
      } else {
        await createPattern({ name, definitions: defs })
        notifications.show({ message: 'Pattern saved', color: 'green' })
      }
      resetEditor()
      reload()
      onChange?.()
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
    } catch {
      notifications.show({ message: 'Failed to assign', color: 'red' })
    }
  }

  const needsAssignment = patterns.length > 0 && assignments.length === 0

  return (
    <Stack>
      {needsAssignment ? (
        <Alert color="orange" variant="light" title="Pattern not assigned">
          You have shift pattern(s) saved but none are assigned to a plant or line. The header will show{' '}
          <strong>No shift assigned</strong> until you assign a pattern below.
        </Alert>
      ) : null}

      <Group gap={6} align="center">
        <Text size="sm" c="dimmed">
          Shift start/end times use the plant timezone (Admin → Hierarchy).
        </Text>
        <HelpTrigger helpId="shift.plantTimezone" size="xs" />
      </Group>

      <Card withBorder radius="md" padding="md">
        <SectionLabel mb={6}>Shift patterns</SectionLabel>
        {patterns.length === 0 ? (
          <Text size="sm" c="dimmed">
            No patterns yet.
          </Text>
        ) : (
          patterns.map((p) => {
            const assigned = assignedPatternIds.has(p.id)
            return (
              <Group key={p.id} justify="space-between" py={4} align="flex-start">
                <div>
                  <Group gap="xs" mb={4}>
                    <Text fw={600} size="sm">
                      {p.name}
                    </Text>
                    <Badge size="xs" variant="light" color={assigned ? 'green' : 'orange'}>
                      {assigned ? 'Assigned' : 'Not assigned'}
                    </Badge>
                  </Group>
                  <Group gap={6}>
                    {p.definitions.map((d) => (
                      <Badge
                        key={d.id ?? `${p.id}-${d.name}`}
                        variant="light"
                        size="sm"
                        style={{ backgroundColor: `${d.color ?? '#888'}22`, color: d.color ?? undefined }}
                      >
                        {d.name} {d.startTime.slice(0, 5)}–{d.endTime.slice(0, 5)}
                      </Badge>
                    ))}
                  </Group>
                </div>
                <Group gap={4}>
                  <Button size="xs" variant="light" onClick={() => startEdit(p)}>
                    Edit
                  </Button>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    disabled={assigned}
                    onClick={async () => {
                      try {
                        await deletePattern(p.id)
                        if (editingId === p.id) resetEditor()
                        reload()
                      } catch {
                        notifications.show({
                          message: 'Pattern is assigned; remove assignment first',
                          color: 'red',
                        })
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Group>
              </Group>
            )
          })
        )}
      </Card>

      <Card withBorder radius="md" padding="md">
        <Group justify="space-between" mb={8}>
          <SectionLabel>{editingId ? `Editing: ${name}` : 'New pattern'}</SectionLabel>
          {editingId ? (
            <Button size="xs" variant="default" onClick={resetEditor}>
              Cancel edit
            </Button>
          ) : null}
        </Group>
        <Stack gap="lg">
          {!editingId ? (
            <ShiftPatternTemplatePicker selectedId={selectedTemplateId} onSelect={selectTemplate} />
          ) : (
            <Text size="sm" c="dimmed">
              Changes apply to future shift windows. Active shift instances keep their current names until the next
              boundary.
            </Text>
          )}
          <PatternEditor
            name={name}
            defs={defs}
            onNameChange={setName}
            onDefsChange={setDefs}
            onSave={savePattern}
            saving={saving}
            saveLabel={editingId ? 'Update pattern' : 'Save pattern'}
            activeShiftIndex={activeShiftIndex}
            onActiveShiftChange={setActiveShiftIndex}
            showCoverageAlerts={editingId !== null || selectedTemplateId !== null}
          />
          <ShiftScheduleChart
            name={name}
            definitions={defs}
            activeShiftIndex={activeShiftIndex}
            variant="compact"
          />
        </Stack>
      </Card>

      <Card withBorder radius="md" padding="md">
        <SectionLabel mb={8} helpId="shift.assignment">
          Assignments
        </SectionLabel>
        {assignments.length === 0 ? (
          <Text size="sm" c="dimmed" mb="xs">
            No assignments yet. Assign a pattern to a plant or line so the header shows Day / Swing / Night instead of
            the fallback.
          </Text>
        ) : (
          <Table fz="sm" mb="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Pattern</Table.Th>
                <Table.Th>Scope</Table.Th>
                <Table.Th>Effective</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {assignments.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>{a.patternName}</Table.Td>
                  <Table.Td>{a.plantId ? 'Plant' : 'Line'}</Table.Td>
                  <Table.Td>{a.effectiveFrom}</Table.Td>
                  <Table.Td>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="red"
                      onClick={async () => {
                        await deleteAssignment(a.id)
                        reload()
                        onChange?.()
                      }}
                    >
                      Remove
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
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
      </Card>

      <Card withBorder padding="md">
        <Title order={5} mb="xs">
          Plant calendar (holidays &amp; non-working days)
        </Title>
        <HolidayTemplatePicker
          plantOpts={plantOpts}
          defaultPlantId={singlePlant?.id ?? null}
          onApplied={onChange}
        />
      </Card>
    </Stack>
  )
}
