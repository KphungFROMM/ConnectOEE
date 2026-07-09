import { Badge, Button, Card, Group, Stack, Text } from '@mantine/core'
import type { DowntimeEvent } from '../../lib/metrics'
import { ReasonQuickButtons } from './ReasonAssignModal'

interface Props {
  pendingEvent: DowntimeEvent
  lineId: string
  machineId: string
  onAssign: (reason: string, category: string) => void
  onOpenAssignModal?: () => void
}

export function DowntimeActionBanner({
  pendingEvent,
  lineId,
  machineId,
  onAssign,
  onOpenAssignModal,
}: Props) {
  return (
    <Card
      withBorder
      padding="md"
      radius="md"
      style={{
        borderColor: 'var(--mantine-color-yellow-5)',
        position: 'sticky',
        top: 72,
        zIndex: 9,
        background: 'var(--mantine-color-body)',
      }}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Text fw={700} size="lg">
            Why is it stopped?
          </Text>
          {pendingEvent.faultCode != null ? (
            <Badge color="yellow" size="lg">
              PLC {pendingEvent.faultCode}
            </Badge>
          ) : null}
        </Group>
        <ReasonQuickButtons
          lineId={lineId}
          machineId={machineId}
          onAssign={onAssign}
          touch
        />
        {onOpenAssignModal ? (
          <Button variant="light" size="md" onClick={onOpenAssignModal}>
            More reasons…
          </Button>
        ) : null}
      </Stack>
    </Card>
  )
}
