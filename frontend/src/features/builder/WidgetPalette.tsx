import { useEffect, useMemo, useState, type ComponentType } from 'react'
import {
  Accordion,
  Badge,
  Button,
  Card,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import * as TablerIcons from '@tabler/icons-react'
import { IconGripVertical, IconPlus, IconSparkles } from '@tabler/icons-react'
import { PRESENTATION_WIDGET_TYPES, STATUS_STYLE_WIDGET_TYPES, supportsFrameVariant, KPI_COLOR_MODE_OPTIONS } from '../../components/widgets/common'
import { KPI_PRESENTATION_OPTIONS } from '../../components/widgets/design/PresentationKpi'
import { STATUS_STYLE_OPTIONS } from '../../components/widgets/design/statusStyle'
import { widgetCatalog, widgetMetaByType } from '../../components/widgets/registry'
import {
  enrichWidgetMeta,
  matchesPaletteSearch,
  VISUAL_FAMILY_LABELS,
  type WidgetVisualFamily,
} from '../../components/widgets/widgetPaletteMeta'
import type { DisplayProfileId } from './displayProfiles'
import { flavorDefaultsForType, type FlavorOptions } from './defaultFlavors'
import { PaletteWidgetPreview } from './PaletteWidgetPreview'
import { LAYOUT_SNIPPETS, resolveSnippetTypes, suggestedWidgetTypes } from './suggestedWidgets'
import { PALETTE_DRAG_MIME } from './widgetFactory'

export interface PaletteAddPayload {
  type: string
  options?: FlavorOptions
}

interface WidgetPaletteProps {
  displayProfile: DisplayProfileId
  plantId: string | null
  lineId: string | null
  machineId: string | null
  onAdd: (payload: PaletteAddPayload) => void
  onAddSuggested: () => void
  onAddSnippet: (snippetId: string) => void
  onDragPayloadChange?: (payload: PaletteAddPayload | null) => void
  /** Increment to force Browse all mode (empty-canvas coach). */
  browseAllSignal?: number
}

type PaletteView = 'gallery' | 'compact'
type BrowseMode = 'suggested' | 'all'

function PaletteIcon({ name, size = 18 }: { name?: string; size?: number }) {
  if (!name) return <IconGripVertical size={size} style={{ opacity: 0.5 }} />
  const icons = TablerIcons as unknown as Record<string, ComponentType<{ size?: number; style?: object; stroke?: number }>>
  const Icon = icons[name]
  return Icon ? <Icon size={size} stroke={1.5} style={{ opacity: 0.85, flexShrink: 0 }} /> : <IconGripVertical size={size} style={{ opacity: 0.5 }} />
}

function setPaletteDragImage(e: React.DragEvent, label: string, size?: string) {
  const ghost = document.createElement('div')
  ghost.innerHTML = `<div style="font-weight:600;font-size:12px">${label}</div>${size ? `<div style="font-size:10px;opacity:0.7;margin-top:2px">${size}</div>` : ''}`
  ghost.style.cssText =
    'position:fixed;top:-1000px;left:-1000px;padding:8px 12px;background:var(--mantine-color-body);' +
    'border:2px solid var(--mantine-color-blue-5);border-radius:8px;' +
    'box-shadow:0 4px 12px rgba(0,0,0,0.15);pointer-events:none;white-space:nowrap;min-width:120px;'
  document.body.appendChild(ghost)
  e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, ghost.offsetHeight / 2)
  requestAnimationFrame(() => ghost.remove())
}

