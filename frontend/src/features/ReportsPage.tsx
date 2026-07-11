import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Stack, Tabs, Text, Title } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import {
  buildGenerateRequest,
  generateReport,
  getReportTemplate,
  getReportTemplates,
  previewReport,
  type ReportRangeKind,
  type ReportTemplate,
} from '../lib/reports'
import { getLicenseStatus } from '../lib/license'
import { useAuth } from '../lib/auth'
import { Permissions } from '../lib/permissions'
import { ReportDesignerTab } from '../components/reports/ReportDesignerTab'
import { ReportGeneratePanel } from '../components/reports/ReportGeneratePanel'
import { ReportHistoryTab, notifyReport } from '../components/reports/ReportHistoryTab'
import { parseScopeParam, RANGE_OPTIONS, type GenerateFormState } from '../components/reports/reportConstants'
import { ReportSchedulesTab } from '../components/reports/ReportSchedulesTab'
import { ReportSmtpTab } from '../components/reports/ReportSmtpTab'
import { useScopeOptions } from '../components/reports/useScopeOptions'

const VALID_TABS = new Set(['generate', 'history', 'schedules', 'custom'])

export function ReportsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(Permissions.ManageReports)
  const [searchParams, setSearchParams] = useSearchParams()
  const scopeFromUrl = parseScopeParam(searchParams.get('scope'))

  const tabFromUrl = searchParams.get('tab')
  const [tab, setTab] = useState<string | null>(
    tabFromUrl && VALID_TABS.has(tabFromUrl) ? tabFromUrl : 'generate',
  )
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const { options: scopes } = useScopeOptions()
  const [pdfEnabled, setPdfEnabled] = useState(true)

  const [form, setForm] = useState<GenerateFormState>({
    templateId: searchParams.get('templateId'),
    scope: scopeFromUrl,
    range: 'PreviousShift',
    format: 'Pdf',
    customFrom: '',
    customTo: '',
  })

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewBuiltAt, setPreviewBuiltAt] = useState<Date | null>(null)
  const [generateBusy, setGenerateBusy] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [schedulePrefillOpen, setSchedulePrefillOpen] = useState(false)
  const [scheduleSubTab, setScheduleSubTab] = useState<string | null>('list')
  const previewSeq = useRef(0)

  const refreshTemplates = useCallback(() => {
    getReportTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    refreshTemplates()
    getLicenseStatus()
      .then((s) => {
        setPdfEnabled(s.pdfReportsEnabled)
        if (!s.pdfReportsEnabled) {
          setForm((f) => (f.format === 'Pdf' ? { ...f, format: 'Csv' } : f))
        }
      })
      .catch(() => undefined)
  }, [refreshTemplates])

  useEffect(() => {
    if (templates.length === 0) return
    setForm((f) => ({
      ...f,
      templateId: f.templateId && templates.some((t) => t.id === f.templateId) ? f.templateId : templates[0].id,
      scope: f.scope ?? scopeFromUrl ?? scopes[0]?.value ?? null,
    }))
  }, [templates, scopes, scopeFromUrl])

  useEffect(() => {
    if (scopeFromUrl) setForm((f) => ({ ...f, scope: scopeFromUrl }))
  }, [scopeFromUrl])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && VALID_TABS.has(t) && t !== tab) setTab(t)
  }, [searchParams, tab])

  const syncUrl = useCallback(
    (next: { tab?: string | null; scope?: string | null; templateId?: string | null }) => {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        if (next.tab != null) p.set('tab', next.tab)
        if (next.scope !== undefined) {
          if (next.scope) p.set('scope', next.scope)
          else p.delete('scope')
        }
        if (next.templateId !== undefined) {
          if (next.templateId) p.set('templateId', next.templateId)
          else p.delete('templateId')
        }
        return p
      })
    },
    [setSearchParams],
  )

  const handleTabChange = (v: string | null) => {
    const next = v ?? 'generate'
    setTab(next)
    syncUrl({ tab: next })
  }

  const patchForm = useCallback(
    (patch: Partial<GenerateFormState>) => {
      setForm((f) => {
        const next = { ...f, ...patch }
        if (patch.scope !== undefined || patch.templateId !== undefined) {
          syncUrl({
            scope: patch.scope !== undefined ? patch.scope : next.scope,
            templateId: patch.templateId !== undefined ? patch.templateId : next.templateId,
          })
        }
        return next
      })
      if (patch.templateId || patch.scope || patch.range || patch.format || patch.customFrom || patch.customTo) {
        setPreviewBlob(null)
        setPreviewError(null)
        setPreviewBuiltAt(null)
      }
    },
    [syncUrl],
  )

  const handleSelectTemplate = useCallback(
    (id: string) => {
      patchForm({ templateId: id })
      getReportTemplate(id)
        .then((detail) => {
          const suggested = detail.suggestedRanges ?? []
          if (suggested.length === 0) return
          const match = RANGE_OPTIONS.find((r) => suggested.includes(r.value))
          if (match) patchForm({ range: match.value as ReportRangeKind })
        })
        .catch(() => undefined)
    },
    [patchForm],
  )

  const scopeOpt = useMemo(() => scopes.find((s) => s.value === form.scope), [scopes, form.scope])

  function buildRequest() {
    if (!form.templateId || !scopeOpt) return null
    if (form.range === 'Custom' && (!form.customFrom || !form.customTo)) return null
    if (form.format === 'Pdf' && !pdfEnabled) return null
    return buildGenerateRequest(
      form.templateId,
      { level: scopeOpt.level, id: scopeOpt.id },
      form.range,
      form.format,
      form.customFrom,
      form.customTo,
    )
  }

  const runPreview = useCallback(async () => {
    if (!form.templateId || !scopeOpt) return
    if (form.range === 'Custom' && (!form.customFrom || !form.customTo)) return
    if (form.format === 'Pdf' && !pdfEnabled) {
      setPreviewError('PDF reports require a full license.')
      return
    }
    const req = buildGenerateRequest(
      form.templateId,
      { level: scopeOpt.level, id: scopeOpt.id },
      form.range,
      form.format,
      form.customFrom,
      form.customTo,
    )
    const seq = ++previewSeq.current
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const blob = await previewReport(req)
      if (seq !== previewSeq.current) return
      setPreviewBlob(blob)
      setPreviewBuiltAt(new Date())
    } catch (e) {
      if (seq !== previewSeq.current) return
      setPreviewBlob(null)
      setPreviewBuiltAt(null)
      setPreviewError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false)
    }
  }, [form, scopeOpt, pdfEnabled])

  async function handlePreview() {
    if (!form.templateId || !scopeOpt) {
      notifyReport('Select template and scope', 'red')
      return
    }
    if (form.range === 'Custom' && (!form.customFrom || !form.customTo)) {
      notifyReport('Custom range requires from and to dates', 'red')
      return
    }
    await runPreview()
  }

  useEffect(() => {
    if (tab !== 'generate') return
    if (!form.templateId || !form.scope) return
    if (form.range === 'Custom' && (!form.customFrom || !form.customTo)) return
    const t = window.setTimeout(() => {
      void runPreview()
    }, 600)
    return () => window.clearTimeout(t)
  }, [
    tab,
    form.templateId,
    form.scope,
    form.range,
    form.format,
    form.customFrom,
    form.customTo,
    runPreview,
  ])

  async function handleDownload() {
    const req = buildRequest()
    if (!req) {
      if (form.format === 'Pdf' && !pdfEnabled) notifyReport('PDF requires a full license', 'red')
      else if (!form.templateId || !scopeOpt) notifyReport('Select template and scope', 'red')
      else if (form.range === 'Custom') notifyReport('Custom range requires from and to dates', 'red')
      return
    }
    setGenerateBusy(true)
    try {
      await generateReport(req)
      setHistoryRefresh((n) => n + 1)
      notifyReport('Report downloaded and saved to history')
    } catch {
      notifyReport('Generate failed', 'red')
    } finally {
      setGenerateBusy(false)
    }
  }

  function handleScheduleFromPreview() {
    if (!form.templateId || !form.scope) {
      notifyReport('Select template and scope first', 'red')
      return
    }
    setTab('schedules')
    setScheduleSubTab('list')
    syncUrl({ tab: 'schedules' })
    setSchedulePrefillOpen(true)
  }

  const schedulePrefill = useMemo(
    () => ({
      reportTemplateId: form.templateId ?? '',
      scope: form.scope ?? '',
      rangeKind: form.range,
      format: form.format,
    }),
    [form],
  )

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Reports</Title>
        <Text c="dimmed" size="sm">
          Professional OEE PDFs and CSV exports — preview, download, schedule, and deliver.
        </Text>
      </div>

      <Tabs value={tab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="generate">Generate</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
          {canManage ? <Tabs.Tab value="schedules">Schedules</Tabs.Tab> : null}
          {canManage ? <Tabs.Tab value="custom">Custom templates</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="generate" pt="md">
          <ReportGeneratePanel
            templates={templates}
            form={form}
            onChange={patchForm}
            onSelectTemplate={handleSelectTemplate}
            previewBlob={previewBlob}
            previewLoading={previewLoading}
            previewError={previewError}
            previewBuiltAt={previewBuiltAt}
            generateBusy={generateBusy}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onSchedule={handleScheduleFromPreview}
            canManage={canManage}
            pdfEnabled={pdfEnabled}
          />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <ReportHistoryTab refreshToken={historyRefresh} templates={templates} />
        </Tabs.Panel>

        {canManage ? (
          <Tabs.Panel value="schedules" pt="md">
            <Tabs value={scheduleSubTab} onChange={setScheduleSubTab}>
              <Tabs.List mb="md">
                <Tabs.Tab value="list">Schedules</Tabs.Tab>
                <Tabs.Tab value="delivery">Delivery settings</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="list">
                <ReportSchedulesTab
                  templates={templates}
                  scopes={scopes}
                  canManage={canManage}
                  prefill={schedulePrefill}
                  prefillOpen={schedulePrefillOpen}
                  onPrefillClose={() => setSchedulePrefillOpen(false)}
                />
              </Tabs.Panel>
              <Tabs.Panel value="delivery">
                <ReportSmtpTab />
              </Tabs.Panel>
            </Tabs>
          </Tabs.Panel>
        ) : null}

        {canManage ? (
          <Tabs.Panel value="custom" pt="md">
            <ReportDesignerTab
              templates={templates}
              scopes={scopes}
              onSaved={refreshTemplates}
              onUseSystem={() => handleTabChange('generate')}
            />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </Stack>
  )
}
