import { Badge, Divider, SimpleGrid, Stack, Text } from '@mantine/core'
import type { NodeKpi } from '../../lib/hierarchy'
import type { KpiSnapshot } from '../../lib/historian'
import type { Reliability } from '../../lib/metrics'
import { buildTimeBalanceFromSnapshot } from '../../lib/kpiTimeBalance'
import { idealCycleSourceLabel } from '../../lib/idealRate'
import { ModernKpiHero } from '../analytics/ModernKpiHero'
import { explorerRunStateColor } from '../widgets/common'
import type { ExplorerLiveMetrics } from './explorerKpi'
import type { TimeBalanceData } from '../analytics/TimeBalanceChart'

function liveToSnapshot(
  level: KpiSnapshot['level'],
  id: string,
  name: string,
  kpi: NodeKpi,
  live?: ExplorerLiveMetrics | null,
  teepPct = 0,
): KpiSnapshot {
  const total = kpi.goodCount + kpi.rejectCount
  const scrapPct = total > 0 ? (kpi.rejectCount / total) * 100 : 0
  return {
    level,
    entityId: id,
    entityName: name,
    from: '',
    to: '',
    oee: {
      availabilityPct: kpi.availabilityPct,
      performancePct: kpi.performancePct,
      qualityPct: kpi.qualityPct,
      oeePct: kpi.oeePct,
      teepPct,
      scrapPct,
      yieldPct: kpi.qualityPct,
      fpyPct: kpi.qualityPct,
      availabilityLossMin: 0,
      performanceLossMin: 0,
      qualityLossMin: 0,
      actualCycleTimeSec: kpi.actualCycleTimeSec,
      idealCycleTimeSec: kpi.idealCycleTimeSec,
    },
    goodCount: kpi.goodCount,
    rejectCount: kpi.rejectCount,
    totalCount: total,
    downtimeMin: live?.downtimeMin ?? 0,
    downtimeCount: live?.failureCount ?? 0,
    uptimeMin: live?.uptimeMin ?? 0,
    plannedDowntimeMin: live?.plannedDowntimeMin ?? 0,
    unplannedDowntimeMin: live?.unplannedDowntimeMin ?? 0,
    microStopCount: live?.microStopCount ?? 0,
    targetOeePct: live?.targetOeePct ?? 85,
    oeeGapPct: live?.oeeGapPct ?? kpi.oeePct - (live?.targetOeePct ?? 85),
  }
}

function resolveTimeBalance(
  snapshot: KpiSnapshot,
  live?: ExplorerLiveMetrics | null,
  reliability?: Reliability | null,
): TimeBalanceData | null {
  if (live) {
    const uptimeMin = live.uptimeMin ?? snapshot.uptimeMin ?? 0
    const downtimeMin = live.downtimeMin ?? snapshot.downtimeMin ?? 0
    const plannedMin = live.plannedDowntimeMin ?? snapshot.plannedDowntimeMin ?? reliability?.plannedDowntimeMin ?? 0
    const unplannedMin =
      live.unplannedDowntimeMin ?? snapshot.unplannedDowntimeMin ?? reliability?.unplannedDowntimeMin ?? 0
    if (uptimeMin <= 0 && downtimeMin <= 0 && plannedMin <= 0 && unplannedMin <= 0) return null
    return { uptimeMin, downtimeMin, plannedMin, unplannedMin }
  }
  return buildTimeBalanceFromSnapshot(snapshot, reliability)
}

function MachineContextStrip({ kpi, live }: { kpi: NodeKpi; live: ExplorerLiveMetrics }) {
  const hasRate = live.actualRatePph > 0 || live.idealRatePph > 0
  const ratePct = live.idealRatePph > 0 ? Math.min(100, (live.actualRatePph / live.idealRatePph) * 100) : 0
  const statusColor = explorerRunStateColor(kpi.status, kpi.connectionState)
  const sourceLabel = idealCycleSourceLabel(live.idealCycleSource)
  const rateDetail =
    kpi.activeRecipeCode && sourceLabel
      ? `${kpi.activeRecipeCode} (${sourceLabel})`
      : sourceLabel
        ? sourceLabel
        : null

  return (
    <Stack gap="sm">
      <Divider label="Machine" labelPosition="left" />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Run state
          </Text>
          <Badge size="lg" variant="filled" style={{ backgroundColor: statusColor, width: 'fit-content' }}>
            {kpi.status}
          </Badge>
        </Stack>
        {kpi.activeRecipeCode ? (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Product
            </Text>
            <Text fw={700}>{kpi.activeRecipeCode}</Text>
          </Stack>
        ) : null}
        {hasRate ? (
          <>
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Actual / ideal
              </Text>
              <Text fw={700}>
                {live.actualRatePph.toFixed(0)} / {live.idealRatePph.toFixed(0)} pph
              </Text>
              {rateDetail ? (
                <Text size="xs" c="dimmed">
                  {rateDetail}
                </Text>
              ) : null}
            </Stack>
            <Stack gap={4}>
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                Rate vs ideal
              </Text>
              <Text fw={800} size="lg">
                {ratePct.toFixed(1)}%
              </Text>
            </Stack>
          </>
        ) : null}
      </SimpleGrid>
      {live.faultCode || live.downtimeReasonText ? (
        <Text size="sm">
          <Text span c="dimmed">
            Downtime reason:{' '}
          </Text>
          {live.downtimeReasonText ?? `PLC code ${live.faultCode}`}
        </Text>
      ) : null}
    </Stack>
  )
}

function mergeLiveWithHistorian(liveDisplay: KpiSnapshot, historian: KpiSnapshot | null): KpiSnapshot {
  if (!historian) return liveDisplay
  return {
    ...liveDisplay,
    from: historian.from,
    to: historian.to,
    oee: {
      ...liveDisplay.oee,
      availabilityLossMin: historian.oee.availabilityLossMin,
      performanceLossMin: historian.oee.performanceLossMin,
      qualityLossMin: historian.oee.qualityLossMin,
      teepPct: historian.oee.teepPct > 0 ? historian.oee.teepPct : liveDisplay.oee.teepPct,
    },
  }
}

interface Props {
  level: KpiSnapshot['level']
  id: string
  name: string
  kpi: NodeKpi
  snapshot: KpiSnapshot | null
  live?: ExplorerLiveMetrics | null
  reliability?: Reliability | null
  teepPct?: number
  preferLive?: boolean
}

export function ExplorerKpiHero({
  level,
  id,
  name,
  kpi,
  snapshot,
  live,
  reliability,
  teepPct = 0,
  preferLive = false,
}: Props) {
  const liveDisplay = liveToSnapshot(level, id, name, kpi, live, teepPct)
  const display = preferLive ? mergeLiveWithHistorian(liveDisplay, snapshot) : (snapshot ?? liveDisplay)
  const timeBalance = resolveTimeBalance(display, live, reliability)
  const isMachine = level === 'Machine'

  return (
    <ModernKpiHero
      display={display}
      timeBalance={timeBalance}
      reliability={reliability}
      hideTeep={isMachine}
      footer={isMachine && live ? <MachineContextStrip kpi={kpi} live={live} /> : undefined}
      connectionState={kpi.connectionState}
    />
  )
}
