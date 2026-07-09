import type { EntityLevel } from '../../lib/historian'
import type {
  ReportDeliveryMethod,
  ReportFormat,
  ReportFrequency,
  ReportRangeKind,
  ReportTemplate,
} from '../../lib/reports'

export const RANGE_OPTIONS: { value: ReportRangeKind; label: string }[] = [
  { value: 'PreviousShift', label: 'Previous shift' },
  { value: 'Today', label: 'Today' },
  { value: 'Yesterday', label: 'Yesterday' },
  { value: 'Last24h', label: 'Last 24h' },
  { value: 'Last7d', label: 'Last 7 days' },
  { value: 'Last30d', label: 'Last 30 days' },
  { value: 'PreviousWeek', label: 'Previous week' },
  { value: 'PreviousMonth', label: 'Previous month' },
  { value: 'Custom', label: 'Custom range' },
]

export interface ScopeOption {
  value: string
  label: string
  level: EntityLevel
  id: string
}

export interface GenerateFormState {
  templateId: string | null
  scope: string | null
  range: ReportRangeKind
  format: ReportFormat
  customFrom: string
  customTo: string
}

export interface ScheduleForm {
  id?: string
  name: string
  reportTemplateId: string
  format: ReportFormat
  scope: string
  rangeKind: ReportRangeKind
  frequency: ReportFrequency
  timeOfDay: string
  dayOfPeriod: number
  enabled: boolean
  deliveryMethod: ReportDeliveryMethod
  recipients: string
  fileDropPath: string
}

export const EMPTY_SCHEDULE: ScheduleForm = {
  name: '',
  reportTemplateId: '',
  format: 'Pdf',
  scope: '',
  rangeKind: 'Yesterday',
  frequency: 'Daily',
  timeOfDay: '06:00',
  dayOfPeriod: 1,
  enabled: true,
  deliveryMethod: 'Email',
  recipients: '',
  fileDropPath: '',
}

export function parseScopeParam(raw: string | null): string | null {
  if (!raw) return null
  const parts = raw.split(':')
  if (parts.length !== 2) return null
  return raw
}

export function templateTypeLabel(reportType: string): string {
  return reportType.replace(/([a-z])([A-Z])/g, '$1 $2')
}

export function selectedTemplate(templates: ReportTemplate[], id: string | null) {
  return templates.find((t) => t.id === id) ?? null
}
