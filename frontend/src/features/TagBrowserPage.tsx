import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Flex,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconDatabaseImport,
  IconInfoCircle,
  IconLink,
  IconRefresh,
  IconUnlink,
} from '@tabler/icons-react'
import { TagBrowseTree } from '../components/tags/TagBrowseTree'
import { useTagBrowse } from '../components/tags/useTagBrowse'
import { formatTagValue, tagTypeLabel } from '../components/tags/tagBrowseUtils'
import { getHierarchyTree, type PlantNode } from '../lib/hierarchy'
import { listConnections, listSignals, updateCountIngestMode, type PlcConnection, type SignalDto } from '../lib/admin'
import { importTags, mapTagBound, unmapSignal } from '../lib/tags'
import { useAuth } from '../lib/auth'
import { Permissions } from '../lib/permissions'

export function TagBrowserPage() {
  const { hasPermission } = useAuth()
  const canMap = hasPermission(Permissions.MapTags)

  const [connections, setConnections] = useState<PlcConnection[]>([])
  const [connectionId, setConnectionId] = useState<string | null>(null)

  const {
    browse,
    loading,
    filter,
    selected,
    scrollTop,
    values,
    rows,
    loadBrowse,
    toggle,
    setFilter,
    setSelected,
    setScrollTop,
  } = useTagBrowse(connectionId)

  const [tree, setTree] = useState<PlantNode[]>([])
  const [machineId, setMachineId] = useState<string | null>(null)
  const [signals, setSignals] = useState<SignalDto[]>([])
  const [manualPaths, setManualPaths] = useState<Record<string, string>>({})

  useEffect(() => {
    void listConnections().then((c) => {
      setConnections(c)
      if (c.length > 0) setConnectionId((prev) => prev ?? c[0].id)
    })
    void getHierarchyTree().then(setTree)
  }, [])

  useEffect(() => {
    if (!machineId) {
      setSignals([])
      return
    }
    void listSignals(machineId).then((s) => {
      setSignals(s)
      setManualPaths(Object.fromEntries(s.map((x) => [x.id, x.mappedPath ?? ''])))
    })
  }, [machineId])

  const machineOpts = useMemo(
    () =>
      tree.flatMap((p) =>
        p.departments.flatMap((d) =>
          d.lines.flatMap((l) => l.machines.map((m) => ({ value: m.id, label: `${l.name} / ${m.name}` }))),
        ),
      ),
    [tree],
  )

  async function refreshSignals() {
    if (machineId) setSignals(await listSignals(machineId))
  }

  const isCountRole = (role: string) => role === 'GoodCount' || role === 'RejectCount' || role === 'TotalCount'

  async function saveIngestMode(signal: SignalDto, mode: string | null) {
    if (!mode) return
    try {
      await updateCountIngestMode(signal.id, mode)
      await refreshSignals()
      notifications.show({ message: 'Count source updated', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to update count source', color: 'red' })
    }
  }

  async function bind(signal: SignalDto) {
    if (!selected || !selected.bindable) {
      notifications.show({ message: 'Select a bindable tag from the tree first', color: 'yellow' })
      return
    }
    try {
      const res = await mapTagBound({
        logicalSignalId: signal.id,
        tagPath: selected.fullPath,
        plcConnectionId: connectionId,
        dataType: selected.dataType,
      })
      await refreshSignals()
      if (res.warning) {
        notifications.show({ title: 'Mapped with warning', message: res.warning, color: 'yellow', autoClose: 6000 })
      } else {
        notifications.show({ message: `Bound ${signal.name} -> ${selected.fullPath}`, color: 'green' })
      }
    } catch {
      notifications.show({ message: 'Failed to bind tag', color: 'red' })
    }
  }

  async function saveManual(signal: SignalDto) {
    const path = (manualPaths[signal.id] ?? '').trim()
    if (!path) return
    try {
      await mapTagBound({ logicalSignalId: signal.id, tagPath: path, plcConnectionId: connectionId })
      await refreshSignals()
      notifications.show({ message: 'Mapping saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to map', color: 'red' })
    }
  }

  async function clearMapping(signal: SignalDto) {
    try {
      await unmapSignal(signal.id)
      await refreshSignals()
      notifications.show({ message: `Unmapped ${signal.name}`, color: 'gray' })
    } catch {
      notifications.show({ message: 'Failed to unmap', color: 'red' })
    }
  }

  async function doImport() {
    if (!connectionId) return
    try {
      const r = await importTags(connectionId)
      notifications.show({
        message: `Imported ${r.tags} tag(s), ${r.udts} UDT type(s), ${r.members} member(s)`,
        color: 'green',
      })
      void listConnections().then(setConnections)
    } catch {
      notifications.show({ message: 'Import failed', color: 'red' })
    }
  }

  const connOpts = connections.map((c) => ({ value: c.id, label: `${c.name} (${c.driverType})` }))

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Tag Browser & Mapping</Title>
        <Text c="dimmed" size="sm">
          Browse live controller tags (including nested UDTs and arrays), preview values with quality, and bind them to
          logical signals. Falls back to manual entry when a driver can't enumerate tags.
        </Text>
      </div>

      <Group align="flex-end" gap="sm">
        <Select
          label="PLC connection"
          placeholder="Pick a connection"
          data={connOpts}
          value={connectionId}
          onChange={setConnectionId}
          searchable
          w={320}
        />
        <Tooltip label="Re-read the controller tag list">
          <ActionIcon
            variant="default"
            size="lg"
            disabled={!connectionId}
            onClick={() => connectionId && loadBrowse(connectionId)}
            aria-label="Refresh tags"
          >
            <IconRefresh size={18} />
          </ActionIcon>
        </Tooltip>
        {canMap && browse?.supportsBrowsing ? (
          <Button leftSection={<IconDatabaseImport size={16} />} variant="light" onClick={doImport}>
            Import to catalog
          </Button>
        ) : null}
        {browse ? (
          <Badge color={browse.supportsBrowsing ? 'green' : 'gray'} variant="light" size="lg">
            {browse.driverType}: {browse.supportsBrowsing ? 'browsable' : 'manual only'}
          </Badge>
        ) : null}
      </Group>

      {browse && !browse.supportsBrowsing ? (
        <Alert color="gray" icon={<IconInfoCircle size={16} />} title="Manual entry">
          This connection's driver ({browse.driverType}) does not support live browsing yet. Enter tag paths manually in
          the mapping panel below.
        </Alert>
      ) : null}

      <Flex gap="md" direction={{ base: 'column', md: 'row' }} align="stretch">
        <Box style={{ flex: '1 1 58%', minWidth: 0 }}>
          <Card withBorder padding="sm" h="100%">
            <TagBrowseTree
              supportsBrowsing={browse?.supportsBrowsing ?? false}
              loading={loading}
              filter={filter}
              onFilterChange={setFilter}
              rows={rows}
              selected={selected}
              onSelect={setSelected}
              onToggle={toggle}
              values={values}
              scrollTop={scrollTop}
              onScrollTopChange={setScrollTop}
            />
          </Card>
        </Box>

        <Box style={{ flex: '1 1 42%', minWidth: 0 }}>
          <Stack gap="md">
            <Card withBorder padding="sm">
              <Title order={5} mb={6}>
                Tag details
              </Title>
              {selected ? (
                <Stack gap={4}>
                  <MetaRow label="Name" value={selected.name} />
                  <MetaRow label="Path" value={selected.fullPath} mono />
                  <MetaRow label="Type" value={tagTypeLabel(selected)} />
                  {selected.udtTypeName && selected.dataType !== 'Udt' ? (
                    <MetaRow label="UDT type" value={selected.udtTypeName} />
                  ) : null}
                  <MetaRow label="Historian path" value={selected.flattenedPath} mono />
                  {selected.description ? <MetaRow label="Description" value={selected.description} /> : null}
                  {selected.bindable ? (
                    <Group gap={8} mt={4}>
                      <Text size="sm" fw={600}>
                        Live value:
                      </Text>
                      {(() => {
                        const sample = values[selected.fullPath]
                        const cell = formatTagValue(sample)
                        return sample ? (
                          <>
                            <Text size="sm" ff="monospace" c={cell.color}>
                              {cell.text}
                            </Text>
                            <Badge
                              size="xs"
                              color={sample.quality === 'Good' ? 'green' : 'red'}
                              variant="light"
                            >
                              {sample.quality}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              {new Date(sample.timestampUtc).toLocaleTimeString()}
                            </Text>
                          </>
                        ) : (
                          <Text size="sm" c="dimmed">
                            sampling…
                          </Text>
                        )
                      })()}
                    </Group>
                  ) : (
                    <Text size="xs" c="dimmed" mt={4}>
                      Container node — expand to bind a member.
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Select a tag in the tree to see its metadata and live value.
                </Text>
              )}
            </Card>

            <Card withBorder padding="sm">
              <Group justify="space-between" mb={6}>
                <Title order={5}>Map to logical signals</Title>
              </Group>
              <Select
                placeholder="Pick a machine"
                data={machineOpts}
                value={machineId}
                onChange={setMachineId}
                searchable
                size="sm"
                mb="xs"
              />
              {!canMap ? (
                <Alert color="gray" icon={<IconInfoCircle size={16} />}>
                  You have read-only access; mapping requires the Map Tags permission.
                </Alert>
              ) : signals.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {machineId ? 'No logical signals for this machine.' : 'Choose a machine to view its signals.'}
                </Text>
              ) : (
                <Table fz="sm" verticalSpacing={6}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Signal</Table.Th>
                      <Table.Th>Count source</Table.Th>
                      <Table.Th>Mapping</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {signals.map((s) => (
                      <Table.Tr key={s.id}>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm">{s.name}</Text>
                            {s.required ? (
                              <Badge size="xs" color="orange">
                                req
                              </Badge>
                            ) : null}
                          </Group>
                          <Text size="xs" c="dimmed">
                            {s.expectedType}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {isCountRole(s.role) ? (
                            <Select
                              size="xs"
                              disabled={!canMap}
                              data={[
                                { value: 'CumulativeDelta', label: 'Cumulative delta' },
                                { value: 'PulseRisingEdge', label: 'Pulse (rising edge)' },
                              ]}
                              value={s.countIngestMode ?? 'CumulativeDelta'}
                              onChange={(v) => saveIngestMode(s, v)}
                            />
                          ) : (
                            <Text size="xs" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                        <Table.Td>
                          {browse?.supportsBrowsing ? (
                            s.isMapped ? (
                              <Group gap={4} wrap="nowrap">
                                <Text size="xs" ff="monospace" truncate maw={150}>
                                  {s.mappedPath}
                                </Text>
                                <Badge size="xs" color={s.isManual ? 'gray' : 'green'} variant="light">
                                  {s.isManual ? 'manual' : 'bound'}
                                </Badge>
                              </Group>
                            ) : (
                              <Badge size="xs" color="gray" variant="light">
                                unmapped
                              </Badge>
                            )
                          ) : (
                            <TextInput
                              size="xs"
                              placeholder="Program:MainProgram.Tag"
                              value={manualPaths[s.id] ?? ''}
                              onChange={(e) => setManualPaths((p) => ({ ...p, [s.id]: e.currentTarget.value }))}
                            />
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap" justify="flex-end">
                            {browse?.supportsBrowsing ? (
                              <Tooltip label={selected?.bindable ? `Bind ${selected.name}` : 'Select a tag first'}>
                                <ActionIcon
                                  variant="light"
                                  color="blue"
                                  disabled={!canMap || !selected?.bindable}
                                  onClick={() => bind(s)}
                                  aria-label="Bind selected tag"
                                >
                                  <IconLink size={16} />
                                </ActionIcon>
                              </Tooltip>
                            ) : (
                              <Button
                                size="xs"
                                variant="light"
                                disabled={!canMap || !(manualPaths[s.id] ?? '').trim()}
                                onClick={() => saveManual(s)}
                              >
                                Save
                              </Button>
                            )}
                            {s.isMapped ? (
                              <Tooltip label="Unmap">
                                <ActionIcon
                                  variant="subtle"
                                  color="red"
                                  disabled={!canMap}
                                  onClick={() => clearMapping(s)}
                                  aria-label="Unmap signal"
                                >
                                  <IconUnlink size={16} />
                                </ActionIcon>
                              </Tooltip>
                            ) : null}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </Card>
          </Stack>
        </Box>
      </Flex>
    </Stack>
  )
}

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Group gap={8} wrap="nowrap" align="flex-start">
      <Text size="xs" c="dimmed" w={110} style={{ flexShrink: 0 }}>
        {label}
      </Text>
      <Text size="sm" ff={mono ? 'monospace' : undefined} style={{ wordBreak: 'break-all' }}>
        {value}
      </Text>
    </Group>
  )
}
