import { Badge, Group, Paper, Text } from '@mantine/core'
import type { MachineSnapshot } from '../../lib/liveHub'
import type { KpiSnapshot } from '../../lib/historian'
import type { TimeBalanceData } from '../analytics/TimeBalanceChart'
import { ModernKpiHero } from '../analytics/ModernKpiHero'
import { stateColor } from '../widgets/common'

function machineToKpiSnapshot(machine: MachineSnapshot): KpiSnapshot {
  const total = machine.goodCount + machine.rejectCount
  const scrapPct = total > 0 ? (machine.rejectCount / total) * 100 : 0
  return {
    level: 'Machine',
    entityId: machine.machineId,
    entityName: machine.machineName,
    from: '',
    to: '',
    oee: {
      availabilityPct: machine.availabilityPct,
      performancePct: machine.performancePct,
      qualityPct: machine.qualityPct,
      oeePct: machine.oeePct,
      teepPct: machine.teepPct ?? 0,
      scrapPct,
      yieldPct: machine.yieldPct ?? machine.qualityPct,
      fpyPct: machine.fpyPct ?? machine.qualityPct,
      availabilityLossMin: machine.availabilityLossMin ?? 0,
      performanceLossMin: machine.performanceLossMin ?? 0,
      qualityLossMin: machine.qualityLossMin ?? 0,
      actualCycleTimeSec: machine.actualCycleTimeSec,
      idealCycleTimeSec: machine.idealCycleTimeSec,
    },
    goodCount: machine.goodCount,
    rejectCount: machine.rejectCount,
    totalCount: total,
    downtimeMin: machine.downtimeMin ?? 0,
    downtimeCount: machine.downtimeCount ?? 0,
    uptimeMin: machine.uptimeMin ?? 0,
    plannedDowntimeMin: machine.plannedDowntimeMin ?? 0,
    unplannedDowntimeMin: machine.unplannedDowntimeMin ?? 0,
    microStopCount: machine.microStopCount ?? 0,
    targetOeePct: machine.targetOeePct ?? 85,
    oeeGapPct: machine.oeeGapPct,
    targetAvailabilityPct: machine.targetAvailabilityPct,
    targetPerformancePct: machine.targetPerformancePct,
    targetQualityPct: machine.targetQualityPct,
    availabilityGapPct: machine.availabilityGapPct,
    performanceGapPct: machine.performanceGapPct,
    qualityGapPct: machine.qualityGapPct,
    utilizationPct: machine.utilizationPct,
    cycleVariancePct: machine.cycleVariancePct,
  }
}

function resolveTimeBalance(machine: MachineSnapshot): TimeBalanceData | null {
  const uptimeMin = machine.uptimeMin ?? 0
  const downtimeMin = machine.downtimeMin ?? 0
  const plannedMin = machine.plannedDowntimeMin ?? 0
  const unplannedMin = machine.unplannedDowntimeMin ?? 0
  if (uptimeMin <= 0 && downtimeMin <= 0 && plannedMin <= 0 && unplannedMin <= 0) return null
  return { uptimeMin, downtimeMin, plannedMin, unplannedMin }
}

function OperatorRunStateStrip({ machine }: { machine: MachineSnapshot }) {
  const color = stateColor(machine.state)

  return (
    <Paper withBorder p="sm" radius="md" style={{ borderLeft: `4px solid ${color}` }}>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap">
          <Group gap={8} wrap="nowrap">
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: color,
                boxShadow: `0 0 0 3px ${color}33`,
                flexShrink: 0,
              }}
            />
            <Text fw={700} size="md">
              {machine.state}
            </Text>
          </Group>
          <Text size="sm" c="dimmed">
            {machine.shiftName} shift
          </Text>
        </Group>
        <Group gap="xs">
          {machine.faultCode || machine.downtimeReasonText ? (
            <Badge color="red" variant="light">
              {machine.downtimeReasonText ?? `PLC ${machine.faultCode}`}
            </Badge>
          ) : null}
          {machine.connectionState !== 'Connected' ? (
            <Badge color="gray" variant="light">
              {machine.connectionState}
            </Badge>
          ) : null}
        </Group>
      </Group>
    </Paper>
  )
}

interface Props {
  machine: MachineSnapshot
}

export function OperatorMachineHero({ machine }: Props) {
  const display = machineToKpiSnapshot(machine)
  const timeBalance = resolveTimeBalance(machine)

  return (
    <ModernKpiHero
      display={display}
      timeBalance={timeBalance}
      hideTeep
      footer={<OperatorRunStateStrip machine={machine} />}
      connectionState={machine.connectionState}
    />
  )
}
