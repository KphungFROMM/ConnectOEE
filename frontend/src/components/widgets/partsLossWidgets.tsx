import { Group, Progress, Stack, Text } from '@mantine/core'
import { partsLossFromLive } from '../../lib/partsLoss'
import { getFactorColors } from '../../theme/factorColorsRuntime'
import { WidgetFrame, fmtNumber, type WidgetProps } from './common'
import { MetricHero } from './design/MetricHero'
import { WaterfallChart } from './charts/WaterfallChart'
import { resolveScopedField, resolveScopedSnapshot } from './resolveScopedSnapshot'

export function ExpectedVsActualCountWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const good = (resolveScopedField(ctx, widget.binding, 'goodCount') as number) ?? 0
  const expected = snap?.expectedPartsPace ?? 0
  const pct = expected > 0 ? Math.min(100, (good / expected) * 100) : 0
  const pace = expected > 0 ? ((good - expected) / expected) * 100 : 0

  return (
    <WidgetFrame
      title={widget.title ?? 'Expected vs actual'}
      noData={!snap || expected <= 0}
      stale={!ctx.hubConnected}
      emptyHint="Ideal rate required"
    >
      <Stack gap={6} justify="center" h="100%">
        <Group justify="space-between" align="baseline">
          <MetricHero value={fmtNumber(good)} label="Actual" />
          <Text size="sm" c="dimmed">
            / {fmtNumber(Math.round(expected))} expected
          </Text>
        </Group>
        <Text size="xs" c={pace >= 0 ? 'teal' : 'red'} fw={600}>
          {pace >= 0 ? '+' : ''}
          {pace.toFixed(1)}% vs pace
        </Text>
        <Progress value={pct} size="md" radius="xl" color={pace >= 0 ? 'teal' : 'orange'} />
      </Stack>
    </WidgetFrame>
  )
}

export function PartsLossWaterfallWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const loss = snap ? partsLossFromLive(snap) : null
  const good = snap?.goodCount ?? 0

  if (!loss || !snap) {
    return (
      <WidgetFrame title={widget.title ?? 'Parts loss'} noData stale={!ctx.hubConnected} emptyHint="Ideal rate required">
        {null}
      </WidgetFrame>
    )
  }

  const colors = getFactorColors()
  const start = Math.max(loss.maxPossibleParts, loss.partsCouldHaveMade, 1)
  const steps = [
    { name: 'Start', value: start, fill: '#8A929E' },
    { name: 'A', value: loss.partsLostAvailability, fill: colors.availability.hex },
    { name: 'P', value: loss.partsLostPerformance, fill: colors.performance.hex },
    { name: 'Q', value: loss.partsLostQuality, fill: colors.quality.hex },
    { name: 'OEE', value: good, fill: colors.oee.hex },
  ]

  return (
    <WidgetFrame title={widget.title ?? 'Parts loss waterfall'} stale={!ctx.hubConnected}>
      <WaterfallChart steps={steps} max={start} unit="" />
    </WidgetFrame>
  )
}
