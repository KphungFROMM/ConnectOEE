import { Alert, Group, SimpleGrid, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconAlertTriangle, IconBuildingFactory2 } from '@tabler/icons-react'
import { useExplorerNav } from '../lib/useExplorerNav'
import { ExplorerDetailPanel } from '../components/explorer/ExplorerDetailPanel'
import { ExplorerDrillGrid } from '../components/explorer/ExplorerDrillGrid'
import { ExplorerNavigator } from '../components/explorer/ExplorerNavigator'
import { ExplorerNodeHero } from '../components/explorer/ExplorerNodeHero'
import { ExplorerRail } from '../components/explorer/ExplorerRail'

function ExplorerLoadingSkeleton() {
  return (
    <Stack gap="md">
      <Skeleton height={96} radius="md" />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} height={140} radius="md" />
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
        <Text
          size="sm"
          fw={600}
          c="blue"
          style={{ cursor: 'pointer', width: 'fit-content' }}
          onClick={onRetry}
        >
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

export function PlantExplorerPage() {
  const nav = useExplorerNav()
  const { tree, loading, error, reload, selected, children, filteredChildren, setStatusFilter, select, snapshots } = nav

  const hasChildren = children.length > 0

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Plant Explorer</Title>
        <Text size="sm" c="dimmed">
          Drill from plant to machine with live connection status, run state, and OEE% visible at every step.
        </Text>
      </div>

      <ExplorerNavigator nav={nav} />

      <Group align="flex-start" gap="md" wrap="nowrap">
        <ExplorerRail nav={nav} />

        <Stack gap="md" style={{ flex: 1, minWidth: 0 }}>
          {error ? <ExplorerErrorState error={error} onRetry={reload} /> : null}

          {!error && loading ? <ExplorerLoadingSkeleton /> : null}

          {!error && !loading && tree.length === 0 ? <ExplorerEmptyState /> : null}

          {!error && !loading && tree.length > 0 ? (
            <>
              {selected && hasChildren ? (
                <div key={`hero-${selected.level}-${selected.id}`} className="explorerDrillTransition">
                  <ExplorerNodeHero node={selected} />
                </div>
              ) : null}

              {hasChildren ? (
                <div key={`grid-${selected?.level ?? 'root'}-${selected?.id ?? 'root'}`} className="explorerDrillTransition">
                  <ExplorerDrillGrid
                    children={filteredChildren}
                    allChildren={children}
                    snapshots={snapshots}
                    onSelect={select}
                    onClearFilter={() => setStatusFilter('all')}
                  />
                </div>
              ) : null}

              {selected ? (
                <ExplorerDetailPanel node={selected} tree={tree} snapshots={snapshots} onSelectNode={select} />
              ) : null}
            </>
          ) : null}
        </Stack>
      </Group>
    </Stack>
  )
}
