import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { TagPickerModal } from '../../components/tags/TagPickerModal'
import { SNAPSHOT_FIELDS, widgetMetaByType } from '../../components/widgets/registry'
import { resolveScopedField } from '../../components/widgets/resolveScopedSnapshot'
import type { WidgetCtx } from '../../components/widgets/common'
import { FRAME_VARIANT_WIDGET_TYPES } from '../../components/widgets/common'
import { GRID_COLS } from './gridConstants'
import { listConnections, type PlcConnection } from '../../lib/admin'
import type { DashboardWidget, WidgetBinding } from '../../lib/dashboards'
import { readTagValues } from '../../lib/tags'

export const TREND_FIELD_OPTIONS = [
  { value: 'oeePct', label: 'OEE %' },
  { value: 'availabilityPct', label: 'Availability %' },
  { value: 'performancePct', label: 'Performance %' },
  { value: 'qualityPct', label: 'Quality %' },
  { value: 'teepPct', label: 'TEEP %' },
  { value: 'uptimeMin', label: 'Uptime (min)' },
  { value: 'downtimeMin', label: 'Downtime (min)' },
  { value: 'availabilityLossMin', label: 'A loss (min)' },
  { value: 'performanceLossMin', label: 'P loss (min)' },
  { value: 'qualityLossMin', label: 'Q loss (min)' },
]

function bindingKind(widget: DashboardWidget): 'snapshot' | 'tag' {
  if (widget.type === 'live-tag-value' || widget.type === 'udt-member-value') return 'tag'
  const k = widget.binding.bindingKind
  if (k === 'tag') return 'tag'
  return 'snapshot'
}

function supportsTagBinding(type: string, opts: string[]): boolean {
  return type === 'live-tag-value' || type === 'udt-member-value' || opts.includes('binding')
}

interface BindingEditorProps {
  widget: DashboardWidget
  machineId?: string | null
  lineId?: string | null
  onChange: (patch: Partial<DashboardWidget>) => void
  ctx: WidgetCtx
}

