import { useMemo, type ReactNode } from 'react'
import { Alert, Divider, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { BarChart, DonutChart } from '@mantine/charts'
import type { KpiSnapshot } from '../../lib/historian'
import type { Reliability } from '../../lib/metrics'
import { formatDurationMinutes } from '../../lib/formatDuration'
import { MetricLabel } from '../help/HelpTrigger'
import { FactorGaugeVisual } from '../widgets/charts/FactorGaugeVisual'
import { GaugeRing } from '../widgets/design/GaugeRing'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import { oeeExplorerHexColor, oeeSurfaceTone } from '../widgets/common'
import { TimeBalanceChart, type TimeBalanceData } from './TimeBalanceChart'

export function deltaPct(current: number, prior: number | undefined): string | null {
  if (prior == null) return null
  const d = current - prior
  if (Math.abs(d) < 0.05) return null
  const sign = d > 0 ? '+' : ''
  return `${sign}${d.toFixed(1)}pp`
}

function StatCell({
  label,
  value,
  helpId,
  delta,
}: {
  label: string
  value: string
  helpId?: string
  delta?: string | null
}) {
  return (
    <Stack gap={2} align="center">
      <MetricLabel label={label} helpId={helpId} />
      <Group gap={4} justify="center">
        <Text size="lg" fw={800} lh={1}>
          {value}
        </Text>
        {delta ? (
          <Text size="xs" c={delta.startsWith('+') ? 'teal' : 'red'}>
            {delta}
          </Text>
        ) : null}
      </Group>
    </Stack>
  )
}

function FactorWithDelta({
  value,
  prior,
  label,
}: {
  value: number
  prior?: number
  label: 'A' | 'P' | 'Q'
}) {
  const d = deltaPct(value, prior)
  return (
    <Stack gap={4} align="center">
      <FactorGaugeVisual value={value} label={label} size={80} />
      {d ? (
        <Text size="xs" c={d.startsWith('+') ? 'teal' : 'red'}>
          {d}
        </Text>
      ) : null}
    </Stack>
  )
}

interface Props {
  display: KpiSnapshot
  priorSnapshot?: KpiSnapshot | null
  timeBalance?: TimeBalanceData | null
  reliability?: Reliability | null
  plannedMin?: number
  unplannedMin?: number
  hideTeep?: boolean
  footer?: ReactNode
  /** Drives the tiered OEE ring/tone color; omit only for scopes with no live PLC connection concept. */
  connectionState?: string
}

export function ModernKpiHero({
  display,
  priorSnapshot,
  timeBalance,
  reliability,
  plannedMin,
  unplannedMin,
  hideTeep = false,
  footer,
  connectionState = 'Connected',
}: Props) {
  const oee = display.oee
  const oeeHex = oeeExplorerHexColor(oee.oeePct, connectionState)
  const prior = priorSnapshot?.oee

  const hasProductionData =
    display.goodCount + display.rejectCount > 0 || display.downtimeMin > 0
  const tone = hasProductionData ? oeeSurfaceTone(oee.oeePct, connectionState) : 'neutral'

  const lossBarData = useMemo(
    () =>
      hasProductionData
        ? [
            {
              label: 'Losses',
              A: oee.availabilityLossMin,
              P: oee.performanceLossMin,
              Q: oee.qualityLossMin,
            },
          ]
        : [],
    [hasProductionData, oee.availabilityLossMin, oee.performanceLossMin, oee.qualityLossMin],
  )

  const productionDonut = useMemo(() => {
    const good = display.goodCount
    const reject = display.rejectCount
    if (good + reject === 0) return []
    return [
      { name: 'Good', value: good, color: 'teal.6' },
      { name: 'Reject', value: reject, color: 'red.5' },
    ].filter((x) => x.value > 0)
  }, [display.goodCount, display.rejectCount])

  const insight =
    hasProductionData && oee.oeePct < 30 && oee.availabilityPct > 70
      ? 'Performance is driving OEE — check ideal cycle time and product assignment.'
      : hasProductionData && oee.oeePct < 30 && oee.qualityPct < 80
        ? 'Quality losses are significant — review scrap reasons and first-pass yield.'
        : !hasProductionData
          ? 'No production or downtime recorded in this range — connect PLCs and map tags to see live OEE.'
          : null

  const planned = plannedMin ?? display.plannedDowntimeMin ?? reliability?.plannedDowntimeMin
  const unplanned = unplannedMin ?? display.unplannedDowntimeMin ?? reliability?.unplannedDowntimeMin

  return (
    <Stack gap="sm">
      {insight ? (
        <Alert color="blue" variant="light" title="Insight">
          {insight}
        </Alert>
      ) : null}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <WidgetSurface tone={tone} padding="md" radius="md">
          <Stack gap="md" align="center">
            <GaugeRing
              value={oee.oeePct}
              label="OEE"
              size={108}
              thickness={12}
              showLabelBelow
              sublabel={
                display.oeeGapPct != null
                  ? `${display.oeeGapPct >= 0 ? '+' : ''}${display.oeeGapPct.toFixed(1)} vs target ${display.targetOeePct ?? 85}%`
                  : `target ${display.targetOeePct ?? 85}%`
              }
              ringColor={oeeHex}
            />
            <SimpleGrid cols={3} spacing="lg" w="100%" style={{ maxWidth: 300 }}>
              <FactorWithDelta value={oee.availabilityPct} prior={prior?.availabilityPct} label="A" />
              <FactorWithDelta value={oee.performancePct} prior={prior?.performancePct} label="P" />
              <FactorWithDelta value={oee.qualityPct} prior={prior?.qualityPct} label="Q" />
            </SimpleGrid>
          </Stack>
          <Divider mt="md" />
          <Text size="xs" c="dimmed" tt="uppercase" fw={700} mt="xs" mb={6}>
            OEE loss minutes
          </Text>
          {lossBarData.length > 0 ? (
            <BarChart
              h={64}
              data={lossBarData}
              dataKey="label"
              type="stacked"
              orientation="vertical"
              series={[
                { name: 'A', color: 'blue.6' },
                { name: 'P', color: 'indigo.5' },
                { name: 'Q', color: 'grape.6' },
              ]}
              withTooltip
              withLegend
              legendProps={{ verticalAlign: 'bottom', height: 28 }}
              valueFormatter={(v) => formatDurationMinutes(v)}
            />
          ) : (
            <Text size="sm" c="dimmed">
              No OEE loss data in range
            </Text>
          )}
        </WidgetSurface>

        <WidgetSurface tone="neutral" padding="md" radius="md">
          <Stack gap="lg">
            <SimpleGrid cols={2} spacing="md">
              <Stack gap="md" align="center">
                <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                  Production mix
                </Text>
                {productionDonut.length > 0 ? (
                  <>
                    <DonutChart data={productionDonut} size={80} thickness={12} withTooltip />
                    <SimpleGrid cols={2} spacing="xs" w="100%">
                      <StatCell label="Good" value={display.goodCount.toLocaleString()} helpId="goodCount" />
                      <StatCell label="Reject" value={display.rejectCount.toLocaleString()} helpId="rejectCount" />
                    </SimpleGrid>
                  </>
                ) : (
                  <Text size="sm" c="dimmed" ta="center">
                    No production in range
                  </Text>
                )}
              </Stack>

              {timeBalance ? (
                <TimeBalanceChart data={timeBalance} size={80} stacked />
              ) : (
                <Stack gap="md" align="center" justify="center">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    Time balance
                  </Text>
                  <Text size="sm" c="dimmed" ta="center">
                    No runtime data in range
                  </Text>
                </Stack>
              )}
            </SimpleGrid>

            <Divider />

            <SimpleGrid cols={hideTeep ? 2 : 3} spacing="md">
              {!hideTeep ? (
                <StatCell
                  label="TEEP"
                  value={`${oee.teepPct.toFixed(1)}%`}
                  helpId="teepPct"
                  delta={deltaPct(oee.teepPct, prior?.teepPct)}
                />
              ) : null}
              <StatCell
                label="Scrap"
                value={`${oee.scrapPct.toFixed(1)}%`}
                helpId="scrapPct"
                delta={deltaPct(oee.scrapPct, prior?.scrapPct)}
              />
              <StatCell
                label="FPY"
                value={`${oee.fpyPct.toFixed(1)}%`}
                helpId="fpyPct"
                delta={deltaPct(oee.fpyPct, prior?.fpyPct)}
              />
            </SimpleGrid>

            {reliability || display.downtimeMin > 0 ? (
              <>
                <Divider />
                <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="md">
                  {display.uptimeMin != null && display.uptimeMin > 0 ? (
                    <StatCell label="Uptime" value={formatDurationMinutes(display.uptimeMin)} helpId="uptimeMin" />
                  ) : null}
                  <StatCell
                    label="Downtime"
                    value={formatDurationMinutes(display.downtimeMin)}
                    helpId="downtimeMin"
                  />
                  {planned != null && unplanned != null ? (
                    <StatCell
                      label="Planned / Unplanned"
                      value={`${formatDurationMinutes(planned)} / ${formatDurationMinutes(unplanned)}`}
                      helpId="plannedDowntimeMin"
                    />
                  ) : null}
                  {reliability ? (
                    <>
                      <StatCell label="MTTR" value={`${reliability.mttrMin.toFixed(1)}m`} helpId="mttrMin" />
                      <StatCell label="Stops/hr" value={reliability.stopsPerHour.toFixed(2)} helpId="stopsPerHour" />
                    </>
                  ) : null}
                </SimpleGrid>
              </>
            ) : null}

            {footer}
          </Stack>
        </WidgetSurface>
      </SimpleGrid>
    </Stack>
  )
}

export function ModernKpiHeroSkeleton() {
  return (
    <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
      <WidgetSurface padding="md" radius="md" style={{ height: 280 }}>
        <div />
      </WidgetSurface>
      <WidgetSurface padding="md" radius="md" style={{ height: 280 }}>
        <div />
      </WidgetSurface>
    </SimpleGrid>
  )
}
