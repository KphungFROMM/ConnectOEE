import { Alert, Group, SimpleGrid, Skeleton, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconBuildingFactory2 } from '@tabler/icons-react'
import { useExplorerNav } from '../lib/useExplorerNav'
import { ExplorerChildCanvas } from '../components/explorer/ExplorerChildCanvas'
import { ExplorerCommandBar } from '../components/explorer/ExplorerCommandBar'
import { ExplorerHealthStrip } from '../components/explorer/ExplorerHealthStrip'
import { ExplorerInsights } from '../components/explorer/ExplorerInsights'
import { ExplorerRail } from '../components/explorer/ExplorerRail'

function ExplorerLoadingSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton height={160} radius="md" />
      <Skeleton height={88} radius="md" />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={148} radius="md" />
        ))}
      </SimpleGrid>
    </Stack>
  )
}

function ExplorerErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <Alert color="red" variant="light" title="Couldn't load the plant hierarchy" icon={<IconAlertTriangle size={18} />}>
      <Stack gap="xs">
        <Text size="sm">{error}</Text>
        <Text size="sm" fw={600} c="blue" style={{ cursor: 'pointer', width: 'fit-content' }} onClick={onRetry}>
          Retry
        </Text>
      </Stack>
    </Alert>
  )
}

function ExplorerEmptyState() {
  return (
    <Stack align="center" gap="xs" py="xl">
      <IconBuildingFactory2 size={40} style={{ opacity: 0.4 }} />
      <Text fw={600}>No plants configured yet</Text>
      <Text c="dimmed" size="sm" ta="center" maw={420}>
        Set up your plant hierarchy in the Startup Wizard or Admin to start exploring live OEE, downtime, and production
        data.
      </Text>
    </Stack>
  )
}

/**
 * Ground-up Plant Explorer cockpit:
 * CommandBar → HealthStrip → ChildCanvas → Insights
 */
export function PlantExplorerPage() {
  const nav = useExplorerNav()
  const { tree, loading, error, reload, selected, children, filteredChildren, setStatusFilter, select, snapshots } = nav

  const hasChildren = children.length > 0

  return (
    <Stack gap="md">
      <ExplorerCommandBar nav={nav} />

      <Group align="flex-start" gap="md" wrap="nowrap">
        <ExplorerRail nav={nav} />

        <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
          {error ? <ExplorerErrorState error={error} onRetry={reload} /> : null}

          {!error && loading ? <ExplorerLoadingSkeleton /> : null}

          {!error && !loading && tree.length === 0 ? <ExplorerEmptyState /> : null}

          {!error && !loading && tree.length > 0 ? (
            <>
              <div key={`health-${selected?.level ?? 'root'}-${selected?.id ?? 'root'}`} className="explorerDrillTransition">
                <ExplorerHealthStrip
                  selected={selected}
                  drillChildren={children}
                  tree={tree}
                  snapshots={snapshots}
                  onSelectWorst={select}
                />
              </div>

              {hasChildren ? (
                <div key={`canvas-${selected?.level ?? 'root'}-${selected?.id ?? 'root'}`} className="explorerDrillTransition">
                  <ExplorerChildCanvas
                    children={filteredChildren}
                    allChildren={children}
                    snapshots={snapshots}
                    onSelect={select}
                    onClearFilter={() => setStatusFilter('all')}
                  />
                </div>
              ) : null}

              {selected ? (
                <div key={`insights-${selected.level}-${selected.id}`} className="explorerDrillTransition">
                  <ExplorerInsights node={selected} tree={tree} snapshots={snapshots} onSelectNode={select} />
                </div>
              ) : null}
            </>
          ) : null}
        </Stack>
      </Group>
    </Stack>
  )
}
