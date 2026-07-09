import { Badge, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import type { MachineGridLineGroup } from '../widgets/machineGridUtils'
import { MachineGridCard } from '../widgets/MachineGridCard'

interface Props {
  groups: MachineGridLineGroup[]
  unassignedByMachine: Map<string, number>
  onSelectMachine: (machineId: string) => void
  loading?: boolean
  /** Wall-mounted operator displays — show OEE + state + good count only */
  compact?: boolean
}

export function StationGrid({ groups, unassignedByMachine, onSelectMachine, loading, compact = false }: Props) {
  if (!loading && groups.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No operator stations in your scope. Check hierarchy setup or user plant/line assignment.
      </Text>
    )
  }

  return (
    <Stack gap="lg">
      {groups.map((g) => (
        <div key={g.lineId}>
          <Group mb="xs" gap="xs">
            <Text fw={600} size="sm">
              {g.lineName}
            </Text>
            <Text size="xs" c="dimmed">
              {g.deptName}
            </Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: compact ? 2 : 2, lg: compact ? 3 : 3, xl: compact ? 4 : 4 }} spacing={compact ? 'xs' : 'sm'}>
            {g.machines.map((m) => {
              const pending = unassignedByMachine.get(m.machineId.toLowerCase()) ?? 0
              const offline = m.snapshot.connectionState !== 'Connected'
              return (
                <div
                  key={m.machineId}
                  style={{ cursor: 'pointer', position: 'relative' }}
                  onClick={() => onSelectMachine(m.machineId)}
                >
                  {pending > 0 ? (
                    <Badge
                      color="orange"
                      size="sm"
                      style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                    >
                      {pending}
                    </Badge>
                  ) : null}
                  {offline ? (
                    <Badge
                      color="gray"
                      size="xs"
                      variant="light"
                      style={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                    >
                      Offline
                    </Badge>
                  ) : null}
                  <MachineGridCard snapshot={m.snapshot} compact={compact} />
                </div>
              )
            })}
          </SimpleGrid>
        </div>
      ))}
    </Stack>
  )
}
