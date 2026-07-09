import { Button, Group, SegmentedControl, Select, Switch, Text, Tooltip } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import type { Granularity } from '../../lib/historian'

const PRESETS = [
  { value: '24', label: '24h' },
  { value: '168', label: '7d' },
  { value: '720', label: '30d' },
  { value: '2160', label: '90d' },
]

const GRANULARITIES: Granularity[] = ['Auto', 'Hour', 'Shift', 'Day', 'Week', 'Month']

interface Props {
  presetHours: string
  onPresetChange: (v: string) => void
  customRange: [Date | null, Date | null]
  onCustomRangeChange: (v: [Date | null, Date | null]) => void
  granularity: Granularity
  onGranularityChange: (v: Granularity) => void
  resolvedGranularity?: string
  pointCount?: number
  compare: boolean
  onCompareChange: (v: boolean) => void
  onExport?: () => void
  onOpenReports?: () => void
}

export function TimeRangeBar({
  presetHours,
  onPresetChange,
  customRange,
  onCustomRangeChange,
  granularity,
  onGranularityChange,
  resolvedGranularity,
  pointCount,
  compare,
  onCompareChange,
  onExport,
  onOpenReports,
}: Props) {
  const customActive = customRange[0] != null && customRange[1] != null

  return (
    <Group justify="space-between" align="flex-end" wrap="wrap" gap="sm">
      <Group gap="xs" wrap="wrap" align="flex-end">
        <SegmentedControl
          size="xs"
          value={customActive ? '' : presetHours}
          onChange={(v) => {
            if (v) {
              onCustomRangeChange([null, null])
              onPresetChange(v)
            }
          }}
          data={PRESETS}
        />
        <DatePickerInput
          type="range"
          size="xs"
          w={240}
          placeholder="Custom range"
          value={customRange}
          onChange={(v) => {
            const range = (v ?? [null, null]) as [Date | null, Date | null]
            onCustomRangeChange(range)
            if (range[0] && range[1]) onPresetChange('')
          }}
          clearable
        />
        <Select
          size="xs"
          w={110}
          value={granularity}
          onChange={(v) => onGranularityChange((v as Granularity) ?? 'Auto')}
          data={GRANULARITIES.map((g) => ({ value: g, label: g }))}
          allowDeselect={false}
        />
        {resolvedGranularity ? (
          <Text size="xs" c="dimmed">
            {resolvedGranularity}
            {pointCount != null ? ` · ${pointCount} pts` : ''}
          </Text>
        ) : null}
        <Tooltip label="Overlay prior period of same length on OEE trend and KPI deltas">
          <Switch size="xs" label="Compare" checked={compare} onChange={(e) => onCompareChange(e.currentTarget.checked)} />
        </Tooltip>
      </Group>
      <Group gap="xs">
        {onExport ? (
          <Button size="xs" variant="light" onClick={onExport}>
            Export CSV
          </Button>
        ) : null}
        {onOpenReports ? (
          <Button size="xs" variant="subtle" onClick={onOpenReports}>
            Open in Reports
          </Button>
        ) : null}
      </Group>
    </Group>
  )
}

export function resolveTimeRange(
  presetHours: string,
  customRange: [Date | null, Date | null],
): { from: string; to: string } {
  const to = new Date()
  if (customRange[0] && customRange[1]) {
    const start = new Date(customRange[0])
    start.setHours(0, 0, 0, 0)
    const end = new Date(customRange[1])
    end.setHours(23, 59, 59, 999)
    return { from: start.toISOString(), to: end.toISOString() }
  }
  const hours = Number(presetHours) || 168
  return { from: new Date(to.getTime() - hours * 3600_000).toISOString(), to: to.toISOString() }
}
