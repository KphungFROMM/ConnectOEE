import {
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Group,
  Image,
  NavLink,
  ScrollArea,
  SimpleGrid,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { IconClock, IconStarFilled, IconTemplate } from '@tabler/icons-react'
import type { DashboardSummary, DashboardTemplate } from '../../lib/dashboards'
import { recommendedTemplates } from '../builder/systemTemplateMeta'
import { DashboardCard } from './DashboardCard'
import { displayTitle, type DashboardChipFilter } from './dashboardGrouping'
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

const CHIP_OPTIONS: { value: DashboardChipFilter; label: string }[] = [
  { value: 'pinned', label: 'Pinned' },
  { value: 'kiosk', label: 'Kiosk' },
  { value: 'analysis', label: 'Analysis' },
]

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
  const {
    search,
    setSearch,
    chips,
    toggleChip,
    selectedScope,
    setSelectedScope,
    scopeTree,
    activeScopeTitle,
    filtered,
    recentDashboards,
    togglePin,
    isPinned,
    isRecent,
    recordRecent,
  } = useDashboardFilters(dashboards)

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
        onSearchChange={setSearch}
        onNewFromTemplate={onNewFromTemplate}
        onNewBlank={onNewBlank}
        onRefreshLayouts={onRefreshLayouts}
      />

      {showDiscovery && recommended.length > 0 ? (
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap" gap="sm">
            <Group gap="xs">
              <IconStarFilled size={16} color="var(--mantine-color-blue-filled)" />
              <Text fw={700}>Recommended templates</Text>
            </Group>
            <Button variant="subtle" size="xs" leftSection={<IconTemplate size={14} />} onClick={onNewFromTemplate}>
              Browse all
            </Button>
          </Group>
          <ScrollArea type="hover" offsetScrollbars>
            <Group gap="sm" wrap="nowrap" align="stretch" pb={4}>
              {recommended.map((t) => {
                const meta = recommendedTemplates.find((m) => m.name === t.name)
                return (
                  <Card
                    key={t.id}
                    withBorder
                    padding="sm"
                    radius="md"
                    style={{ flex: '0 0 220px', width: 220 }}
                  >
                    <Stack gap="xs">
                      {meta ? (
                        <Image
                          src={meta.previewPath}
                          alt=""
                          w="100%"
                          h={72}
                          fit="contain"
                          radius="sm"
                          fallbackSrc={`/template-previews/${meta.slug}.svg`}
                          style={{ background: 'var(--mantine-color-gray-0)' }}
                        />
                      ) : null}
                      <Text size="sm" fw={600} lineClamp={1}>
                        {t.name}
                      </Text>
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
            </Group>
          </ScrollArea>
        </Stack>
      ) : null}

      {showDiscovery && recommended.length === 0 ? (
        <Card withBorder padding="lg" radius="md" bg="var(--mantine-color-blue-light)">
          <Group justify="space-between" wrap="wrap" gap="md">
            <Stack gap={4}>
              <Title order={4}>Start from a template</Title>
              <Text size="sm" c="dimmed">
                Skip the blank canvas — apply a role-based v8 board in one click.
              </Text>
            </Stack>
            <Button leftSection={<IconTemplate size={18} />} onClick={onNewFromTemplate}>
              Browse templates
            </Button>
          </Group>
        </Card>
      ) : null}

      {recentDashboards.length > 0 ? (
        <Stack gap="xs">
          <Group gap="xs">
            <IconClock size={14} />
            <Text size="sm" fw={600} c="dimmed">
              Recently opened
            </Text>
          </Group>
          <ScrollArea type="hover" offsetScrollbars>
            <Group gap="sm" wrap="nowrap" pb={4}>
              {recentDashboards.map((d) => (
                <UnstyledButton
                  key={d.id}
                  onClick={() => handleOpen(d.id)}
                  style={{
                    flexShrink: 0,
                    minWidth: 140,
                    maxWidth: 200,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-md)',
                    padding: '8px 12px',
                    background: 'var(--mantine-color-body)',
                  }}
                >
                  <Text size="sm" fw={600} truncate>
                    {displayTitle(d)}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {d.lineName ?? d.plantName ?? 'Board'}
                  </Text>
                </UnstyledButton>
              ))}
            </Group>
          </ScrollArea>
        </Stack>
      ) : null}

      {dashboards.length === 0 ? (
        <Card withBorder padding="lg" radius="md">
          <Text c="dimmed" size="sm">
            No dashboards yet.{' '}
            {canBuild ? 'Create one from a built-in template or start with a blank dashboard.' : 'Ask an admin to publish one.'}
          </Text>
        </Card>
      ) : (
        <Box
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--mantine-spacing-lg)',
            alignItems: 'flex-start',
          }}
        >
          <Card
            withBorder
            padding="xs"
            radius="md"
            style={{ flex: '1 1 220px', maxWidth: 280, position: 'sticky', top: 8 }}
          >
            <ScrollArea.Autosize mah="70vh" type="hover" offsetScrollbars>
              <Stack gap={2}>
                {scopeTree.map((node) => (
                  <Box key={node.id}>
                    <NavLink
                      label={
                        <Group justify="space-between" gap="xs" wrap="nowrap">
                          <Text size="sm" fw={selectedScope === node.id ? 600 : 500} truncate>
                            {node.label}
                          </Text>
                          <Badge size="xs" variant="light" color="gray">
                            {node.count}
                          </Badge>
                        </Group>
                      }
                      active={selectedScope === node.id}
                      onClick={() => setSelectedScope(node.id)}
                      variant="light"
                    />
                    {node.children?.map((child) => (
                      <NavLink
                        key={child.id}
                        label={
                          <Group justify="space-between" gap="xs" wrap="nowrap">
                            <Text size="sm" fw={selectedScope === child.id ? 600 : 400} truncate>
                              {child.label}
                            </Text>
                            <Badge size="xs" variant="light" color="gray">
                              {child.count}
                            </Badge>
                          </Group>
                        }
                        active={selectedScope === child.id}
                        onClick={() => setSelectedScope(child.id)}
                        variant="light"
                        pl="lg"
                      />
                    ))}
                  </Box>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Card>

          <Stack gap="md" style={{ flex: '1 1 420px', minWidth: 0 }}>
            <Group justify="space-between" align="center" wrap="wrap" gap="sm">
              <Group gap="sm">
                <Title order={4}>{activeScopeTitle}</Title>
                <Badge size="sm" variant="light" color="gray">
                  {filtered.length}
                </Badge>
              </Group>
              <Group gap="xs">
                {CHIP_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.value}
                    checked={chips.includes(opt.value)}
                    onChange={() => toggleChip(opt.value)}
                    size="xs"
                    variant="light"
                  >
                    {opt.label}
                  </Chip>
                ))}
              </Group>
            </Group>

            {filtered.length === 0 ? (
              <Card withBorder padding="lg" radius="md">
                <Text c="dimmed" size="sm">
                  No dashboards match this scope or filter.
                </Text>
              </Card>
            ) : (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
                {filtered.map((d) => (
                  <DashboardCard
                    key={d.id}
                    dashboard={d}
                    canBuild={canBuild}
                    pinned={isPinned(d.id)}
                    recent={isRecent(d.id)}
                    onOpen={handleOpen}
                    onEdit={onEdit}
                    onTogglePin={togglePin}
                  />
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Box>
      )}
    </Stack>
  )
}
