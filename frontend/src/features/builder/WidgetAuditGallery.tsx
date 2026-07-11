import { useEffect, useMemo, useState, type ComponentType } from 'react'
import { setAuditApiMode } from './auditApiMode'
import {
  ActionIcon,
  Badge,
  Card,
  Group,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import * as TablerIcons from '@tabler/icons-react'
import { IconCopy, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  KPI_COLOR_MODE_OPTIONS,
  KPI_PRESENTATION_OPTIONS,
  PRESENTATION_WIDGET_TYPES,
  STATUS_STYLE_OPTIONS,
  STATUS_STYLE_WIDGET_TYPES,
  type KpiColorMode,
  type KpiPresentation,
  type StatusStyle,
} from '../../components/widgets/common'
import { resolveWidget, widgetCatalog, type WidgetMeta } from '../../components/widgets/registry'
import {
  enrichWidgetMeta,
  matchesPaletteSearch,
  VISUAL_FAMILY_LABELS,
  type WidgetVisualFamily,
} from '../../components/widgets/widgetPaletteMeta'
import type { WidgetFrameVariant } from '../../components/widgets/design/WidgetFrame'
import { createMockWidgetCtx } from './mockWidgetCtx'
import { createAuditWidget, createAuditNestTree, widgetCatalogByCategory } from './widgetAuditDefaults'
import { GRID_ROW_HEIGHT } from './gridConstants'
import { COMMISSION_GRADES, type CommissionGrade } from './widgetCommissionGrades'
import { DashboardWidgetTreeProvider } from '../../components/widgets/NestedWidgetHost'

interface WidgetAuditGalleryProps {
  embedded?: boolean
}

function PaletteIcon({ name }: { name?: string }) {
  if (!name) return null
  const icons = TablerIcons as unknown as Record<string, ComponentType<{ size?: number; stroke?: number }>>
  const Icon = icons[name]
  return Icon ? <Icon size={16} stroke={1.5} /> : null
}

function gradeColor(g: CommissionGrade) {
  if (g === 'Pass') return 'teal'
  if (g === 'Fix') return 'orange'
  if (g === 'Defer') return 'gray'
  return 'blue'
}

function isWide(meta: WidgetMeta) {
  return meta.defaultW >= 8
}

export function WidgetAuditGallery({ embedded = false }: WidgetAuditGalleryProps) {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [frameVariant, setFrameVariant] = useState<WidgetFrameVariant>('default')
  const [presentation, setPresentation] = useState<KpiPresentation>('number')
  const [statusStyle, setStatusStyle] = useState<StatusStyle>('beacon')
  const [colorMode, setColorMode] = useState<KpiColorMode>('identity')
  const [filter, setFilter] = useState('')
  const [family, setFamily] = useState<WidgetVisualFamily | 'all'>('all')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const ctx = useMemo(() => createMockWidgetCtx(), [])

  useEffect(() => {
    setAuditApiMode(true)
    return () => setAuditApiMode(false)
  }, [])

  const enriched = useMemo(
    () =>
      widgetCatalog
        .map(enrichWidgetMeta)
        .filter((item) => matchesPaletteSearch(item, filter))
        .filter((item) => family === 'all' || item.visualFamily === family),
    [filter, family],
  )

  const categories = useMemo(() => {
    const map = new Map<string, typeof enriched>()
    for (const item of enriched) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [enriched])

  const allCategories = useMemo(() => widgetCatalogByCategory().map(([c]) => c), [])

  useEffect(() => {
    if (activeCategory && !categories.some(([c]) => c === activeCategory)) {
      setActiveCategory(categories[0]?.[0] ?? null)
    }
  }, [categories, activeCategory])

  function copyType(type: string) {
    void navigator.clipboard.writeText(type)
    notifications.show({ message: `Copied ${type}`, color: 'teal', autoClose: 1200 })
  }

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
      <Group justify="space-between" wrap="wrap" align="flex-start">
        <div>
          <Title order={embedded ? 3 : 2}>Widget library</Title>
          <Text size="sm" c="dimmed">
            {enriched.length} of {widgetCatalog.length} widgets · mock live data · frame / presentation / status style
            matrix
          </Text>
        </div>
        <Group gap="sm" wrap="wrap">
          <SegmentedControl
            size="xs"
            value={colorScheme}
            onChange={(v) => setColorScheme(v as 'light' | 'dark')}
            data={[
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ]}
          />
          <SegmentedControl
            size="xs"
            value={frameVariant}
            onChange={(v) => setFrameVariant(v as WidgetFrameVariant)}
            data={[
              { label: 'Default', value: 'default' },
              { label: 'Compact', value: 'compact' },
              { label: 'Hero', value: 'hero' },
              { label: 'Kiosk', value: 'kiosk' },
            ]}
          />
        </Group>
      </Group>

      <Group gap="sm" wrap="wrap" align="flex-end">
        <div>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Presentation (KPI tiles)
          </Text>
          <SegmentedControl
            size="xs"
            value={presentation}
            onChange={(v) => setPresentation(v as KpiPresentation)}
            data={KPI_PRESENTATION_OPTIONS.map((p) => ({ value: p.value, label: p.label }))}
          />
        </div>
        <div>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Color mode
          </Text>
          <SegmentedControl
            size="xs"
            value={colorMode}
            onChange={(v) => setColorMode(v as KpiColorMode)}
            data={KPI_COLOR_MODE_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
          />
        </div>
        <div>
          <Text size="xs" c="dimmed" fw={600} mb={4}>
            Status style
          </Text>
          <SegmentedControl
            size="xs"
            value={statusStyle}
            onChange={(v) => setStatusStyle(v as StatusStyle)}
            data={STATUS_STYLE_OPTIONS.map((s) => ({ value: s.value, label: s.label }))}
          />
        </div>
      </Group>

      <Group gap="sm" wrap="wrap" align="flex-end">
        <TextInput
          placeholder="Search widgets…"
          leftSection={<IconSearch size={14} />}
          value={filter}
          onChange={(e) => setFilter(e.currentTarget.value)}
          size="sm"
          style={{ flex: 1, minWidth: 200, maxWidth: 360 }}
        />
        <SegmentedControl
          size="xs"
          value={family}
          onChange={(v) => setFamily(v as WidgetVisualFamily | 'all')}
          data={[
            { label: 'All', value: 'all' },
            ...Object.entries(VISUAL_FAMILY_LABELS).map(([k, label]) => ({ value: k, label })),
          ]}
        />
      </Group>

      <Group gap={6} wrap="wrap" style={{ position: 'sticky', top: 0, zIndex: 5, background: 'var(--mantine-color-body)', paddingBottom: 4 }}>
        {allCategories.map((cat) => {
          const count = categories.find(([c]) => c === cat)?.[1].length ?? 0
          if (filter && count === 0) return null
          return (
            <UnstyledButton
              key={cat}
              onClick={() => {
                setActiveCategory(cat)
                document.getElementById(`gallery-cat-${cat}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
            >
              <Badge variant={activeCategory === cat ? 'filled' : 'light'} color="blue" size="sm">
                {cat} {count > 0 ? `(${count})` : ''}
              </Badge>
            </UnstyledButton>
          )
        })}
      </Group>

      {categories.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No widgets match your filters.
        </Text>
      ) : (
        categories.map(([category, items]) => (
          <Stack key={category} gap="sm" id={`gallery-cat-${category}`}>
            <Group gap="xs">
              <Title order={4}>{category}</Title>
              <Badge variant="light">{items.length}</Badge>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3, xl: 4 }} spacing="md">
              {items.map((meta) => {
                const Widget = resolveWidget(meta.type)
                const base = createAuditWidget(meta.type, 0)
                const options: Record<string, unknown> = { ...base.options, frameVariant }
                if (PRESENTATION_WIDGET_TYPES.has(meta.type)) {
                  options.presentation = presentation
                  options.colorMode = colorMode
                }
                if (STATUS_STYLE_WIDGET_TYPES.has(meta.type)) {
                  options.statusStyle = statusStyle
                }
                const widget = { ...base, options }
                const nestTree = createAuditNestTree(widget)
                const heightPx = meta.defaultH * GRID_ROW_HEIGHT
                const grade = COMMISSION_GRADES[meta.type]?.grade ?? 'Pass'
                const wide = isWide(meta)
                return (
                  <Card
                    key={meta.type}
                    withBorder
                    padding="sm"
                    radius="md"
                    id={`widget-audit-${meta.type}`}
                    style={wide ? { gridColumn: '1 / -1' } : undefined}
                  >
                    <Stack gap={8}>
                      <Group justify="space-between" wrap="nowrap" gap="xs">
                        <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                          <PaletteIcon name={meta.icon} />
                          <Text size="sm" fw={700} truncate>
                            {meta.label}
                          </Text>
                        </Group>
                        <Group gap={4} wrap="nowrap">
                          <Badge size="xs" variant="light" color={gradeColor(grade)}>
                            {grade}
                          </Badge>
                          <Badge size="xs" variant="outline" color="gray">
                            {meta.defaultW}×{meta.defaultH}
                          </Badge>
                          <Tooltip label="Copy type id">
                            <ActionIcon size="sm" variant="subtle" onClick={() => copyType(meta.type)} aria-label="Copy type">
                              <IconCopy size={14} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Group>
                      <Text size="10px" c="dimmed" ff="monospace">
                        {meta.type}
                        {meta.description ? ` · ${meta.description}` : ''}
                      </Text>
                      <div
                        data-widget-preview
                        style={{
                          height: Math.max(heightPx, wide ? 160 : 140),
                          minHeight: wide ? 160 : 140,
                          overflow: 'hidden',
                          borderRadius: 10,
                          border: '1px solid var(--mantine-color-default-border)',
                          background: 'var(--mantine-color-body)',
                          padding: 4,
                        }}
                      >
                        <DashboardWidgetTreeProvider widgets={nestTree}>
                          <Widget widget={widget} ctx={ctx} />
                        </DashboardWidgetTreeProvider>
                      </div>
                    </Stack>
                  </Card>
                )
              })}
            </SimpleGrid>
          </Stack>
        ))
      )}
    </Stack>
  )
}
