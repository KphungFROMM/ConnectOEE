import { useEffect, useState } from 'react'
import { Button, Card, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { deleteControlMap, listConnections, listControlMaps, saveControlMap, type ControlMapDto, type PlcConnection } from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'

const COMMANDS = ['Reset', 'StartPermissive', 'Ack']

export function ControlTagsAdmin() {
  const [maps, setMaps] = useState<ControlMapDto[]>([])
  const [connections, setConnections] = useState<PlcConnection[]>([])
  const [tree, setTree] = useState<PlantNode[]>([])
  const [machineId, setMachineId] = useState<string | null>(null)
  const [connectionId, setConnectionId] = useState<string | null>(null)
  const [command, setCommand] = useState('Reset')
  const [tagPath, setTagPath] = useState('')

  const machineOpts = tree.flatMap((p) =>
    p.departments.flatMap((d) => d.lines.flatMap((l) => l.machines.map((m) => ({ value: m.id, label: `${l.name} / ${m.name}` })))),
  )
  const connOpts = connections.map((c) => ({ value: c.id, label: c.name }))

  const reload = () => void listControlMaps(machineId ?? undefined).then(setMaps).catch(() => undefined)
  useEffect(() => {
    void getHierarchyTree().then(setTree).catch(() => undefined)
    void listConnections().then(setConnections).catch(() => undefined)
  }, [])
  useEffect(reload, [machineId])

  async function save() {
    if (!machineId || !connectionId || !tagPath.trim()) return
    try {
      await saveControlMap({ machineId, plcConnectionId: connectionId, command, tagPath, dataType: 'Bool' })
      setTagPath('')
      reload()
      notifications.show({ message: 'Control map saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save', color: 'red' })
    }
  }

  return (
    <Stack>
      <Select label="Machine" data={machineOpts} value={machineId} onChange={setMachineId} searchable placeholder="Pick a machine" />
      <Card withBorder padding="md">
        <Text fw={600} mb="xs">
          Map PLC write tag
        </Text>
        <Group grow align="flex-end">
          <Select label="Command" data={COMMANDS} value={command} onChange={(v) => setCommand(v ?? 'Reset')} />
          <Select label="PLC connection" data={connOpts} value={connectionId} onChange={setConnectionId} searchable />
          <TextInput label="Tag path" value={tagPath} onChange={(e) => setTagPath(e.currentTarget.value)} placeholder="Program:MainProgram.Reset" />
          <Button onClick={save} disabled={!machineId || !connectionId || !tagPath.trim()}>
            Save
          </Button>
        </Group>
      </Card>
      <Table fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Command</Table.Th>
            <Table.Th>Tag path</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {maps.map((m) => (
            <Table.Tr key={m.id}>
              <Table.Td>{m.command}</Table.Td>
              <Table.Td>{m.tagPath}</Table.Td>
              <Table.Td>
                <Button size="xs" variant="subtle" color="red" onClick={async () => { await deleteControlMap(m.id); reload() }}>
                  Delete
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}
