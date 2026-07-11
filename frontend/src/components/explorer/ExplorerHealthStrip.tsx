import { Badge, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import type { PlantNode } from '../../lib/hierarchy'
import type { MachineSnapshot } from '../../lib/liveHub'
import { oeeExplorerBadgeColor, statusSurfaceTone } from '../widgets/common'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import type { ExplorerChildSummary } from './explorerTree'
import type { ExplorerNode } from './explorerTypes'

function countStatuses(nodes: { kpi: ExplorerNode['kpi'] }[]) {
  let running = 0
  let down = 0
  let idle = 0
  let offline = 0
  for (const n of nodes) {
    if (n.kpi.connectionState !== 'Connected') {
      offline++
      continue
    }
    if (n.kpi.status === 'Running') running++
    else if (n.kpi.status === 'Down') down++
    else idle++
  }
  return { running, down, idle, offline }
}

/** Above-the-fold health story — enterprise at root, APQ + child run counts when scoped. */
export function ExplorerHealthStrip({
  selected,
  drillChildren,
  tree,
  snapshots,
  onSelectWorst,
}: {
  selected: ExplorerNode | null
  drillChildren: ExplorerChildSummary[]
  tree: PlantNode[]
  snapshots: MachineSnapshot[]
  onSelectWorst?: (node: ExplorerNode) => void
}) {
  if (!selected) {
    const counts = countStatuses(tree)
    const liveMachines = snapshots.filter((s) => s.connectionState === 'Connected').length
    const worst = [...tree].sort((a, b) => a.kpi.oeePct - b.kpi.oeePct).slice(0, 3)

    return (
      <WidgetSurface tone="neutral" padding="md" radius="md" elevation="default">
        <Group justify="space-between" wrap="wrap" gap="md" align="flex-start">
          <Stack gap={4}>
            <Text fw={700} size="lg">
              Fleet health
            </Text>
            <Text size="sm" c="dimmed">
              {tree.length} plant{tree.length === 1 ? '' : 's'} · pick a plant to drill
            </Text>
            <Group gap="xs" mt={4} wrap="wrap">
              <Badge variant="light" color="green">
                {counts.running} running
              </Badge>
              {counts.down > 0 ? (
                <Badge variant="light" color="red">
                  {counts.down} down
                </Badge>
              ) : null}
              {counts.idle > 0 ? (
                <Badge variant="light" color="yellow">
                  {counts.idle} idle
                </Badge>
              ) : null}
              {counts.offline > 0 ? (
                <Badge variant="light" color="gray">
                  {counts.offline} offline
                </Badge>
              ) : null}
              <Badge variant="outline" color="blue">
                {liveMachines} live machine{liveMachines === 1 ? '' : 's'}
              </Badge>
            </Group>
          </Stack>

          {worst.length > 0 ? (
            <Stack gap={6} style={{ minWidth: 200 }}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Lowest OEE
              </Text>
              {worst.map((p) => (
                <UnstyledButton
                  key={p.id}
                  onClick={() =>
                    onSelectWorst?.({
                      level: 'Plant',
                      id: p.id,
                      name: p.name,
                      kpi: p.kpi,
                      plantId: p.id,
                    })
                  }
                >
                  <Group gap="xs" justify="space-between">
                    <Text size="sm" fw={600} truncate style={{ maxWidth: 140 }}>
                      {p.name}
                    </Text>
                    <Badge size="sm" variant="light" color={oeeExplorerBadgeColor(p.kpi.oeePct, p.kpi.connectionState)}>
                      {p.kpi.oeePct.toFixed(0)}%
                    </Badge>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          ) : null}
        </Group>
      </WidgetSurface>
    )
  }

  const kpi = selected.kpi
  const childCounts = countStatuses(drillChildren)
  const tone = statusSurfaceTone(kpi.status, kpi.connectionState)

  return (
    <WidgetSurface tone={tone} padding="md" radius="md">
      <SimpleGrid cols={{ base: 2, sm: 4, md: 6 }} spacing="sm">
        <Stack gap={2}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Availability
          </Text>
          <Text fw={700} size="xl">
            {kpi.availabilityPct.toFixed(0)}%
          </Text>
        </Stack>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Performance
          </Text>
          <Text fw={700} size="xl">
            {kpi.performancePct.toFixed(0)}%
          </Text>
        </Stack>
        <Stack gap={2}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Quality
          </Text>
          <Text fw={700} size="xl">
            {kpi.qualityPct.toFixed(0)}%
          </Text>
        </Stack>
        {drillChildren.length > 0 ? (
          <>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Children running
              </Text>
              <Text fw={700} size="xl" c="green">
                {childCounts.running}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Down
              </Text>
              <Text fw={700} size="xl" c={childCounts.down > 0 ? 'red' : undefined}>
                {childCounts.down}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Offline
              </Text>
              <Text fw={700} size="xl" c="dimmed">
                {childCounts.offline}
              </Text>
            </Stack>
          </>
        ) : (
          <>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Good
              </Text>
              <Text fw={700} size="xl">
                {kpi.goodCount.toLocaleString()}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Reject
              </Text>
              <Text fw={700} size="xl">
                {kpi.rejectCount.toLocaleString()}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                OEE
              </Text>
              <Text fw={700} size="xl">
                {kpi.oeePct.toFixed(0)}%
              </Text>
            </Stack>
          </>
        )}
      </SimpleGrid>
    </WidgetSurface>
  )
}
