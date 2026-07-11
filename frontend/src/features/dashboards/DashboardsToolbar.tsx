import { Button, Group, Menu, TextInput, Title } from '@mantine/core'
import { IconDots, IconLayoutGrid, IconPlus, IconRefresh, IconTemplate } from '@tabler/icons-react'

interface DashboardsToolbarProps {
  canBuild: boolean
  search: string
  onSearchChange: (value: string) => void
  onNewFromTemplate: () => void
  onNewBlank: () => void
  onRefreshLayouts: () => void
}

export function DashboardsToolbar({
  canBuild,
  search,
  onSearchChange,
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