export function BindingEditor({ widget, lineId, onChange, ctx }: BindingEditorProps) {
  const meta = widgetMetaByType[widget.type]
  const opts = meta?.options ?? []
  const kind = bindingKind(widget)
  const [tagPickerOpen, setTagPickerOpen] = useState(false)
  const [connections, setConnections] = useState<PlcConnection[]>([])
  const [tagPreview, setTagPreview] = useState<string | null>(null)

  useEffect(() => {
    void listConnections().then(setConnections).catch(() => undefined)
  }, [])

  const lineConnections = useMemo(
    () => connections.filter((c) => c.enabled && (!lineId || c.lineId === lineId)),
    [connections, lineId],
  )

  const connectionId =
    widget.binding.connectionId ?? lineConnections[0]?.id ?? connections.find((c) => c.enabled)?.id ?? null

  useEffect(() => {
    const path = widget.binding.tagPath
    const conn = widget.binding.connectionId ?? connectionId
    if (kind !== 'tag' || !path || !conn) {
      setTagPreview(null)
      return
    }
    let cancelled = false
    const load = () => {
      void readTagValues(conn, [{ path }])
        .then((rows) => {
          if (!cancelled) setTagPreview(rows[0]?.display ?? String(rows[0]?.value ?? '—'))
        })
        .catch(() => {
          if (!cancelled) setTagPreview(null)
        })
    }
    load()
    const t = setInterval(load, 2000)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [kind, widget.binding.tagPath, widget.binding.connectionId, connectionId])

  const field = widget.binding.field
  const liveRaw =
    kind === 'snapshot' && field ? resolveScopedField(ctx, widget.binding, field) : undefined
  const liveValue = liveRaw ?? undefined

  function setBinding(patch: Partial<WidgetBinding>) {
    onChange({ binding: { ...widget.binding, ...patch } })
  }

  function setKind(next: 'snapshot' | 'tag') {
    if (next === 'snapshot') {
      setBinding({ bindingKind: 'snapshot', field: field ?? SNAPSHOT_FIELDS[0]?.value })
    } else {
      setBinding({ bindingKind: 'tag', connectionId: connectionId ?? undefined })
    }
  }

  const tagOnly = widget.type === 'live-tag-value' || widget.type === 'udt-member-value'
  const showKpiBinding = opts.includes('field') && !tagOnly
  const showTagBinding = supportsTagBinding(widget.type, opts)
  const showModeSwitch = showKpiBinding && showTagBinding

  return (
    <Stack gap="xs">
      {opts.includes('source') ? (
        <Select
          label={kind === 'snapshot' ? 'Roll-up scope' : 'Historian scope'}
          size="xs"
          data={[
            { value: 'machine', label: 'Machine' },
            { value: 'line', label: 'Line' },
            { value: 'plant', label: 'Plant' },
          ]}
          value={widget.binding.source ?? 'line'}
          onChange={(v) => setBinding({ source: (v ?? 'line') as WidgetBinding['source'] })}
        />
      ) : null}

      {showKpiBinding || showTagBinding ? (
        <>
          {showModeSwitch ? (
            <SegmentedControl
              size="xs"
              value={kind}
              onChange={(v) => setKind(v as 'snapshot' | 'tag')}
              data={[
                { value: 'snapshot', label: 'KPI' },
                { value: 'tag', label: 'PLC tag' },
              ]}
            />
          ) : null}

          {kind === 'snapshot' && showKpiBinding ? (
            <>
              <Select
                label="Snapshot field"
                size="xs"
                data={SNAPSHOT_FIELDS}
                value={field ?? null}
                onChange={(v) => setBinding({ field: v ?? undefined })}
                searchable
              />
              {liveValue !== undefined && liveValue !== null ? (
                <Text size="xs" c="dimmed">
                  Live preview: <b>{String(liveValue)}</b>
                </Text>
              ) : (
                <Text size="xs" c="dimmed">
                  Set plant/line/machine in toolbar for live preview.
                </Text>
              )}
            </>
          ) : null}

          {kind === 'tag' && showTagBinding ? (
            <>
              <Select
                label="PLC connection"
                size="xs"
                data={lineConnections.map((c) => ({ value: c.id, label: c.name }))}
                value={widget.binding.connectionId ?? connectionId}
                onChange={(v) => setBinding({ connectionId: v ?? undefined })}
              />
              <TextInput
                label="Tag path"
                size="xs"
                value={widget.binding.tagPath ?? ''}
                onChange={(e) => setBinding({ tagPath: e.currentTarget.value })}
                placeholder="Program:MainProgram.Counter"
              />
              <Button size="xs" variant="light" onClick={() => setTagPickerOpen(true)}>
                Browse tags…
              </Button>
              {tagPreview !== null ? (
                <Text size="xs" c="dimmed">
                  Live preview: <b>{tagPreview}</b>
                </Text>
              ) : null}
              <TagPickerModal
                opened={tagPickerOpen}
                onClose={() => setTagPickerOpen(false)}
                connectionId={widget.binding.connectionId ?? connectionId}
                signalName={widget.title ?? 'Widget tag'}
                onSelect={(tag) => {
                  setBinding({ tagPath: tag.fullPath, connectionId: connectionId ?? undefined })
                  setTagPickerOpen(false)
                }}
              />
            </>
          ) : null}
        </>
      ) : null}

      {opts.includes('factor') ? (
        <Select
          label="Factor"
          size="xs"
          data={[
            { value: 'A', label: 'Availability' },
            { value: 'P', label: 'Performance' },
            { value: 'Q', label: 'Quality' },
          ]}
          value={(widget.options.factor as string) ?? 'A'}
          onChange={(v) => onChange({ options: { ...widget.options, factor: (v ?? 'A') as 'A' | 'P' | 'Q' } })}
        />
      ) : null}
      {opts.includes('mode') ? (
        <Select
          label="Display mode"
          size="xs"
          data={[
            { value: 'percent', label: 'Percent' },
            { value: 'minutes', label: 'Loss minutes' },
          ]}
          value={(widget.options.mode as string) ?? 'percent'}
          onChange={(v) => onChange({ options: { ...widget.options, mode: v ?? 'percent' } })}
        />
      ) : null}
      {opts.includes('trendField') ? (
        <Select
          label="Trend field"
          size="xs"
          data={TREND_FIELD_OPTIONS}
          value={(widget.options.trendField as string) ?? 'oeePct'}
          onChange={(v) => onChange({ options: { ...widget.options, trendField: v ?? 'oeePct' } })}
          searchable
        />
      ) : null}
      {opts.includes('kind') ? (
        <Select
          label="Value kind"
          size="xs"
          data={['number', 'percent', 'count']}
          value={(widget.options.kind as string) ?? 'number'}
          onChange={(v) =>
            onChange({ options: { ...widget.options, kind: (v ?? 'number') as 'percent' | 'number' | 'count' } })
          }
        />
      ) : null}
      {opts.includes('unit') ? (
        <TextInput
          label="Unit"
          size="xs"
          value={(widget.options.unit as string) ?? ''}
          onChange={(e) => onChange({ options: { ...widget.options, unit: e.currentTarget.value } })}
        />
      ) : null}
      {opts.includes('decimals') ? (
        <NumberInput
          label="Decimals"
          size="xs"
          min={0}
          max={4}
          value={(widget.options.decimals as number) ?? 0}
          onChange={(v) => onChange({ options: { ...widget.options, decimals: typeof v === 'number' ? v : 0 } })}
        />
      ) : null}
      {opts.includes('tone') ? (
        <Select
          label="Tone"
          size="xs"
          data={['neutral', 'good', 'bad']}
          value={(widget.options.tone as string) ?? 'neutral'}
          onChange={(v) =>
            onChange({ options: { ...widget.options, tone: (v ?? 'neutral') as 'good' | 'bad' | 'neutral' } })
          }
        />
      ) : null}
    </Stack>
  )
}

export function LayoutFields({
  widget,
  onChange,
}: {
  widget: DashboardWidget
  onChange: (patch: Partial<DashboardWidget>) => void
}) {
  const showVariant = FRAME_VARIANT_WIDGET_TYPES.has(widget.type)
  return (
    <Stack gap="xs">
      {showVariant ? (
        <SegmentedControl
          size="xs"
          fullWidth
          value={(widget.options.frameVariant as string) ?? 'default'}
          onChange={(v) => onChange({ options: { ...widget.options, frameVariant: v } })}
          data={[
            { value: 'default', label: 'Default' },
            { value: 'compact', label: 'Compact' },
            { value: 'hero', label: 'Hero' },
            { value: 'kiosk', label: 'Kiosk' },
          ]}
        />
      ) : null}
      <Group gap={6}>
      <NumberInput
        label="X"
        size="xs"
        min={0}
        max={GRID_COLS - 1}
        value={widget.x}
        onChange={(v) => onChange({ x: typeof v === 'number' ? v : widget.x })}
        w={56}
      />
      <NumberInput label="Y" size="xs" min={0} value={widget.y} onChange={(v) => onChange({ y: typeof v === 'number' ? v : widget.y })} w={56} />
      <NumberInput
        label="W"
        size="xs"
        min={1}
        max={GRID_COLS}
        value={widget.w}
        onChange={(v) => onChange({ w: typeof v === 'number' ? v : widget.w })}
        w={56}
      />
      <NumberInput label="H" size="xs" min={1} value={widget.h} onChange={(v) => onChange({ h: typeof v === 'number' ? v : widget.h })} w={56} />
      </Group>
    </Stack>
  )
}
