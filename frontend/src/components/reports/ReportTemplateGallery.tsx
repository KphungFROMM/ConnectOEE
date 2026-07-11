import { Badge, Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconFileAnalytics } from '@tabler/icons-react'
import type { ReportTemplate } from '../../lib/reports'
import { templateTypeLabel } from './reportConstants'

export function ReportTemplateGallery({
  templates,
  selectedId,
  onSelect,
}: {
  templates: ReportTemplate[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  if (templates.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No report templates available.
      </Text>
    )
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
      {templates.map((t) => {
        const active = t.id === selectedId
        return (
          <UnstyledButton key={t.id} onClick={() => onSelect(t.id)} style={{ width: '100%' }}>
            <Card
              withBorder
              padding="sm"
              radius="md"
              style={{
                borderColor: active ? 'var(--mantine-color-blue-5)' : undefined,
                background: active ? 'var(--mantine-color-blue-0)' : undefined,
                height: '100%',
              }}
            >
              <Group wrap="nowrap" align="flex-start" gap="sm">
                <IconFileAnalytics
                  size={22}
                  style={{ flexShrink: 0, marginTop: 2 }}
                  color={active ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-dimmed)'}
                />
                <Stack gap={4} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={650} lineClamp={1}>
                    {t.name}
                  </Text>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {t.description || templateTypeLabel(t.reportType)}
                  </Text>
                  <Group gap={6}>
                    <Badge size="xs" variant="light">
                      {templateTypeLabel(t.reportType)}
                    </Badge>
                    <Badge size="xs" variant="outline" color={t.isSystem ? 'gray' : 'violet'}>
                      {t.isSystem ? 'System' : 'Custom'}
                    </Badge>
                  </Group>
                </Stack>
              </Group>
            </Card>
          </UnstyledButton>
        )
      })}
    </SimpleGrid>
  )
}
