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
    name: 'Plant Command Center',
    roles: ['Executive', 'Supervisor'],
    scope: 'plant',
    recommended: true,
    widgetCount: 18,
    bestFor: 'Plant managers monitoring all lines at a glance',
  },
  {
    name: 'Executive Briefing',
    roles: ['Executive'],
    scope: 'plant',
    recommended: true,
    widgetCount: 16,
    bestFor: 'Leadership reviews — gap vs target, TEEP, production roll-up',
  },
  {
    name: 'Floor At-a-Glance',
    roles: ['Supervisor'],
    scope: 'plant',
    recommended: false,
    widgetCount: 9,
    bestFor: 'Production floor visibility across every machine',
  },
  {
    name: 'Plant Reliability Hub',
    roles: ['Maintenance'],
    scope: 'plant',
    recommended: false,
    widgetCount: 14,
    bestFor: 'Maintenance managers tracking MTTR, faults, and stops',
  },
  {
    name: 'TEEP & Utilization',
    roles: ['Executive'],
    scope: 'plant',
    recommended: false,
    widgetCount: 12,
    bestFor: 'Ops directors focused on utilization and time balance',
  },
  {
    name: 'Line Performance Board',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: true,
    widgetCount: 17,
    bestFor: 'Line supervisors — OEE hero, attainment, gap cluster, trends',
  },
  {
    name: 'Shift Huddle Board',
    roles: ['Supervisor', 'Operator'],
    scope: 'line',
    recommended: false,
    widgetCount: 14,
    bestFor: 'Shift-start huddles — progress, pace, hourly production',
  },
  {
    name: 'Machine Station Detail',
    roles: ['Engineer'],
    scope: 'machine',
    recommended: false,
    widgetCount: 15,
    bestFor: 'Engineers drilling into one machine — speed, faults, reliability',
  },
  {
    name: 'Production & Pace',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 13,
    bestFor: 'Production analysis — hourly bars, takt, rate variance',
  },
  {
    name: 'Quality & Yield Lab',
    roles: ['Quality'],
    scope: 'line',
    recommended: false,
    widgetCount: 11,
    bestFor: 'Quality teams — scrap, yield, FPY, loss pareto',
  },
  {
    name: 'Downtime Detective',
    roles: ['Supervisor', 'CI'],
    scope: 'line',
    recommended: true,
    widgetCount: 12,
    bestFor: 'CI and supervisors finding top loss drivers',
  },
  {
    name: 'Setup & Changeover',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 10,
    bestFor: 'Setup teams tracking changeover time and state distribution',
  },
  {
    name: 'Supervisor Cockpit',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 13,
    bestFor: 'Active supervision — KPIs, downtime pad, worst lines',
  },
  {
    name: 'Operator Kiosk',
    roles: ['Operator'],
    scope: 'machine',
    recommended: true,
    widgetCount: 7,
    bestFor: 'Touch-friendly operator station — OEE, pace, downtime entry',
  },
  {
    name: 'Line Andon Wall',
    roles: ['Operator', 'Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 8,
    bestFor: 'Large-format andon display readable from 10 feet',
  },
  {
    name: 'Maintenance Wallboard',
    roles: ['Maintenance'],
    scope: 'plant',
    recommended: false,
    widgetCount: 9,
    bestFor: 'Maintenance kiosk — MTTR/MTBF, faults, event feed',
  },
  {
    name: 'Attainment Tracker',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 14,
    bestFor: 'Schedulers tracking run and shift attainment vs target',
  },
  {
    name: 'Shift Compare',
    roles: ['Supervisor'],
    scope: 'line',
    recommended: false,
    widgetCount: 11,
    bestFor: 'Prior-shift review with OEE-by-shift comparison',
  },
]

export const systemTemplateMeta: SystemTemplateMeta[] = META.map((m) => ({
  ...m,
  slug: slugify(m.name),
  previewPath: `/template-previews/${slugify(m.name)}.png`,
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
