import type { DashboardWidget } from './dashboards'

export const NEST_HOST_TYPES = new Set(['container-panel', 'tabbed-panel'])

export function isNestHostType(type: string): boolean {
  return NEST_HOST_TYPES.has(type)
}

export function isRootWidget(w: DashboardWidget): boolean {
  return !w.parentId
}

export function rootWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  const ids = new Set(widgets.map((w) => w.id))
  return widgets.filter((w) => !w.parentId || !ids.has(w.parentId))
}

export function childrenOf(
  widgets: DashboardWidget[],
  parentId: string,
  tabKey?: string | null,
): DashboardWidget[] {
  return widgets
    .filter((w) => w.parentId === parentId && (tabKey == null || (w.tabKey ?? '0') === tabKey))
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

/** Remove widget and all descendants (one nesting level). */
export function cascadeRemove(widgets: DashboardWidget[], id: string): DashboardWidget[] {
  const remove = new Set<string>([id])
  for (const w of widgets) {
    if (w.parentId && remove.has(w.parentId)) remove.add(w.id)
  }
  return widgets.filter((w) => !remove.has(w.id))
}

export function dashboardMaxRowForRoots(widgets: DashboardWidget[]): number {
  const roots = rootWidgets(widgets)
  if (roots.length === 0) return 1
  return Math.max(1, ...roots.map((w) => w.y + w.h))
}
