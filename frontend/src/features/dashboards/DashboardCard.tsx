import { ActionIcon, Badge, Card, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconDeviceTv, IconLayoutGrid, IconPencil, IconPin, IconPinFilled } from '@tabler/icons-react'
import type { DashboardSummary } from '../../lib/dashboards'
import {
  bindingContextLabel,
  CATEGORY_COLORS,
  displayTitle,
  resolveCategory,
  scopeLabel,
} from './dashboardGrouping'

interface DashboardCardProps {
  dashboard: DashboardSummary
  canBuild: boolean
  pinned: boolean
  onOpen: (id: string) => void
  onEdit: (id: string) => void
  onTogglePin: (id: string) => void
}

export function DashboardCard({ dashboard, canBuild, pinned, onOpen, onEdit, onTogglePin }: DashboardCardProps) {
  const category = resolveCategory(dashboard)
  const binding = bindingContextLabel(dashboard)
  const isKiosk = dashboard.scope === 'PublicKiosk'

  return (
    <Card
      withBorder
      radius="md"
      padding="lg"
      style={{ cursor: 'pointer' }}
      onClick={() => onOpen(dashboard.id)}
    >
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="xs">
          <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <IconLayoutGrid size={18} style={{ flexShrink: 0 }} />
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Text fw={600} truncate>
                {displayTitle(dashboard)}
              </Text>
              {dashboard.name !== displayTitle(dashboard) ? (
                <Text size="xs" c="dimmed" truncate>
                  {dashboard.name}
                </Text>
              ) : null}
            </Stack>
          </Group>
          <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
            <Tooltip label={pinned ? 'Unpin' : 'Pin'}>
              <ActionIcon
                variant={pinned ? 'light' : 'subtle'}
                color={pinned ? 'blue' : 'gray'}
                size="sm"
                aria-label={pinned ? 'Unpin dashboard' : 'Pin dashboard'}
                onClick={() => onTogglePin(dashboard.id)}
              >
                {pinned ? <IconPinFilled size={14} /> : <IconPin size={14} />}
              </ActionIcon>
            </Tooltip>
            {canBuild ? (
              <Tooltip label="Edit in builder">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  aria-label="Edit dashboard"
                  onClick={() => onEdit(dashboard.id)}
                >
                  <IconPencil size={14} />
                </ActionIcon>
              </Tooltip>
            ) : null}
          </Group>
        </Group>

        <Group gap={6}>
          <Badge size="xs" variant="light" color={CATEGORY_COLORS[category]}>
            {category}
          </Badge>
          <Badge size="xs" variant="dot" color={isKiosk ? 'violet' : dashboard.isPublished ? 'green' : 'gray'}>
            {scopeLabel(dashboard)}
          </Badge>
        </Group>

        {binding ? (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {binding}
          </Text>
        ) : null}

        {isKiosk ? (
          <Group gap={4} onClick={(e) => e.stopPropagation()}>
            <Badge
              size="xs"
              variant="light"
              color="violet"
              leftSection={<IconDeviceTv size={12} />}
              component="a"
              href={`/kiosk/${dashboard.id}`}
              target="_blank"
              style={{ cursor: 'pointer' }}
            >
              Open kiosk
            </Badge>
          </Group>
        ) : null}
      </Stack>
    </Card>
  )
}
