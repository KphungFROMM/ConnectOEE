import { Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconFilterOff } from '@tabler/icons-react'
import type { MachineSnapshot } from '../../lib/liveHub'
import { ExplorerChildTile } from './ExplorerChildTile'
import type { ExplorerChildSummary } from './explorerTree'
import type { ExplorerNode } from './explorerTypes'

function titleForChildren(children: ExplorerChildSummary[]): string {
  const level = children[0]?.level
  switch (level) {
    case 'Plant':
      return 'Plants'
    case 'Department':
      return 'Departments'
    case 'Line':
      return 'Lines'
    case 'Machine':
      return 'Machines'
    default:
      return 'Children'
  }
}

/** Primary drill canvas — explorer-native tiles only (no MachineGridCard). */
export function ExplorerChildCanvas({
  children,
  allChildren,
  snapshots,
  onSelect,
  onClearFilter,
}: {
  children: ExplorerChildSummary[]
  allChildren: ExplorerChildSummary[]
  snapshots: MachineSnapshot[]
  onSelect: (node: ExplorerNode) => void
  onClearFilter: () => void
}) {
  if (allChildren.length === 0) return null

  const isMachineLevel = allChildren[0]?.level === 'Machine'

  return (
    <Stack gap="sm" className="explorerDrillTransition">
      <Group justify="space-between">
        <Text fw={700} size="sm" c="dimmed" tt="uppercase" style={{ letterSpacing: '0.03em' }}>
          {titleForChildren(allChildren)} ({children.length}/{allChildren.length})
        </Text>
      </Group>

      {children.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <Text c="dimmed" size="sm">
            No {titleForChildren(allChildren).toLowerCase()} match the current filter.
          </Text>
          <UnstyledButton onClick={onClearFilter}>
            <Group gap={4}>
              <IconFilterOff size={14} />
              <Text size="sm" fw={600} c="blue">
                Clear filter
              </Text>
            </Group>
          </UnstyledButton>
        </Stack>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: isMachineLevel ? 4 : 3 }} spacing="md">
          {children.map((child) => {
            const snap = child.level === 'Machine' ? snapshots.find((s) => s.machineId === child.id) : undefined
            return <ExplorerChildTile key={child.id} node={child} snapshot={snap} onSelect={onSelect} />
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}
