import { useMemo } from 'react'
import { Badge, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../lib/liveHub'
import type { PlantNode } from '../../lib/hierarchy'
import { MachineGridCard } from '../widgets/MachineGridCard'
import type { ExplorerLevel } from './explorerTypes'

interface Props {
  level: ExplorerLevel
  nodeId: string
  tree: PlantNode[]
  snapshots: MachineSnapshot[]
  limit?: number
}

function lineNameMap(tree: PlantNode[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of tree) {
    for (const d of p.departments) {
      for (const l of d.lines) map.set(l.id, l.name)
    }
  }
  return map
}

function collectSnapshots(
  level: ExplorerLevel,
  nodeId: string,
  tree: PlantNode[],
  snapshots: MachineSnapshot[],
): MachineSnapshot[] {
  const byMachine = new Map(snapshots.map((s) => [s.machineId, s]))

  if (level === 'Line') {
    return snapshots.filter((s) => s.lineId === nodeId)
  }

  if (level === 'Department') {
    const machineIds = new Set<string>()
    for (const p of tree) {
      for (const d of p.departments) {
        if (d.id !== nodeId) continue
        for (const l of d.lines) {
          for (const m of l.machines) machineIds.add(m.id)
        }
      }
    }
    return [...machineIds].map((id) => byMachine.get(id)).filter((s): s is MachineSnapshot => Boolean(s))
  }

  if (level === 'Plant') {
    const machineIds = new Set<string>()
    for (const p of tree) {
      if (p.id !== nodeId) continue
      for (const d of p.departments) {
        for (const l of d.lines) {
          for (const m of l.machines) machineIds.add(m.id)
        }
      }
    }
    return [...machineIds].map((id) => byMachine.get(id)).filter((s): s is MachineSnapshot => Boolean(s))
  }

  return []
}

function titleForLevel(level: ExplorerLevel): string {
  switch (level) {
    case 'Line':
      return 'Machines on line'
    case 'Department':
      return 'Machines in department'
    case 'Plant':
      return 'Plant machines — lowest OEE'
    default:
      return 'Machines'
  }
}

interface LineMachineGroup {
  lineId: string
  lineName: string
  snapshots: MachineSnapshot[]
}

export function ExplorerMachineStrip({ level, nodeId, tree, snapshots, limit = 6 }: Props) {
  const lineNames = useMemo(() => lineNameMap(tree), [tree])

  const departmentGroups = useMemo((): LineMachineGroup[] | null => {
    if (level !== 'Department') return null
    const scoped = collectSnapshots(level, nodeId, tree, snapshots)
    const byLine = new Map<string, MachineSnapshot[]>()
    for (const s of scoped) {
      const list = byLine.get(s.lineId) ?? []
      list.push(s)
      byLine.set(s.lineId, list)
    }
    return [...byLine.entries()]
      .map(([lineId, snaps]) => ({
        lineId,
        lineName: lineNames.get(lineId) ?? 'Line',
        snapshots: [...snaps].sort((a, b) => (a.oeePct ?? 0) - (b.oeePct ?? 0)),
      }))
      .sort((a, b) => a.lineName.localeCompare(b.lineName))
  }, [level, nodeId, tree, snapshots, lineNames])

  const flatCards = useMemo(() => {
    if (level === 'Department') return []
    const scoped = collectSnapshots(level, nodeId, tree, snapshots)
    const sorted = [...scoped].sort((a, b) => (a.oeePct ?? 0) - (b.oeePct ?? 0))
    if (level === 'Line') return sorted
    return sorted.slice(0, limit)
  }, [level, nodeId, tree, snapshots, limit])

  if (level === 'Machine') return null
  if (level === 'Department' && (!departmentGroups || departmentGroups.length === 0)) return null
  if (level !== 'Department' && flatCards.length === 0) return null

  return (
    <Card withBorder radius="md" padding="md">
      <Text fw={600} mb="sm">
        {titleForLevel(level)}
      </Text>
      {level === 'Department' && departmentGroups ? (
        <Stack gap="md">
          {departmentGroups.map((group) => (
            <Stack key={group.lineId} gap="xs">
              <Group gap="xs">
                <Text fw={600} size="sm">
                  {group.lineName}
                </Text>
                <Badge size="xs" variant="light" color="blue">
                  {group.snapshots.length} {group.snapshots.length === 1 ? 'machine' : 'machines'}
                </Badge>
              </Group>
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                {group.snapshots.map((s) => (
                  <MachineGridCard key={s.machineId} snapshot={s} />
                ))}
              </SimpleGrid>
            </Stack>
          ))}
        </Stack>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {flatCards.map((s) => (
            <MachineGridCard
              key={s.machineId}
              snapshot={s}
              lineName={level === 'Plant' ? lineNames.get(s.lineId) : undefined}
            />
          ))}
        </SimpleGrid>
      )}
    </Card>
  )
}
