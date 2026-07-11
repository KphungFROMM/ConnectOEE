import { useEffect, useState } from 'react'
import {
  AppShell,
  Alert,
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
  Button,
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
import { getLicenseStatus, licenseBadgeColor, type LicenseStatus } from '../lib/license'
import { useAppearance } from '../lib/AppearanceProvider'
import {
  DEFAULT_HEADER_LOGO,
  PRODUCT_NAME,
  isCustomHeaderTitle,
  resolveHeaderLogoUrl,
  resolveHeaderTitle,
} from '../lib/appearance'

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
  const canOpenAdmin = hasPermission(Permissions.ManageUsers)
  const computed = useComputedColorScheme('light')
  const isDark = computed === 'dark'
  const { settings: appearance, revision: appearanceRevision } = useAppearance()
  const headerTitle = resolveHeaderTitle(appearance)
  const headerLogoUrl = resolveHeaderLogoUrl(appearance)
  const showProductUnderTitle = isCustomHeaderTitle(appearance)

  useClientPresence()

  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  const [license, setLicense] = useState<LicenseStatus | null>(null)

  useEffect(() => {
    void getSetupStatus()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false))
    void getLicenseStatus()
      .then(setLicense)
      .catch(() => undefined)
  }, [])

  // Sectioned nav for future non-OEE modules. Items gated by permission.
  const navSections = [
    {
      id: 'oee',
      label: 'OEE',
      items: [
        {
          label: 'Plant Explorer',
          to: '/plant-explorer',
          icon: IconBinaryTree2,
          show: hasPermission(Permissions.ViewPlantExplorer),
        },
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
          label: 'Operator Station',
          to: '/operator',
          icon: IconDeviceDesktop,
          show: hasPermission(Permissions.EnterDowntimeReason),
        },
      ].filter((i) => i.show),
    },
    {
      id: 'systems',
      label: 'Systems',
      items: [
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
      ].filter((i) => i.show),
    },
  ].filter((s) => s.items.length > 0)

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
              <img
                src={headerLogoUrl}
                alt={headerTitle}
                width={28}
                height={28}
                style={{ objectFit: 'contain', display: 'block' }}
                onError={(e) => {
                  const img = e.currentTarget
                  if (img.src.endsWith(DEFAULT_HEADER_LOGO)) return
                  img.src = DEFAULT_HEADER_LOGO
                }}
              />
            </Box>
            <Box>
              <Title order={4} lh={1.1}>
                {headerTitle}
              </Title>
              {showProductUnderTitle ? (
                <Text size="xs" c="dimmed" lh={1.2}>
                  {PRODUCT_NAME}
                </Text>
              ) : null}
            </Box>
          </Group>
          <Group gap="md" wrap="nowrap">
            <ShiftClock />
            <ConnectionIndicator key={appearanceRevision} status={status} lastChecked={lastChecked} />
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

      <AppShell.Navbar p="xs" style={{ display: 'flex', flexDirection: 'column' }}>
        {navSections.map((section) => (
          <Box key={section.id} mb={section.id === 'systems' ? 0 : 8}>
            <Text size="xs" tt="uppercase" fw={700} c="dimmed" px="sm" py={6}>
              {section.label}
            </Text>
            {section.items.map((item) => {
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
          </Box>
        ))}
        {/* Product mark always present when customers rebrand the header. */}
        <Group gap={6} wrap="nowrap" mt="auto" px="sm" py="sm">
          <img src={DEFAULT_HEADER_LOGO} alt="" width={14} height={14} style={{ opacity: 0.85 }} />
          <Text size="xs" c="dimmed">
            {PRODUCT_NAME}
          </Text>
        </Group>
      </AppShell.Navbar>

      <AppShell.Main>
        {license && (license.edition === 'Trial' || license.edition === 'Expired') ? (
          <Alert
            color={license.edition === 'Expired' ? 'red' : 'yellow'}
            variant="light"
            mb="md"
            title={license.edition === 'Expired' ? 'License expired' : 'Trial mode'}
          >
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
              <Text size="sm" style={{ flex: 1 }}>
                {license.edition === 'Expired'
                  ? 'ConnectOEE requires a license to unlock all features.'
                  : `${license.trialDaysRemaining} day(s) left in trial — limited to ${license.maxPlants} plant, ${license.maxLines} lines, Mock driver, and CSV reports.`}
              </Text>
              {canOpenAdmin ? (
                <Button
                  component={Link}
                  to="/admin?tab=license"
                  size="xs"
                  variant={license.edition === 'Expired' ? 'filled' : 'light'}
                  color={license.edition === 'Expired' ? 'red' : 'yellow'}
                >
                  {license.edition === 'Expired' ? 'Activate license' : 'View license'}
                </Button>
              ) : (
                <Text size="xs" c="dimmed">
                  Ask an administrator to activate a license in Admin → License.
                </Text>
              )}
            </Group>
          </Alert>
        ) : null}
        <Outlet />
      </AppShell.Main>

      <AppShell.Footer>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap={6} wrap="nowrap">
            <Text size="xs">Signed in as {user?.userName}</Text>
            {license ? (
              canOpenAdmin ? (
                <Badge
                  size="xs"
                  variant="light"
                  color={licenseBadgeColor(license.edition)}
                  component={Link}
                  to="/admin?tab=license"
                  style={{ cursor: 'pointer' }}
                >
                  {license.editionDisplay}
                </Badge>
              ) : (
                <Badge size="xs" variant="light" color={licenseBadgeColor(license.edition)}>
                  {license.editionDisplay}
                </Badge>
              )
            ) : null}
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