function FlavorChips({
  type,
  flavors,
  onChange,
}: {
  type: string
  flavors: FlavorOptions
  onChange: (next: FlavorOptions) => void
}) {
  const showFrame = supportsFrameVariant(type)
  const showPresentation = PRESENTATION_WIDGET_TYPES.has(type)
  const showStatusStyle = STATUS_STYLE_WIDGET_TYPES.has(type)
  if (!showFrame && !showPresentation && !showStatusStyle) return null

  return (
    <Stack gap={4} onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {showStatusStyle ? (
        <Group gap={4}>
          {STATUS_STYLE_OPTIONS.map((s) => (
            <Button
              key={s.value}
              size="compact-xs"
              variant={(flavors.statusStyle ?? 'beacon') === s.value ? 'filled' : 'light'}
              onClick={() => onChange({ ...flavors, statusStyle: s.value })}
            >
              {s.label}
            </Button>
          ))}
        </Group>
      ) : null}
      {showPresentation ? (
        <Group gap={4}>
          {KPI_PRESENTATION_OPTIONS.map((p) => (
            <Button
              key={p.value}
              size="compact-xs"
              variant={(flavors.presentation ?? 'number') === p.value ? 'filled' : 'light'}
              onClick={() => onChange({ ...flavors, presentation: p.value })}
            >
              {p.label}
            </Button>
          ))}
        </Group>
      ) : null}
      {showPresentation ? (
        <Group gap={4}>
          {KPI_COLOR_MODE_OPTIONS.map((c) => (
            <Button
              key={c.value}
              size="compact-xs"
              variant={(flavors.colorMode ?? 'identity') === c.value ? 'filled' : 'light'}
              onClick={() => onChange({ ...flavors, colorMode: c.value })}
            >
              {c.label}
            </Button>
          ))}
        </Group>
      ) : null}
      {showFrame ? (
        <Group gap={4}>
          {(['default', 'compact', 'hero', 'kiosk'] as const).map((f) => (
            <Button
              key={f}
              size="compact-xs"
              variant={(flavors.frameVariant ?? 'default') === f ? 'filled' : 'outline'}
              onClick={() => onChange({ ...flavors, frameVariant: f })}
            >
              {f}
            </Button>
          ))}
        </Group>
      ) : null}
    </Stack>
  )
}

function GalleryCard({
  item,
  displayProfile,
  view,
  expanded,
  onToggleExpand,
  onAdd,
  onDragPayloadChange,
}: {
  item: ReturnType<typeof enrichWidgetMeta>
  displayProfile: DisplayProfileId
  view: PaletteView
  expanded: boolean
  onToggleExpand: () => void
  onAdd: (payload: PaletteAddPayload) => void
  onDragPayloadChange?: (payload: PaletteAddPayload | null) => void
}) {
  const [flavors, setFlavors] = useState<FlavorOptions>(() => flavorDefaultsForType(item.type, displayProfile))

  useEffect(() => {
    setFlavors(flavorDefaultsForType(item.type, displayProfile))
  }, [item.type, displayProfile])

  const payload: PaletteAddPayload = { type: item.type, options: flavors }
  const meta = widgetMetaByType[item.type]
  const sizeLabel = `${meta?.defaultW ?? 3}×${meta?.defaultH ?? 2}`

  if (view === 'compact') {
    return (
      <Tooltip label={item.description ?? item.type} multiline w={220} disabled={!item.description} withArrow>
        <UnstyledButton
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PALETTE_DRAG_MIME, item.type)
            e.dataTransfer.effectAllowed = 'copy'
            onDragPayloadChange?.(payload)
            setPaletteDragImage(e, item.label, sizeLabel)
          }}
          onDragEnd={() => onDragPayloadChange?.(null)}
          onClick={() => onAdd(payload)}
          style={{ cursor: 'grab', width: '100%' }}
        >
          <Card withBorder padding="xs" radius="sm">
            <Group gap={8} wrap="nowrap">
              <PaletteIcon name={item.icon} size={16} />
              <Text size="xs" fw={600} truncate style={{ flex: 1 }}>
                {item.label}
              </Text>
              <IconPlus size={12} style={{ opacity: 0.45 }} />
            </Group>
          </Card>
        </UnstyledButton>
      </Tooltip>
    )
  }

  return (
    <Card withBorder padding="xs" radius="md" style={{ background: 'var(--mantine-color-body)' }}>
      <Stack gap={6}>
        <UnstyledButton
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(PALETTE_DRAG_MIME, item.type)
            e.dataTransfer.effectAllowed = 'copy'
            onDragPayloadChange?.(payload)
            setPaletteDragImage(e, item.label, sizeLabel)
          }}
          onDragEnd={() => onDragPayloadChange?.(null)}
          onClick={() => onAdd(payload)}
          style={{ cursor: 'grab', width: '100%' }}
        >
          <PaletteWidgetPreview type={item.type} flavors={flavors} height={88} />
        </UnstyledButton>
        <Group justify="space-between" wrap="nowrap" gap={4}>
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Text size="xs" fw={700} truncate>
              {item.label}
            </Text>
            {item.description ? (
              <Text size="10px" c="dimmed" lineClamp={1}>
                {item.description}
              </Text>
            ) : null}
          </Stack>
          <Button
            size="compact-xs"
            variant="light"
            onClick={() => onAdd(payload)}
            leftSection={<IconPlus size={12} />}
          >
            Add
          </Button>
        </Group>
        {(supportsFrameVariant(item.type) || PRESENTATION_WIDGET_TYPES.has(item.type)) && (
          <>
            <UnstyledButton onClick={onToggleExpand}>
              <Text size="10px" c="blue" fw={600}>
                {expanded ? 'Hide flavors' : 'Flavors'}
              </Text>
            </UnstyledButton>
            {expanded ? <FlavorChips type={item.type} flavors={flavors} onChange={setFlavors} /> : null}
          </>
        )}
      </Stack>
    </Card>
  )
}

