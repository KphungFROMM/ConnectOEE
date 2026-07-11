import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Modal,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload, IconEye } from '@tabler/icons-react'
import { downloadRun, getRuns, type ReportRun, type ReportTemplate } from '../../lib/reports'

export function ReportHistoryTab({
  refreshToken,
  templates = [],
}: {
  refreshToken: number
  templates?: ReportTemplate[]
}) {
  const [runs, setRuns] = useState<ReportRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [templateFilter, setTemplateFilter] = useState<string | null>(null)
  const [skip, setSkip] = useState(0)
  const pageSize = 50

  const load = useCallback(() => {
    setLoading(true)
    getRuns(skip, pageSize, statusFilter ?? undefined)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [skip, statusFilter])

  useEffect(() => {
    load()
  }, [load, refreshToken])

  const templateNameById = useMemo(() => new Map(templates.map((t) => [t.id, t.name])), [templates])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return runs.filter((r) => {
      if (templateFilter && r.reportTemplateId !== templateFilter) return false
      if (!q) return true
      const title = r.title?.toLowerCase() ?? ''
      const err = r.error?.toLowerCase() ?? ''
      const tpl = templateNameById.get(r.reportTemplateId)?.toLowerCase() ?? ''
      return title.includes(q) || err.includes(q) || tpl.includes(q)
    })
  }, [runs, search, templateFilter, templateNameById])

  const hasMore = runs.length >= pageSize

  return (
    <Stack>
      <Group wrap="wrap">
        <TextInput
          placeholder="Search title or error…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={240}
        />
        <Select
          placeholder="All templates"
          clearable
          searchable
          data={templates.map((t) => ({ value: t.id, label: t.name }))}
          value={templateFilter}
          onChange={setTemplateFilter}
          w={220}
        />
        <Select
          placeholder="All statuses"
          clearable
          data={[
            { value: 'Success', label: 'Success' },
            { value: 'Failed', label: 'Failed' },
          ]}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v)
            setSkip(0)
          }}
          w={160}
        />
        <Button variant="light" onClick={load} loading={loading}>
          Refresh
        </Button>
      </Group>
      <Paper withBorder radius="md">
        <ScrollArea>
          <Table highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Generated</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Template</Table.Th>
                <Table.Th>Format</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Trigger</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    <Text size="sm">{new Date(r.generatedUtc).toLocaleString()}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {r.title}
                      </Text>
                      {r.error ? (
                        <Text size="xs" c="red" lineClamp={1}>
                          {r.error}
                        </Text>
                      ) : null}
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {templateNameById.get(r.reportTemplateId) ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="outline">
                      {r.format}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={r.status === 'Success' ? 'teal' : 'red'}>
                      {r.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {r.triggeredBy ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {r.hasFile ? (
                      <Group gap={4} justify="flex-end">
                        <Tooltip label="Download">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => downloadRun(r.id, r.title, r.format)}
                            title="Download"
                          >
                            <IconDownload size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Open file">
                          <ActionIcon
                            variant="subtle"
                            onClick={() => downloadRun(r.id, r.title, r.format)}
                            title="Open"
                          >
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              ))}
              {!loading && filtered.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center" size="sm">
                      No reports match these filters.
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Paper>
      <Group justify="center">
        <Button variant="subtle" disabled={skip === 0} onClick={() => setSkip((s) => Math.max(0, s - pageSize))}>
          Previous
        </Button>
        <Text size="sm" c="dimmed">
          Page {Math.floor(skip / pageSize) + 1}
        </Text>
        <Button variant="subtle" disabled={!hasMore} onClick={() => setSkip((s) => s + pageSize)}>
          Next
        </Button>
      </Group>
    </Stack>
  )
}

export function ConfirmDeleteModal({
  opened,
  name,
  onClose,
  onConfirm,
}: {
  opened: boolean
  name: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal opened={opened} onClose={onClose} title="Delete schedule?" centered>
      <Stack>
        <Text size="sm">Delete schedule “{name}”? This cannot be undone.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}

export function notifyReport(message: string, color: 'green' | 'red' | 'yellow' = 'green') {
  notifications.show({ message, color })
}
