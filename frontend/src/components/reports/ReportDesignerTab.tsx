import { useState } from 'react'
import { Alert, Button, Card, Stack, Text, TextInput, Textarea } from '@mantine/core'
import { saveCustomReportTemplate } from '../../lib/reports'
import { notifyReport } from './ReportHistoryTab'

const DEFAULT_BLOCKS = `[
  { "type": "kpi-table", "title": "Shift KPIs" },
  { "type": "pareto", "title": "Downtime Pareto" },
  { "type": "production-table", "title": "Production Summary" }
]`

export function ReportDesignerTab({ onSaved }: { onSaved: () => void }) {
  const [name, setName] = useState('Custom report')
  const [layout, setLayout] = useState(DEFAULT_BLOCKS)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      await saveCustomReportTemplate({ name, layoutJson: layout })
      notifyReport('Custom template saved')
      onSaved()
    } catch {
      notifyReport('Failed to save template', 'red')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card withBorder padding="md">
      <Stack>
        <Text fw={600}>Advanced — block layout (JSON)</Text>
        <Alert color="blue" variant="light">
          Custom layouts are saved for future use. PDF rendering from layout blocks is coming in a later release; system
          templates use the new preview and chart layouts today.
        </Alert>
        <TextInput label="Template name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
        <Textarea
          label="Layout JSON"
          minRows={12}
          value={layout}
          onChange={(e) => setLayout(e.currentTarget.value)}
          style={{ fontFamily: 'monospace' }}
        />
        <Button loading={busy} onClick={save}>
          Save custom template
        </Button>
      </Stack>
    </Card>
  )
}
