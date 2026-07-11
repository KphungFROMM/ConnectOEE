import { widgetCatalog } from '../../components/widgets/registry'
import type { DashboardWidget } from '../../lib/dashboards'
import { createWidget } from './widgetFactory'
import { MOCK_LINE_ID, MOCK_MACHINE_ID, MOCK_PLANT_ID } from './mockWidgetCtx'

const auditCtx = {
  lineId: MOCK_LINE_ID,
  machineId: MOCK_MACHINE_ID,
  plantId: MOCK_PLANT_ID,
}

/** Build a dashboard widget instance for audit gallery at catalog default size. */
export function createAuditWidget(type: string, index: number): DashboardWidget {
  const w = createWidget(type, auditCtx, { x: 0, y: index * 10 })
  return { ...w, id: `audit-${type}`, title: w.title ?? type }
}

/** Demo nested children so container/tab cards show real nesting in the gallery. */
export function createAuditNestTree(parent: DashboardWidget): DashboardWidget[] {
  if (parent.type === 'container-panel') {
    const a = createWidget('kpi-tile', auditCtx, { x: 0, y: 0 })
    a.id = `${parent.id}-child-kpi`
    a.parentId = parent.id
    a.w = 6
    a.h = 2
    a.title = 'OEE'
    const b = createWidget('status-light', auditCtx, { x: 6, y: 0 })
    b.id = `${parent.id}-child-status`
    b.parentId = parent.id
    b.w = 6
    b.h = 2
    return [parent, a, b]
  }
  if (parent.type === 'tabbed-panel') {
    const a = createWidget('count-tile', auditCtx, { x: 0, y: 0 })
    a.id = `${parent.id}-tab0`
    a.parentId = parent.id
    a.tabKey = '0'
    a.w = 6
    a.h = 2
    const b = createWidget('scrap-tile', auditCtx, { x: 0, y: 0 })
    b.id = `${parent.id}-tab1`
    b.parentId = parent.id
    b.tabKey = '1'
    b.w = 6
    b.h = 2
    return [parent, a, b]
  }
  return [parent]
}

export function allAuditWidgets(): DashboardWidget[] {
  return widgetCatalog.map((meta, i) => createAuditWidget(meta.type, i))
}

export const widgetCatalogByCategory = () => {
  const map = new Map<string, typeof widgetCatalog>()
  for (const item of widgetCatalog) {
    const list = map.get(item.category) ?? []
    list.push(item)
    map.set(item.category, list)
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
}
