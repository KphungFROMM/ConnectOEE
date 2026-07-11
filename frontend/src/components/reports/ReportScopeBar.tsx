import { useEffect, useMemo, useState } from 'react'
import { Group, Paper, Select, Stack, Text } from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { resolveScopeSelection } from '../../lib/scopeFromUrl'
import type { EntityLevel } from '../../lib/historian'
import { ScopeBreadcrumb, type BreadcrumbSegment } from '../analytics/ScopeBreadcrumb'
import type { GenerateFormState } from './reportConstants'
import { RANGE_OPTIONS } from './reportConstants'

function scopeValue(level: EntityLevel, id: string) {
  return `${level}:${id}`
}

export function ReportScopeBar({
  form,
  onChange,
}: {
  form: GenerateFormState
  onChange: (patch: Partial<GenerateFormState>) => void
}) {
  const [tree, setTree] = useState<PlantNode[]>([])
  const [plantId, setPlantId] = useState<string | null>(null)
  const [deptId, setDeptId] = useState<string | null>(null)
  const [lineId, setLineId] = useState<string | null>(null)
  const [machineId, setMachineId] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    getHierarchyTree()
      .then((t) => {
        setTree(t)
        if (t.length > 0 && !form.scope) {
          setPlantId(t[0].id)
          onChange({ scope: scopeValue('Plant', t[0].id) })
        }
      })
      .catch(() => setTree([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once from tree load
  }, [])

  useEffect(() => {
    if (tree.length === 0 || !form.scope) return
    const resolved = resolveScopeSelection(tree, form.scope)
    if (resolved) {
      setPlantId(resolved.plantId)
      setDeptId(resolved.deptId)
      setLineId(resolved.lineId)
      setMachineId(resolved.machineId)
    }
    setHydrated(true)
  }, [tree, form.scope])

  const plant = tree.find((p) => p.id === plantId) ?? null
  const dept = plant?.departments.find((d) => d.id === deptId) ?? null
  const line = dept?.lines.find((l) => l.id === lineId) ?? null

  function emitScope(next: {
    plantId: string | null
    deptId: string | null
    lineId: string | null
    machineId: string | null
  }) {
    if (next.machineId && next.lineId) {
      onChange({ scope: scopeValue('Machine', next.machineId) })
      return
    }
    if (next.lineId) {
      onChange({ scope: scopeValue('Line', next.lineId) })
      return
    }
    if (next.deptId) {
      onChange({ scope: scopeValue('Department', next.deptId) })
      return
    }
    if (next.plantId) {
      onChange({ scope: scopeValue('Plant', next.plantId) })
    }
  }

  function onBreadcrumbNavigate(seg: BreadcrumbSegment | null) {
    if (!seg) return
    if (seg.level === 'Plant') {
      setDeptId(null)
      setLineId(null)
      setMachineId(null)
      emitScope({ plantId: seg.id, deptId: null, lineId: null, machineId: null })
    } else if (seg.level === 'Department') {
      setDeptId(seg.id)
      setLineId(null)
      setMachineId(null)
      emitScope({ plantId, deptId: seg.id, lineId: null, machineId: null })
    } else if (seg.level === 'Line') {
      setLineId(seg.id)
      setMachineId(null)
      emitScope({ plantId, deptId, lineId: seg.id, machineId: null })
    }
  }

  const rangeData = useMemo(() => RANGE_OPTIONS, [])

  return (
    <Paper withBorder radius="md" padding="sm" style={{ position: 'sticky', top: 0, zIndex: 5 }}>
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <ScopeBreadcrumb
            plant={plant}
            deptId={deptId}
            lineId={lineId}
            machineId={machineId}
            onNavigate={onBreadcrumbNavigate}
          />
          {!hydrated && tree.length === 0 ? (
            <Text size="xs" c="dimmed">
              Loading hierarchy…
            </Text>
          ) : null}
        </Group>
        <Group grow align="flex-end" wrap="wrap">
          <Select
            label="Plant"
            size="xs"
            data={tree.map((p) => ({ value: p.id, label: p.name }))}
            value={plantId}
            onChange={(v) => {
              setPlantId(v)
              setDeptId(null)
              setLineId(null)
              setMachineId(null)
              if (v) emitScope({ plantId: v, deptId: null, lineId: null, machineId: null })
            }}
            allowDeselect={false}
          />
          <Select
            label="Department"
            size="xs"
            clearable
            placeholder="All"
            data={(plant?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            value={deptId}
            onChange={(v) => {
              setDeptId(v)
              setLineId(null)
              setMachineId(null)
              emitScope({ plantId, deptId: v, lineId: null, machineId: null })
            }}
            disabled={!plant}
          />
          <Select
            label="Line"
            size="xs"
            clearable
            placeholder="All"
            data={(dept?.lines ?? []).map((l) => ({ value: l.id, label: l.name }))}
            value={lineId}
            onChange={(v) => {
              setLineId(v)
              setMachineId(null)
              emitScope({ plantId, deptId, lineId: v, machineId: null })
            }}
            disabled={!dept}
          />
          <Select
            label="Machine"
            size="xs"
            clearable
            placeholder="All"
            data={(line?.machines ?? []).map((m) => ({ value: m.id, label: m.name }))}
            value={machineId}
            onChange={(v) => {
              setMachineId(v)
              emitScope({ plantId, deptId, lineId, machineId: v })
            }}
            disabled={!line}
          />
          <Select
            label="Date range"
            size="xs"
            data={rangeData}
            value={form.range}
            onChange={(v) => onChange({ range: (v as GenerateFormState['range']) ?? 'PreviousShift' })}
            allowDeselect={false}
          />
        </Group>
        {form.range === 'Custom' ? (
          <Group grow align="flex-end">
            <DateTimePicker
              label="From"
              size="xs"
              value={form.customFrom ? new Date(form.customFrom) : null}
              onChange={(d) => onChange({ customFrom: d ? new Date(d).toISOString() : '' })}
            />
            <DateTimePicker
              label="To"
              size="xs"
              value={form.customTo ? new Date(form.customTo) : null}
              onChange={(d) => onChange({ customTo: d ? new Date(d).toISOString() : '' })}
            />
          </Group>
        ) : null}
      </Stack>
    </Paper>
  )
}
