import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ActionIcon, Button, Card, Group, Stack, Text, TextInput, Tooltip } from '@mantine/core'
import { IconCopy, IconPencil, IconTemplate, IconTrash, IconSparkles } from '@tabler/icons-react'
import ReactGridLayout, { type Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Dashboard, DashboardWidget } from '../../lib/dashboards'
import { DashboardRenderer } from '../../components/DashboardRenderer'
import { DashboardWidgetTreeProvider } from '../../components/widgets/NestedWidgetHost'
import { WallDisplayContext } from '../../components/widgets/design/WallDisplayContext'
import {
  PRESENTATION_WIDGET_TYPES,
  STATUS_STYLE_WIDGET_TYPES,
  supportsFrameVariant,
  KPI_COLOR_MODE_OPTIONS,
  type WidgetCtx,
} from '../../components/widgets/common'
import { KPI_PRESENTATION_OPTIONS } from '../../components/widgets/design/PresentationKpi'
import { STATUS_STYLE_OPTIONS } from '../../components/widgets/design/statusStyle'
import type { WidgetFrameVariant } from '../../components/widgets/design/WidgetFrame'
import { resolveWidget, widgetMetaByType } from '../../components/widgets/registry'
import { isNestHostType, rootWidgets } from '../../lib/widgetNesting'
import { GRID_COLS, GRID_MARGIN, GRID_ROW_HEIGHT } from './gridConstants'
import { DISPLAY_PROFILES, exceedsProfile, type DisplayProfileId } from './displayProfiles'
import {
  computeWallRowHeight,
  dashboardMaxRow,
  wallFitRowCount,
  wallStageHeightForWidth,
  WALL_STAGE_MAX_WIDTH,
} from './viewportGrid'
import { builderGridBackground, gridColumnWidthPx, gridRowStridePx, pointerToGridCell } from './gridCoords'
import { PALETTE_DRAG_MIME, applyLayout, widgetsToLayout } from './widgetFactory'
import type { PaletteAddPayload } from './WidgetPalette'
import { BuilderNestEditProvider } from './BuilderNestEditContext'
import { NestedBuilderGrid } from './NestedBuilderGrid'

interface BuilderCanvasProps {
  widgets: DashboardWidget[]
  selectedId: string | null
  previewMode: boolean
  displayProfile: DisplayProfileId
  /** When false, use classic title-bar chrome (power-user mode). */
  immersiveEdit: boolean
  fullWidgetDrag: boolean
  paletteDragType: string | null
  ctx: WidgetCtx
  dashboardPreview: Dashboard
  hasScope: boolean
  onSelect: (id: string | null) => void
  onLayoutChange: (widgets: DashboardWidget[], recordHistory: boolean) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onPatchWidget: (id: string, patch: Partial<DashboardWidget>) => void
  onAddAt: (type: string, x: number, y: number, options?: PaletteAddPayload['options']) => void
  onPaletteDragEnd: () => void
  onOpenTemplates: () => void
  onAddSuggested: () => void
  onBrowseGallery: () => void
}

function dropPreviewStyle(
  x: number,
  y: number,
  w: number,
  h: number,
  canvasWidth: number,
  rowHeight: number,
): CSSProperties {
  const colStride = gridColumnWidthPx(canvasWidth)
  const rowStride = rowHeight + GRID_MARGIN[1]
  const colWidth = colStride - GRID_MARGIN[0]
  return {
    position: 'absolute',
    left: x * colStride,
    top: y * rowStride,
    width: w * colWidth + (w - 1) * GRID_MARGIN[0],
    height: h * rowHeight + (h - 1) * GRID_MARGIN[1],
    border: '2px dashed var(--mantine-color-blue-5)',
    borderRadius: 8,
    background: 'color-mix(in srgb, var(--mantine-color-blue-5) 12%, transparent)',
    pointerEvents: 'none',
    zIndex: 5,
  }
}

