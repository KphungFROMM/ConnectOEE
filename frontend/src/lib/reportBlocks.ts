/** Shared report block schema — must match ConnectOEE.Reporting.ReportBlockTypes */

export type ReportBlockType =
  | 'cover'
  | 'kpi-hero'
  | 'apq-bars'
  | 'secondary-metrics'
  | 'oee-trend'
  | 'pareto'
  | 'production-chart'
  | 'shift-table'
  | 'trend-table'
  | 'production-table'
  | 'reason-table'
  | 'fault-table'
  | 'breakdown-table'
  | 'reliability'
  | 'section-title'
  | 'page-break'
  | 'rich-text'

export interface ReportBlock {
  id: string
  type: ReportBlockType
  title?: string
  options?: Record<string, unknown>
}

export type ReportBlockCategory = 'KPIs' | 'Charts' | 'Tables' | 'Layout'

export type ReportBlockIcon =
  | 'cover'
  | 'kpi'
  | 'bars'
  | 'metrics'
  | 'chart'
  | 'pareto'
  | 'production'
  | 'table'
  | 'reliability'
  | 'title'
  | 'breakBreak'
  | 'notes'

export interface ReportBlockCatalogItem {
  type: ReportBlockType
  label: string
  description: string
  category: ReportBlockCategory
  defaultTitle: string
  icon: ReportBlockIcon
  tint: string
}

export const REPORT_BLOCK_CATALOG: ReportBlockCatalogItem[] = [
  { type: 'cover', label: 'Cover page', description: 'Branded cover with headline KPIs', category: 'Layout', defaultTitle: 'Cover', icon: 'cover', tint: 'violet' },
  { type: 'section-title', label: 'Section title', description: 'Accent heading between sections', category: 'Layout', defaultTitle: 'Section', icon: 'title', tint: 'violet' },
  { type: 'page-break', label: 'Page break', description: 'Start a new A4 page', category: 'Layout', defaultTitle: 'Page break', icon: 'pageBreak', tint: 'gray' },
  { type: 'rich-text', label: 'Notes', description: 'Static text / notes block', category: 'Layout', defaultTitle: 'Notes', icon: 'notes', tint: 'violet' },
  { type: 'kpi-hero', label: 'KPI hero', description: 'OEE ring + A/P/Q bars + secondary metrics', category: 'KPIs', defaultTitle: 'KPI hero', icon: 'kpi', tint: 'blue' },
  { type: 'apq-bars', label: 'A/P/Q bars', description: 'Availability, Performance, Quality bars', category: 'KPIs', defaultTitle: 'A / P / Q', icon: 'bars', tint: 'blue' },
  { type: 'secondary-metrics', label: 'Secondary metrics', description: 'Counts, downtime, scrap strip', category: 'KPIs', defaultTitle: 'Secondary metrics', icon: 'metrics', tint: 'blue' },
  { type: 'reliability', label: 'Reliability', description: 'MTTR / MTBF / MTTF strip', category: 'KPIs', defaultTitle: 'Reliability', icon: 'reliability', tint: 'blue' },
  { type: 'oee-trend', label: 'OEE trend', description: 'OEE over time chart', category: 'Charts', defaultTitle: 'OEE trend', icon: 'chart', tint: 'orange' },
  { type: 'pareto', label: 'Pareto', description: 'Downtime Pareto chart', category: 'Charts', defaultTitle: 'Downtime Pareto', icon: 'pareto', tint: 'orange' },
  { type: 'production-chart', label: 'Production chart', description: 'Production vs target + summary', category: 'Charts', defaultTitle: 'Production vs target', icon: 'production', tint: 'orange' },
  { type: 'shift-table', label: 'Shift table', description: 'Shift comparison table', category: 'Tables', defaultTitle: 'Shift comparison', icon: 'table', tint: 'teal' },
  { type: 'trend-table', label: 'Trend table', description: 'OEE detail by period', category: 'Tables', defaultTitle: 'OEE detail', icon: 'table', tint: 'teal' },
  { type: 'production-table', label: 'Production table', description: 'Production detail rows', category: 'Tables', defaultTitle: 'Production detail', icon: 'table', tint: 'teal' },
  { type: 'reason-table', label: 'Reason table', description: 'Downtime by reason', category: 'Tables', defaultTitle: 'Downtime by reason', icon: 'table', tint: 'teal' },
  { type: 'fault-table', label: 'Fault table', description: 'Top fault codes', category: 'Tables', defaultTitle: 'Top faults', icon: 'table', tint: 'teal' },
  { type: 'breakdown-table', label: 'Breakdown table', description: 'Scope breakdown (plant/line)', category: 'Tables', defaultTitle: 'Breakdown', icon: 'table', tint: 'teal' },
]

const TYPE_SET = new Set(REPORT_BLOCK_CATALOG.map((c) => c.type))

const TABLE_TYPES = new Set<ReportBlockType>([
  'shift-table',
  'trend-table',
  'production-table',
  'reason-table',
  'fault-table',
  'breakdown-table',
])

export function isReportBlockType(v: string): v is ReportBlockType {
  return TYPE_SET.has(v as ReportBlockType)
}

export function isTableBlock(type: ReportBlockType): boolean {
  return TABLE_TYPES.has(type)
}

export function newBlockId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12)
}

export function defaultOptionsFor(type: ReportBlockType): Record<string, unknown> {
  if (type === 'rich-text') return { text: 'Add notes for this report…' }
  if (type === 'kpi-hero') return { showSparklines: true, includeSecondary: true }
  if (type === 'apq-bars') return { showSparklines: true }
  if (isTableBlock(type)) return { showIfEmpty: false, maxRows: type === 'trend-table' || type === 'production-table' ? 40 : 20 }
  return {}
}

