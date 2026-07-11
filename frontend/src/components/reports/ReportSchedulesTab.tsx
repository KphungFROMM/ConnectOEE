import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core'
import { TimeInput } from '@mantine/dates'
import { IconPencil, IconPlayerPlay, IconPlus, IconTrash } from '@tabler/icons-react'
import {
  createSchedule,
  deleteSchedule,
  getSchedules,
  runScheduleNow,
  updateSchedule,
  type ReportSchedule,
  type ReportTemplate,
} from '../../lib/reports'
import type { ScheduleForm, ScopeOption } from './reportConstants'
import { EMPTY_SCHEDULE, RANGE_OPTIONS } from './reportConstants'
import { ConfirmDeleteModal, notifyReport } from './ReportHistoryTab'

const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
]

function formatCadence(s: { frequency: string; timeOfDay: string; dayOfPeriod: number }) {
  const time = s.timeOfDay || '06:00'
  if (s.frequency === 'Daily') return `Daily at ${time}`
  if (s.frequency === 'Weekly') {
    const day = WEEKDAYS.find((d) => d.value === String(s.dayOfPeriod))?.label ?? `day ${s.dayOfPeriod}`
    return `Weekly · ${day} at ${time}`
  }
  return `Monthly · day ${s.dayOfPeriod} at ${time}`
}

function formatDelivery(s: { deliveryMethod: string; recipients?: string | null; fileDropPath?: string | null }) {
  if (s.deliveryMethod === 'Email') return s.recipients?.trim() || 'Email (no recipients)'
  return s.fileDropPath?.trim() || 'File drop (path unset)'
}

