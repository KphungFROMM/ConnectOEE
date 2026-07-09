import {
  Accordion,
  Alert,
  Box,
  Group,
  Progress,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { IconCheck, IconChevronRight } from '@tabler/icons-react'
import type { MachineMappingStatus } from './machineMappingStatus'

interface MachineMappingChecklistProps {
  statuses: MachineMappingStatus[]
  selectedMachineId: string | null
  onSelectMachine: (machineId: string) => void
  filterLabel: string
}

export function MachineMappingChecklist({
  statuses,
  selectedMachineId,
  onSelectMachine,
  filterLabel,
}: MachineMappingChecklistProps) {
  if (statuses.length === 0) return null

  const complete = statuses.filter((s) => s.complete)
  const incomplete = statuses.filter((s) => !s.complete)
  const total = statuses.length
  const mapped = complete.length
  const pct = total > 0 ? Math.round((mapped / total) * 100) : 0

  return (
    <Stack gap="sm">
      <Box>
        <Group justify="space-between" mb={6}>
          <Text size="sm" fw={600}>
            Machine progress
          </Text>
          <Text size="sm" c="dimmed">
            {mapped} of {total} complete
          </Text>
        </Group>
        <Progress value={pct} size="sm" radius="xl" />
      </Box>

      {incomplete.length === 0 ? (
        <Alert color="green" variant="light">
          All machines have {filterLabel} mapped.
        </Alert>
      ) : (
        <>
          <Text size="sm" fw={600}>
            Still need mapping ({incomplete.length})
          </Text>
          <Stack gap={4}>
            {incomplete.map((s) => (
              <MachineRow
                key={s.machineId}
                status={s}
                selected={s.machineId === selectedMachineId}
                onSelect={() => onSelectMachine(s.machineId)}
              />
            ))}
          </Stack>
        </>
      )}

      {complete.length > 0 ? (
        complete.length > 3 ? (
          <Accordion variant="contained" radius="sm">
            <Accordion.Item value="complete">
              <Accordion.Control>
                <Group gap={6}>
                  <IconCheck size={14} color="var(--mantine-color-green-filled)" />
                  <Text size="sm" fw={500}>
                    Complete ({complete.length})
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap={4}>
                  {complete.map((s) => (
                    <CompleteRow key={s.machineId} label={s.label} />
                  ))}
                </Stack>
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        ) : (
          <Stack gap={4}>
            <Text size="sm" fw={600} c="dimmed">
              Complete ({complete.length})
            </Text>
            {complete.map((s) => (
              <CompleteRow key={s.machineId} label={s.label} />
            ))}
          </Stack>
        )
      ) : null}
    </Stack>
  )
}

function MachineRow({
  status,
  selected,
  onSelect,
}: {
  status: MachineMappingStatus
  selected: boolean
  onSelect: () => void
}) {
  return (
    <UnstyledButton
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        padding: '8px 10px',
        borderRadius: 'var(--mantine-radius-sm)',
        border: `1px solid ${selected ? 'var(--mantine-color-blue-4)' : 'var(--mantine-color-default-border)'}`,
        background: selected ? 'var(--mantine-color-blue-light)' : undefined,
      }}
    >
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="sm" fw={500} truncate>
            {status.label}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            Missing: {status.missingSignals.join(', ')}
          </Text>
        </Box>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Text size="xs" c="blue" fw={500}>
            Go
          </Text>
          <IconChevronRight size={14} />
        </Group>
      </Group>
    </UnstyledButton>
  )
}

function CompleteRow({ label }: { label: string }) {
  return (
    <Group gap={6} py={4} px={8}>
      <IconCheck size={14} color="var(--mantine-color-green-filled)" />
      <Text size="sm" c="dimmed">
        {label}
      </Text>
    </Group>
  )
}