export function BuilderCanvas({
  widgets,
  selectedId,
  previewMode,
  displayProfile,
  immersiveEdit,
  fullWidgetDrag,
  paletteDragType,
  ctx,
  dashboardPreview,
  hasScope,
  onSelect,
  onLayoutChange,
  onRemove,
  onDuplicate,
  onPatchWidget,
  onAddAt,
  onPaletteDragEnd,
  onOpenTemplates,
  onAddSuggested,
  onBrowseGallery,
}: BuilderCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [dropPreview, setDropPreview] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null)
  const [activeTabs, setActiveTabs] = useState<Record<string, string>>({})

  const isWallProfile = displayProfile !== 'builderFreeform'
  const profile = DISPLAY_PROFILES[displayProfile]
  const budgetRow = profile.maxRows
  const roots = useMemo(() => rootWidgets(widgets), [widgets])
  const maxRow = useMemo(() => dashboardMaxRow(roots), [roots])
  const wallPreviewProfile: DisplayProfileId =
    displayProfile === 'builderFreeform' ? 'plantWall' : displayProfile

  // Same stage geometry for edit + preview (scaled wall content — no aspectRatio/height fight).
  const stageWidth = isWallProfile ? Math.min(Math.max(width, 1), WALL_STAGE_MAX_WIDTH) : width
  const stageHeight = isWallProfile ? wallStageHeightForWidth(stageWidth, displayProfile) : undefined
  const previewStageHeight = wallStageHeightForWidth(
    isWallProfile ? stageWidth : Math.min(width, WALL_STAGE_MAX_WIDTH),
    wallPreviewProfile,
  )

  const editRowHeight = useMemo(() => {
    if (!isWallProfile || stageHeight == null) return GRID_ROW_HEIGHT
    const rows = wallFitRowCount(maxRow, displayProfile)
    return computeWallRowHeight(rows, displayProfile, stageHeight)
  }, [isWallProfile, stageHeight, displayProfile, maxRow])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const raw = entries[0]?.contentRect.width
      if (!raw || raw <= 0) return
      // Account for the 8px stage padding on each side so edit and preview share one width.
      const next = isWallProfile ? Math.max(1, raw - 16) : raw
      setWidth(next)
    })
    ro.observe(el)
    const raw = el.clientWidth
    setWidth(isWallProfile ? Math.max(1, raw - 16) : raw)
    return () => ro.disconnect()
  }, [previewMode, isWallProfile])

  useEffect(() => {
    if (!paletteDragType) setDropPreview(null)
  }, [paletteDragType])

  const layout = useMemo(() => widgetsToLayout(roots), [roots])
  const rowStride = editRowHeight + GRID_MARGIN[1]
  const gridMinHeight = Math.max(budgetRow ?? 8, maxRow) * rowStride
  const wallFrameHeight = budgetRow !== null ? budgetRow * editRowHeight + (budgetRow - 1) * GRID_MARGIN[1] : null
  const overBudget = budgetRow !== null && exceedsProfile(maxRow, displayProfile)

  const nestEditApi = useMemo(
    () => ({
      getActiveTab: (parentId: string) => activeTabs[parentId] ?? '0',
      setActiveTab: (parentId: string, tabKey: string) =>
        setActiveTabs((prev) => (prev[parentId] === tabKey ? prev : { ...prev, [parentId]: tabKey })),
      renderNestedEdit: (parentId: string, tabKey?: string | null) => (
        <NestedBuilderGrid
          parentId={parentId}
          tabKey={tabKey}
          widgets={widgets}
          ctx={ctx}
          selectedId={selectedId}
          onSelect={onSelect}
          onLayoutChange={onLayoutChange}
          onRemove={onRemove}
          onDuplicate={onDuplicate}
          width={Math.max(160, Math.floor(stageWidth * 0.9))}
          rowHeight={editRowHeight}
        />
      ),
    }),
    [activeTabs, widgets, ctx, selectedId, onSelect, onLayoutChange, onRemove, onDuplicate, stageWidth, editRowHeight],
  )

  const handleLayoutChange = useCallback(
    (nextLayout: Layout) => {
      onLayoutChange(applyLayout(widgets, nextLayout as { i: string; x: number; y: number; w: number; h: number }[]), false)
    },
    [widgets, onLayoutChange],
  )

  const commitLayout = useCallback(
    (nextLayout: Layout) => {
      onLayoutChange(applyLayout(widgets, nextLayout as { i: string; x: number; y: number; w: number; h: number }[]), true)
    },
    [widgets, onLayoutChange],
  )

  const resolveDropType = useCallback(
    (e: React.DragEvent) => {
      const fromMime = e.dataTransfer.getData(PALETTE_DRAG_MIME)
      return fromMime || paletteDragType || null
    },
    [paletteDragType],
  )

  const updateDropPreview = useCallback(
    (e: React.DragEvent, type: string) => {
      const meta = widgetMetaByType[type]
      const w = meta?.defaultW ?? 3
      const h = meta?.defaultH ?? 2
      const scrollEl = scrollRef.current
      const rect = widthRef.current?.getBoundingClientRect() ?? scrollEl?.getBoundingClientRect()
      if (!rect) return
      const { x, y } = pointerToGridCell(
        e.clientX,
        e.clientY,
        rect,
        { width: stageWidth, rowHeight: editRowHeight },
        w,
        h,
        scrollEl?.scrollLeft ?? 0,
        scrollEl?.scrollTop ?? 0,
      )
      setDropPreview({ x, y, w, h })
    },
    [stageWidth, editRowHeight],
  )

  const handleNativeDragOver = useCallback(
    (e: React.DragEvent) => {
      const type = paletteDragType
      const hasMime = [...e.dataTransfer.types].includes(PALETTE_DRAG_MIME)
      if (!type && !hasMime) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      if (type) updateDropPreview(e, type)
    },
    [paletteDragType, updateDropPreview],
  )

  const handleNativeDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const type = resolveDropType(e)
      onPaletteDragEnd()
      setDropPreview(null)
      if (!type) return
      const meta = widgetMetaByType[type]
      const w = meta?.defaultW ?? 3
      const h = meta?.defaultH ?? 2
      const scrollEl = scrollRef.current
      const rect = widthRef.current?.getBoundingClientRect() ?? scrollEl?.getBoundingClientRect()
      if (!rect) {
        onAddAt(type, 0, 0)
        return
      }
      const { x, y } = pointerToGridCell(
        e.clientX,
        e.clientY,
        rect,
        { width: stageWidth, rowHeight: editRowHeight },
        w,
        h,
        scrollEl?.scrollLeft ?? 0,
        scrollEl?.scrollTop ?? 0,
      )
      onAddAt(type, x, y)
    },
    [resolveDropType, onPaletteDragEnd, onAddAt, stageWidth, editRowHeight],
  )

  const handleNativeDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropPreview(null)
    }
  }, [])

  const selected = widgets.find((w) => w.id === selectedId) ?? null

  const gridBody = (
    <WallDisplayContext.Provider value={isWallProfile}>
    <div ref={widthRef} style={{ width: '100%', minHeight: gridMinHeight, position: 'relative' }}>
      {wallFrameHeight !== null ? (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: wallFrameHeight,
              height: 2,
              borderTop: '2px dashed var(--mantine-color-blue-5)',
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
          <Text
            size="10px"
            fw={600}
            c={overBudget ? 'orange' : 'blue'}
            style={{
              position: 'absolute',
              right: 8,
              top: wallFrameHeight + 4,
              zIndex: 3,
              pointerEvents: 'none',
              background: 'var(--mantine-color-body)',
              padding: '1px 6px',
              borderRadius: 4,
              opacity: 0.95,
            }}
          >
            {overBudget
              ? `Over ${profile.label} budget — shrink or remove a widget`
              : `${profile.label} — ${budgetRow} rows`}
          </Text>
          {overBudget ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: wallFrameHeight + 2,
                bottom: 0,
                background: 'color-mix(in srgb, var(--mantine-color-orange-5) 10%, transparent)',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          ) : null}
        </>
      ) : null}
      {dropPreview ? (
        <div
          style={dropPreviewStyle(dropPreview.x, dropPreview.y, dropPreview.w, dropPreview.h, stageWidth, editRowHeight)}
        />
      ) : null}
      <BuilderNestEditProvider value={nestEditApi}>
        <DashboardWidgetTreeProvider widgets={widgets} rowHeight={editRowHeight}>
      <ReactGridLayout
        width={stageWidth}
        cols={GRID_COLS}
        rowHeight={editRowHeight}
        margin={GRID_MARGIN}
        containerPadding={[0, 0]}
        layout={layout}
        compactType="vertical"
        preventCollision
        isDroppable={false}
        onLayoutChange={handleLayoutChange}
        onDragStop={commitLayout}
        onResizeStop={commitLayout}
        draggableHandle={immersiveEdit || fullWidgetDrag ? undefined : '.widget-drag-handle'}
        style={{
          minHeight: gridMinHeight,
          background: widgets.length === 0 ? builderGridBackground(stageWidth) : undefined,
          borderRadius: widgets.length === 0 ? 12 : undefined,
          margin: widgets.length === 0 ? 4 : undefined,
          border: widgets.length === 0 ? '2px dashed var(--mantine-color-default-border)' : undefined,
        }}
      >
        {roots.map((w) => {
          const Widget = resolveWidget(w.type)
          const isSel = w.id === selectedId
          const showChrome = !immersiveEdit
          const nestHost = isNestHostType(w.type)
          return (
            <div
              key={w.id}
              data-grid={{
                x: w.x,
                y: w.y,
                w: w.w,
                h: w.h,
                minW: 1,
                minH: w.h <= 2 && w.w <= 3 ? 2 : 1,
              }}
              onPointerDown={(e) => {
                if (!immersiveEdit && !fullWidgetDrag) e.stopPropagation()
                onSelect(w.id)
              }}
              style={{
                outline: isSel ? '2px solid var(--mantine-color-blue-6)' : '1px solid transparent',
                boxShadow: isSel ? '0 0 0 1px color-mix(in srgb, var(--mantine-color-blue-6) 35%, transparent)' : undefined,
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--mantine-color-body)',
                cursor: immersiveEdit || fullWidgetDrag ? 'grab' : undefined,
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {showChrome ? (
                <Group
                  className="widget-drag-handle"
                  justify="space-between"
                  gap={4}
                  px={6}
                  wrap="nowrap"
                  style={{
                    height: 24,
                    minHeight: 24,
                    flexShrink: 0,
                    cursor: 'grab',
                    background: 'var(--mantine-color-default-hover)',
                  }}
                >
                  <Text size="10px" truncate fw={600} c="dimmed" style={{ flex: 1 }}>
                    {w.title || w.type}
                  </Text>
                  <Group gap={2} wrap="nowrap">
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onDuplicate(w.id)}
                      aria-label="Duplicate widget"
                    >
                      <IconCopy size={12} />
                    </ActionIcon>
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onRemove(w.id)}
                      aria-label="Remove widget"
                    >
                      <IconTrash size={12} />
                    </ActionIcon>
                  </Group>
                </Group>
              ) : null}

              {immersiveEdit && isSel ? (
                <Group
                  gap={4}
                  wrap="nowrap"
                  style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    zIndex: 6,
                    background: 'var(--mantine-color-body)',
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 8,
                    padding: 2,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Tooltip label="Rename">
                    <ActionIcon size="sm" variant="subtle" onClick={() => setEditingTitleId(w.id)} aria-label="Rename">
                      <IconPencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Duplicate">
                    <ActionIcon size="sm" variant="subtle" onClick={() => onDuplicate(w.id)} aria-label="Duplicate">
                      <IconCopy size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove">
                    <ActionIcon size="sm" variant="subtle" color="red" onClick={() => onRemove(w.id)} aria-label="Remove">
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              ) : null}

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  // Nest hosts need pointer events for nested RGL / tabs; other widgets stay chrome-drag friendly.
                  pointerEvents: nestHost ? 'auto' : immersiveEdit || fullWidgetDrag ? 'none' : 'auto',
                  overflow: 'hidden',
                }}
              >
                <Widget widget={w} ctx={ctx} />
              </div>
            </div>
          )
        })}
      </ReactGridLayout>
        </DashboardWidgetTreeProvider>
      </BuilderNestEditProvider>

      {widgets.length === 0 ? (
        <Stack
          align="center"
          justify="center"
          gap="md"
          style={{
            position: 'absolute',
            inset: 4,
            minHeight: 360,
            zIndex: 4,
          }}
        >
          <Stack gap={4} align="center">
            <Text fw={700} size="md">
              Start your board
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              Three ways to get a useful wall in minutes — pick one.
            </Text>
          </Stack>
          <Group gap="sm" justify="center">
            <Button leftSection={<IconTemplate size={16} />} onClick={onOpenTemplates}>
              Use a template
            </Button>
            <Button variant="light" leftSection={<IconSparkles size={16} />} onClick={onAddSuggested}>
              Add suggested widgets
            </Button>
            <Button variant="default" onClick={onBrowseGallery}>
              Browse gallery
            </Button>
          </Group>
        </Stack>
      ) : null}
    </div>
    </WallDisplayContext.Provider>
  )

  return (
    <Card
      withBorder
      padding="xs"
      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      {!hasScope && !previewMode ? (
        <Text size="xs" c="orange.7" mb={6} px={4}>
          Bind a plant or line in the toolbar so widgets get live data.
        </Text>
      ) : null}

      {selected && immersiveEdit && !previewMode ? (
        <Group gap="xs" mb={6} wrap="wrap" px={4}>
          {editingTitleId === selected.id ? (
            <TextInput
              size="xs"
              value={selected.title ?? ''}
              onChange={(e) => onPatchWidget(selected.id, { title: e.currentTarget.value })}
              onBlur={() => setEditingTitleId(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setEditingTitleId(null)
              }}
              autoFocus
              style={{ width: 180 }}
            />
          ) : (
            <Text size="xs" fw={600} style={{ cursor: 'pointer' }} onClick={() => setEditingTitleId(selected.id)}>
              {selected.title || selected.type}
            </Text>
          )}
          {supportsFrameVariant(selected.type) ? (
            <Group gap={4}>
              {(['default', 'compact', 'hero', 'kiosk'] as WidgetFrameVariant[]).map((f) => (
                <Button
                  key={f}
                  size="compact-xs"
                  variant={(selected.options.frameVariant as string) === f || (!(selected.options.frameVariant) && f === 'default') ? 'filled' : 'light'}
                  onClick={() =>
                    onPatchWidget(selected.id, { options: { ...selected.options, frameVariant: f } })
                  }
                >
                  {f}
                </Button>
              ))}
            </Group>
          ) : null}
          {STATUS_STYLE_WIDGET_TYPES.has(selected.type) ? (
            <Group gap={4}>
              {STATUS_STYLE_OPTIONS.map((s) => (
                <Button
                  key={s.value}
                  size="compact-xs"
                  variant={
                    (selected.options.statusStyle as string) === s.value ||
                    (!(selected.options.statusStyle) && s.value === 'beacon')
                      ? 'filled'
                      : 'light'
                  }
                  onClick={() =>
                    onPatchWidget(selected.id, { options: { ...selected.options, statusStyle: s.value } })
                  }
                >
                  {s.label}
                </Button>
              ))}
            </Group>
          ) : null}
          {PRESENTATION_WIDGET_TYPES.has(selected.type) ? (
            <Group gap={4}>
              {KPI_PRESENTATION_OPTIONS.map((p) => (
                <Button
                  key={p.value}
                  size="compact-xs"
                  variant={
                    (selected.options.presentation as string) === p.value ||
                    (!(selected.options.presentation) && p.value === 'number')
                      ? 'filled'
                      : 'light'
                  }
                  onClick={() =>
                    onPatchWidget(selected.id, { options: { ...selected.options, presentation: p.value } })
                  }
                >
                  {p.label}
                </Button>
              ))}
            </Group>
          ) : null}
          {PRESENTATION_WIDGET_TYPES.has(selected.type) ? (
            <Group gap={4}>
              {KPI_COLOR_MODE_OPTIONS.map((c) => (
                <Button
                  key={c.value}
                  size="compact-xs"
                  variant={
                    (selected.options.colorMode as string) === c.value ||
                    (!(selected.options.colorMode) && c.value === 'identity')
                      ? 'filled'
                      : 'light'
                  }
                  onClick={() =>
                    onPatchWidget(selected.id, { options: { ...selected.options, colorMode: c.value } })
                  }
                >
                  {c.label}
                </Button>
              ))}
            </Group>
          ) : null}
        </Group>
      ) : null}

      <div
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null)
        }}
        onDragOver={previewMode ? undefined : handleNativeDragOver}
        onDrop={previewMode ? undefined : handleNativeDrop}
        onDragLeave={previewMode ? undefined : handleNativeDragLeave}
      >
        {previewMode ? (
          <div
            style={{
              padding: 8,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              minHeight: previewStageHeight + 16,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: WALL_STAGE_MAX_WIDTH,
                height: previewStageHeight,
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--mantine-color-body)',
              }}
            >
              <DashboardRenderer
                dashboard={dashboardPreview}
                displayMode="wallFit"
                wallProfile={wallPreviewProfile}
                containerHeight={previewStageHeight}
                mockCtx={ctx}
              />
            </div>
          </div>
        ) : isWallProfile ? (
          <div
            style={{
              padding: 8,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: WALL_STAGE_MAX_WIDTH,
                height: stageHeight,
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 10,
                overflow: 'hidden',
                background: 'var(--mantine-color-body)',
                position: 'relative',
              }}
            >
              {gridBody}
            </div>
          </div>
        ) : (
          gridBody
        )}
      </div>
    </Card>
  )
}
