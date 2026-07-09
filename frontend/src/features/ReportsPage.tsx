import { useCallback, useEffect, useMemo, useState } from 'react'
import { Stack, Tabs, Text, Title } from '@mantine/core'
import { useSearchParams } from 'react-router-dom'
import {
  buildGenerateRequest,
  generateReport,
  getReportTemplates,
  previewReport,
  type ReportTemplate,
} from '../lib/reports'
import { useAuth } from '../lib/auth'
import { Permissions } from '../lib/permissions'
import { ReportDesignerTab } from '../components/reports/ReportDesignerTab'
import { ReportGeneratePanel } from '../components/reports/ReportGeneratePanel'
import { ReportHistoryTab, notifyReport } from '../components/reports/ReportHistoryTab'
import { parseScopeParam, type GenerateFormState } from '../components/reports/reportConstants'
import { ReportSchedulesTab } from '../components/reports/ReportSchedulesTab'
import { ReportSmtpTab } from '../components/reports/ReportSmtpTab'
import { useScopeOptions } from '../components/reports/useScopeOptions'

export function ReportsPage() {
  const { hasPermission } = useAuth()
  const canManage = hasPermission(Permissions.ManageReports)
  const [searchParams] = useSearchParams()
  const scopeFromUrl = parseScopeParam(searchParams.get('scope'))

  const [tab, setTab] = useState<string | null>('generate')
  const [templates, setTemplates] = useState<ReportTemplate[]>([])
  const { options: scopes, loading: scopesLoading } = useScopeOptions()

  const [form, setForm] = useState<GenerateFormState>({
    templateId: null,
    scope: scopeFromUrl,
    range: 'PreviousShift',
    format: 'Pdf',
    customFrom: '',
    customTo: '',
  })

  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [generateBusy, setGenerateBusy] = useState(false)
  const [historyRefresh, setHistoryRefresh] = useState(0)
  const [schedulePrefillOpen, setSchedulePrefillOpen] = useState(false)

  const refreshTemplates = useCallback(() => {
    getReportTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
  }, [])

  useEffect(() => {
    refreshTemplates()
  }, [refreshTemplates])

  useEffect(() => {
    if (templates.length === 0) return
    setForm((f) => ({
      ...f,
      templateId: f.templateId ?? templates[0].id,
      scope: f.scope ?? scopeFromUrl ?? scopes[0]?.value ?? null,
    }))
  }, [templates, scopes, scopeFromUrl])

  useEffect(() => {
    if (scopeFromUrl) {
      setForm((f) => ({ ...f, scope: scopeFromUrl }))
    }
  }, [scopeFromUrl])

  const patchForm = useCallback((patch: Partial<GenerateFormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    if (patch.templateId || patch.scope || patch.range || patch.format || patch.customFrom || patch.customTo) {
      setPreviewBlob(null)
      setPreviewError(null)
    }
  }, [])

  const scopeOpt = useMemo(() => scopes.find((s) => s.value === form.scope), [scopes, form.scope])

  function buildRequest() {
    if (!form.templateId || !scopeOpt) return null
    if (form.range === 'Custom' && (!form.customFrom || !form.customTo)) {
      notifyReport('Custom range requires from and to dates', 'red')
      return null
    }
    return buildGenerateRequest(
      form.templateId,
      { level: scopeOpt.level, id: scopeOpt.id },
      form.range,
      form.format,
      form.customFrom,
      form.customTo,
    )
  }

  async function handlePreview() {
    const req = buildRequest()
    if (!req) {
      if (!form.templateId || !scopeOpt) notifyReport('Select template and scope', 'red')
      return
    }
    setPreviewLoading(true)
    setPreviewError(null)
    try {
      const blob = await previewReport(req)
      setPreviewBlob(blob)
    } catch (e) {
      setPreviewBlob(null)
      setPreviewError(e instanceof Error ? e.message : 'Preview failed')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleDownload() {
    const req = buildRequest()
    if (!req) {
      if (!form.templateId || !scopeOpt) notifyReport('Select template and scope', 'red')
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
          Preview branded PDFs or export CSV before saving to history. Schedule delivery via email or file drop.
        </Text>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List>
          <Tabs.Tab value="generate">Generate</Tabs.Tab>
          <Tabs.Tab value="history">History</Tabs.Tab>
          {canManage ? <Tabs.Tab value="schedules">Schedules</Tabs.Tab> : null}
          {canManage ? <Tabs.Tab value="smtp">SMTP</Tabs.Tab> : null}
          {canManage ? <Tabs.Tab value="designer">Advanced</Tabs.Tab> : null}
        </Tabs.List>

        <Tabs.Panel value="generate" pt="md">
          <ReportGeneratePanel
            templates={templates}
            scopes={scopes}
            scopesLoading={scopesLoading}
            form={form}
            onChange={patchForm}
            previewBlob={previewBlob}
            previewLoading={previewLoading}
            previewError={previewError}
            generateBusy={generateBusy}
            onPreview={handlePreview}
            onDownload={handleDownload}
            onSchedule={handleScheduleFromPreview}
            canManage={canManage}
          />
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <ReportHistoryTab refreshToken={historyRefresh} />
        </Tabs.Panel>

        {canManage ? (
          <Tabs.Panel value="schedules" pt="md">
            <ReportSchedulesTab
              templates={templates}
              scopes={scopes}
              canManage={canManage}
              prefill={schedulePrefill}
              prefillOpen={schedulePrefillOpen}
              onPrefillClose={() => setSchedulePrefillOpen(false)}
            />
          </Tabs.Panel>
        ) : null}

        {canManage ? (
          <Tabs.Panel value="smtp" pt="md">
            <ReportSmtpTab />
          </Tabs.Panel>
        ) : null}

        {canManage ? (
          <Tabs.Panel value="designer" pt="md">
            <ReportDesignerTab onSaved={refreshTemplates} />
          </Tabs.Panel>
        ) : null}
      </Tabs>
    </Stack>
  )
}
