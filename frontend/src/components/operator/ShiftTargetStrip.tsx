import { useMemo } from 'react'
import { Group, Paper, Progress, SimpleGrid, Stack, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../lib/liveHub'
import { idealCycleSourceLabel } from '../../lib/idealRate'
import { MetricLabel } from '../help/HelpTrigger'

interface Props {
  machine: MachineSnapshot
}

function computePace(snap: MachineSnapshot): number | null {
  if (!snap.shiftStartUtc || !snap.shiftEndUtc || !snap.idealRatePph) return null
  const start = new Date(snap.shiftStartUtc).getTime()
  const elapsed = Math.max(1, Date.now() - start)
  const expected = (snap.idealRatePph * elapsed) / 3600_000
  if (expected <= 0) return null
  return ((snap.goodCount - expected) / expected) * 100
}

function computeActualRatePph(machine: MachineSnapshot): number {
  if (machine.actualRatePph > 0) return machine.actualRatePph
  if (!machine.shiftStartUtc) return 0
  const elapsedH = Math.max(1 / 3600, (Date.now() - new Date(machine.shiftStartUtc).getTime()) / 3600_000)
  return machine.goodCount / elapsedH
}

export function ShiftTargetStrip({ machine }: Props) {
  const pace = useMemo(() => computePace(machine), [machine])

  const countToGo = useMemo(() => {
    if (!machine.shiftEndUtc || !machine.idealRatePph) return null
    const remainingH = Math.max(0, (new Date(machine.shiftEndUtc).getTime() - Date.now()) / 3600_000)
    const target = Math.round(machine.goodCount + machine.idealRatePph * remainingH)
    const remaining = Math.max(0, target - machine.goodCount)
    return { target, remaining, pct: target > 0 ? Math.min(100, (machine.goodCount / target) * 100) : 0 }
  }, [machine])

  const actualRate = computeActualRatePph(machine)
  const idealRate = machine.idealRatePph ?? 0
  const ratePct = idealRate > 0 ? Math.min(100, (actualRate / idealRate) * 100) : 0
  const sourceLabel = idealCycleSourceLabel(machine.idealCycleSource)

  if (!countToGo && pace == null && idealRate <= 0) return null

  return (
    <Paper withBorder p="md" radius="md">
      <SimpleGrid cols={{ base: 1, md: 3 }} spacing="md">
        {countToGo ? (
          <Stack gap="xs">
            <MetricLabel label="Est. count to go (shift)" helpId="goodCount" />
            <Text size="32px" fw={800} lh={1}>
              {countToGo.remaining.toLocaleString()}
            </Text>
            <Text size="xs" c="dimmed">
              {machine.goodCount.toLocaleString()} / ~{countToGo.target.toLocaleString()} at ideal rate
            </Text>
            <Progress value={countToGo.pct} size="md" radius="xl" color="teal" />
          </Stack>
        ) : null}

        {pace != null ? (
          <Stack gap="xs">
            <MetricLabel label="Target pace" helpId="expectedPartsPace" />
            <Text size="32px" fw={800} c={pace >= 0 ? 'teal' : 'red'} lh={1}>
              {pace >= 0 ? '+' : ''}
              {pace.toFixed(1)}%
            </Text>
            {machine.expectedPartsPace != null ? (
              <Text size="xs" c="dimmed">
                Expected {Math.round(machine.expectedPartsPace).toLocaleString()} parts · actual{' '}
                {machine.goodCount.toLocaleString()}
              </Text>
            ) : (
              <Text size="xs" c="dimmed">
                vs expected production this shift
              </Text>
            )}
          </Stack>
        ) : null}

        {machine.partsLostAvailability != null && machine.partsLostAvailability > 0 ? (
          <Stack gap="xs">
            <MetricLabel label="Parts lost — downtime" helpId="partsLostAvailability" />
            <Text size="32px" fw={800} c="red" lh={1}>
              {machine.partsLostAvailability.toLocaleString()}
            </Text>
            <Text size="xs" c="dimmed">
              at {idealRate.toLocaleString()} pph ideal
            </Text>
          </Stack>
        ) : null}

        {idealRate > 0 ? (
          <Stack gap="xs">
            <MetricLabel label="Actual vs ideal rate" helpId="actualRatePph" />
            <Group gap="xs" align="baseline">
              <Text size="28px" fw={800} lh={1}>
                {actualRate.toFixed(0)}
              </Text>
              <Text size="sm" c="dimmed">
                / {idealRate.toFixed(0)} pph
              </Text>
            </Group>
            {sourceLabel ? (
              <Text size="xs" c="dimmed">
                Ideal from {sourceLabel}
              </Text>
            ) : null}
            <Progress value={ratePct} size="md" radius="xl" color={ratePct >= 90 ? 'teal' : ratePct >= 70 ? 'yellow' : 'red'} />
          </Stack>
        ) : null}
      </SimpleGrid>
    </Paper>
  )
}
