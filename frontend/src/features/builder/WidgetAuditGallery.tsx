import { useEffect, useMemo, useState } from 'react'
import { setAuditApiMode } from './auditApiMode'
import { Badge, Card, Group, SegmentedControl, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { resolveWidget, widgetCatalog } from '../../components/widgets/registry'
import { createMockWidgetCtx } from './mockWidgetCtx'
import { createAuditWidget, widgetCatalogByCategory } from './widgetAuditDefaults'
import { GRID_ROW_HEIGHT } from './gridConstants'

interface WidgetAuditGalleryProps {
  embedded?: boolean
}

export function WidgetAuditGallery({ embedded = false }: WidgetAuditGalleryProps) {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const ctx = useMemo(() => createMockWidgetCtx(), [])
  const categories = useMemo(() => widgetCatalogByCategory(), [])

  useEffect(() => {
    setAuditApiMode(true)
    return () => setAuditApiMode(false)
  }, [])

  return (
    <Stack
      gap="md"
      p={embedded ? 0 : 'md'}
      data-mantine-color-scheme={colorScheme}
      style={
        embedded
          ? undefined
          : { minHeight: '100vh', background: 'var(--mantine-color-body)' }
      }
    >
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={embedded ? 3 : 2}>Widget Audit Gallery</Title>
          <Text size="sm" c="dimmed">
            All {widgetCatalog.length} widget types with mock live data — for visual QA in light and dark mode.
          </Text>
        </div>
        <SegmentedControl
          value={colorScheme}
          onChange={(v) => setColorScheme(v as 'light' | 'dark')}
          data={[
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
        />
      </Group>

      {categories.map(([category, items]) => (
        <Stack key={category} gap="sm">
          <Group gap="xs">
            <Title order={4}>{category}</Title>
            <Badge variant="light">{items.length}</Badge>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
            {items.map((meta) => {
              const Widget = resolveWidget(meta.type)
              const widget = createAuditWidget(meta.type, 0)
              const heightPx = meta.defaultH * GRID_ROW_HEIGHT
              return (
                <Card key={meta.type} withBorder padding="xs" radius="md" id={`widget-audit-${meta.type}`}>
                  <Stack gap={6}>
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Text size="xs" fw={700} truncate>
                        {meta.label}
                      </Text>
                      <Badge size="xs" variant="outline" color="gray">
                        {meta.defaultW}×{meta.defaultH}
                      </Badge>
                    </Group>
                    <Text size="10px" c="dimmed" ff="monospace">
                      {meta.type}
                    </Text>
                    <div
                      style={{
                        height: Math.max(heightPx, 120),
                        minHeight: 120,
                        overflow: 'hidden',
                        borderRadius: 8,
                        border: '1px solid var(--mantine-color-default-border)',
                        background: 'var(--mantine-color-body)',
                      }}
                    >
                      <Widget widget={widget} ctx={ctx} />
                    </div>
                  </Stack>
                </Card>
              )
            })}
          </SimpleGrid>
        </Stack>
      ))}
    </Stack>
  )
}
