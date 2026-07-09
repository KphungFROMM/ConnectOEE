import { Group, Text } from '@mantine/core'
import { HelpTrigger } from './help/HelpTrigger'
import { connectionColor, type ConnectionStatus } from '../theme/tokens'

const labels: Record<ConnectionStatus, string> = {
  connected: 'System OK',
  connecting: 'Connecting…',
  stale: 'Stale',
  disconnected: 'Disconnected',
  faulted: 'Faulted',
}

export function ConnectionIndicator({
  status,
  lastChecked,
}: {
  status: ConnectionStatus
  lastChecked: Date | null
}) {
  return (
    <Group gap={8} wrap="nowrap">
      <span
        aria-label={`Backend ${labels[status]}`}
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: connectionColor[status],
          boxShadow: `0 0 0 3px ${connectionColor[status]}22`,
          display: 'inline-block',
        }}
      />
      <Text size="sm" fw={500}>
        {labels[status]}
      </Text>
      {lastChecked && (
        <Text size="xs" c="dimmed">
          {lastChecked.toLocaleTimeString()}
        </Text>
      )}
      <HelpTrigger helpId="connection.state" size="xs" />
    </Group>
  )
}
