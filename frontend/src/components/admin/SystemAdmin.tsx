import { useCallback, useEffect, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconDatabaseExport, IconRefresh, IconServer2, IconUsers } from '@tabler/icons-react'
import {
  createBackup,
  getCommissioningStatus,
  getSecurityCommissioning,
  getDriverStatus,
  getSystemInfo,
  getSystemMonitor,
  listBackups,
  type BackupFile,
  type ClientSession,
  type CommissioningStatus,
  type SecurityCommissioningStatus,
  type DriverStatus,
  type SystemInfo,
  type SystemMonitor,
} from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'

function stateColor(state: string): string {
  switch (state) {
    case 'Connected':
      return 'green'
    case 'Connecting':
      return 'blue'
    case 'Stale':
      return 'yellow'
    case 'Faulted':
      return 'red'
    default:
      return 'gray'
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function SystemAdmin() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(Permissions.ManageHierarchy)

  const [statuses, setStatuses] = useState<DriverStatus[]>([])
  const [info, setInfo] = useState<SystemInfo | null>(null)
  const [backups, setBackups] = useState<BackupFile[]>([])
  const [backingUp, setBackingUp] = useState(false)
  const [tree, setTree] = useState<PlantNode[]>([])
  const [commissionLineId, setCommissionLineId] = useState<string | null>(null)
  const [commissioning, setCommissioning] = useState<CommissioningStatus | null>(null)
  const [securityCommissioning, setSecurityCommissioning] = useState<SecurityCommissioningStatus | null>(null)
  const [monitor, setMonitor] = useState<SystemMonitor | null>(null)

  const lineOpts = tree.flatMap((p) =>
    p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${p.name} / ${d.name} / ${l.name}` }))),
  )

  const loadStatus = useCallback(() => {
    void getDriverStatus().then(setStatuses).catch(() => undefined)
  }, [])

  const loadInfo = useCallback(() => {
    void getSystemInfo().then(setInfo).catch(() => undefined)
    if (canManage) void listBackups().then(setBackups).catch(() => undefined)
  }, [canManage])

  const loadMonitor = useCallback(() => {
    void getSystemMonitor().then(setMonitor).catch(() => undefined)
  }, [])

  useEffect(() => {
    loadStatus()
    loadInfo()
    loadMonitor()
    void getHierarchyTree().then(setTree).catch(() => undefined)
    const t = setInterval(loadStatus, 3000)
    const m = setInterval(loadMonitor, 5000)
    return () => {
      clearInterval(t)
      clearInterval(m)
    }
  }, [loadStatus, loadInfo, loadMonitor])

  useEffect(() => {
    if (canManage) {
      void getSecurityCommissioning().then(setSecurityCommissioning).catch(() => setSecurityCommissioning(null))
    }
  }, [canManage, statuses])

  useEffect(() => {
    if (!commissionLineId) {
      setCommissioning(null)
      return
    }
    void getCommissioningStatus(commissionLineId).then(setCommissioning).catch(() => setCommissioning(null))
  }, [commissionLineId, statuses])

  async function runBackup() {
    setBackingUp(true)
    try {
      const b = await createBackup()
      notifications.show({ message: `Backup created: ${b.name}`, color: 'green' })
      void listBackups().then(setBackups).catch(() => undefined)
    } catch (e) {
      notifications.show({ message: e instanceof Error ? e.message : 'Backup failed', color: 'red' })
    } finally {
      setBackingUp(false)
    }
  }

  return (
    <Stack gap="lg">
      {/* Live connection health */}
      <Card withBorder padding="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <IconServer2 size={18} />
            <Title order={5}>Driver / connection health</Title>
          </Group>
          <Tooltip label="Refresh">
            <ActionIcon variant="subtle" onClick={loadStatus} aria-label="Refresh status">
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
        {statuses.length === 0 ? (
          <Text size="sm" c="dimmed">
            No active drivers.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {statuses.map((s, i) => (
              <Card key={`${s.name}-${i}`} withBorder padding="sm" radius="md">
                <Group justify="space-between" wrap="nowrap">
                  <Text fw={600} truncate>
                    {s.name}
                  </Text>
                  <Badge color={stateColor(s.state)} variant="light">
                    {s.state}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {s.driverType} · {s.machineCount} machine{s.machineCount === 1 ? '' : 's'}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </Card>

      {monitor ? (
        <>
          <Card withBorder padding="md">
            <Group justify="space-between" mb="sm">
              <Group gap="xs">
                <IconUsers size={18} />
                <Title order={5}>Active clients</Title>
              </Group>
              <Tooltip label="Refresh">
                <ActionIcon variant="subtle" onClick={loadMonitor} aria-label="Refresh monitor">
                  <IconRefresh size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
            <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} mb="md">
              <SummaryPill label="Staff" value={monitor.summary.staffSessions} />
              <SummaryPill label="Operator" value={monitor.summary.operatorSessions} />
              <SummaryPill label="Kiosk" value={monitor.summary.kioskSessions} color="blue" />
              <SummaryPill label="Users" value={monitor.summary.uniqueUsers} />
              <SummaryPill label="SignalR" value={monitor.summary.signalRConnections} />
              <SummaryPill label="Tag preview" value={monitor.summary.tagPreviewClients} />
            </SimpleGrid>
            {monitor.sessions.length === 0 ? (
              <Text size="sm" c="dimmed">
                No active browser sessions in the last 90 seconds.
              </Text>
            ) : (
              <Table striped highlightOnHover fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Kind</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Page</Table.Th>
                    <Table.Th>Line / display</Table.Th>
                    <Table.Th>Theme</Table.Th>
                    <Table.Th>Last seen</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {monitor.sessions.map((s) => (
                    <SessionRow key={s.sessionId} session={s} />
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          {monitor.sessions.some((s) => s.clientKind === 'Kiosk') ? (
            <Card withBorder padding="md">
              <Title order={5} mb="sm">
                Active kiosk displays
              </Title>
              <Table striped fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Dashboard</Table.Th>
                    <Table.Th>Line</Table.Th>
                    <Table.Th>Last seen</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {monitor.sessions
                    .filter((s) => s.clientKind === 'Kiosk')
                    .map((s) => (
                      <Table.Tr key={s.sessionId}>
                        <Table.Td>{s.kioskDashboardName ?? '—'}</Table.Td>
                        <Table.Td>{s.lineName ?? '—'}</Table.Td>
                        <Table.Td>{formatRelative(s.lastSeenUtc)}</Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </Card>
          ) : null}

          <Card withBorder padding="md">
            <Title order={5} mb="sm">
              Live pipeline
            </Title>
            <SimpleGrid cols={{ base: 2, sm: 4 }}>
              <SummaryPill label="Connected" value={monitor.pipeline.connected} color="green" />
              <SummaryPill label="Stale" value={monitor.pipeline.stale} color="yellow" />
              <SummaryPill label="Disconnected" value={monitor.pipeline.disconnected} color="gray" />
              <SummaryPill label="Machines" value={monitor.pipeline.total} />
            </SimpleGrid>
          </Card>

          <Card withBorder padding="md">
            <Title order={5} mb="sm">
              Recent sign-ins
            </Title>
            {monitor.recentSignIns.length === 0 ? (
              <Text size="sm" c="dimmed">
                No login events recorded yet.
              </Text>
            ) : (
              <Table striped fz="sm">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Time</Table.Th>
                    <Table.Th>User</Table.Th>
                    <Table.Th>Result</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {monitor.recentSignIns.map((e, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{new Date(e.timestampUtc).toLocaleString()}</Table.Td>
                      <Table.Td>{e.userName ?? '—'}</Table.Td>
                      <Table.Td>
                        <Badge
                          size="xs"
                          variant="light"
                          color={e.result === 'Success' ? 'green' : 'red'}
                        >
                          {e.result ?? '—'}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          <Card withBorder padding="md">
            <Title order={5} mb="sm">
              Scheduled reports
            </Title>
            <Text size="sm" c="dimmed" mb="sm">
              {monitor.enabledSchedules} enabled schedule{monitor.enabledSchedules === 1 ? '' : 's'}
            </Text>
            {monitor.upcomingSchedules.length > 0 ? (
              <>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
                  Next runs
                </Text>
                <Table striped fz="sm" mb="md">
                  <Table.Tbody>
                    {monitor.upcomingSchedules.map((s) => (
                      <Table.Tr key={s.id}>
                        <Table.Td>{s.name}</Table.Td>
                        <Table.Td>
                          {s.nextRunUtc ? new Date(s.nextRunUtc).toLocaleString() : '—'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            ) : null}
            {monitor.schedulesWithErrors.length > 0 ? (
              <>
                <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb={4}>
                  Recent errors
                </Text>
                <Stack gap="xs">
                  {monitor.schedulesWithErrors.map((s) => (
                    <Alert key={s.id} color="red" variant="light" title={s.name}>
                      {s.lastError}
                    </Alert>
                  ))}
                </Stack>
              </>
            ) : monitor.upcomingSchedules.length === 0 ? (
              <Text size="sm" c="dimmed">
                No enabled report schedules.
              </Text>
            ) : null}
          </Card>
        </>
      ) : null}

      {/* Commissioning readiness */}
      <Card withBorder padding="md">
        <Title order={5} mb="sm">
          Commissioning readiness
        </Title>
        <Select
          label="Line to commission"
          data={lineOpts}
          value={commissionLineId}
          onChange={setCommissionLineId}
          searchable
          placeholder="Select a line"
          mb="md"
        />
        {commissioning ? (
          <Stack gap="sm">
            <Group>
              <Badge color={commissioning.ready ? 'green' : 'orange'} size="lg" variant="light">
                {commissioning.ready ? 'Ready for field connect' : 'Not ready — fix failed checks'}
              </Badge>
              <Text size="sm" c="dimmed">
                {commissioning.lineName}
              </Text>
            </Group>
            <Table striped fz="sm">
              <Table.Tbody>
                {commissioning.checks.map((c) => (
                  <Table.Tr key={c.key}>
                    <Table.Td w={40}>
                      {c.required === false ? (
                        <Text size="sm" c={c.passed ? 'green' : 'dimmed'}>
                          {c.passed ? '✓' : '○'}
                        </Text>
                      ) : (
                        c.passed ? '✓' : '✗'
                      )}
                    </Table.Td>
                    <Table.Td>
                      {c.label}
                      {c.required === false ? (
                        <Text component="span" size="xs" c="dimmed" ml={6}>
                          (optional)
                        </Text>
                      ) : null}
                    </Table.Td>
                    <Table.Td c="dimmed">{c.detail ?? '—'}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Select a line to see go/no-go checks before connecting to the PLC.
          </Text>
        )}
      </Card>

      {canManage && securityCommissioning ? (
        <Card withBorder padding="md">
          <Title order={5} mb="sm">
            Security commissioning
          </Title>
          <Group mb="sm">
            <Badge color={securityCommissioning.ready ? 'green' : 'orange'} size="lg" variant="light">
              {securityCommissioning.ready ? 'Security ready' : 'Security checks pending'}
            </Badge>
          </Group>
          <Table striped fz="sm">
            <Table.Tbody>
              {securityCommissioning.checks.map((c) => (
                <Table.Tr key={c.key}>
                  <Table.Td w={40}>{c.passed ? '✓' : '✗'}</Table.Td>
                  <Table.Td>{c.label}</Table.Td>
                  <Table.Td c="dimmed">{c.detail ?? '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      ) : null}

      {/* System info */}
      <Card withBorder padding="md">
        <Title order={5} mb="sm">
          System
        </Title>
        {info ? (
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
            <Info label="Version" value={info.version} />
            <Info label="Environment" value={info.environment} />
            <Info label="Uptime" value={`${info.uptimeHours.toFixed(1)} h`} />
            <Info
              label="Database"
              value={info.databaseReachable ? 'Reachable' : 'Unreachable'}
              color={info.databaseReachable ? 'green' : 'red'}
            />
            <Info label="Server time" value={new Date(info.serverTimeUtc).toLocaleTimeString()} />
          </SimpleGrid>
        ) : (
          <Text size="sm" c="dimmed">
            Loading…
          </Text>
        )}
      </Card>

      {/* Retention policies */}
      <Card withBorder padding="md">
        <Title order={5} mb="sm">
          Historian retention &amp; compression
        </Title>
        {info && info.policies.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Hypertable</Table.Th>
                <Table.Th>Policy</Table.Th>
                <Table.Th>Schedule</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {info.policies.map((p, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{p.hypertable}</Table.Td>
                  <Table.Td>{p.policyType}</Table.Td>
                  <Table.Td>{p.schedule ?? '—'}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text size="sm" c="dimmed">
            No TimescaleDB policies reported.
          </Text>
        )}
      </Card>

      {/* Backups */}
      {canManage ? (
        <Card withBorder padding="md">
          <Group justify="space-between" mb="sm">
            <Title order={5}>Database backups</Title>
            <Button
              size="xs"
              leftSection={<IconDatabaseExport size={16} />}
              onClick={runBackup}
              loading={backingUp}
            >
              Create backup
            </Button>
          </Group>
          {backups.length === 0 ? (
            <Text size="sm" c="dimmed">
              No backups yet. Backups are written to the server's <code>backups/</code> folder via pg_dump.
            </Text>
          ) : (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>File</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Created</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {backups.map((b) => (
                  <Table.Tr key={b.name}>
                    <Table.Td>{b.name}</Table.Td>
                    <Table.Td>{formatBytes(b.sizeBytes)}</Table.Td>
                    <Table.Td>{new Date(b.createdUtc).toLocaleString()}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      ) : null}
    </Stack>
  )
}

function Info({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={600} c={color}>
        {value}
      </Text>
    </div>
  )
}

function SummaryPill({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Badge size="lg" variant="light" color={color ?? 'gray'}>
        {value}
      </Badge>
    </div>
  )
}

function formatRelative(iso: string): string {
  const sec = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (sec < 10) return 'just now'
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  return new Date(iso).toLocaleTimeString()
}

function SessionRow({ session: s }: { session: ClientSession }) {
  const user = s.displayName ?? s.userName ?? (s.clientKind === 'Kiosk' ? 'Anonymous' : '—')
  const context =
    s.clientKind === 'Kiosk'
      ? s.kioskDashboardName ?? s.lineName ?? '—'
      : s.lineName ?? '—'
  return (
    <Table.Tr>
      <Table.Td>
        <Badge size="xs" variant="light">
          {s.clientKind}
        </Badge>
      </Table.Td>
      <Table.Td>{user}</Table.Td>
      <Table.Td>{s.pageLabel ?? s.route ?? '—'}</Table.Td>
      <Table.Td>{context}</Table.Td>
      <Table.Td>{s.theme ?? '—'}</Table.Td>
      <Table.Td>{formatRelative(s.lastSeenUtc)}</Table.Td>
    </Table.Tr>
  )
}
