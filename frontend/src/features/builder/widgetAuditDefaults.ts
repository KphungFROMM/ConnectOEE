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