export function createBlock(type: ReportBlockType, title?: string): ReportBlock {
  const meta = REPORT_BLOCK_CATALOG.find((c) => c.type === type)
  const options = defaultOptionsFor(type)
  return {
    id: newBlockId(),
    type,
    title: title ?? meta?.defaultTitle ?? type,
    ...(Object.keys(options).length ? { options } : {}),
  }
}

export function optionBool(block: ReportBlock, key: string, fallback: boolean): boolean {
  const v = block.options?.[key]
  return typeof v === 'boolean' ? v : fallback
}

export function optionNumber(block: ReportBlock, key: string, fallback: number): number {
  const v = block.options?.[key]
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function optionString(block: ReportBlock, key: string, fallback = ''): string {
  const v = block.options?.[key]
  return typeof v === 'string' ? v : fallback
}

export function parseLayoutJson(json: string | null | undefined): ReportBlock[] {
  if (!json?.trim() || json.trim() === '{}' || json.trim() === 'null') return []
  try {
    const raw = JSON.parse(json) as unknown
    const arr = Array.isArray(raw)
      ? raw
      : raw && typeof raw === 'object' && Array.isArray((raw as { blocks?: unknown }).blocks)
        ? (raw as { blocks: unknown[] }).blocks
        : null
    if (!arr) return []
    return arr
      .filter((b): b is Record<string, unknown> => !!b && typeof b === 'object')
      .map((b) => {
        const type = String(b.type ?? '')
        if (!isReportBlockType(type)) return null
        const defaults = defaultOptionsFor(type)
        const incoming =
          b.options && typeof b.options === 'object' ? (b.options as Record<string, unknown>) : {}
        return {
          id: typeof b.id === 'string' && b.id ? b.id : newBlockId(),
          type,
          title: typeof b.title === 'string' ? b.title : undefined,
          options: { ...defaults, ...incoming },
        } satisfies ReportBlock
      })
      .filter((b): b is ReportBlock => b !== null)
  } catch {
    return []
  }
}

export function serializeLayoutJson(blocks: ReportBlock[]): string {
  return JSON.stringify(blocks)
}

/** Presets matching system layouts + role-oriented starters. */
export const REPORT_PRESETS: {
  key: string
  label: string
  reportType: string
  role?: 'Operator' | 'Supervisor' | 'Executive'
  blocks: () => ReportBlock[]
}[] = [
  {
    key: 'blank',
    label: 'Blank',
    reportType: 'Custom',
    blocks: () => [createBlock('kpi-hero'), createBlock('oee-trend'), createBlock('reason-table')],
  },
  {
    key: 'operator',
    label: 'Operator floor',
    reportType: 'Custom',
    role: 'Operator',
    blocks: () => [createBlock('kpi-hero'), createBlock('reason-table'), createBlock('fault-table')],
  },
  {
    key: 'supervisor',
    label: 'Supervisor shift',
    reportType: 'ShiftReport',
    role: 'Supervisor',
    blocks: () => [
      createBlock('kpi-hero'),
      createBlock('shift-table'),
      createBlock('oee-trend'),
      createBlock('trend-table'),
      createBlock('reason-table'),
      createBlock('fault-table'),
    ],
  },
  {
    key: 'executive',
    label: 'Executive summary',
    reportType: 'ExecutiveSummary',
    role: 'Executive',
    blocks: () => [
      createBlock('cover'),
      createBlock('breakdown-table'),
      createBlock('oee-trend'),
      createBlock('reason-table'),
    ],
  },
  {
    key: 'shift',
    label: 'Shift report',
    reportType: 'ShiftReport',
    blocks: () => [
      createBlock('kpi-hero'),
      createBlock('shift-table'),
      createBlock('oee-trend'),
      createBlock('trend-table'),
      createBlock('reason-table'),
      createBlock('fault-table'),
    ],
  },
  {
    key: 'weekly',
    label: 'Weekly summary',
    reportType: 'WeeklySummary',
    blocks: () => [
      createBlock('oee-trend'),
      createBlock('breakdown-table'),
      createBlock('reason-table'),
      createBlock('reliability'),
    ],
  },
  {
    key: 'pareto',
    label: 'Downtime Pareto',
    reportType: 'DowntimePareto',
    blocks: () => [
      createBlock('pareto'),
      createBlock('reason-table'),
      createBlock('reliability'),
      createBlock('fault-table'),
    ],
  },
  {
    key: 'production',
    label: 'Production vs target',
    reportType: 'ProductionVsTarget',
    blocks: () => [
      createBlock('production-chart'),
      createBlock('production-table'),
      createBlock('oee-trend'),
    ],
  },
]

export function catalogByCategory(): Record<ReportBlockCategory, ReportBlockCatalogItem[]> {
  const out: Record<ReportBlockCategory, ReportBlockCatalogItem[]> = {
    KPIs: [],
    Charts: [],
    Tables: [],
    Layout: [],
  }
  for (const item of REPORT_BLOCK_CATALOG) out[item.category].push(item)
  return out
}

export function blockLabel(type: ReportBlockType): string {
  return REPORT_BLOCK_CATALOG.find((c) => c.type === type)?.label ?? type
}

export function catalogItem(type: ReportBlockType): ReportBlockCatalogItem | undefined {
  return REPORT_BLOCK_CATALOG.find((c) => c.type === type)
}
