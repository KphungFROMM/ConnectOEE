import {
  Alert,
  Button,
  Grid,
  Group,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core'
import { IconCalendarClock, IconDownload, IconEye } from '@tabler/icons-react'
import type { ReportTemplate } from '../../lib/reports'
import type { GenerateFormState } from './reportConstants'
import { ReportPreviewPane } from './ReportPreviewPane'
import { ReportScopeBar } from './ReportScopeBar'
import { ReportTemplateGallery } from './ReportTemplateGallery'

export function ReportGeneratePanel({
  templates,
  form,
  onChange,
  onSelectTemplate,
  previewBlob,
  previewLoading,
  previewError,
  previewBuiltAt,
  generateBusy,
  onPreview,
  onDownload,
  onSchedule,
  canManage,
  pdfEnabled,
}: {
  templates: ReportTemplate[]
  form: GenerateFormState
  onChange: (patch: Partial<GenerateFormState>) => void
  onSelectTemplate: (id: string) => void
  previewBlob: Blob | null
  previewLoading: boolean
  previewError: string | null
  previewBuiltAt: Date | null
  generateBusy: boolean
  onPreview: () => void
  onDownload: () => void
  onSchedule?: () => void
  canManage: boolean
  pdfEnabled: boolean
}) {
  return (
    <Stack gap="md">
      <ReportScopeBar form={form} onChange={onChange} />

      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <SegmentedControl
            value={form.format}
            onChange={(v) => {
              if (v === 'Pdf' && !pdfEnabled) return
              onChange({ format: v as GenerateFormState['format'] })
            }}
            data={[
              { label: 'PDF', value: 'Pdf', disabled: !pdfEnabled },
              { label: 'CSV', value: 'Csv' },
            ]}
          />
          {!pdfEnabled ? (
            <Text size="xs" c="orange">
              PDF requires a full license — CSV is available on trial.
            </Text>
          ) : null}
        </Group>
        <Group gap="xs">
          <Button leftSection={<IconEye size={16} />} variant="light" loading={previewLoading} onClick={onPreview}>
            Preview
          </Button>
          <Button leftSection={<IconDownload size={16} />} loading={generateBusy} onClick={onDownload}>
            Download
          </Button>
          {canManage && onSchedule ? (
            <Button leftSection={<IconCalendarClock size={16} />} variant="default" onClick={onSchedule}>
              Schedule…
            </Button>
          ) : null}
        </Group>
      </Group>

      {!pdfEnabled && form.format === 'Pdf' ? (
        <Alert color="yellow" variant="light" title="PDF locked">
          Activate a full license to generate branded PDFs. Switch to CSV or open Admin → License.
        </Alert>
      ) : null}

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Stack gap="xs">
            <Text size="xs" fw={700} tt="uppercase" c="dimmed">
              Templates
            </Text>
            <ReportTemplateGallery
              templates={templates}
              selectedId={form.templateId}
              onSelect={onSelectTemplate}
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <ReportPreviewPane
            blob={previewBlob}
            format={form.format}
            loading={previewLoading}
            error={previewError}
            builtAt={previewBuiltAt}
            onDownload={onDownload}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  )
}
