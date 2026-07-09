import { useCallback, useEffect, useState } from 'react'
import { Button, Group, Stack, Table, Text, Title } from '@mantine/core'
import { apiGet } from '../../lib/api'
import { getToken } from '../../lib/auth'

interface AuditLogRow {
  id: string
  timestampUtc: string
  action: string
  userName?: string | null
  entityType?: string | null
  entityId?: string | null
  result?: string | null
}

export function AuditAdmin() {
  const [rows, setRows] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    void apiGet<AuditLogRow[]>('/api/audit?take=200')
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  const exportCsv = useCallback(async () => {
    const token = getToken()
    const res = await fetch('/api/audit/export', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `connectoee-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={4}>Audit log</Title>
        <Group>
          <Button variant="light" onClick={load} loading={loading}>
            Refresh
          </Button>
          <Button variant="default" onClick={() => void exportCsv()}>
            Export CSV
          </Button>
        </Group>
      </Group>
      <Text size="sm" c="dimmed">
        Append-only record of sign-ins, configuration changes, PLC writes, and HTTP mutations.
      </Text>
      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Time (UTC)</Table.Th>
            <Table.Th>Action</Table.Th>
            <Table.Th>User</Table.Th>
            <Table.Th>Entity</Table.Th>
            <Table.Th>Result</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.id}>
              <Table.Td>{new Date(r.timestampUtc).toLocaleString()}</Table.Td>
              <Table.Td>{r.action}</Table.Td>
              <Table.Td>{r.userName ?? '—'}</Table.Td>
              <Table.Td>
                {r.entityType ?? '—'}
                {r.entityId ? ` · ${r.entityId}` : ''}
              </Table.Td>
              <Table.Td>{r.result ?? '—'}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
