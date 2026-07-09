import { useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Collapse,
  ColorInput,
  Group,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconPlus, IconTrash } from '@tabler/icons-react'
import type { BreakWindow, ShiftDefinitionDto } from '../../lib/admin'
import {
  analyzeCoverage,
  buildDisplaySegments,
  formatDuration,
  getShiftDurationMinutes,
} from '../../lib/shiftTimelineUtils'

export function blankShiftDef(i: number): ShiftDefinitionDto {
  return { name: '', startTime: '06:00', endTime: '14:00', color: '#2E9E5B', orderIndex: i, breaks: [] }
}

interface PatternEditorProps {
  name: string
  defs: ShiftDefinitionDto[]
  onNameChange: (name: string) => void
  onDefsChange: (defs: ShiftDefinitionDto[]) => void
  onSave: () => void
  saving?: boolean
  saveLabel?: string
  activeShiftIndex?: number | null
  onActiveShiftChange?: (index: number | null) => void
  showCoverageAlerts?: boolean
}

export function PatternEditor({
  name,
  defs,
  onNameChange,
  onDefsChange,
  onSave,
  saving,
  saveLabel = 'Save pattern',
  activeShiftIndex,
  onActiveShiftChange,
  showCoverageAlerts = true,
}: PatternEditorProps) {
  const [breaksOpen, setBreaksOpen] = useState<Record<number, boolean>>({})

  const segments = useMemo(() => buildDisplaySegments(defs), [defs])
  const coverage = useMemo(() => analyzeCoverage(segments), [segments])

  function updateDef(i: number, patch: Partial<ShiftDefinitionDto>) {
    onDefsChange(
      defs.map((d, idx) => {
        if (idx !== i) return d
        const next = { ...d, ...patch }
        if (patch.startTime !== undefined || patch.endTime !== undefined) {
          next.crossesMidnight = next.endTime <= next.startTime
        }
        return next
      }),
    )
  }

  function addBreak(i: number) {
    setBreaksOpen((prev) => ({ ...prev, [i]: true }))
    onDefsChange(
      defs.map((d, idx) =>
        idx === i ? { ...d, breaks: [...(d.breaks ?? []), { start: '12:00', end: '12:30' } as BreakWindow] } : d,
      ),
    )
  }

  function updateBreak(i: number, bi: number, patch: Partial<BreakWindow>) {
    onDefsChange(
      defs.map((d, idx) =>
        idx === i
          ? { ...d, breaks: (d.breaks ?? []).map((b, j) => (j === bi ? { ...b, ...patch } : b)) }
          : d,
      ),
    )
  }

  function removeBreak(i: number, bi: number) {
    onDefsChange(
      defs.map((d, idx) =>
        idx === i ? { ...d, breaks: (d.breaks ?? []).filter((_, j) => j !== bi) } : d,
      ),
    )
  }

  function toggleBreaks(i: number) {
    setBreaksOpen((prev) => ({ ...prev, [i]: !prev[i] }))
  }

  const canSave = name.trim().length > 0 && defs.every((d) => d.name.trim().length > 0)

  return (
    <Stack gap="md">
      <TextInput
        label="Pattern name"
        placeholder="e.g. 2x12"
        value={name}
        onChange={(e) => onNameChange(e.currentTarget.value)}
      />

      {showCoverageAlerts && coverage.gaps.length > 0 ? (
        <Alert color="yellow" variant="light" py={6}>
          {coverage.gaps.map((g, i) => (
            <Text key={i} size="xs">
              {formatDuration(g.minutes)} uncovered in the daily schedule
            </Text>
          ))}
        </Alert>
      ) : null}

      {showCoverageAlerts && coverage.overlaps.length > 0 ? (
        <Alert color="red" variant="light" py={6}>
          {coverage.overlaps.map((o, i) => (
            <Text key={i} size="xs">
              {o.shiftA} and {o.shiftB} overlap by {formatDuration(o.minutes)}
            </Text>
          ))}
        </Alert>
      ) : null}

      {defs.map((d, i) => {
        const shiftColor = d.color ?? '#2E9E5B'
        const isActive = activeShiftIndex === i
        const breakCount = (d.breaks ?? []).length
        const breaksExpanded = breaksOpen[i] ?? breakCount > 0

        return (
          <Card
            key={i}
            withBorder
            padding="sm"
            radius="md"
            style={{
              borderLeftWidth: 4,
              borderLeftColor: shiftColor,
              outline: isActive ? '2px solid var(--mantine-color-brand-6)' : undefined,
              outlineOffset: 1,
            }}
          >
            <UnstyledButton
              w="100%"
              onClick={() => onActiveShiftChange?.(isActive ? null : i)}
              aria-label={`Select shift ${d.name || i + 1}`}
            >
              <Group justify="space-between" mb="xs">
                <Text size="xs" fw={700} c="dimmed" tt="uppercase">
                  Shift {i + 1}
                </Text>
                <Text size="xs" c="dimmed">
                  {getShiftDurationMinutes(d) > 0 && d.name.trim()
                    ? formatDuration(getShiftDurationMinutes(d))
                    : '—'}
                </Text>
              </Group>
            </UnstyledButton>
            <Stack gap={4}>
              <Group grow align="flex-end">
                <TextInput
                  label="Shift name"
                  value={d.name}
                  onChange={(e) => updateDef(i, { name: e.currentTarget.value })}
                  onFocus={() => onActiveShiftChange?.(i)}
                />
                <TextInput
                  label="Start"
                  type="time"
                  value={d.startTime}
                  onChange={(e) => updateDef(i, { startTime: e.currentTarget.value })}
                  onFocus={() => onActiveShiftChange?.(i)}
                />
                <TextInput
                  label="End"
                  type="time"
                  value={d.endTime}
                  onChange={(e) => updateDef(i, { endTime: e.currentTarget.value })}
                  onFocus={() => onActiveShiftChange?.(i)}
                />
                <ColorInput
                  label="Color"
                  value={d.color ?? '#2E9E5B'}
                  onChange={(v) => updateDef(i, { color: v })}
                  withEyeDropper={false}
                />
                <ActionIcon
                  color="red"
                  variant="subtle"
                  onClick={() => {
                    onDefsChange(defs.filter((_, idx) => idx !== i))
                    if (activeShiftIndex === i) onActiveShiftChange?.(null)
                  }}
                  aria-label="Remove shift"
                  mb={4}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              {d.endTime <= d.startTime && d.startTime !== d.endTime ? (
                <Text size="xs" c="dimmed">
                  Spans midnight — end time is on the next calendar day.
                </Text>
              ) : null}
              <div>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={breaksExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                  onClick={() => toggleBreaks(i)}
                >
                  Breaks ({breakCount})
                </Button>
                <Collapse expanded={breaksExpanded}>
                  <Stack gap="xs" mt="xs" pl="xs">
                    {(d.breaks ?? []).map((b, bi) => (
                      <Group key={bi} gap={4}>
                        <TextInput
                          size="xs"
                          type="time"
                          value={b.start}
                          onChange={(e) => updateBreak(i, bi, { start: e.currentTarget.value })}
                        />
                        <Text size="xs">–</Text>
                        <TextInput
                          size="xs"
                          type="time"
                          value={b.end}
                          onChange={(e) => updateBreak(i, bi, { end: e.currentTarget.value })}
                        />
                        <ActionIcon size="sm" variant="subtle" color="red" onClick={() => removeBreak(i, bi)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                    ))}
                    <Button size="xs" variant="light" onClick={() => addBreak(i)}>
                      Add break
                    </Button>
                  </Stack>
                </Collapse>
              </div>
            </Stack>
          </Card>
        )
      })}
      <Group>
        <Button
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => onDefsChange([...defs, blankShiftDef(defs.length)])}
        >
          Add shift
        </Button>
        <Button disabled={!canSave || saving} loading={saving} onClick={onSave}>
          {saveLabel}
        </Button>
      </Group>
    </Stack>
  )
}
