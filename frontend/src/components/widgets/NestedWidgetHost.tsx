import { createContext, useContext, type ReactNode } from 'react'
import type { DashboardWidget } from '../../lib/dashboards'
import { childrenOf } from '../../lib/widgetNesting'
import { resolveWidget } from './registry'
import type { WidgetCtx } from './common'
import { GRID_COLS, GRID_GAP, GRID_ROW_HEIGHT } from '../../features/builder/gridConstants'

export type DashboardWidgetTreeValue = {
  widgets: DashboardWidget[]
  /** When set, nested hosts use this row height (viewer wallFit). */
  rowHeight?: number
  gridGap?: number
}

const DashboardWidgetTreeContext = createContext<DashboardWidgetTreeValue>({ widgets: [] })

export function DashboardWidgetTreeProvider({
  widgets,
  rowHeight,
  gridGap,
  children,
}: DashboardWidgetTreeValue & { children: ReactNode }) {
  return (
    <DashboardWidgetTreeContext.Provider value={{ widgets, rowHeight, gridGap }}>
      {children}
    </DashboardWidgetTreeContext.Provider>
  )
}

export function useDashboardWidgetTree() {
  return useContext(DashboardWidgetTreeContext)
}

/** CSS-grid host for nested children (viewer / gallery / builder preview). */
export function NestedWidgetHost({
  parentId,
  tabKey,
  ctx,
  emptyHint,
}: {
  parentId: string
  tabKey?: string | null
  ctx: WidgetCtx
  emptyHint?: string
}) {
  const { widgets, rowHeight = GRID_ROW_HEIGHT, gridGap = GRID_GAP } = useDashboardWidgetTree()
  const kids = childrenOf(widgets, parentId, tabKey ?? undefined)

  if (kids.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: 48,
          border: '1px dashed var(--mantine-color-default-border)',
          borderRadius: 8,
          color: 'var(--mantine-color-dimmed)',
          fontSize: 12,
          padding: 8,
          textAlign: 'center',
        }}
      >
        {emptyHint ?? 'Drop widgets here in the builder'}
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridAutoRows: `${Math.max(40, Math.round(rowHeight * 0.85))}px`,
        gap: Math.max(6, gridGap - 2),
        height: '100%',
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      {kids.map((w) => {
        const Widget = resolveWidget(w.type)
        return (
          <div
            key={w.id}
            style={{
              gridColumn: `${w.x + 1} / span ${Math.min(w.w, GRID_COLS)}`,
              gridRow: `${w.y + 1} / span ${w.h}`,
              minWidth: 0,
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Widget widget={w} ctx={ctx} />
          </div>
        )
      })}
    </div>
  )
}
