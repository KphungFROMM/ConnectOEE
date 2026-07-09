import { useEffect, useState } from 'react'
import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  Title,
  ActionIcon,
  useMantineColorScheme,
  useComputedColorScheme,
  Badge,
  Box,
  Menu,
  Avatar,
  UnstyledButton,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import {
  IconLayoutDashboard,
  IconLayoutBoardSplit,
  IconBinaryTree2,
  IconChartHistogram,
  IconReportAnalytics,
  IconTags,
  IconSettings,
  IconSun,
  IconMoon,
  IconLogout,
  IconDeviceDesktop,
  IconWand,
  IconHelpCircle,
} from '@tabler/icons-react'
import { Link, useLocation, Outlet } from 'react-router-dom'
import { useConnectionState } from '../lib/useConnectionState'
import { useClientPresence } from '../lib/useClientPresence'
import { ConnectionIndicator } from './ConnectionIndicator'
import { ShiftClock } from './ShiftClock'
import { HelpDrawer } from './help/HelpDrawer'
import { useAuth } from '../lib/auth'
import { Permissions, isOperatorOnly } from '../lib/permissions'
import { getSetupStatus } from '../lib/setup'

function ThemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computed === 'dark'
  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <IconSun size={18} /> : <IconMoon size={18} />}
    </ActionIcon>
  )
}

export function AppLayout() {
  const [opened, { toggle }] = useDisclosure()
  const [helpOpen, { open: openHelp, close: closeHelp }] = useDisclosure()
  const location = useLocation()
  const { status, lastChecked } = useConnectionState()
  const { user, logout, hasPermission } = useAuth()
  const computed = useComputedColorScheme('light')
  const isDark = computed === 'dark'

  useClientPresence()

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    void getSetupStatus()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false))
  }, [])

  // Nav items gated by permission. Operators only see Operator Station.
  const navItems = [
    {
      label: 'Dashboards',
      to: '/',
      icon: IconLayoutDashboard,
      show: !isOperatorOnly(user),
    },
    {
      label: 'Builder',
      to: '/builder',
      icon: IconLayoutBoardSplit,
      show: hasPermission(Permissions.BuildDashboards),
    },
    {
      label: 'Plant Explorer',
      to: '/plant-explorer',
      icon: IconBinaryTree2,
      show: hasPermission(Permissions.ViewPlantExplorer),
    },
    {
      label: 'Analytics',
      to: '/analytics',
      icon: IconChartHistogram,
      show: hasPermission(Permissions.ViewReports),
    },
    {
      label: 'Reports',
      to: '/reports',
      icon: IconReportAnalytics,
      show: hasPermission(Permissions.ViewReports),
    },
    {
      label: 'Tag Browser',
      to: '/tags',
      icon: IconTags,
      show: hasPermission(Permissions.BrowseTags),
    },
    {
      label: 'Operator Station',
      to: '/operator',
      icon: IconDeviceDesktop,
      show: hasPermission(Permissions.EnterDowntimeReason),
    },
    {
      label: 'Setup Wizard',
      to: '/wizard',
      icon: IconWand,
      show: hasPermission(Permissions.RunWizard) && needsSetup === true,
    },
    {
      label: 'Admin',
      to: '/admin',
      icon: IconSettings,
      show: hasPermission(Permissions.ManageUsers),
    },
  ].filter((i) => i.show)

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      footer={{ height: 36 }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            {/* Light-grey icon sits in a padded rounded container so it reads in dark mode. */}
            <Box
              style={{
                background: isDark ? '#20242A' : '#FFFFFF',
                border: isDark ? '1px solid #2C313A' : '1px solid #E3E5E8',
                borderRadius: 8,
                padding: 4,
                lineHeight: 0,
              }}
            >
              <img src="/app-icon.png" alt="ConnectOEE" width={28} height={28} />
            </Box>
            <Title order={4}>ConnectOEE</Title>
          </Group>
          <Group gap="md" wrap="nowrap">
            <ShiftClock />
            <ConnectionIndicator status={status} lastChecked={lastChecked} />
            <ActionIcon variant="default" size="lg" aria-label="Help" onClick={openHelp}>
              <IconHelpCircle size={18} />
            </ActionIcon>
            <ThemeToggle />
            <Menu position="bottom-end" withArrow>
              <Menu.Target>
                <UnstyledButton>
                  <Group gap={6} wrap="nowrap">
                    <Avatar size="sm" radius="xl" color="brand">
                      {(user?.displayName ?? '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box visibleFrom="sm">
                      <Text size="sm" fw={500} lh={1}>
                        {user?.displayName}
                      </Text>
                      <Text size="xs" c="dimmed" lh={1}>
                        {user?.roles.join(', ')}
                      </Text>
                    </Box>
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.userName}</Menu.Label>
                <Menu.Item leftSection={<IconLogout size={14} />} onClick={logout}>
                  Sign out
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar p="xs">
        <Text size="xs" tt="uppercase" fw={700} c="dimmed" px="sm" py={6}>
          Navigation
        </Text>
        {navItems.map((item) => {
          const active =
            item.to === '/'
              ? location.pathname === '/' || location.pathname.startsWith('/dashboards/')
              : location.pathname.startsWith(item.to)
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              component={Link}
              to={item.to}
              label={item.label}
              leftSection={<Icon size={18} />}
              active={active}
            />
          )
        })}
      </AppShell.Navbar>

      <AppShell.Main>
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <Text size="xs">Signed in as {user?.userName}</Text>
            {user?.roles.map((r) => (
              <Badge key={r} size="xs" variant="light">
                {r}
              </Badge>
            ))}
          </Group>
          <Text size="xs" c="dimmed">
            {user && user.plantScopes.length > 0
              ? `${user.plantScopes.length} plant scope(s)`
              : 'All plants'}
          </Text>
        </Group>
      </AppShell.Footer>
      <HelpDrawer opened={helpOpen} onClose={closeHelp} />
    </AppShell>
  )
}
