import { Badge, Button, Group, Modal, Select, SimpleGrid, Stack, Tabs, Text, TextInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useState } from 'react'
import { setDowntimeReason, type DowntimeEvent } from '../../lib/metrics'
import { isChangeoverReason } from '../../lib/productChange'
import { useDowntimeReasonCatalog } from './useDowntimeReasonCatalog'

const OTHER_CATEGORIES = ['Breakdown', 'SetupAndAdjustment', 'SmallStop', 'ReducedSpeed', 'StartupReject', 'ProductionReject']

function prettyCategory(c: string) {
  return c.replace(/([a-z])([A-Z])/g, '$1 $2')
}

interface Props {
  opened: boolean
  event: DowntimeEvent | null
  lineId: string | null
  pendingReviewCodes: Set<number>
  onClose: () => void
  onAssigned: () => void
  onAssignedReason?: (reason: string, category: string) => void
}

export function ReasonAssignModal({
  opened,
  event,
  lineId,
  pendingReviewCodes,
  onClose,
  onAssigned,
  onAssignedReason,
}: Props) {
  const { byCategory, options } = useDowntimeReasonCatalog(lineId, event?.machineId ?? undefined)
  const [otherReason, setOtherReason] = useState('')
  const [otherCategory, setOtherCategory] = useState('Breakdown')

  async function assign(reason: string, category: string) {
    if (!event) return
    try {
      await setDowntimeReason({ downtimeEventId: event.id, reason, category })
      if (!isChangeoverReason(reason, category)) {
        notifications.show({ message: 'Reason recorded', color: 'green' })
      }
      setOtherReason('')
      onAssigned()
      onAssignedReason?.(reason, category)
      onClose()
    } catch {
      notifications.show({ message: 'Failed to record reason', color: 'red' })
    }
  }

  const categories = [...byCategory.keys()]

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Why did the line stop?"
      centered
      size="lg"
    >
      {event ? (
        <Stack gap="sm">
          <Group gap="xs">
            <Badge variant="light">{event.category}</Badge>
            <Text size="sm" c="dimmed">
              {new Date(event.startUtc).toLocaleString()}
            </Text>
            {event.faultCode != null ? (
              <Badge color={pendingReviewCodes.has(event.faultCode) ? 'yellow' : 'red'}>
                PLC {event.faultCode}
                {pendingReviewCodes.has(event.faultCode) ? ' · needs review' : ''}
              </Badge>
            ) : null}
          </Group>

          <Tabs defaultValue={categories[0] ?? 'other'}>
            <Tabs.List>
              {categories.map((c) => (
                <Tabs.Tab key={c} value={c}>
                  {prettyCategory(c)}
                </Tabs.Tab>
              ))}
              <Tabs.Tab value="other">Other</Tabs.Tab>
            </Tabs.List>
            {categories.map((c) => (
              <Tabs.Panel key={c} value={c} pt="md">
                <ReasonButtonGrid
                  items={byCategory.get(c) ?? []}
                  onPick={(r) => assign(r.label, r.category)}
                />
              </Tabs.Panel>
            ))}
            <Tabs.Panel value="other" pt="md">
              <Stack gap="sm">
                <TextInput
                  label="Describe the stop"
                  placeholder="e.g. Conveyor jam at infeed"
                  value={otherReason}
                  onChange={(e) => setOtherReason(e.currentTarget.value)}
                />
                <Select
                  label="Loss category"
                  data={OTHER_CATEGORIES}
                  value={otherCategory}
                  onChange={(v) => setOtherCategory(v ?? 'Breakdown')}
                />
                <Button disabled={!otherReason.trim()} onClick={() => assign(otherReason.trim(), otherCategory)}>
                  Record reason
                </Button>
              </Stack>
            </Tabs.Panel>
          </Tabs>

          {categories.length === 0 ? (
            <ReasonButtonGrid items={options} onPick={(r) => assign(r.label, r.category)} />
          ) : null}
        </Stack>
      ) : null}
    </Modal>
  )
}

function ReasonButtonGrid({
  items,
  onPick,
}: {
  items: { label: string; category: string; needsReview?: boolean }[]
  onPick: (r: { label: string; category: string }) => void
}) {
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {items.map((r) => (
        <Button
          key={`${r.category}-${r.label}`}
          variant="light"
          size="lg"
          h={64}
          onClick={() => onPick(r)}
        >
          {r.label}
          {r.needsReview ? (
            <Badge ml={6} size="xs" color="yellow">
              Review
            </Badge>
          ) : null}
        </Button>
      ))}
    </SimpleGrid>
  )
}

/** Inline quick-assign buttons (widget pad). */
export function ReasonQuickButtons({
  lineId,
  machineId,
  onAssign,
  max = 6,
  touch = false,
}: {
  lineId?: string | null
  machineId?: string | null
  onAssign: (reason: string, category: string) => void
  max?: number
  touch?: boolean
}) {
  const { options, usingFallback } = useDowntimeReasonCatalog(lineId, machineId)
  return (
    <Stack gap="xs">
      {usingFallback ? (
        <Text size="xs" c="orange">
          Using default reasons — line catalog unavailable.
        </Text>
      ) : null}
      <SimpleGrid cols={touch ? { base: 2, sm: 4 } : 2} spacing={touch ? 'sm' : 4}>
        {options.slice(0, max).map((r) => (
          <Button
            key={r.label}
            size={touch ? 'lg' : 'compact-sm'}
            h={touch ? 48 : undefined}
            variant="light"
            onClick={() => onAssign(r.label, r.category)}
          >
            {r.label}
          </Button>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
