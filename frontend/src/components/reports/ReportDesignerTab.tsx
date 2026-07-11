import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Divider,
  Group,
  Menu,
  NumberInput,
  Paper,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Textarea,
  ThemeIcon,
  Title,
  Tooltip,
  UnstyledButton,
} from '@mantine/core'
import {
  IconArrowBackUp,
  IconArrowDown,
  IconArrowForwardUp,
  IconArrowUp,
  IconBlocks,
  IconCopy,
  IconDeviceFloppy,
  IconEye,
  IconFileAnalytics,
  IconGripVertical,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import {
  REPORT_PRESETS,
  catalogByCategory,
  catalogItem,
  createBlock,
  isTableBlock,
  optionBool,
  optionNumber,
  optionString,
  parseLayoutJson,
  serializeLayoutJson,
  type ReportBlock,
  type ReportBlockType,
} from '../../lib/reportBlocks'
import {
  buildGenerateRequest,
  deleteCustomReportTemplate,
  forkReportTemplate,
  getReportTemplate,
  previewReport,
  saveCustomReportTemplate,
  updateCustomReportTemplate,
  type ReportTemplate,
} from '../../lib/reports'
import { ReportBlockPalettePreview, ReportBlockPreview } from './ReportBlockPreview'
import type { ScopeOption } from './reportConstants'
import { notifyReport } from './ReportHistoryTab'
import { useReportBlockHistory } from './useReportBlockHistory'

const byCategory = catalogByCategory()
const CATEGORY_ORDER = ['KPIs', 'Charts', 'Tables', 'Layout'] as const
const DND_BLOCK = 'application/x-connectoee-report-block'
const DND_PALETTE = 'application/x-connectoee-report-palette'

export function ReportDesignerTab({
  templates,
  scopes,
  onSaved,
  onUseSystem,
}: {
  templates: ReportTemplate[]
  scopes: ScopeOption[]
  onSaved: () => void
  onUseSystem?: () => void
}) {
  const customTemplates = useMemo(() => templates.filter((t) => !t.isSystem && t.reportType === 'Custom'), [templates])
  const systemTemplates = useMemo(() => templates.filter((t) => t.isSystem), [templates])

  const { blocks, setBlocks, replaceBlocks, undo, redo, canUndo, canRedo } = useReportBlockHistory([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [name, setName] = useState('Custom report')
  const [description, setDescription] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [previewScope, setPreviewScope] = useState<string | null>(null)
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [showPreview, setShowPreview] = useState(true)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const previewSeq = useRef(0)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragIdRef = useRef<string | null>(null)

  const selected = blocks.find((b) => b.id === selectedId) ?? null

  useEffect(() => {
    if (!previewScope && scopes[0]) setPreviewScope(scopes[0].value)
  }, [scopes, previewScope])

  const markDirty = useCallback(() => setDirty(true), [])

  const loadTemplate = useCallback(
    async (id: string) => {
      try {
        const detail = await getReportTemplate(id)
        const parsed = parseLayoutJson(detail.layoutJson)
        replaceBlocks(parsed.length ? parsed : REPORT_PRESETS[0].blocks())
        setTemplateId(detail.id)
        setName(detail.name)
        setDescription(detail.description ?? '')
        setSelectedId(null)
        setDirty(false)
      } catch {
        notifyReport('Failed to load template', 'red')
      }
    },
    [replaceBlocks],
  )

  function startBlank(presetKey = 'blank') {
    const preset = REPORT_PRESETS.find((p) => p.key === presetKey) ?? REPORT_PRESETS[0]
    replaceBlocks(preset.blocks())
    setTemplateId(null)
    setName(preset.key === 'blank' ? 'Custom report' : `${preset.label} (custom)`)
    setDescription('')
    setSelectedId(null)
    setDirty(true)
  }

  async function forkSystem(systemId: string) {
    setBusy(true)
    try {
      const forked = await forkReportTemplate(systemId)
      onSaved()
      await loadTemplate(forked.id)
      notifyReport(`Forked as “${forked.name}”`)
    } catch (e) {
      notifyReport(e instanceof Error ? e.message : 'Fork failed', 'red')
    } finally {
      setBusy(false)
    }
  }

  function addBlock(type: ReportBlockType, atIndex?: number) {
    const block = createBlock(type)
    setBlocks((prev) => {
      if (atIndex == null) {
        if (!selectedId) return [...prev, block]
        const idx = prev.findIndex((b) => b.id === selectedId)
        if (idx < 0) return [...prev, block]
        const next = [...prev]
        next.splice(idx + 1, 0, block)
        return next
      }
      const next = [...prev]
      next.splice(Math.max(0, Math.min(atIndex, next.length)), 0, block)
      return next
    })
    setSelectedId(block.id)
    markDirty()
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
    markDirty()
  }

  function reorderBlock(fromId: string, toIndex: number) {
    setBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === fromId)
      if (from < 0) return prev
      let insertAt = Math.max(0, Math.min(toIndex, prev.length))
      const next = [...prev]
      const [item] = next.splice(from, 1)
      if (from < insertAt) insertAt -= 1
      next.splice(insertAt, 0, item)
      return next
    })
    markDirty()
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (selectedId === id) setSelectedId(null)
    markDirty()
  }

  function updateSelected(patch: Partial<ReportBlock>) {
    if (!selectedId) return
    setBlocks((prev) => prev.map((b) => (b.id === selectedId ? { ...b, ...patch } : b)))
    markDirty()
  }

  function patchSelectedOption(key: string, value: unknown) {
    if (!selected) return
    updateSelected({ options: { ...selected.options, [key]: value } })
  }

  async function save() {
    if (!name.trim()) {
      notifyReport('Name is required', 'red')
      return
    }
    if (blocks.length === 0) {
      notifyReport('Add at least one block', 'red')
      return
    }
    setBusy(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        layoutJson: serializeLayoutJson(blocks),
      }
      if (templateId) {
        await updateCustomReportTemplate(templateId, body)
        notifyReport('Template updated')
      } else {
        const created = await saveCustomReportTemplate(body)
        setTemplateId(created.id)
        notifyReport('Template saved')
      }
      setDirty(false)
      onSaved()
    } catch (e) {
      notifyReport(e instanceof Error ? e.message : 'Save failed', 'red')
    } finally {
      setBusy(false)
    }
  }

  async function removeTemplate() {
    if (!templateId) return
    if (!window.confirm('Delete this custom template?')) return
    setBusy(true)
    try {
      await deleteCustomReportTemplate(templateId)
      notifyReport('Template deleted')
      startBlank()
      onSaved()
    } catch (e) {
      notifyReport(e instanceof Error ? e.message : 'Delete failed', 'red')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!dirty || !templateId) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      void (async () => {
        try {
          await updateCustomReportTemplate(templateId, {
            name: name.trim() || 'Custom report',
            description: description.trim() || undefined,
            layoutJson: serializeLayoutJson(blocks),
          })
          setDirty(false)
          onSaved()
        } catch {
          /* keep dirty */
        }
      })()
    }, 2500)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [dirty, templateId, name, description, blocks, onSaved])

  useEffect(() => {
    if (!showPreview || !templateId || !previewScope || blocks.length === 0) return
    if (dirty) return
    const scope = scopes.find((s) => s.value === previewScope)
    if (!scope) return

    const timer = setTimeout(() => {
      const seq = ++previewSeq.current
      setPreviewLoading(true)
      setPreviewError(null)
      previewReport(buildGenerateRequest(templateId, { level: scope.level, id: scope.id }, 'Last7d', 'Pdf'))
        .then((blob) => {
          if (seq !== previewSeq.current) return
          setPreviewBlobUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev)
            return URL.createObjectURL(blob)
          })
        })
        .catch((e) => {
          if (seq !== previewSeq.current) return
          setPreviewError(e instanceof Error ? e.message : 'Preview failed')
        })
        .finally(() => {
          if (seq === previewSeq.current) setPreviewLoading(false)
        })
    }, 800)

    return () => clearTimeout(timer)
  }, [showPreview, templateId, previewScope, blocks, dirty, scopes])

  useEffect(() => {
    return () => {
      if (previewBlobUrl) URL.revokeObjectURL(previewBlobUrl)
    }
  }, [previewBlobUrl])

  function onCanvasDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragIdRef.current ? 'move' : 'copy'
    setDropIndex(index)
  }

  function onCanvasDrop(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDropIndex(null)
    const paletteType = e.dataTransfer.getData(DND_PALETTE) || e.dataTransfer.getData('text/plain')
    const moveId = e.dataTransfer.getData(DND_BLOCK) || dragIdRef.current
    dragIdRef.current = null
    if (paletteType && catalogItem(paletteType as ReportBlockType)) {
      addBlock(paletteType as ReportBlockType, index)
      return
    }
    if (moveId) reorderBlock(moveId, index)
  }

  const rolePresets = REPORT_PRESETS.filter((p) => p.role)
  const otherPresets = REPORT_PRESETS.filter((p) => !p.role)

  if (blocks.length === 0 && !templateId && !dirty) {
    return (
      <Stack gap="md">
        <Paper withBorder p="lg" radius="md">
          <Group align="flex-start" gap="md">
            <ThemeIcon size={48} radius="md" variant="light" color="blue">
              <IconBlocks size={26} />
            </ThemeIcon>
            <Stack gap={6} style={{ flex: 1 }}>
              <Title order={4}>Custom report designer</Title>
              <Text size="sm" c="dimmed">
                Compose print-ready sections that match QuestPDF output — KPIs, charts, tables, and layout blocks.
              </Text>
              <Text size="xs" fw={600} mt={4}>
                Start by role
              </Text>
              <Group gap="xs">
                {rolePresets.map((p) => (
                  <Button key={p.key} variant="light" onClick={() => startBlank(p.key)}>
                    {p.role}: {p.label}
                  </Button>
                ))}
              </Group>
              <Group mt="sm" gap="xs">
                <Button leftSection={<IconPlus size={16} />} onClick={() => startBlank('blank')}>
                  Start from blank
                </Button>
                <Button variant="default" onClick={() => startBlank('shift')}>
                  Start from Shift Report
                </Button>
                {onUseSystem ? (
                  <Button variant="subtle" leftSection={<IconFileAnalytics size={16} />} onClick={onUseSystem}>
                    Use system templates
                  </Button>
                ) : null}
              </Group>
            </Stack>
          </Group>
        </Paper>

        {customTemplates.length > 0 ? (
          <Paper withBorder p="md" radius="md">
            <Text fw={600} mb="sm">
              Your custom templates
            </Text>
            <Stack gap={6}>
              {customTemplates.map((t) => (
                <Group key={t.id} justify="space-between">
                  <UnstyledButton onClick={() => void loadTemplate(t.id)}>
                    <Text size="sm" fw={500}>
                      {t.name}
                    </Text>
                  </UnstyledButton>
                  <Button size="compact-xs" variant="light" onClick={() => void loadTemplate(t.id)}>
                    Edit
                  </Button>
                </Group>
              ))}
            </Stack>
          </Paper>
        ) : null}

        {systemTemplates.length > 0 ? (
          <Paper withBorder p="md" radius="md">
            <Text fw={600} mb="xs">
              Fork a system template
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Copies the proven section layout into an editable Custom template.
            </Text>
            <Group gap="xs">
              {systemTemplates.map((t) => (
                <Button
                  key={t.id}
                  size="xs"
                  variant="default"
                  leftSection={<IconCopy size={14} />}
                  loading={busy}
                  onClick={() => void forkSystem(t.id)}
                >
                  {t.name}
                </Button>
              ))}
            </Group>
          </Paper>
        ) : null}
      </Stack>
    )
  }

  return (
    <Stack gap="sm" style={{ minHeight: 'calc(100vh - 180px)' }}>
      <Paper withBorder p="xs" radius="md">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Group gap="xs">
            <TextInput
              size="xs"
              placeholder="Template name"
              value={name}
              onChange={(e) => {
                setName(e.currentTarget.value)
                markDirty()
              }}
              style={{ width: 200 }}
            />
            <Select
              size="xs"
              placeholder="Load custom…"
              clearable
              searchable
              data={customTemplates.map((t) => ({ value: t.id, label: t.name }))}
              value={templateId}
              onChange={(v) => {
                if (v) void loadTemplate(v)
              }}
              style={{ width: 180 }}
            />
            <Menu shadow="md" width={260}>
              <Menu.Target>
                <Button size="xs" variant="default" leftSection={<IconPlus size={14} />}>
                  New
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>By role</Menu.Label>
                {rolePresets.map((p) => (
                  <Menu.Item key={p.key} onClick={() => startBlank(p.key)}>
                    {p.role} · {p.label}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                <Menu.Label>Layouts</Menu.Label>
                {otherPresets.map((p) => (
                  <Menu.Item key={p.key} onClick={() => startBlank(p.key)}>
                    {p.label}
                  </Menu.Item>
                ))}
                <Menu.Divider />
                {systemTemplates.map((t) => (
                  <Menu.Item key={t.id} leftSection={<IconCopy size={14} />} onClick={() => void forkSystem(t.id)}>
                    Fork {t.name}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            {dirty ? (
              <Badge color="yellow" variant="light" size="sm">
                Unsaved
              </Badge>
            ) : templateId ? (
              <Badge color="green" variant="light" size="sm">
                Saved
              </Badge>
            ) : null}
          </Group>
          <Group gap={4}>
            <Tooltip label="Undo">
              <ActionIcon variant="subtle" disabled={!canUndo} onClick={undo}>
                <IconArrowBackUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Redo">
              <ActionIcon variant="subtle" disabled={!canRedo} onClick={redo}>
                <IconArrowForwardUp size={16} />
              </ActionIcon>
            </Tooltip>
            <Button
              size="xs"
              variant={showPreview ? 'light' : 'default'}
              leftSection={<IconEye size={14} />}
              onClick={() => setShowPreview((v) => !v)}
            >
              Preview
            </Button>
            <Button size="xs" leftSection={<IconDeviceFloppy size={14} />} loading={busy} onClick={() => void save()}>
              Save
            </Button>
            {templateId ? (
              <ActionIcon color="red" variant="subtle" onClick={() => void removeTemplate()} disabled={busy}>
                <IconTrash size={16} />
              </ActionIcon>
            ) : null}
          </Group>
        </Group>
      </Paper>

      <Group align="stretch" gap="sm" wrap="nowrap" style={{ flex: 1, minHeight: 520 }}>
        {/* Palette gallery */}
        <Paper withBorder p="sm" radius="md" style={{ width: 220, flexShrink: 0 }}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
            Blocks
          </Text>
          <ScrollArea h="100%" offsetScrollbars>
            <Stack gap="md">
              {CATEGORY_ORDER.map((cat) => (
                <Stack key={cat} gap={8}>
                  <Text size="xs" fw={600}>
                    {cat}
                  </Text>
                  {byCategory[cat].map((item) => (
                    <UnstyledButton
                      key={item.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND_PALETTE, item.type)
                        e.dataTransfer.setData('text/plain', item.type)
                        e.dataTransfer.effectAllowed = 'copy'
                      }}
                      onClick={() => addBlock(item.type)}
                      style={{
                        border: '1px solid var(--mantine-color-default-border)',
                        borderRadius: 8,
                        padding: 6,
                        textAlign: 'left',
                        background: 'var(--mantine-color-body)',
                      }}
                    >
                      <ReportBlockPalettePreview type={item.type} />
                      <Text size="xs" fw={600} mt={6}>
                        {item.label}
                      </Text>
                      <Text size="10px" c="dimmed" lineClamp={2}>
                        {item.description}
                      </Text>
                    </UnstyledButton>
                  ))}
                </Stack>
              ))}
            </Stack>
          </ScrollArea>
        </Paper>

        {/* A4 canvas */}
        <Paper
          withBorder
          radius="md"
          style={{
            flex: 1,
            minWidth: 280,
            background: 'var(--mantine-color-gray-1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box px="sm" py={6} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Text size="xs" c="dimmed">
              A4 page flow · drag to reorder · {blocks.length} block{blocks.length === 1 ? '' : 's'}
            </Text>
          </Box>
          <ScrollArea style={{ flex: 1 }} p="md">
            <Box
              mx="auto"
              onDragOver={(e) => {
                if (blocks.length === 0) onCanvasDragOver(e, 0)
              }}
              onDrop={(e) => {
                if (blocks.length === 0) onCanvasDrop(e, 0)
              }}
              style={{
                width: 'min(100%, 440px)',
                minHeight: 594,
                background: 'white',
                boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
                borderRadius: 2,
                padding: 16,
              }}
            >
              {blocks.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" mt="xl">
                  Drop blocks here from the palette
                </Text>
              ) : (
                <Stack gap={10}>
                  {blocks.map((block, index) => {
                    const isSel = block.id === selectedId
                    const meta = catalogItem(block.type)
                    return (
                      <Box key={block.id}>
                        {dropIndex === index ? (
                          <Box
                            mb={6}
                            style={{
                              height: 3,
                              background: 'var(--mantine-color-blue-5)',
                              borderRadius: 2,
                            }}
                          />
                        ) : null}
                        <Box
                          draggable
                          onDragStart={(e) => {
                            dragIdRef.current = block.id
                            e.dataTransfer.setData(DND_BLOCK, block.id)
                            e.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            dragIdRef.current = null
                            setDropIndex(null)
                          }}
                          onDragOver={(e) => onCanvasDragOver(e, index)}
                          onDrop={(e) => onCanvasDrop(e, index)}
                          onClick={() => setSelectedId(block.id)}
                          style={{
                            border: isSel
                              ? '2px solid var(--mantine-color-blue-5)'
                              : '1px solid var(--mantine-color-gray-3)',
                            borderRadius: 8,
                            padding: 10,
                            background: '#fff',
                            cursor: 'grab',
                            boxShadow: isSel ? '0 0 0 1px var(--mantine-color-blue-1)' : undefined,
                          }}
                        >
                          <Group justify="space-between" gap={4} mb={8} wrap="nowrap">
                            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                              <IconGripVertical size={14} color="var(--mantine-color-dimmed)" />
                              <Badge size="xs" color={meta?.tint ?? 'blue'} variant="light">
                                {meta?.label ?? block.type}
                              </Badge>
                            </Group>
                            <Group gap={2} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                disabled={index === 0}
                                onClick={() => moveBlock(block.id, -1)}
                              >
                                <IconArrowUp size={12} />
                              </ActionIcon>
                              <ActionIcon
                                size="xs"
                                variant="subtle"
                                disabled={index === blocks.length - 1}
                                onClick={() => moveBlock(block.id, 1)}
                              >
                                <IconArrowDown size={12} />
                              </ActionIcon>
                              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => removeBlock(block.id)}>
                                <IconTrash size={12} />
                              </ActionIcon>
                            </Group>
                          </Group>
                          <ReportBlockPreview block={block} />
                        </Box>
                      </Box>
                    )
                  })}
                  <Box
                    onDragOver={(e) => onCanvasDragOver(e, blocks.length)}
                    onDrop={(e) => onCanvasDrop(e, blocks.length)}
                    style={{
                      minHeight: 28,
                      border:
                        dropIndex === blocks.length
                          ? '2px dashed var(--mantine-color-blue-5)'
                          : '2px dashed transparent',
                      borderRadius: 6,
                    }}
                  />
                </Stack>
              )}
            </Box>
          </ScrollArea>
        </Paper>

        {/* Properties */}
        <Paper withBorder p="sm" radius="md" style={{ width: 230, flexShrink: 0 }}>
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb="xs">
            Properties
          </Text>
          {!selected ? (
            <Text size="sm" c="dimmed">
              Select a block on the canvas
            </Text>
          ) : (
            <Stack gap="sm">
              <Text size="xs" c="dimmed">
                {catalogItem(selected.type)?.label ?? selected.type}
              </Text>
              {selected.type !== 'page-break' ? (
                <TextInput
                  label="Title"
                  size="xs"
                  value={selected.title ?? ''}
                  onChange={(e) => updateSelected({ title: e.currentTarget.value })}
                />
              ) : null}
              {selected.type === 'rich-text' ? (
                <Textarea
                  label="Text"
                  size="xs"
                  minRows={4}
                  value={optionString(selected, 'text')}
                  onChange={(e) => patchSelectedOption('text', e.currentTarget.value)}
                />
              ) : null}
              {selected.type === 'kpi-hero' || selected.type === 'apq-bars' ? (
                <Switch
                  size="xs"
                  label="Show sparklines"
                  checked={optionBool(selected, 'showSparklines', true)}
                  onChange={(e) => patchSelectedOption('showSparklines', e.currentTarget.checked)}
                />
              ) : null}
              {selected.type === 'kpi-hero' ? (
                <Switch
                  size="xs"
                  label="Include secondary metrics"
                  checked={optionBool(selected, 'includeSecondary', true)}
                  onChange={(e) => patchSelectedOption('includeSecondary', e.currentTarget.checked)}
                />
              ) : null}
              {isTableBlock(selected.type) ? (
                <>
                  <NumberInput
                    label="Max rows"
                    size="xs"
                    min={1}
                    max={100}
                    value={optionNumber(selected, 'maxRows', 20)}
                    onChange={(v) => patchSelectedOption('maxRows', typeof v === 'number' ? v : 20)}
                  />
                  <Switch
                    size="xs"
                    label="Show if empty"
                    checked={optionBool(selected, 'showIfEmpty', false)}
                    onChange={(e) => patchSelectedOption('showIfEmpty', e.currentTarget.checked)}
                  />
                </>
              ) : null}
              <Divider />
              <Group gap={4}>
                <Button size="compact-xs" variant="light" onClick={() => moveBlock(selected.id, -1)}>
                  Move up
                </Button>
                <Button size="compact-xs" variant="light" onClick={() => moveBlock(selected.id, 1)}>
                  Move down
                </Button>
              </Group>
              <Button size="xs" color="red" variant="light" onClick={() => removeBlock(selected.id)}>
                Remove block
              </Button>
            </Stack>
          )}
          <Divider my="md" />
          <TextInput
            label="Description"
            size="xs"
            value={description}
            onChange={(e) => {
              setDescription(e.currentTarget.value)
              markDirty()
            }}
          />
          <Divider my="md" />
          <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={4}>
            Branding
          </Text>
          <Text size="xs" c="dimmed">
            PDFs use the ConnectOEE accent and plant logo from the preview scope.
          </Text>
        </Paper>

        {showPreview ? (
          <Paper withBorder radius="md" style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
            <Box px="sm" py={6} style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              <Group justify="space-between" gap={4}>
                <Text size="xs" fw={600}>
                  PDF preview
                </Text>
                {previewLoading ? (
                  <Badge size="xs" color="blue" variant="light">
                    Updating…
                  </Badge>
                ) : null}
              </Group>
              <Select
                size="xs"
                mt={6}
                placeholder="Scope"
                data={scopes.map((s) => ({ value: s.value, label: s.label }))}
                value={previewScope}
                onChange={setPreviewScope}
              />
              {!templateId ? (
                <Text size="10px" c="dimmed" mt={4}>
                  Save the template once to enable live preview.
                </Text>
              ) : dirty ? (
                <Text size="10px" c="dimmed" mt={4}>
                  Saving changes…
                </Text>
              ) : null}
            </Box>
            <Box style={{ flex: 1, minHeight: 400, background: '#525659' }}>
              {previewError ? (
                <Text size="xs" c="red" p="sm">
                  {previewError}
                </Text>
              ) : previewBlobUrl ? (
                <iframe
                  title="Report PDF preview"
                  src={previewBlobUrl}
                  style={{ width: '100%', height: '100%', border: 0 }}
                />
              ) : (
                <Text size="xs" c="gray.4" ta="center" mt="xl" px="sm">
                  Preview appears after save
                </Text>
              )}
            </Box>
          </Paper>
        ) : null}
      </Group>
    </Stack>
  )
}
