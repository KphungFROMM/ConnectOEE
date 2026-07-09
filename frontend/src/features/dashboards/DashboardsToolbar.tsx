import {
  Button,
  Group,
  Menu,
  SegmentedControl,
  TextInput,
  Title,
} from '@mantine/core'
import {
  IconDots,
  IconLayoutGrid,
  IconPlus,
  IconRefresh,
  IconTemplate,
} from '@tabler/icons-react'
import type { DashboardTab } from './dashboardGrouping'

interface DashboardsToolbarProps {
  canBuild: boolean
  search: string
  tab: DashboardTab
  onSearchChange: (value: string) => void
  onTabChange: (tab: DashboardTab) => void
  onNewFromTemplate: () => void
  onNewBlank: () => void
  onRefreshLayouts: () => void
}

const TAB_OPTIONS: { value: DashboardTab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'plant', label: 'Plant' },
  { value: 'kiosks', label: 'Kiosks' },
  { value: 'analysis', label: 'Analysis' },
]

export function DashboardsToolbar({
  canBuild,
  search,
  tab,
  onSearchChange,
  onTabChange,
  onNewFromTemplate,
  onNewBlank,
  onRefreshLayouts,
}: DashboardsToolbarProps) {
  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
      <Title order={2}>Dashboards</Title>

      <Group gap="sm" wrap="wrap" style={{ flex: 1, justifyContent: 'flex-end' }}>
        <TextInput
          placeholder="Search dashboards…"
          value={search}
          onChange={(e) => onSearchChange(e.currentTarget.value)}
          style={{ minWidth: 200, maxWidth: 280 }}
        />
        <SegmentedControl
          value={tab}
          onChange={(v) => onTabChange(v as DashboardTab)}
          data={TAB_OPTIONS}
        />
        {canBuild ? (
          <>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button leftSection={<IconPlus size={16} />}>Add dashboard</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconTemplate size={16} />} onClick={onNewFromTemplate}>
                  From template
                </Menu.Item>
                <Menu.Item leftSection={<IconLayoutGrid size={16} />} onClick={onNewBlank}>
                  Blank dashboard
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Button variant="subtle" px="xs" aria-label="More actions">
                  <IconDots size={18} />
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconRefresh size={16} />} onClick={onRefreshLayouts}>
                  Refresh layouts
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        ) : null}
      </Group>
    </Group>
  )
}