export function ReportSchedulesTab({
  templates,
  scopes,
  canManage,
  prefill,
  prefillOpen,
  onPrefillClose,
}: {
  templates: ReportTemplate[]
  scopes: ScopeOption[]
  canManage: boolean
  prefill?: Partial<ScheduleForm> | null
  prefillOpen?: boolean
  onPrefillClose?: () => void
}) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([])
  const [editing, setEditing] = useState<ScheduleForm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ReportSchedule | null>(null)

  const scopeLabel = useMemo(() => {
    const map = new Map(scopes.map((s) => [`${s.level}:${s.id}`, s.label.trim()]))
    return (level: string, id: string) => map.get(`${level}:${id}`) ?? `${level}`
  }, [scopes])

  const refresh = () => getSchedules().then(setSchedules).catch(() => setSchedules([]))
  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (prefillOpen && prefill) {
      setEditing({
        ...EMPTY_SCHEDULE,
        reportTemplateId: prefill.reportTemplateId ?? templates[0]?.id ?? '',
        scope: prefill.scope ?? scopes[0]?.value ?? '',
        rangeKind: (prefill.rangeKind as ScheduleForm['rangeKind']) ?? 'Last7d',
        format: (prefill.format as ScheduleForm['format']) ?? 'Pdf',
        name: 'Scheduled report',
      })
      onPrefillClose?.()
    }
  }, [prefillOpen, prefill, templates, scopes, onPrefillClose])

  async function save(form: ScheduleForm) {
    const opt = scopes.find((s) => s.value === form.scope)
    if (!form.name || !form.reportTemplateId || !opt) {
      notifyReport('Name, template and scope are required', 'red')
      return
    }
    const body = {
      name: form.name,
      reportTemplateId: form.reportTemplateId,
      format: form.format,
      scopeLevel: opt.level,
      scopeId: opt.id,
      rangeKind: form.rangeKind,
      frequency: form.frequency,
      timeOfDay: form.timeOfDay,
      dayOfPeriod: form.dayOfPeriod,
      enabled: form.enabled,
      deliveryMethod: form.deliveryMethod,
      recipients: form.recipients || null,
      fileDropPath: form.fileDropPath || null,
    }
    try {
      if (form.id) await updateSchedule(form.id, body)
      else await createSchedule(body)
      setEditing(null)
      await refresh()
      notifyReport('Schedule saved')
    } catch {
      notifyReport('Failed to save schedule', 'red')
    }
  }

  async function remove(id: string) {
    try {
      await deleteSchedule(id)
      setDeleteTarget(null)
      await refresh()
    } catch {
      notifyReport('Failed to delete', 'red')
    }
  }

  async function runNow(id: string) {
    try {
      const r = await runScheduleNow(id)
      notifyReport(r.delivered ? 'Delivered' : 'Run completed', r.delivered ? 'green' : 'yellow')
      await refresh()
    } catch {
      notifyReport('Run failed (check delivery config)', 'red')
      await refresh()
    }
  }

  return (
    <Stack>
      {canManage ? (
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() =>
              setEditing({
                ...EMPTY_SCHEDULE,
                reportTemplateId: templates[0]?.id ?? '',
                scope: scopes[0]?.value ?? '',
              })
            }
          >
            New schedule
          </Button>
        </Group>
      ) : null}

      <Paper withBorder radius="md">
        <ScrollArea>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Scope</Table.Th>
                <Table.Th>Cadence</Table.Th>
                <Table.Th>Delivery</Table.Th>
                <Table.Th>Next run (local)</Table.Th>
                <Table.Th>Last</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {schedules.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Stack gap={2}>
                      <Group gap={6}>
                        {s.name}
                        {!s.enabled ? (
                          <Badge size="xs" color="gray" variant="light">
                            off
                          </Badge>
                        ) : null}
                      </Group>
                      {s.lastError ? (
                        <Text size="xs" c="red" lineClamp={1}>
                          {s.lastError}
                        </Text>
                      ) : null}
                    </Stack>
                  </Table.Td>
                  <Table.Td>{scopeLabel(s.scopeLevel, s.scopeId)}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatCadence(s)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Badge size="xs" variant="light" w="fit-content">
                        {s.deliveryMethod === 'Email' ? 'Email' : 'File drop'}
                      </Badge>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {formatDelivery(s)}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>{s.nextRunUtc ? new Date(s.nextRunUtc).toLocaleString() : '—'}</Table.Td>
                  <Table.Td>
                    {s.lastStatus ? (
                      <Badge size="sm" variant="light" color={s.lastStatus === 'Success' ? 'teal' : 'red'}>
                        {s.lastStatus}
                      </Badge>
                    ) : (
                      <Text size="xs" c="dimmed">
                        never
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {canManage ? (
                      <Group gap={4} justify="flex-end" wrap="nowrap">
                        <ActionIcon variant="subtle" onClick={() => runNow(s.id)} title="Run now">
                          <IconPlayerPlay size={16} />
                        </ActionIcon>
                        <ActionIcon
                          variant="subtle"
                          onClick={() =>
                            setEditing({
                              id: s.id,
                              name: s.name,
                              reportTemplateId: s.reportTemplateId,
                              format: s.format,
                              scope: `${s.scopeLevel}:${s.scopeId}`,
                              rangeKind: s.rangeKind,
                              frequency: s.frequency,
                              timeOfDay: s.timeOfDay,
                              dayOfPeriod: s.dayOfPeriod,
                              enabled: s.enabled,
                              deliveryMethod: s.deliveryMethod,
                              recipients: s.recipients ?? '',
                              fileDropPath: s.fileDropPath ?? '',
                            })
                          }
                          title="Edit"
                        >
                          <IconPencil size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => setDeleteTarget(s)} title="Delete">
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Group>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              ))}
              {schedules.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center" size="sm">
                      No schedules yet.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>

      <Modal opened={!!editing} onClose={() => setEditing(null)} title="Report schedule" size="lg">
        {editing ? (
          <ScheduleEditor
            form={editing}
            templates={templates}
            scopes={scopes}
            onChange={setEditing}
            onSave={() => save(editing)}
          />
        ) : null}
      </Modal>

      <ConfirmDeleteModal
        opened={!!deleteTarget}
        name={deleteTarget?.name ?? ''}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && void remove(deleteTarget.id)}
      />
    </Stack>
  )
}

