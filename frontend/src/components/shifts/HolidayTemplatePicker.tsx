import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Textarea,
  Switch,
  Collapse,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  formatHolidayDate,
  HOLIDAY_DEFINITIONS,
  HOLIDAY_PRESETS,
  resolveHolidayDates,
  type HolidayId,
} from '../../lib/holidayCatalog'
import { listShiftCalendar, saveShiftCalendar, type ShiftCalendarEntry } from '../../lib/admin'

interface HolidayTemplatePickerProps {
  plantOpts: { value: string; label: string }[]
  defaultPlantId?: string | null
  onApplied?: () => void
  showCustomDate?: boolean
}

export function HolidayTemplatePicker({
  plantOpts,
  defaultPlantId,
  onApplied,
  showCustomDate = true,
}: HolidayTemplatePickerProps) {
  const currentYear = new Date().getFullYear()
  const [plantId, setPlantId] = useState<string | null>(defaultPlantId ?? null)
  const [year, setYear] = useState(String(currentYear))
  const [alsoNextYear, setAlsoNextYear] = useState(false)
  const [selected, setSelected] = useState<Set<HolidayId>>(new Set())
  const [applying, setApplying] = useState(false)
  const [entries, setEntries] = useState<ShiftCalendarEntry[]>([])
  const [customOpen, setCustomOpen] = useState(false)
  const [calDate, setCalDate] = useState(new Date().toISOString().slice(0, 10))
  const [calWorking, setCalWorking] = useState(false)
  const [calHoliday, setCalHoliday] = useState(true)
  const [calPlannedDown, setCalPlannedDown] = useState(false)
  const [calNote, setCalNote] = useState('')

  useEffect(() => {
    if (defaultPlantId && !plantId) setPlantId(defaultPlantId)
  }, [defaultPlantId, plantId])

  useEffect(() => {
    if (!plantId) {
      setEntries([])
      return
    }
    void listShiftCalendar(plantId).then(setEntries).catch(() => undefined)
  }, [plantId])

  const yearNum = parseInt(year, 10)
  const resolved = useMemo(() => {
    const ids = Array.from(selected)
    const y1 = resolveHolidayDates(ids, yearNum)
    if (!alsoNextYear) return y1
    const y2 = resolveHolidayDates(ids, yearNum + 1)
    return [...y1, ...y2]
  }, [selected, yearNum, alsoNextYear])

  function applyPreset(key: keyof typeof HOLIDAY_PRESETS) {
    setSelected(new Set(HOLIDAY_PRESETS[key].ids))
  }

  async function applyHolidays() {
    if (!plantId || resolved.length === 0) return
    setApplying(true)
    try {
      await Promise.all(
        resolved.map((h) =>
          saveShiftCalendar({
            plantId,
            date: h.date,
            isWorkingDay: false,
            isHoliday: true,
            isPlannedDown: false,
            note: h.name,
          }),
        ),
      )
      void listShiftCalendar(plantId).then(setEntries)
      onApplied?.()
      notifications.show({
        message: `Applied ${resolved.length} holiday${resolved.length === 1 ? '' : 's'} to calendar`,
        color: 'green',
      })
    } catch {
      notifications.show({ message: 'Failed to apply holidays', color: 'red' })
    } finally {
      setApplying(false)
    }
  }

  async function saveCustomDate() {
    if (!plantId) return
    try {
      await saveShiftCalendar({
        plantId,
        date: calDate,
        isWorkingDay: calWorking,
        isHoliday: calHoliday,
        isPlannedDown: calPlannedDown,
        note: calNote || null,
      })
      void listShiftCalendar(plantId).then(setEntries)
      onApplied?.()
      notifications.show({ message: 'Calendar day saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save calendar day', color: 'red' })
    }
  }

  function toggleHoliday(id: HolidayId, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Non-working days exclude time from OEE planned availability.
      </Text>
      <Group grow align="flex-end">
        <Select
          label="Plant"
          data={plantOpts}
          value={plantId}
          onChange={setPlantId}
          searchable
          placeholder="Select plant"
        />
        <Select
          label="Year"
          data={[currentYear, currentYear + 1].map((y) => ({ value: String(y), label: String(y) }))}
          value={year}
          onChange={(v) => v && setYear(v)}
        />
      </Group>
      <Group gap="xs">
        <Button size="xs" variant="light" onClick={() => applyPreset('usFederal')}>
          {HOLIDAY_PRESETS.usFederal.label}
        </Button>
        <Button size="xs" variant="light" onClick={() => applyPreset('usFederalPlusClosures')}>
          {HOLIDAY_PRESETS.usFederalPlusClosures.label}
        </Button>
        <Button size="xs" variant="subtle" onClick={() => applyPreset('all')}>
          Select all
        </Button>
        <Button size="xs" variant="subtle" color="gray" onClick={() => setSelected(new Set())}>
          Clear
        </Button>
      </Group>
      <Checkbox
        label="Also apply next year"
        checked={alsoNextYear}
        onChange={(e) => setAlsoNextYear(e.currentTarget.checked)}
      />
      <Stack gap={6}>
        {HOLIDAY_DEFINITIONS.map((h) => {
          const dateStr = resolveHolidayDates([h.id], yearNum)[0]?.date
          return (
            <Checkbox
              key={h.id}
              label={
                <Group gap={6} wrap="nowrap">
                  <Text size="sm">{h.name}</Text>
                  <Text size="xs" c="dimmed">
                    {dateStr ? formatHolidayDate(dateStr) : ''}
                  </Text>
                </Group>
              }
              checked={selected.has(h.id)}
              onChange={(e) => toggleHoliday(h.id, e.currentTarget.checked)}
            />
          )
        })}
      </Stack>
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          {selected.size} holiday{selected.size === 1 ? '' : 's'} selected
          {alsoNextYear && selected.size > 0 ? ` (${resolved.length} dates with next year)` : ''}
        </Text>
        <Button disabled={!plantId || resolved.length === 0} loading={applying} onClick={applyHolidays}>
          Apply to calendar
        </Button>
      </Group>
      {entries.length > 0 ? (
        <Table fz="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Date</Table.Th>
              <Table.Th>Working</Table.Th>
              <Table.Th>Holiday</Table.Th>
              <Table.Th>Note</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {entries.slice(0, 20).map((e) => (
              <Table.Tr key={e.id}>
                <Table.Td>{e.date}</Table.Td>
                <Table.Td>{e.isWorkingDay ? 'Yes' : 'No'}</Table.Td>
                <Table.Td>{e.isHoliday ? 'Yes' : '—'}</Table.Td>
                <Table.Td>{e.note ?? '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : null}
      {showCustomDate ? (
        <>
          <Button variant="subtle" size="xs" onClick={() => setCustomOpen((o) => !o)}>
            {customOpen ? 'Hide custom date' : 'Add custom date'}
          </Button>
          <Collapse expanded={customOpen}>
            <Stack gap="sm" mt="xs">
              <Group grow align="flex-end">
                <TextInput label="Date" type="date" value={calDate} onChange={(e) => setCalDate(e.currentTarget.value)} />
                <Switch label="Working day" checked={calWorking} onChange={(e) => setCalWorking(e.currentTarget.checked)} />
                <Switch label="Holiday" checked={calHoliday} onChange={(e) => setCalHoliday(e.currentTarget.checked)} />
                <Switch label="Planned down" checked={calPlannedDown} onChange={(e) => setCalPlannedDown(e.currentTarget.checked)} />
              </Group>
              <Textarea label="Note" value={calNote} onChange={(e) => setCalNote(e.currentTarget.value)} />
              <Button disabled={!plantId} onClick={saveCustomDate}>
                Save custom date
              </Button>
            </Stack>
          </Collapse>
        </>
      ) : null}
    </Stack>
  )
}
