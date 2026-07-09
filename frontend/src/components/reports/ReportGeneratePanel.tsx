import {
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Select,
  Stack,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { IconCalendarClock, IconDownload, IconEye } from '@tabler/icons-react'
import type { ReportTemplate } from '../../lib/reports'
import type { GenerateFormState, ScopeOption } from './reportConstants'
import { RANGE_OPTIONS, selectedTemplate, templateTypeLabel } from './reportConstants'
import { ReportPreviewPane } from './ReportPreviewPane'

export function ReportGeneratePanel({
  templates,
  scopes,
  scopesLoading,
  form,
  onChange,
  previewBlob,
  previewLoading,
  previewError,
  generateBusy,
  onPreview,
  onDownload,
  onSchedule,
  canManage,
}: {
  templates: ReportTemplate[]
  scopes: ScopeOption[]
  scopesLoading: boolean
  form: GenerateFormState
  onChange: (patch: Partial<GenerateFormState>) => void
  previewBlob: Blob | null
  previewLoading: boolean
  previewError: string | null
  generateBusy: boolean
  onPreview: () => void
  onDownload: () => void
  onSchedule?: () => void
  canManage: boolean
}) {
  const tpl = selectedTemplate(templates, form.templateId)

  return (
    <Grid gap="md">
      <Grid.Col span={{ base: 12, lg: 5 }}>
        <Card withBorder radius="md" padding="lg">
          <Stack>
            <Select
              label="Report template"
              description={tpl?.description ?? undefined}
              data={templates.map((t) => ({
                value: t.id,
                label: t.name,
                description: t.description ?? undefined,
              }))}
              value={form.templateId}
              onChange={(v) => onChange({ templateId: v })}
              allowDeselect={false}
              nothingFoundMessage="No templates"
            />
            {tpl ? (
              <Group gap="xs">
                <Badge variant="light">{templateTypeLabel(tpl.reportType)}</Badge>
                {tpl.isSystem ? (
                  <Badge variant="outline" color="gray">
                    System
                  </Badge>
                ) : null}
              </Group>
            ) : null}
            <Select
              label="Scope"
              searchable
              disabled={scopesLoading}
              data={scopes.map((s) => ({ value: s.value, label: s.label }))}
              value={form.scope}
              onChange={(v) => onChange({ scope: v })}
              allowDeselect={false}
            />
            <Select
              label="Date range"
              data={RANGE_OPTIONS}
              value={form.range}
              onChange={(v) => onChange({ range: v as GenerateFormState['range'] })}
              allowDeselect={false}
            />
            {form.range === 'Custom' ? (
              <Group grow align="flex-end">
                <DateTimePicker
                  label="From"
                  value={form.customFrom ? new Date(form.customFrom) : null}
                  onChange={(d) => onChange({ customFrom: d ? new Date(d).toISOString() : '' })}
                />
                <DateTimePicker
                  label="To"
                  value={form.customTo ? new Date(form.customTo) : null}
                  onChange={(d) => onChange({ customTo: d ? new Date(d).toISOString() : '' })}
                />
              </Group>
            ) : null}
            <Select
              label="Format"
              data={[
                { value: 'Pdf', label: 'PDF (branded)' },
                { value: 'Csv', label: 'CSV (data)' },
              ]}
              value={form.format}
              onChange={(v) => onChange({ format: (v as GenerateFormState['format']) ?? 'Pdf' })}
              allowDeselect={false}
            />
            <Group>
              <Button leftSection={<IconEye size={16} />} loading={previewLoading} onClick={onPreview}>
                Preview
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                loading={generateBusy}
                variant="filled"
                onClick={onDownload}
              >
                Download
              </Button>
              {canManage && onSchedule ? (
                <Button leftSection={<IconCalendarClock size={16} />} variant="light" onClick={onSchedule}>
                  Schedule…
                </Button>
              ) : null}
            </Group>
          </Stack>
        </Card>
      </Grid.Col>
      <Grid.Col span={{ base: 12, lg: 7 }}>
        <Card withBorder radius="md" padding="md" h="100%">
          <ReportPreviewPane
            blob={previewBlob}
            format={form.format}
            loading={previewLoading}
            error={previewError}
          />
        </Card>
      </Grid.Col>
    </Grid>
  )
}
