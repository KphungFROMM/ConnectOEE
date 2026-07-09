import { useCallback, useEffect, useState } from 'react'
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
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDownload } from '@tabler/icons-react'
import { downloadRun, getRuns, type ReportRun } from '../../lib/reports'

export function ReportHistoryTab({ refreshToken }: { refreshToken: number }) {
  const [runs, setRuns] = useState<ReportRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
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

  const hasMore = runs.length >= pageSize

  return (
    <Stack>
      <Group>
        <Select
          placeholder="All statuses"
          clearable
          data={[
            { value: 'Success', label: 'Success' },
            { value: 'Failed', label: 'Failed' },
          ]}
          value={statusFilter}
          onChange={setStatusFilter}
          w={180}
        />
        <Button variant="light" onClick={load} loading={loading}>
          Refresh
        </Button>
      </Group>
      <Paper withBorder radius="md">
        <ScrollArea>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Generated</Table.Th>
                <Table.Th>Title</Table.Th>
                <Table.Th>Format</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Error</Table.Th>
                <Table.Th>Trigger</Table.Th>
                <Table.Th />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {runs.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>{new Date(r.generatedUtc).toLocaleString()}</Table.Td>
                  <Table.Td>{r.title}</Table.Td>
                  <Table.Td>{r.format}</Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" color={r.status === 'Success' ? 'teal' : 'red'}>
                      {r.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c={r.error ? 'red' : 'dimmed'} lineClamp={2}>
                      {r.error ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {r.triggeredBy ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {r.hasFile ? (
                      <ActionIcon variant="subtle" onClick={() => downloadRun(r.id, r.title, r.format)} title="Download">
                        <IconDownload size={16} />
                      </ActionIcon>
                    ) : null}
                  </Table.Td>
                </Table.Tr>
              ))}
              {!loading && runs.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text c="dimmed" ta="center" size="sm">
                      No reports generated yet.
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
