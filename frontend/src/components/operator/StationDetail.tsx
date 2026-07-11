import { setDowntimeReason, type DowntimeEvent } from '../../lib/metrics'
import { isChangeoverReason } from '../../lib/productChange'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import { sendPlcCommand } from '../../lib/admin'
import { notifications } from '@mantine/notifications'
import { Button, Stack } from '@mantine/core'
import { DowntimeActionBanner } from './DowntimeActionBanner'
import { OperatorMachineHero } from './OperatorMachineHero'
import { OperatorProductStrip } from './OperatorProductStrip'
import { ShiftTargetStrip } from './ShiftTargetStrip'
import type { OperatorStation } from '../../lib/useOperatorStations'

interface Props {
  station: OperatorStation
  pendingEvent?: DowntimeEvent | null
  onOpenAssignModal?: (event: DowntimeEvent) => void
  onReasonAssigned?: () => void
  onChangeoverReason?: (event: DowntimeEvent) => void
}

export function StationDetail({
  station,
  pendingEvent,
  onOpenAssignModal,
  onReasonAssigned,
  onChangeoverReason,
}: Props) {
  const { hasPermission } = useAuth()
  const canSelect = hasPermission(Permissions.SelectProduct)
  const canPlcWrite = hasPermission(Permissions.PlcWrite)
  const machine = station.snapshot

  const needsReason = machine.state === 'Down' && !!pendingEvent

  async function assignReason(reason: string, category: string) {
    if (!pendingEvent) return
    try {
      await setDowntimeReason({ downtimeEventId: pendingEvent.id, reason, category })
      onReasonAssigned?.()
      if (isChangeoverReason(reason, category)) {
        onChangeoverReason?.(pendingEvent)
      } else {
        notifications.show({ message: 'Reason recorded', color: 'green' })
      }
    } catch {
      notifications.show({ message: 'Failed to record reason', color: 'red' })
    }
  }

  async function ackFault() {
    try {
      await sendPlcCommand(station.machineId, 'Ack')
      notifications.show({ message: 'Fault acknowledged', color: 'green' })
    } catch {
      notifications.show({ message: 'Ack failed — check control tag mapping', color: 'red' })
    }
  }

  return (
    <Stack gap="md">
      {needsReason && pendingEvent ? (
        <DowntimeActionBanner
          pendingEvent={pendingEvent}
          lineId={station.lineId}
          machineId={station.machineId}
          onAssign={(reason, category) => void assignReason(reason, category)}
          onOpenAssignModal={onOpenAssignModal ? () => onOpenAssignModal(pendingEvent) : undefined}
        />
      ) : null}

      <OperatorProductStrip
        lineId={station.lineId}
        machineId={station.machineId}
        machine={machine}
        canSelect={canSelect}
      />

      <OperatorMachineHero machine={machine} />

      {canPlcWrite ? (
        <Button color="orange" size="md" radius="md" onClick={() => void ackFault()} fullWidth>
          Acknowledge fault
        </Button>
      ) : null}

      <ShiftTargetStrip machine={machine} />
    </Stack>
  )
}
