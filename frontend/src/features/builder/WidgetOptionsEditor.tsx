import { NumberInput, Select, Stack, TagsInput, Textarea, TextInput } from '@mantine/core'
import type { DashboardWidget } from '../../lib/dashboards'
import { SNAPSHOT_FIELDS, widgetMetaByType } from '../../components/widgets/registry'

const LAYOUT_KEYS = new Set([
  'content',
  'url',
  'align',
  'fontSize',
  'tabs',
  'dashboardId',
  'path',
  'label',
  'dataSource',
  'fields',
  'target',
  'limit',
  'alt',
  'title',
])

interface WidgetOptionsEditorProps {
  widget: DashboardWidget
  onChange: (patch: Partial<DashboardWidget>) => void
}

export function hasWidgetOptions(type: string): boolean {
  const opts = widgetMetaByType[type]?.options ?? []
  return opts.some((k) => LAYOUT_KEYS.has(k))
}

export function WidgetOptionsEditor({ widget, onChange }: WidgetOptionsEditorProps) {
  const meta = widgetMetaByType[widget.type]
  const opts = meta?.options ?? []

  function setOption(key: string, value: unknown) {
    onChange({ options: { ...widget.options, [key]: value } })
  }

  if (!opts.some((k) => LAYOUT_KEYS.has(k))) {
    return null
  }

  return (
    <Stack gap="xs">
      {opts.includes('content') ? (
        <Textarea
          label="Content"
          size="xs"
          minRows={3}
          value={(widget.options.content as string) ?? ''}
          onChange={(e) => setOption('content', e.currentTarget.value)}
        />
      ) : null}
      {opts.includes('url') ? (
        <TextInput
          label="URL"
          size="xs"
          value={(widget.options.url as string) ?? ''}
          onChange={(e) => setOption('url', e.currentTarget.value)}
          placeholder="https://…"
        />
      ) : null}
      {opts.includes('alt') ? (
        <TextInput
          label="Alt text"
          size="xs"
          value={(widget.options.alt as string) ?? ''}
          onChange={(e) => setOption('alt', e.currentTarget.value)}
        />
      ) : null}
      {opts.includes('align') ? (
        <Select
          label="Alignment"
          size="xs"
          data={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          value={(widget.options.align as string) ?? 'left'}
          onChange={(v) => setOption('align', v ?? 'left')}
        />
      ) : null}
      {opts.includes('fontSize') ? (
        <Select
          label="Font size"
          size="xs"
          data={['xs', 'sm', 'md', 'lg', 'xl']}
          value={(widget.options.fontSize as string) ?? 'sm'}
          onChange={(v) => setOption('fontSize', v ?? 'sm')}
        />
      ) : null}
      {opts.includes('tabs') ? (
        <TagsInput
          label="Tab labels"
          size="xs"
          value={((widget.options.tabs as string[]) ?? ['Tab 1']).map(String)}
          onChange={(v) => setOption('tabs', v)}
          placeholder="Add tab name"
        />
      ) : null}
      {opts.includes('dashboardId') ? (
        <TextInput
          label="Dashboard ID"
          size="xs"
          value={(widget.options.dashboardId as string) ?? ''}
          onChange={(e) => setOption('dashboardId', e.currentTarget.value)}
        />
      ) : null}
      {opts.includes('path') ? (
        <TextInput
          label="Navigation path"
          size="xs"
          value={(widget.options.path as string) ?? '/plant-explorer'}
          onChange={(e) => setOption('path', e.currentTarget.value)}
        />
      ) : null}
      {opts.includes('label') ? (
        <TextInput
          label="Button label"
          size="xs"
          value={(widget.options.label as string) ?? ''}
          onChange={(e) => setOption('label', e.currentTarget.value)}
        />
      ) : null}
      {opts.includes('title') ? (
        <TextInput
          label="Panel title"
          size="xs"
          value={(widget.options.title as string) ?? ''}
          onChange={(e) => setOption('title', e.currentTarget.value)}
        />
      ) : null}
      {opts.includes('dataSource') ? (
        <Select
          label="Data source"
          size="xs"
          data={[
            { value: 'lines', label: 'Lines' },
            { value: 'downtime', label: 'Downtime events' },
            { value: 'snapshots', label: 'Live snapshots' },
          ]}
          value={(widget.options.dataSource as string) ?? 'lines'}
          onChange={(v) => setOption('dataSource', v ?? 'lines')}
        />
      ) : null}
      {opts.includes('fields') ? (
        <TagsInput
          label="KPI fields"
          size="xs"
          value={((widget.options.fields as string[]) ?? ['oeePct', 'availabilityPct']).map(String)}
          onChange={(v) => setOption('fields', v)}
          placeholder="Snapshot field name"
        />
      ) : null}
      {opts.includes('target') ? (
        <NumberInput
          label="Target count"
          size="xs"
          min={0}
          value={(widget.options.target as number) ?? 0}
          onChange={(v) => setOption('target', typeof v === 'number' ? v : 0)}
        />
      ) : null}
      {opts.includes('limit') ? (
        <NumberInput
          label="Row limit"
          size="xs"
          min={1}
          max={50}
          value={(widget.options.limit as number) ?? 10}
          onChange={(v) => setOption('limit', typeof v === 'number' ? v : 10)}
        />
      ) : null}
    </Stack>
  )
}

export { SNAPSHOT_FIELDS }
