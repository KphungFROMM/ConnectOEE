import { Accordion, Badge, Group, SimpleGrid, Text } from '@mantine/core'
import type { DashboardSummary } from '../../lib/dashboards'
import type { DashboardGroup } from './dashboardGrouping'
import { DashboardCard } from './DashboardCard'

interface DashboardGroupSectionProps {
  groups: DashboardGroup[]
  canBuild: boolean
  isPinned: (id: string) => boolean
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onTogglePin: (id: string) => void
}

export function DashboardGroupSection({
  groups,
  canBuild,
  isPinned,
  onOpen,
  onEdit,
  onTogglePin,
}: DashboardGroupSectionProps) {
  if (groups.length === 0) return null

  const defaultOpen = groups.map((g) => g.id)

  return (
    <Accordion multiple defaultValue={defaultOpen} variant="contained" radius="md" chevronPosition="right">
      {groups.map((group) => (
        <Accordion.Item key={group.id} value={group.id}>
          <Accordion.Control>
            <Group gap="sm" wrap="nowrap">
              <Text fw={600}>{group.title}</Text>
              {group.subtitle ? (
                <Text size="xs" c="dimmed">
                  {group.subtitle}
                </Text>
              ) : null}
              <Badge size="sm" variant="light" color="gray">
                {group.dashboards.length}
              </Badge>
            </Group>
          </Accordion.Control>
          <Accordion.Panel>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
              {group.dashboards.map((d: DashboardSummary) => (
                <DashboardCard
                  key={d.id}
                  dashboard={d}
                  canBuild={canBuild}
                  pinned={isPinned(d.id)}
                  onOpen={onOpen}
                  onEdit={onEdit}
                  onTogglePin={onTogglePin}
                />
              ))}
            </SimpleGrid>
          </Accordion.Panel>
        </Accordion.Item>
      ))}
    </Accordion>
  )
}
