import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActionIcon, Card, Group, Stack, Text } from '@mantine/core'
import { IconCopy, IconTrash } from '@tabler/icons-react'
import ReactGridLayout, { type Layout } from 'react-grid-layout/legacy'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import type { Dashboard, DashboardWidget } from '../../lib/dashboards'
import { DashboardRenderer } from '../../components/DashboardRenderer'
import { resolveWidget } from '../../components/widgets/registry'
import type { WidgetCtx } from '../../components/widgets/common'
import { GRID_COLS, GRID_MARGIN, GRID_ROW_HEIGHT } from './gridConstants'
import { DISPLAY_PROFILES, exceedsProfile, type DisplayProfileId } from './displayProfiles'
import { dashboardMaxRow, profileContentHeight } from './viewportGrid'
import { builderGridBackground, gridRowStridePx, pointerToGridCell } from './gridCoords'
import { PALETTE_DRAG_MIME, applyLayout, widgetsToLayout } from './widgetFactory'
import { widgetMetaByType } from '../../components/widgets/registry'

interface BuilderCanvasProps {
  widgets: DashboardWidget[]
  selectedId: string | null
  previewMode: boolean
  displayProfile: DisplayProfileId
  fullWidgetDrag: boolean
  ctx: WidgetCtx
  dashboardPreview: Dashboard
  onSelect: (id: string | null) => void
  onLayoutChange: (widgets: DashboardWidget[], recordHistory: boolean) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  onAddAt: (type: string, x: number, y: number) => void
}

