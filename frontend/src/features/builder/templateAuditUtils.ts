import type { Dashboard, DashboardTemplate, DashboardWidget, SaveWidget } from '../../lib/dashboards'
import { getTemplateMeta } from './systemTemplateMeta'
import { MOCK_LINE_ID, MOCK_MACHINE_ID, MOCK_PLANT_ID } from './mockWidgetCtx'

export function parseTemplateLayout(layoutJson: string | null | undefined): SaveWidget[] {
  if (!layoutJson) return []
  try {
    return JSON.parse(layoutJson) as SaveWidget[]
  } catch {
    return []
  }
}

export function templateToPreviewDashboard(template: DashboardTemplate): Dashboard {
  const seeds = parseTemplateLayout(template.layoutJson)
  const meta = getTemplateMeta(template.name)
  const scope = template.category === 'Kiosk' ? 'PublicKiosk' : 'Private'
  const widgets: DashboardWidget[] = seeds
    .filter((w) => w.type !== 'text-label')
    .map((w, i) => ({
      id: `${template.id}-${i}`,
      type: w.type,
      title: w.title ?? null,
      x: w.x,
      y: w.y,
      w: w.w,
      h: w.h,
      binding: w.binding ?? {},
      options: w.options ?? {},
    }))

  const plantId = meta?.scope === 'plant' ? MOCK_PLANT_ID : MOCK_PLANT_ID
  const lineId = meta?.scope === 'line' || template.category === 'Kiosk' ? MOCK_LINE_ID : meta?.scope === 'plant' ? null : MOCK_LINE_ID
  const machineId = meta?.scope === 'machine' ? MOCK_MACHINE_ID : null

  return {
    id: template.id,
    name: template.name,
    scope,
    isPublished: scope === 'PublicKiosk',
    version: 1,
    plantId,
    lineId,
    machineId,
    widgets,
  }
}
