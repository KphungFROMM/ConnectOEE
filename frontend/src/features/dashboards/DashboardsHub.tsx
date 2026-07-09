import { Badge, Button, Card, Group, Image, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { IconStarFilled, IconTemplate } from '@tabler/icons-react'
import type { DashboardSummary, DashboardTemplate } from '../../lib/dashboards'
import { recommendedTemplates } from '../builder/systemTemplateMeta'
import { DashboardGroupSection } from './DashboardGroupSection'
import { DashboardsToolbar } from './DashboardsToolbar'
import { useDashboardFilters } from './useDashboardFilters'

interface DashboardsHubProps {
  dashboards: DashboardSummary[]
  canBuild: boolean
  templates: DashboardTemplate[]
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onNewFromTemplate: () => void
  onNewBlank: () => void
  onRefreshLayouts: () => void
  onApplyRecommended: (templateId: string) => void
}

export function DashboardsHub({
  dashboards,
  canBuild,
  templates,
  onSelect,
  onEdit,
  onNewFromTemplate,
  onNewBlank,
  onRefreshLayouts,
  onApplyRecommended,
}: DashboardsHubProps) {
  const { search, setSearch, tab, setTab, groups, togglePin, isPinned, recordRecent } = useDashboardFilters(dashboards)

  function handleOpen(id: string) {
    recordRecent(id)
    onSelect(id)
  }

  const showDiscovery = canBuild && dashboards.length <= 3
  const recommended = recommendedTemplates
    .map((meta) => templates.find((t) => t.name === meta.name))
    .filter((t): t is DashboardTemplate => !!t)

  return (
    <Stack gap="lg">
      <DashboardsToolbar
        canBuild={canBuild}
        search={search}
        tab={tab}
        onSearchChange={setSearch}
        onTabChange={setTab}
        onNewFromTemplate={onNewFromTemplate}
        onNewBlank={onNewBlank}
        onRefreshLayouts={onRefreshLayouts}
      />

      {showDiscovery ? (
        <Card withBorder padding="lg" radius="md" bg="var(--mantine-color-blue-light)">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Title order={4}>Start from a template</Title>
              <Text size="sm" c="dimmed">
                Skip the blank canvas — apply a role-based v7 board in one click.
              </Text>
            </Stack>
            <Button leftSection={<IconTemplate size={18} />} onClick={onNewFromTemplate}>
              Browse templates
            </Button>
          </Group>
        </Card>
      ) : null}

      {canBuild && recommended.length > 0 ? (
        <Stack gap="sm">
          <Group gap="xs">
            <IconStarFilled size={16} color="var(--mantine-color-blue-filled)" />
            <Text fw={700}>Recommended templates</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
            {recommended.map((t) => {
              const meta = recommendedTemplates.find((m) => m.name === t.name)
              return (
                <Card key={t.id} withBorder padding="sm" radius="md">
                  <Stack gap="xs">
                    {meta ? (
                      <Image
                        src={meta.previewPath}
                        alt=""
                        h={88}
                        fit="cover"
                        radius="sm"
                        fallbackSrc={`/template-previews/${meta.slug}.svg`}
                      />
                    ) : null}
                    <Group justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={600} lineClamp={1}>
                        {t.name}
                      </Text>
                      <Badge size="xs" color="blue">
                        Recommended
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {meta?.bestFor}
                    </Text>
                    <Button size="xs" variant="light" onClick={() => onApplyRecommended(t.id)}>
                      Use template
                    </Button>
                  </Stack>
                </Card>
              )
            })}
          </SimpleGrid>
        </Stack>
      ) : null}

      {dashboards.length === 0 ? (
        <Card withBorder padding="lg" radius="md">
          <Text c="dimmed" size="sm">
            No dashboards yet.{' '}
            {canBuild ? 'Create one from a built-in template or start with a blank dashboard.' : 'Ask an admin to publish one.'}
          </Text>
        </Card>
      ) : groups.length === 0 ? (
        <Card withBorder padding="lg" radius="md">
          <Text c="dimmed" size="sm">
            No dashboards match your search or filter.
          </Text>
        </Card>
      ) : (
        <DashboardGroupSection
          groups={groups}
          canBuild={canBuild}
          isPinned={isPinned}
          onOpen={handleOpen}
          onEdit={onEdit}
          onTogglePin={togglePin}
        />
      )}
    </Stack>
  )
}
