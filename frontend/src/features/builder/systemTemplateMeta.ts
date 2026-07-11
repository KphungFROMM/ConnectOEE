export type TemplateScope = 'plant' | 'line' | 'machine'
export type TemplateRole = 'Operator' | 'Supervisor' | 'Executive' | 'Maintenance' | 'Quality' | 'Engineer' | 'CI'

export interface SystemTemplateMeta {
  name: string
  slug: string
  previewPath: string
  roles: TemplateRole[]
  scope: TemplateScope
  recommended: boolean
  widgetCount: number
  bestFor: string
  /** Meeting / use-case purpose for gallery filters */
  purpose: string
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const META: Omit<SystemTemplateMeta, 'slug' | 'previewPath'>[] = [
  {
    name: 'Operator Floor',
    roles: ['Operator'],
    scope: 'machine',
    recommended: true,
    widgetCount: 12,
    bestFor: 'Touch-friendly operator wall — OEE, pace, downtime entry from 10 ft',
    purpose: 'Operator kiosk',
  },
  {
    name: 'Line Andon',
    roles: ['Operator', 'Supervisor'],
    scope: 'line',
    recommended: true,
    widgetCount: 9,
    bestFor: 'Large-format andon display with supporting OEE',
    purpose: 'Line andon wall',
  },
  {
    name: 'Maintenance Wall',
    roles: ['Maintenance'],
    scope: 'plant',
    recommended: true,
    widgetCount: 10,
    bestFor: 'Maintenance walks — MTTR/MTBF, unassigned stops, reliability',
    purpose: 'Maintenance triage',
  },
  {
    name: 'Plant Overview',
    roles: ['Executive', 'Supervisor'],
    scope: 'plant',
    recommended: true,
    widgetCount: 6,
    bestFor: 'Plant leadership — multi-line status at a glance',
    purpose: 'Leadership review',
  },
  {
    name: 'Shift Supervisor',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: true,
    widgetCount: 9,
    bestFor: 'Shift huddles — progress, losses, reason queue, vs target',
    purpose: 'Shift handover',
  },
  {
    name: 'Quality Pulse',
    roles: ['Quality'],
    scope: 'line',
    recommended: false,
    widgetCount: 7,
    bestFor: 'Quality teams — scrap, yield, FPY, loss pareto',
    purpose: 'Quality huddle',
  },
  {
    name: 'Production Board',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 8,
    bestFor: 'Production floor — pace, counts, product, hourly bars',
    purpose: 'Production floor',
  },
  {
    name: 'Analytics Starter',
    roles: ['CI', 'Engineer', 'Executive'],
    scope: 'plant',
    recommended: false,
    widgetCount: 5,
    bestFor: 'Signed-in analysis — trends, losses, reliability charts',
    purpose: 'Weekly analysis',
  },
]

export const systemTemplateMeta: SystemTemplateMeta[] = META.map((m) => ({
  ...m,
  slug: slugify(m.name),
  previewPath: `/template-previews/${slugify(m.name)}.svg`,
}))

export const systemTemplateMetaByName = new Map(systemTemplateMeta.map((m) => [m.name, m]))

export const recommendedTemplates = systemTemplateMeta.filter((m) => m.recommended)

export function getTemplateMeta(name: string): SystemTemplateMeta | undefined {
  return systemTemplateMetaByName.get(name)
}

export function isPlantScopedTemplateMeta(meta: SystemTemplateMeta | undefined): boolean {
  return meta?.scope === 'plant'
}

export function isMachineScopedTemplateMeta(meta: SystemTemplateMeta | undefined): boolean {
  return meta?.scope === 'machine'
}
