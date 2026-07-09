import { useMemo, useState, type ComponentType } from 'react'
import { Accordion, Badge, Box, Card, Group, ScrollArea, Stack, Text, TextInput, Tooltip, UnstyledButton } from '@mantine/core'
import * as TablerIcons from '@tabler/icons-react'
import { IconGripVertical, IconPlus } from '@tabler/icons-react'
import { widgetCatalog, widgetMetaByType } from '../../components/widgets/registry'
import {
  enrichWidgetMeta,
  matchesPaletteSearch,
  VISUAL_FAMILY_LABELS,
  type WidgetVisualFamily,
} from '../../components/widgets/widgetPaletteMeta'
import { PALETTE_DRAG_MIME } from './widgetFactory'

interface WidgetPaletteProps {
  onAdd: (type: string) => void
}

function PaletteIcon({ name }: { name?: string }) {
  if (!name) return <IconGripVertical size={12} style={{ opacity: 0.5 }} />
  const icons = TablerIcons as unknown as Record<string, ComponentType<{ size?: number; style?: object }>>
  const Icon = icons[name]
  return Icon ? <Icon size={12} style={{ opacity: 0.7 }} /> : <IconGripVertical size={12} style={{ opacity: 0.5 }} />
}

function setPaletteDragImage(e: React.DragEvent, label: string, size?: string) {
  const ghost = document.createElement('div')
  ghost.innerHTML = `<div style="font-weight:600;font-size:12px">${label}</div>${size ? `<div style="font-size:10px;opacity:0.7;margin-top:2px">${size}</div>` : ''}`
  ghost.style.cssText =
    'position:fixed;top:-1000px;left:-1000px;padding:8px 12px;background:var(--mantine-color-body);' +
    'border:2px solid var(--mantine-color-blue-5);border-radius:8px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.15);pointer-events:none;white-space:nowrap;'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2)
  requestAnimationFrame(() => ghost.remove())
}

function PaletteWidgetCard({
  item,
  onAdd,
}: {
  item: ReturnType<typeof enrichWidgetMeta>
  onAdd: (type: string) => void
}) {
  return (
    <Tooltip label={item.description ?? item.type} multiline w={220} disabled={!item.description} withArrow>
      <UnstyledButton
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(PALETTE_DRAG_MIME, item.type)
          e.dataTransfer.effectAllowed = 'copy'
          const meta = widgetMetaByType[item.type]
          setPaletteDragImage(e, item.label, `${meta?.defaultW ?? 3}×${meta?.defaultH ?? 2} grid`)
        }}
        onClick={() => onAdd(item.type)}
        style={{ cursor: 'grab', width: '100%' }}
      >
        <Card withBorder padding={6} radius="sm">
          <Group gap={8} wrap="nowrap" align="flex-start">
            {item.thumbnail ? (
              <Box
                component="img"
                src={item.thumbnail}
                alt=""
                w={48}
                h={28}
                style={{ objectFit: 'contain', borderRadius: 4, flexShrink: 0 }}
              />
            ) : (
              <PaletteIcon name={item.icon} />
            )}
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Group gap={4} wrap="nowrap" justify="space-between">
                <Text size="xs" fw={600} truncate>
                  {item.label}
                </Text>
                <IconPlus size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              </Group>
              {item.defaultVariant ? (
                <Badge size="xs" variant="light" color="gray" w="fit-content">
                  {item.defaultVariant}
                </Badge>
              ) : null}
            </Stack>
          </Group>
        </Card>
      </UnstyledButton>
    </Tooltip>
  )
}

export function WidgetPalette({ onAdd }: WidgetPaletteProps) {
  const [filter, setFilter] = useState('')

  const { categories, familyGroups } = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const items = widgetCatalog.map(enrichWidgetMeta).filter((item) => matchesPaletteSearch(item, q))

    const grouped = new Map<string, ReturnType<typeof enrichWidgetMeta>[]>()
    for (const item of items) {
      const list = grouped.get(item.category) ?? []
      list.push(item)
      grouped.set(item.category, list)
    }

    const byFamily = new Map<WidgetVisualFamily, ReturnType<typeof enrichWidgetMeta>[]>()
    for (const item of items) {
      if (!item.visualFamily) continue
      const list = byFamily.get(item.visualFamily) ?? []
      list.push(item)
      byFamily.set(item.visualFamily, list)
    }

    return {
      categories: [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)),
      familyGroups: [...byFamily.entries()].sort(([a], [b]) => a.localeCompare(b)),
    }
  }, [filter])

  const useFamilyView = !filter.trim()

  return (
    <Card withBorder padding="xs" w={260} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Group justify="space-between" mb={6}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Widgets
        </Text>
        <Badge size="xs" variant="light">
          {widgetCatalog.length}
        </Badge>
      </Group>
      <TextInput
        placeholder="Search by name or metric…"
        size="xs"
        mb={8}
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
      />
      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        {categories.length === 0 ? (
          <Text size="xs" c="dimmed" ta="center" py="md">
            No widgets match your search.
          </Text>
        ) : (
          <Accordion
            multiple
            defaultValue={
              useFamilyView
                ? familyGroups.map(([f]) => `family-${f}`)
                : categories.map(([c]) => c)
            }
            chevronPosition="right"
            variant="contained"
          >
            {useFamilyView
              ? familyGroups.map(([family, items]) => (
                  <Accordion.Item key={family} value={`family-${family}`}>
                    <Accordion.Control py={6}>
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" fw={600} style={{ flex: 1 }}>
                          {VISUAL_FAMILY_LABELS[family]}
                        </Text>
                        <Badge size="xs" variant="outline" color="gray">
                          {items.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={4}>
                        {items.map((m) => (
                          <PaletteWidgetCard key={m.type} item={m} onAdd={onAdd} />
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))
              : categories.map(([category, items]) => (
                  <Accordion.Item key={category} value={category}>
                    <Accordion.Control py={6}>
                      <Group gap={6} wrap="nowrap">
                        <Text size="xs" fw={600} style={{ flex: 1 }}>
                          {category}
                        </Text>
                        <Badge size="xs" variant="outline" color="gray">
                          {items.length}
                        </Badge>
                      </Group>
                    </Accordion.Control>
                    <Accordion.Panel>
                      <Stack gap={4}>
                        {items.map((m) => (
                          <PaletteWidgetCard key={m.type} item={m} onAdd={onAdd} />
                        ))}
                      </Stack>
                    </Accordion.Panel>
                  </Accordion.Item>
                ))}
          </Accordion>
        )}
      </ScrollArea>
      <Text size="10px" c="dimmed" mt={8}>
        Drag onto the canvas or click to add.
      </Text>
    </Card>
  )
}
