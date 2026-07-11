import { useMemo } from 'react'
import { Anchor, Box, Group, Progress, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core'
import { Link } from 'react-router-dom'
import type { KpiSnapshot } from '../../lib/historian'
import type { MachineSnapshot } from '../../lib/liveHub'
import { idealCycleSourceLabel } from '../../lib/idealRate'
import {
  aggregatePartsLossFromSnapshots,
  type ProductionPartsLoss,
} from '../../lib/partsLoss'
import { getFactorColors } from '../../theme/factorColorsRuntime'
import { statusColors } from '../../theme/tokens'
import { MetricLabel } from '../help/HelpTrigger'
import { MetricHero } from '../widgets/design/MetricHero'
import { WidgetSurface } from '../widgets/design/WidgetSurface'

interface Props {
  snapshots: MachineSnapshot[]
  historianSnapshot?: KpiSnapshot | null
  analyticsScope: string
  preferLive?: boolean
}

function lossSegments() {
  const colors = getFactorColors()
  return [
    { key: 'partsLostAvailability' as const, label: 'Downtime', color: colors.availability.hex },
    { key: 'partsLostPerformance' as const, label: 'Slow run', color: colors.performance.hex },
    { key: 'partsLostQuality' as const, label: 'Rejects', color: colors.quality.hex },
    { key: 'partsLostBreakdown' as const, label: 'Breakdown', color: statusColors.fault },
  ]
}

function LossStackBar({ loss }: { loss: ProductionPartsLoss }) {
  const segments = lossSegments()
  const total = segments.reduce((s, seg) => s + loss[seg.key], 0)
  if (total <= 0) {
    return (
      <Text size="sm" c="dimmed">
        No parts losses attributed yet this shift.
      </Text>
    )
  }

  return (
    <Stack gap={6}>
      <Box
        style={{
          display: 'flex',
          height: 14,
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--mantine-color-gray-2)',
        }}
      >
        {segments.map((seg) => {
          const value = loss[seg.key]
          if (value <= 0) return null
          const pct = (value / total) * 100
          return (
            <Tooltip key={seg.key} label={`${seg.label}: ${value.toLocaleString()} parts`}>
              <Box style={{ width: `${pct}%`, background: seg.color, minWidth: value > 0 ? 4 : 0 }} />
            </Tooltip>
          )
        })}
      </Box>
      <Group gap="md" wrap="wrap">
        {segments.map((seg) => {
          const value = loss[seg.key]
          if (value <= 0) return null
          return (
            <Group key={seg.key} gap={6}>
              <Box w={10} h={10} style={{ borderRadius: 2, background: seg.color }} />
              <Text size="xs" c="dimmed">
                {seg.label}{' '}
                <Text span fw={600} c="var(--mantine-color-text)">
                  {value.toLocaleString()}
                </Text>
              </Text>
            </Group>
          )
        })}
      </Group>
    </Stack>
  )
}

export function ExplorerPartsSection({ snapshots, historianSnapshot, analyticsScope, preferLive = true }: Props) {
  const liveAgg = useMemo(() => aggregatePartsLossFromSnapshots(snapshots), [snapshots])

  const model = useMemo(() => {
    if (preferLive && liveAgg) {
      return {
        loss: liveAgg.loss,
        goodCount: liveAgg.goodCount,
        idealRatePph: liveAgg.idealRatePph,
        idealCycleSource: liveAgg.idealCycleSource,
      }
    }
    const hist = historianSnapshot?.partsLoss
    if (hist && historianSnapshot) {
      const avgCycle = historianSnapshot.oee.idealCycleTimeSec
      return {
        loss: hist,
        goodCount: historianSnapshot.goodCount,
        idealRatePph: avgCycle > 0 ? 3600 / avgCycle : 0,
        idealCycleSource: null as string | null,
      }
    }
    return liveAgg
      ? {
          loss: liveAgg.loss,
          goodCount: liveAgg.goodCount,
          idealRatePph: liveAgg.idealRatePph,
          idealCycleSource: liveAgg.idealCycleSource,
        }
      : null
  }, [preferLive, liveAgg, historianSnapshot])

  if (!model || model.idealRatePph <= 0) return null

  const { loss, goodCount, idealRatePph, idealCycleSource } = model
  const expected = loss.expectedPartsPace ?? 0
  const pacePct = expected > 0 ? ((goodCount - expected) / expected) * 100 : null
  const paceProgress = expected > 0 ? Math.min(100, (goodCount / expected) * 100) : 0
  const sourceLabel = idealCycleSourceLabel(idealCycleSource)
  const rateNote = sourceLabel
    ? `${Math.round(idealRatePph).toLocaleString()} pph · ${sourceLabel}`
    : `${Math.round(idealRatePph).toLocaleString()} pph`

  return (
    <WidgetSurface tone="neutral" padding="lg" radius="md">
      <Group justify="space-between" mb="md" wrap="wrap">
        <div>
          <Text fw={600}>Production vs expected</Text>
          <Text size="xs" c="dimmed">
            Parts at ideal rate ({rateNote})
          </Text>
        </div>
        <Anchor
          component={Link}
          to={`/analytics?scope=${encodeURIComponent(analyticsScope)}&tab=production`}
          size="sm"
        >
          Full production view
        </Anchor>
      </Group>

      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md" mb="md">
        <MetricHero
          label="Expected by now"
          value={expected > 0 ? expected.toLocaleString() : '—'}
          helpId="expectedPartsPace"
        />
        <MetricHero label="Actual good" value={goodCount.toLocaleString()} helpId="goodCount" />
        <MetricHero
          label="Pace"
          value={pacePct != null ? `${pacePct >= 0 ? '+' : ''}${pacePct.toFixed(1)}%` : '—'}
          color={pacePct != null && pacePct >= 0 ? 'teal' : 'red'}
          helpId="expectedPartsPace"
        />
        <MetricHero
          label="Could have made"
          value={loss.partsCouldHaveMade.toLocaleString()}
          helpId="partsCouldHaveMade"
        />
      </SimpleGrid>

      {expected > 0 ? (
        <Stack gap={4} mb="lg">
          <Group justify="space-between">
            <MetricLabel label="Shift pace" helpId="expectedPartsPace" />
            <Text size="xs" c="dimmed">
              {goodCount.toLocaleString()} / {expected.toLocaleString()}
            </Text>
          </Group>
          <Progress
            value={paceProgress}
            size="lg"
            radius="xl"
            color={pacePct != null && pacePct >= 0 ? 'teal' : 'orange'}
          />
        </Stack>
      ) : null}

      <Text fw={600} size="sm" mb="xs">
        Parts lost this shift
      </Text>
      <LossStackBar loss={loss} />
    </WidgetSurface>
  )
}
