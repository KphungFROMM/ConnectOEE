import { useMemo, type ReactNode } from 'react'
import {
  Anchor,
  Badge,
  Breadcrumbs,
  Button,
  Group,
  Paper,
  Progress,
  Select,
  Text,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { IconBolt } from '@tabler/icons-react'
import type { OperatorFilters } from '../../lib/useOperatorStations'
import type { MachineSnapshot } from '../../lib/liveHub'
import { formatDurationSeconds } from '../../lib/formatDuration'

interface Props {
  filters: OperatorFilters
  plantOptions: { value: string; label: string }[]
  lineOptions: { value: string; label: string }[]
  machineOptions: { value: string; label: string }[]
  onFiltersChange: (patch: Partial<OperatorFilters>) => void
  hubConnected: boolean
  summary: { stationCount: number; needReasonCount: number; downCount: number }
  shiftSnapshot?: MachineSnapshot | null
  selectedMachineName?: string | null
  onBackToGrid?: () => void
  machineTabs?: ReactNode
}

export function OperatorScopeBar({
  filters,
  plantOptions,
  lineOptions,
  machineOptions,
  onFiltersChange,
  hubConnected,
  summary,
  shiftSnapshot,
  selectedMachineName,
  onBackToGrid,
  machineTabs,
}: Props) {
  const breadcrumb = useMemo(() => {
    const parts: string[] = []
    const plant = plantOptions.find((p) => p.value === filters.plantId)
    if (plant) parts.push(plant.label)
    const line = lineOptions.find((l) => l.value === filters.lineId)
    if (line) parts.push(line.label.split(' › ').pop() ?? line.label)
    const machine = machineOptions.find((m) => m.value === filters.machineId)
    if (machine) parts.push(machine.label)
    else if (selectedMachineName) parts.push(selectedMachineName)
    return parts
  }, [filters, plantOptions, lineOptions, machineOptions, selectedMachineName])

  const shiftProgress = useMemo(() => {
    if (!shiftSnapshot?.shiftStartUtc || !shiftSnapshot?.shiftEndUtc) return null
    const start = new Date(shiftSnapshot.shiftStartUtc).getTime()
    const end = new Date(shiftSnapshot.shiftEndUtc).getTime()
    const now = Date.now()
    const total = Math.max(1, end - start)
    const elapsed = Math.max(0, Math.min(total, now - start))
    return {
      pct: (elapsed / total) * 100,
      remainingSec: Math.max(0, (end - now) / 1000),
      name: shiftSnapshot.shiftName,
    }
  }, [shiftSnapshot])

  return (
    <Paper withBorder p="md" radius="md" style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--mantine-color-body)' }}>
      <Group justify="space-between" wrap="wrap" mb="sm">
        <div>
          <Group gap="sm">
            {onBackToGrid ? (
              <Button variant="subtle" size="compact-sm" onClick={onBackToGrid}>
                ← All stations
              </Button>
            ) : null}
            <Text fw={700} size="lg">
              Operator Station
            </Text>
          </Group>
          {breadcrumb.length > 0 ? (
            <Breadcrumbs separator="›" mt={4}>
              {breadcrumb.map((b) => (
                <Text key={b} size="sm" c="dimmed">
                  {b}
                </Text>
              ))}
            </Breadcrumbs>
          ) : null}
        </div>
        <Group gap="xs">
          <Badge variant="light" color={hubConnected ? 'green' : 'gray'} leftSection={<IconBolt size={12} />}>
            {hubConnected ? 'Live' : 'Connecting…'}
          </Badge>
          <Anchor component={Link} to="/plant-explorer" size="sm">
            Plant Explorer
          </Anchor>
        </Group>
      </Group>

      {shiftProgress ? (
        <Group mb="sm" gap="sm" wrap="wrap">
          <Text size="sm" c="dimmed">
            {shiftProgress.name} shift · {formatDurationSeconds(shiftProgress.remainingSec)} left
          </Text>
          <Progress value={shiftProgress.pct} size="sm" radius="xl" style={{ flex: 1, minWidth: 120, maxWidth: 280 }} />
        </Group>
      ) : null}

      <Group gap="sm" wrap="wrap" mb="sm">
        {plantOptions.length > 1 ? (
          <Select
            size="sm"
            w={160}
            label="Plant"
            value={filters.plantId}
            onChange={(v) => onFiltersChange({ plantId: v, lineId: null, machineId: null })}
            data={plantOptions}
            allowDeselect={false}
          />
        ) : null}
        <Select
          size="sm"
          w={200}
          label="Line"
          placeholder="All lines"
          value={filters.lineId}
          onChange={(v) => onFiltersChange({ lineId: v, machineId: null })}
          onClear={() => onFiltersChange({ lineId: null, machineId: null })}
          data={lineOptions}
          clearable
          rightSectionPointerEvents="all"
          disabled={lineOptions.length === 0}
        />
        <Select
          size="sm"
          w={160}
          label="Machine"
          placeholder="All stations"
          value={filters.machineId}
          onChange={(v) => onFiltersChange({ machineId: v })}
          onClear={() => onFiltersChange({ machineId: null })}
          data={machineOptions}
          clearable
          rightSectionPointerEvents="all"
          disabled={!filters.lineId}
        />
      </Group>

      {machineTabs ? <div style={{ marginBottom: 12 }}>{machineTabs}</div> : null}

      <Group gap="xs">
        <Badge variant="light">{summary.stationCount} stations</Badge>
        <Badge variant="light" color={summary.needReasonCount > 0 ? 'orange' : 'green'}>
          {summary.needReasonCount} need reason
        </Badge>
        {summary.downCount > 0 ? (
          <Badge variant="light" color="red">
            {summary.downCount} down
          </Badge>
        ) : null}
      </Group>
    </Paper>
  )
}