export function BuilderCanvas({
  widgets,
  selectedId,
  previewMode,
  displayProfile,
  fullWidgetDrag,
  ctx,
  dashboardPreview,
  onSelect,
  onLayoutChange,
  onRemove,
  onDuplicate,
  onAddAt,
}: BuilderCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const widthRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const [droppingItem, setDroppingItem] = useState({ i: '__drop__', x: 0, y: 0, w: 3, h: 2 })

  useEffect(() => {
    const el = widthRef.current ?? scrollRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [previewMode])

  const layout = useMemo(() => widgetsToLayout(widgets), [widgets])
  const rowStride = gridRowStridePx()
  const maxRow = dashboardMaxRow(widgets)
  const gridMinHeight = Math.max(8, maxRow) * rowStride
  const profile = DISPLAY_PROFILES[displayProfile]
  const budgetRow = profile.maxRows
  const wallFrameHeight =
    budgetRow !== null ? budgetRow * GRID_ROW_HEIGHT + (budgetRow - 1) * GRID_MARGIN[1] : null
  const overBudget = budgetRow !== null && exceedsProfile(maxRow, displayProfile)
  const previewFrameHeight = profileContentHeight(displayProfile)

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

  const handleDrop = useCallback(
    (_layout: Layout, item: { x: number; y: number } | undefined, e: Event) => {
      const type = (e as DragEvent).dataTransfer?.getData(PALETTE_DRAG_MIME)
      if (!type || !item) return
      onAddAt(type, item.x, item.y)
    },
    [onAddAt],
  )

  const handleDropDragOver = useCallback(
    (e: React.DragEvent) => {
      const type = e.dataTransfer.getData(PALETTE_DRAG_MIME) || undefined
      if (!type && !e.dataTransfer.types.includes(PALETTE_DRAG_MIME)) {
        const hasMime = [...e.dataTransfer.types].some((t) => t === PALETTE_DRAG_MIME)
        if (!hasMime) return false
      }
      const meta = widgetMetaByType[type ?? '']
      const w = meta?.defaultW ?? 3
      const h = meta?.defaultH ?? 2
      const scrollEl = scrollRef.current
      const rect = scrollEl?.getBoundingClientRect()
      if (rect) {
        const { x, y } = pointerToGridCell(
          e.clientX,
          e.clientY,
          rect,
          { width },
          w,
          h,
          scrollEl?.scrollLeft ?? 0,
          scrollEl?.scrollTop ?? 0,
        )
        setDroppingItem({ i: '__drop__', x, y, w, h })
      } else {
        setDroppingItem((prev) => ({ ...prev, w, h }))
      }
      return { w, h }
    },
    [width],
  )

  return (
    <Card
      withBorder
      padding="xs"
      style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}
    >
      <div
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}
        onPointerDown={(e) => {
          if (e.target === e.currentTarget) onSelect(null)
        }}
      >
        {previewMode ? (
          <div
            style={{
              padding: 8,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              minHeight: previewFrameHeight + 16,
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 960,
                aspectRatio: '16 / 9',
                height: previewFrameHeight,
                border: '1px solid var(--mantine-color-default-border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'var(--mantine-color-body)',
              }}
            >
              <DashboardRenderer
                dashboard={dashboardPreview}
                displayMode="wallFit"
                wallProfile={displayProfile === 'builderFreeform' ? 'plantWall' : displayProfile}
                containerHeight={previewFrameHeight}
                mockCtx={ctx}
              />
            </div>
          </div>
        ) : (
          <>
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
                  {overBudget ? (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: wallFrameHeight + 2,
                        bottom: 0,
                        background: 'color-mix(in srgb, var(--mantine-color-red-5) 8%, transparent)',
                        pointerEvents: 'none',
                        zIndex: 1,
                      }}
                    />
                  ) : null}
                </>
              ) : null}
              <ReactGridLayout
                width={width}
                cols={GRID_COLS}
                rowHeight={GRID_ROW_HEIGHT}
                margin={GRID_MARGIN}
                containerPadding={[0, 0]}
                layout={layout}
                compactType="vertical"
                preventCollision
                isDroppable
                droppingItem={droppingItem}
                onLayoutChange={handleLayoutChange}
                onDragStop={commitLayout}
                onResizeStop={commitLayout}
                onDrop={handleDrop}
                onDropDragOver={handleDropDragOver}
                draggableHandle={fullWidgetDrag ? undefined : '.widget-drag-handle'}
                style={{
                  minHeight: gridMinHeight,
                  background: widgets.length === 0 ? builderGridBackground(width) : undefined,
                  borderRadius: widgets.length === 0 ? 12 : undefined,
                  margin: widgets.length === 0 ? 4 : undefined,
                  border: widgets.length === 0 ? '2px dashed var(--mantine-color-default-border)' : undefined,
                }}
              >
                {widgets.map((w) => {
                  const Widget = resolveWidget(w.type)
                  const isSel = w.id === selectedId
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
                        if (!fullWidgetDrag) e.stopPropagation()
                        onSelect(w.id)
                      }}
                      style={{
                        outline: isSel ? '2px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-default-border)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: 'var(--mantine-color-body)',
                        cursor: fullWidgetDrag ? 'grab' : undefined,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <Group
                        className="widget-drag-handle"
                        justify="space-between"
                        gap={4}
                        px={6}
                        wrap="nowrap"
                        style={{
                          height: fullWidgetDrag ? 28 : 24,
                          minHeight: fullWidgetDrag ? 28 : 24,
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
                      <div
                        style={{
                          flex: 1,
                          minHeight: 0,
                          pointerEvents: fullWidgetDrag ? 'none' : 'none',
                          overflow: 'hidden',
                        }}
                      >
                        <Widget widget={w} ctx={ctx} />
                      </div>
                    </div>
                  )
                })}
              </ReactGridLayout>
            </div>
            {widgets.length === 0 ? (
              <Stack
                align="center"
                justify="center"
                gap="xs"
                style={{
                  position: 'absolute',
                  inset: 4,
                  pointerEvents: 'none',
                  minHeight: 360,
                }}
              >
                <Text fw={600} size="sm">
                  Drag widgets here
                </Text>
                <Text size="xs" c="dimmed" ta="center" maw={320}>
                  Pick a widget from the palette and drop it on the grid, or click a widget to add it below.
                </Text>
              </Stack>
            ) : null}
          </>
        )}
      </div>
    </Card>
  )
}
