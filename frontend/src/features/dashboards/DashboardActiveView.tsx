import { useState } from 'react'
import { Alert, Anchor, Badge, Breadcrumbs, Button, Group, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconBolt, IconDeviceTv, IconPencil, IconPresentation, IconRefresh } from '@tabler/icons-react'
import { DashboardRenderer } from '../../components/DashboardRenderer'
import { kioskPreviewFrameStyle } from '../../components/widgets/design/widgetTheme'
import {
  isSystemLayoutStale,
  refreshSystemLayouts,
  type Dashboard,
} from '../../lib/dashboards'
import { bindingContextLabel, CATEGORY_COLORS, resolveCategory } from './dashboardGrouping'

interface DashboardActiveViewProps {
  dashboard: Dashboard
  canBuild: boolean
  onBack: () => void
  onEdit: () => void
  onLayoutUpdated: () => void | Promise<void>
}

export function DashboardActiveView({
  dashboard,
  canBuild,
  onBack,
  onEdit,
  onLayoutUpdated,
}: DashboardActiveViewProps) {
  const isKiosk = dashboard.scope === 'PublicKiosk'
  const staleLayout = isSystemLayoutStale(dashboard)
  const [layoutBusy, setLayoutBusy] = useState(false)
  const category = resolveCategory(dashboard)
  const binding = bindingContextLabel(dashboard)

  async function updateSystemLayout() {
    setLayoutBusy(true)
    try {
      await refreshSystemLayouts()
      await onLayoutUpdated()
      notifications.show({ message: 'Dashboard layout updated', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to update layout', color: 'red' })
    } finally {
      setLayoutBusy(false)
    }
  }

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Breadcrumbs separator="›" separatorMargin={6}>
          <Anchor size="sm" c="dimmed" onClick={onBack} style={{ cursor: 'pointer' }}>
            Dashboards
          </Anchor>
          <Text size="sm" fw={700}>
            {dashboard.name}
          </Text>
        </Breadcrumbs>
        {binding ? (
          <Text size="xs" c="dimmed">
            {binding}
          </Text>
        ) : null}
      </Stack>

      {staleLayout ? (
        <Alert color="blue" variant="light" title="Dashboard layout needs updating">
          <Stack gap="xs">
            <Text size="sm">
              This dashboard uses an older template grid. Refresh to apply the latest built-in layouts.
            </Text>
            {canBuild ? (
              <Button
                size="xs"
                loading={layoutBusy}
                leftSection={<IconRefresh size={14} />}
                onClick={() => void updateSystemLayout()}
              >
                Refresh system layouts
              </Button>
            ) : null}
          </Stack>
        </Alert>
      ) : null}

      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="xs" wrap="wrap">
          <Title order={isKiosk ? 4 : 3}>{dashboard.name}</Title>
          <Badge size="sm" variant="light" color={CATEGORY_COLORS[category]}>
            {category}
          </Badge>
          {isKiosk ? (
            <Badge variant="light" color="violet" size="sm">
              Kiosk layout
            </Badge>
          ) : (
            <Badge variant="light" color="green" leftSection={<IconBolt size={12} />}>
              Live
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {dashboard.isPublished ? (
            <Button
              variant="light"
              size="sm"
              leftSection={<IconPresentation size={14} />}
              component="a"
              href={`/present/${dashboard.id}`}
              target="_blank"
            >
              Open presentation
            </Button>
          ) : null}
          {isKiosk ? (
            <Button
              variant="light"
              size="sm"
              leftSection={<IconDeviceTv size={14} />}
              component="a"
              href={`/kiosk/${dashboard.id}`}
              target="_blank"
            >
              Open kiosk
            </Button>
          ) : null}
          {canBuild ? (
            <Button variant="light" size="sm" leftSection={<IconPencil size={14} />} onClick={onEdit}>
              Edit
            </Button>
          ) : null}
        </Group>
      </Group>

      <div style={isKiosk ? kioskPreviewFrameStyle() : undefined}>
        <DashboardRenderer dashboard={dashboard} displayMode={isKiosk ? 'kioskPreview' : 'default'} />
      </div>
    </Stack>
  )
}
