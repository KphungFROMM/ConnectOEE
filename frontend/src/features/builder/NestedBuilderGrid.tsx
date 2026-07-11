import { useMemo } from 'react'
import ReactGridLayout, { type Layout } from 'react-grid-layout/legacy'
import { ActionIcon, Group, Text } from '@mantine/core'
import { IconCopy, IconTrash } from '@tabler/icons-react'
import type { DashboardWidget } from '../../lib/dashboards'
import { childrenOf } from '../../lib/widgetNesting'
import { resolveWidget } from '../../components/widgets/registry'
import type { WidgetCtx } from '../../components/widgets/common'
import { GRID_COLS, GRID_MARGIN } from './gridConstants'
import { applyLayout, widgetsToLayout } from './widgetFactory'

export function NestedBuilderGrid({
  parentId,
  tabKey,
  widgets,
  ctx,
  selectedId,
  onSelect,
  onLayoutChange,
  onRemove,
  onDuplicate,
  width,
  rowHeight,
}: {
  parentId: string
  tabKey?: string | null
  widgets: DashboardWidget[]
  ctx: WidgetCtx
  selectedId: string | null
  onSelect: (id: string) => void
  onLayoutChange: (next: DashboardWidget[], recordHistory: boolean) => void
  onRemove: (id: string) => void
  onDuplicate: (id: string) => void
  width: number
  rowHeight: number
}) {
  const kids = useMemo(() => childrenOf(widgets, parentId, tabKey ?? undefined), [widgets, parentId, tabKey])
  const layout = useMemo(() => widgetsToLayout(kids), [kids])

  const handleChange = (nextLayout: Layout, record: boolean) => {
    onLayoutChange(applyLayout(widgets, nextLayout as { i: string; x: number; y: number; w: number; h: number }[]), record)
  }

  if (kids.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 56,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px dashed var(--mantine-color-blue-4)',
          borderRadius: 8,
          fontSize: 12,
          color: 'var(--mantine-color-dimmed)',
          background: 'color-mix(in srgb, var(--mantine-color-blue-1) 35%, transparent)',
        }}
      >
        Drop widgets here (nest target selected)
      </div>
    )
  }

  return (
    <ReactGridLayout
      width={Math.max(120, width)}
      cols={GRID_COLS}
      rowHeight={Math.max(36, Math.round(rowHeight * 0.75))}
      margin={[6, 6]}
      containerPadding={[0, 0]}
      layout={layout}
      compactType="vertical"
      preventCollision
      isDroppable={false}
      onLayoutChange={(l) => handleChange(l, false)}
      onDragStop={(l) => handleChange(l, true)}
      onResizeStop={(l) => handleChange(l, true)}
      draggableHandle=".nested-drag-handle"
      style={{ minHeight: 56 }}
    >
      {kids.map((w) => {
        const Widget = resolveWidget(w.type)
        const isSel = w.id === selectedId
        return (
          <div
            key={w.id}
            data-grid={{ x: w.x, y: w.y, w: w.w, h: w.h, minW: 1, minH: 1 }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onSelect(w.id)
            }}
            style={{
              outline: isSel ? '2px solid var(--mantine-color-blue-6)' : '1px solid var(--mantine-color-default-border)',
              borderRadius: 6,
              overflow: 'hidden',
              background: 'var(--mantine-color-body)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Group
              className="nested-drag-handle"
              justify="space-between"
              gap={2}
              px={4}
              wrap="nowrap"
              style={{ height: 20, flexShrink: 0, cursor: 'grab', background: 'var(--mantine-color-default-hover)' }}
            >
              <Text size="10px" truncate fw={600} c="dimmed" style={{ flex: 1 }}>
                {w.title || w.type}
              </Text>
              <ActionIcon size="xs" variant="subtle" onClick={() => onDuplicate(w.id)} aria-label="Duplicate">
                <IconCopy size={11} />
              </ActionIcon>
              <ActionIcon size="xs" variant="subtle" color="red" onClick={() => onRemove(w.id)} aria-label="Remove">
                <IconTrash size={11} />
              </ActionIcon>
            </Group>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <Widget widget={w} ctx={ctx} />
            </div>
          </div>
        )
      })}
    </ReactGridLayout>
  )
}

// silence unused GRID_MARGIN if tree-shaken oddly
void GRID_MARGIN