function ScheduleEditor({
  form,
  templates,
  scopes,
  onChange,
  onSave,
}: {
  form: ScheduleForm
  templates: ReportTemplate[]
  scopes: ScopeOption[]
  onChange: (f: ScheduleForm) => void
  onSave: () => void
}) {
  const set = (patch: Partial<ScheduleForm>) => onChange({ ...form, ...patch })
  return (
    <Stack>
      <TextInput label="Name" value={form.name} onChange={(e) => set({ name: e.currentTarget.value })} required />
      <Group grow>
        <Select
          label="Template"
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={form.reportTemplateId}
          onChange={(v) => set({ reportTemplateId: v ?? '' })}
          allowDeselect={false}
        />
        <Select
          label="Format"
          data={[
            { value: 'Pdf', label: 'PDF' },
            { value: 'Csv', label: 'CSV' },
          ]}
          value={form.format}
          onChange={(v) => set({ format: (v as ScheduleForm['format']) ?? 'Pdf' })}
          allowDeselect={false}
        />
      </Group>
      <Select
        label="Scope"
        searchable
        data={scopes.map((s) => ({ value: s.value, label: s.label }))}
        value={form.scope}
        onChange={(v) => set({ scope: v ?? '' })}
        allowDeselect={false}
      />
      <Select
        label="Date range"
        data={RANGE_OPTIONS.filter((r) => r.value !== 'Custom')}
        value={form.rangeKind}
        onChange={(v) => set({ rangeKind: (v as ScheduleForm['rangeKind']) ?? 'Yesterday' })}
        allowDeselect={false}
      />
      <Group grow>
        <Select
          label="Frequency"
          data={[
            { value: 'Daily', label: 'Daily' },
            { value: 'Weekly', label: 'Weekly' },
            { value: 'Monthly', label: 'Monthly' },
          ]}
          value={form.frequency}
          onChange={(v) => set({ frequency: (v as ScheduleForm['frequency']) ?? 'Daily' })}
          allowDeselect={false}
        />
        <TimeInput
          label="Time of day"
          value={form.timeOfDay}
          onChange={(e) => set({ timeOfDay: e.currentTarget.value })}
        />
        {form.frequency !== 'Daily' ? (
          form.frequency === 'Weekly' ? (
            <Select
              label="Day of week"
              data={WEEKDAYS}
              value={String(form.dayOfPeriod)}
              onChange={(v) => set({ dayOfPeriod: Number(v ?? 1) })}
              allowDeselect={false}
            />
          ) : (
            <NumberInput
              label="Day of month"
              value={form.dayOfPeriod}
              min={1}
              max={28}
              onChange={(v) => set({ dayOfPeriod: Number(v) || 1 })}
            />
          )
        ) : null}
      </Group>
      <Select
        label="Delivery method"
        data={[
          { value: 'Email', label: 'Email (SMTP)' },
          { value: 'FileDrop', label: 'File drop (folder)' },
        ]}
        value={form.deliveryMethod}
        onChange={(v) => set({ deliveryMethod: (v as ScheduleForm['deliveryMethod']) ?? 'Email' })}
        allowDeselect={false}
      />
      {form.deliveryMethod === 'Email' ? (
        <TextInput
          label="Recipients"
          placeholder="ops@plant.com; manager@plant.com"
          value={form.recipients}
          onChange={(e) => set({ recipients: e.currentTarget.value })}
        />
      ) : (
        <TextInput
          label="File drop folder"
          placeholder="\\\\fileserver\\reports or C:\\reports"
          value={form.fileDropPath}
          onChange={(e) => set({ fileDropPath: e.currentTarget.value })}
        />
      )}
      <Switch label="Enabled" checked={form.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
      <Group justify="flex-end">
        <Button onClick={onSave}>Save schedule</Button>
      </Group>
    </Stack>
  )
}