export function WidgetPalette({
  displayProfile,
  plantId,
  lineId,
  machineId,
  onAdd,
  onAddSuggested,
  onAddSnippet,
  onDragPayloadChange,
  browseAllSignal = 0,
}: WidgetPaletteProps) {
  const [filter, setFilter] = useState('')
  const [view, setView] = useState<PaletteView>('gallery')
  const [browse, setBrowse] = useState<BrowseMode>('suggested')
  const [expandedType, setExpandedType] = useState<string | null>(null)

  useEffect(() => {
    if (browseAllSignal > 0) setBrowse('all')
  }, [browseAllSignal])

  const suggestedTypes = useMemo(
    () => suggestedWidgetTypes({ displayProfile, plantId, lineId, machineId }),
    [displayProfile, plantId, lineId, machineId],
  )

  const suggestedItems = useMemo(
    () =>
      suggestedTypes
        .map((t) => widgetCatalog.find((c) => c.type === t))
        .filter(Boolean)
        .map((c) => enrichWidgetMeta(c!)),
    [suggestedTypes],
  )

  const { categories, familyGroups, filteredCount } = useMemo(() => {
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
      filteredCount: items.length,
    }
  }, [filter])

  const showAll = browse === 'all' || filter.trim().length > 0
  const useFamilyView = !filter.trim()

  return (
    <Card
      withBorder
      padding="xs"
      w={view === 'gallery' ? 340 : 260}
      style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <Group justify="space-between" mb={6}>
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          Widgets
        </Text>
        <Badge size="xs" variant="light">
          {widgetCatalog.length}
        </Badge>
      </Group>

      <TextInput
        placeholder="Search: andon, pareto, OEE…"
        size="xs"
        mb={8}
        value={filter}
        onChange={(e) => setFilter(e.currentTarget.value)}
      />

      <Group grow mb={8}>
        <SegmentedControl
          size="xs"
          value={browse}
          onChange={(v) => setBrowse(v as BrowseMode)}
          data={[
            { value: 'suggested', label: 'Suggested' },
            { value: 'all', label: 'Browse all' },
          ]}
        />
      </Group>
      <SegmentedControl
        size="xs"
        mb={8}
        fullWidth
        value={view}
        onChange={(v) => setView(v as PaletteView)}
        data={[
          { value: 'gallery', label: 'Gallery' },
          { value: 'compact', label: 'Compact' },
        ]}
      />

      <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
        <Stack gap="sm">
          {!filter.trim() ? (
            <Stack gap={6}>
              <Group justify="space-between" wrap="nowrap">
                <Group gap={6}>
                  <IconSparkles size={14} color="var(--mantine-color-blue-6)" />
                  <Text size="xs" fw={700}>
                    Suggested for this board
                  </Text>
                </Group>
                <Button size="compact-xs" variant="light" onClick={onAddSuggested}>
                  Add all
                </Button>
              </Group>
              <Stack gap={6}>
                {suggestedItems.map((item) => (
                  <GalleryCard
                    key={`sug-${item.type}`}
                    item={item}
                    displayProfile={displayProfile}
                    view={view}
                    expanded={expandedType === `sug-${item.type}`}
                    onToggleExpand={() =>
                      setExpandedType((cur) => (cur === `sug-${item.type}` ? null : `sug-${item.type}`))
                    }
                    onAdd={onAdd}
                    onDragPayloadChange={onDragPayloadChange}
                  />
                ))}
              </Stack>
            </Stack>
          ) : null}

          {!filter.trim() && browse === 'suggested' ? (
            <Stack gap={6}>
              <Text size="xs" fw={700} c="dimmed">
                Layout snippets
              </Text>
              {LAYOUT_SNIPPETS.map((snip) => {
                const types = resolveSnippetTypes(snip)
                if (types.length === 0) return null
                return (
                  <Card key={snip.id} withBorder padding="xs" radius="sm">
                    <Group justify="space-between" wrap="nowrap" gap="xs">
                      <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                        <Text size="xs" fw={600}>
                          {snip.label}
                        </Text>
                        <Text size="10px" c="dimmed" lineClamp={2}>
                          {snip.description}
                        </Text>
                      </Stack>
                      <Button size="compact-xs" variant="light" onClick={() => onAddSnippet(snip.id)}>
                        Insert
                      </Button>
                    </Group>
                  </Card>
                )
              })}
              <Button size="xs" variant="subtle" onClick={() => setBrowse('all')}>
                Show all {widgetCatalog.length} widgets
              </Button>
            </Stack>
          ) : null}

          {showAll ? (
            filteredCount === 0 ? (
              <Text size="xs" c="dimmed" ta="center" py="md">
                No widgets match your search.
              </Text>
            ) : (
              <Accordion
                multiple
                defaultValue={
                  useFamilyView ? familyGroups.slice(0, 2).map(([f]) => `family-${f}`) : categories.map(([c]) => c)
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
                          <Stack gap={6}>
                            {items.map((m) => (
                              <GalleryCard
                                key={m.type}
                                item={m}
                                displayProfile={displayProfile}
                                view={view}
                                expanded={expandedType === m.type}
                                onToggleExpand={() => setExpandedType((cur) => (cur === m.type ? null : m.type))}
                                onAdd={onAdd}
                                onDragPayloadChange={onDragPayloadChange}
                              />
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
                          <Stack gap={6}>
                            {items.map((m) => (
                              <GalleryCard
                                key={m.type}
                                item={m}
                                displayProfile={displayProfile}
                                view={view}
                                expanded={expandedType === m.type}
                                onToggleExpand={() => setExpandedType((cur) => (cur === m.type ? null : m.type))}
                                onAdd={onAdd}
                                onDragPayloadChange={onDragPayloadChange}
                              />
                            ))}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    ))}
              </Accordion>
            )
          ) : null}
        </Stack>
      </ScrollArea>

      <Text size="10px" c="dimmed" mt={8}>
        Drag onto the canvas or click Add. Flavors apply on drop.
      </Text>
    </Card>
  )
}
