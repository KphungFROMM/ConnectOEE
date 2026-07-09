import { apiGet, apiPost } from './api'
import { getToken } from './auth'
import type { EntityLevel } from './historian'

export type ReportFormat = 'Pdf' | 'Csv'
export type ReportFrequency = 'Daily' | 'Weekly' | 'Monthly'
export type ReportDeliveryMethod = 'Email' | 'FileDrop'
export type ReportRangeKind =
  | 'PreviousShift'
  | 'Today'
  | 'Yesterday'
  | 'Last24h'
  | 'Last7d'
  | 'Last30d'
  | 'PreviousWeek'
  | 'PreviousMonth'
  | 'Custom'

export interface ReportTemplate {
  id: string
  name: string
  description?: string | null
  reportType: string
  isSystem: boolean
  isPublished: boolean
}

export interface ReportTemplateDetail extends ReportTemplate {
  suggestedRanges: string[]
}

export interface ReportRun {
  id: string
  reportTemplateId: string
  reportScheduleId?: string | null
  title: string
  format: ReportFormat
  generatedUtc: string
  status: string
  hasFile: boolean
  triggeredBy?: string | null
  error?: string | null
}

export interface ReportSchedule {
  id: string
  name: string
  reportTemplateId: string
  format: ReportFormat
  scopeLevel: string
  scopeId: string
  rangeKind: ReportRangeKind
  frequency: ReportFrequency
  timeOfDay: string
  dayOfPeriod: number
  enabled: boolean
  deliveryMethod: ReportDeliveryMethod
  recipients?: string | null
  fileDropPath?: string | null
  nextRunUtc?: string | null
  lastRunUtc?: string | null
  lastStatus?: string | null
  lastError?: string | null
}

export interface ScheduleUpsert {
  name: string
  reportTemplateId: string
  format: ReportFormat
  scopeLevel: EntityLevel
  scopeId: string
  rangeKind: ReportRangeKind
  frequency: ReportFrequency
  timeOfDay: string
  dayOfPeriod: number
  enabled: boolean
  deliveryMethod: ReportDeliveryMethod
  recipients?: string | null
  fileDropPath?: string | null
}

export interface SmtpSettings {
  host: string
  port: number
  useSsl: boolean
  username?: string | null
  hasPassword: boolean
  fromAddress: string
  fromName: string
}

export interface GenerateRequest {
  templateId: string
  level: EntityLevel
  scopeId: string
  rangeKind: ReportRangeKind
  format: ReportFormat
  fromUtc?: string | null
  toUtc?: string | null
}

export const getReportTemplates = () => apiGet<ReportTemplate[]>('/api/reports/templates')
export const getReportTemplate = (id: string) => apiGet<ReportTemplateDetail>(`/api/reports/templates/${id}`)
export const saveCustomReportTemplate = (body: { name: string; description?: string; layoutJson: string }) =>
  apiPost<ReportTemplate>('/api/reports/templates/custom', body)

export const getRuns = (skip = 0, take = 50, status?: string) => {
  const p = new URLSearchParams({ skip: String(skip), take: String(take) })
  if (status) p.set('status', status)
  return apiGet<ReportRun[]>(`/api/reports/runs?${p}`)
}

export const getSchedules = () => apiGet<ReportSchedule[]>('/api/reports/schedules')
export const createSchedule = (b: ScheduleUpsert) => apiPost<ReportSchedule>('/api/reports/schedules', b)
export const runScheduleNow = (id: string) => apiPost<{ delivered: boolean }>(`/api/reports/schedules/${id}/run-now`, {})
export const getSmtp = () => apiGet<SmtpSettings>('/api/reports/smtp')

async function authFetch(path: string, init?: RequestInit) {
  const token = getToken()
  const headers = new Headers(init?.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')
  return fetch(path, { ...init, headers })
}

function buildGenerateBody(req: GenerateRequest): GenerateRequest {
  return {
    templateId: req.templateId,
    level: req.level,
    scopeId: req.scopeId,
    rangeKind: req.rangeKind,
    format: req.format,
    fromUtc: req.fromUtc ?? null,
    toUtc: req.toUtc ?? null,
  }
}

export async function previewReport(req: GenerateRequest): Promise<Blob> {
  const res = await authFetch('/api/reports/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGenerateBody(req)),
  })
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(msg || `Preview failed: ${res.status}`)
  }
  return res.blob()
}

export async function updateSchedule(id: string, b: ScheduleUpsert) {
  const res = await authFetch(`/api/reports/schedules/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  })
  if (!res.ok) throw new Error(`PUT failed: ${res.status}`)
  return (await res.json()) as ReportSchedule
}

export async function deleteSchedule(id: string) {
  const res = await authFetch(`/api/reports/schedules/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`DELETE failed: ${res.status}`)
}

export async function saveSmtp(b: {
  host: string
  port: number
  useSsl: boolean
  username?: string | null
  password?: string | null
  fromAddress: string
  fromName: string
}) {
  const res = await authFetch('/api/reports/smtp', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  })
  if (!res.ok) throw new Error(`PUT failed: ${res.status}`)
  return (await res.json()) as SmtpSettings
}

export async function testSmtp(recipient: string) {
  const res = await authFetch('/api/reports/smtp/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Test failed: ${res.status}`)
  }
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function fileNameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (star) return decodeURIComponent(star[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain ? plain[1] : fallback
}

export async function generateReport(req: GenerateRequest) {
  const res = await authFetch('/api/reports/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(buildGenerateBody(req)),
  })
  if (!res.ok) throw new Error(`Generate failed: ${res.status}`)
  const blob = await res.blob()
  const name = fileNameFromDisposition(
    res.headers.get('Content-Disposition'),
    `report.${req.format === 'Csv' ? 'csv' : 'pdf'}`,
  )
  triggerDownload(blob, name)
  return blob
}

export async function downloadRun(id: string, title: string, format: ReportFormat) {
  const res = await authFetch(`/api/reports/runs/${id}/download`)
  if (!res.ok) throw new Error(`Download failed: ${res.status}`)
  const blob = await res.blob()
  const name = fileNameFromDisposition(
    res.headers.get('Content-Disposition'),
    `${title}.${format === 'Csv' ? 'csv' : 'pdf'}`,
  )
  triggerDownload(blob, name)
}

export function buildGenerateRequest(
  templateId: string,
  scope: { level: EntityLevel; id: string },
  rangeKind: ReportRangeKind,
  format: ReportFormat,
  customFrom?: string,
  customTo?: string,
): GenerateRequest {
  return {
    templateId,
    level: scope.level,
    scopeId: scope.id,
    rangeKind,
    format,
    fromUtc: rangeKind === 'Custom' ? customFrom || null : null,
    toUtc: rangeKind === 'Custom' ? customTo || null : null,
  }
}
