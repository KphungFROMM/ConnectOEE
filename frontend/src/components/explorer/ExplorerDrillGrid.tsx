import { Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconFilterOff } from '@tabler/icons-react'
import type { MachineSnapshot } from '../../lib/liveHub'
import { MachineGridCard } from '../widgets/MachineGridCard'
import { HierarchyNodeCard } from './HierarchyNodeCard'
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

/**
 * Responsive grid of drill-down cards for the current node's children — `HierarchyNodeCard`
 * for Plant/Department/Line, `MachineGridCard` (live-snapshot aware) for Machine leaves.
 */
export function ExplorerDrillGrid({
  children,
  allChildren,
  snapshots,
  onSelect,
  onClearFilter,
}: {
  /** Status-filtered children to render. */
  children: ExplorerChildSummary[]
  /** Unfiltered children — used to tell "no children" apart from "filter hid everything". */
  allChildren: ExplorerChildSummary[]
  snapshots: MachineSnapshot[]
  onSelect: (node: ExplorerNode) => void
  onClearFilter: () => void
}) {
  if (allChildren.length === 0) return null

  const isMachineLevel = allChildren[0]?.level === 'Machine'

  return (
    <Stack gap="sm">
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
        <SimpleGrid cols={{ base: 1, sm: 2, lg: isMachineLevel ? 3 : 3, xl: isMachineLevel ? 4 : 4 }} spacing="md">
          {children.map((child) => {
            if (child.level === 'Machine') {
              const snap = snapshots.find((s) => s.machineId === child.id)
              if (snap) {
                return (
                  <UnstyledButton
                    key={child.id}
                    onClick={() => onSelect(child)}
                    style={{ display: 'block', height: '100%' }}
                    aria-label={`Open ${child.name}`}
                    className="explorerFadeIn"
                  >
                    <MachineGridCard snapshot={snap} />
                  </UnstyledButton>
                )
              }
            }
            return <HierarchyNodeCard key={child.id} node={child} onSelect={onSelect} />
          })}
        </SimpleGrid>
      )}
    </Stack>
  )
}
