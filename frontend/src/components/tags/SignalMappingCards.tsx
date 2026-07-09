import { Badge, Button, Card, Divider, Group, Select, Stack, Text, TextInput } from '@mantine/core'
import { IconCheck, IconSearch, IconX } from '@tabler/icons-react'
import type { SignalDto } from '../../lib/admin'

interface SignalMappingCardsProps {
  signals: SignalDto[]
  machineLabel?: string | null
  supportsBrowsing: boolean
  paths: Record<string, string>
  onPathChange: (signalId: string, path: string) => void
  onBrowse: (signal: SignalDto) => void
  onUnmap: (signal: SignalDto) => void
  onSaveManual: (signalId: string) => void
  onRunStateModeChange: (signal: SignalDto, mode: string | null) => void
  onIngestModeChange: (signal: SignalDto, mode: string | null) => void
  emptyMessage?: string
}

export function SignalMappingCards({
  signals,
  machineLabel,
  supportsBrowsing,
  paths,
  onPathChange,
  onBrowse,
  onUnmap,
  onSaveManual,
  onRunStateModeChange,
  onIngestModeChange,
  emptyMessage = 'Pick a machine to map tags.',
}: SignalMappingCardsProps) {
  if (signals.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        {emptyMessage}
      </Text>
    )
  }

  const listTitle = machineLabel ? `Signals for ${machineLabel}` : 'Signals'

  return (
    <Card withBorder radius="md" padding="md">
      <Text fw={600} mb="md">
        {listTitle}
      </Text>
      <Stack gap="md">
        {signals.map((s, index) => (
          <div key={s.id}>
            {index > 0 ? <Divider mb="md" /> : null}
            <SignalSection
              signal={s}
              supportsBrowsing={supportsBrowsing}
              manualPath={paths[s.id] ?? ''}
              onPathChange={(path) => onPathChange(s.id, path)}
              onBrowse={() => onBrowse(s)}
              onUnmap={() => onUnmap(s)}
              onSaveManual={() => onSaveManual(s.id)}
              onRunStateModeChange={(mode) => onRunStateModeChange(s, mode)}
              onIngestModeChange={(mode) => onIngestModeChange(s, mode)}
            />
          </div>
        ))}
      </Stack>
    </Card>
  )
}

function SignalSection({
  signal,
  supportsBrowsing,
  manualPath,
  onPathChange,
  onBrowse,
  onUnmap,
  onSaveManual,
  onRunStateModeChange,
  onIngestModeChange,
}: {
  signal: SignalDto
  supportsBrowsing: boolean
  manualPath: string
  onPathChange: (path: string) => void
  onBrowse: () => void
  onUnmap: () => void
  onSaveManual: () => void
  onRunStateModeChange: (mode: string | null) => void
  onIngestModeChange: (mode: string | null) => void
}) {
  const isCountRole = signal.role === 'GoodCount' || signal.role === 'RejectCount' || signal.role === 'TotalCount'
  const isRunStateRole = signal.role === 'RunState'

  return (
    <Stack gap="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Group gap={6} wrap="wrap">
          <Text fw={600} size="sm">
            {signal.name}
          </Text>
          {signal.required ? (
            <Badge size="xs" color="orange" variant="light">
              required
            </Badge>
          ) : null}
          <Text size="xs" c="dimmed">
            {signal.expectedType}
            {signal.unit ? ` · ${signal.unit}` : ''}
          </Text>
        </Group>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {signal.isMapped ? (
            <IconCheck size={14} color="var(--mantine-color-green-filled)" />
          ) : (
            <IconX size={14} color="var(--mantine-color-gray-5)" />
          )}
          <Text size="xs" c={signal.isMapped ? 'green' : 'dimmed'} fw={500}>
            {signal.isMapped ? 'Mapped' : 'Unmapped'}
          </Text>
        </Group>
      </Group>

      {isCountRole ? (
        <Select
          label="Ingest mode"
          description="How ConnectOEE reads this count from the PLC"
          data={[
            { value: 'CumulativeDelta', label: 'Cumulative delta' },
            { value: 'PulseRisingEdge', label: 'Pulse (rising edge)' },
          ]}
          value={signal.countIngestMode ?? 'CumulativeDelta'}
          onChange={onIngestModeChange}
        />
      ) : isRunStateRole ? (
        <Select
          label="Ingest mode"
          description="How the run-state tag is interpreted"
          data={[
            { value: 'DirectEnum', label: 'Direct enum (INT)' },
            { value: 'SingleBool', label: 'Single BOOL' },
            { value: 'MultiBool', label: 'Multi BOOL' },
          ]}
          value={signal.runStateIngestMode ?? 'DirectEnum'}
          onChange={onRunStateModeChange}
        />
      ) : null}

      <div>
        <Text size="sm" fw={500} mb={6}>
          Tag path
        </Text>
        {supportsBrowsing ? (
          signal.isMapped ? (
            <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
              {signal.mappedPath}
            </Text>
          ) : (
            <Text size="sm" c="dimmed">
              Not mapped yet — browse the controller to pick a tag.
            </Text>
          )
        ) : (
          <TextInput
            placeholder="Program:MainProgram.Tag"
            value={manualPath}
            onChange={(e) => onPathChange(e.currentTarget.value)}
          />
        )}
      </div>

      {supportsBrowsing ? (
        <Button leftSection={<IconSearch size={16} />} fullWidth onClick={onBrowse}>
          Browse tags
        </Button>
      ) : (
        <Button fullWidth onClick={onSaveManual} disabled={!manualPath.trim()}>
          Save mapping
        </Button>
      )}
      {signal.isMapped ? (
        <Button variant="subtle" color="red" size="xs" onClick={onUnmap}>
          Unmap
        </Button>
      ) : null}
    </Stack>
  )
}
