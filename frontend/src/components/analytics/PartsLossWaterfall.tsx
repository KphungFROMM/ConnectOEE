import { useMemo } from 'react'
import { Box } from '@mantine/core'
import { WaterfallChart } from '../widgets/charts/WaterfallChart'
import { getFactorColors } from '../../theme/factorColorsRuntime'
import type { KpiSnapshot } from '../../lib/historian'
import type { ProductionPartsLoss } from '../../lib/partsLoss'
import { AnalyticsEmpty } from './AnalyticsEmpty'

interface Props {
  snapshot: KpiSnapshot | null
  partsLoss?: ProductionPartsLoss | null
}

export function PartsLossWaterfall({ snapshot, partsLoss }: Props) {
  const loss = partsLoss ?? snapshot?.partsLoss ?? null

  const { steps, max } = useMemo(() => {
    if (!loss || !snapshot) return { steps: [], max: 1 }
    const colors = getFactorColors()
    const start = Math.max(
      loss.maxPossibleParts,
      loss.partsCouldHaveMade,
      snapshot.goodCount + loss.partsLostAvailability + loss.partsLostPerformance + loss.partsLostQuality,
      1,
    )
    const afterA = start - loss.partsLostAvailability
    const afterP = afterA - loss.partsLostPerformance
    void afterP
    return {
      max: start,
      steps: [
        { name: 'Start', value: start, fill: '#8A929E' },
        { name: 'A', value: loss.partsLostAvailability, fill: colors.availability.hex },
        { name: 'P', value: loss.partsLostPerformance, fill: colors.performance.hex },
        { name: 'Q', value: loss.partsLostQuality, fill: colors.quality.hex },
        { name: 'OEE', value: snapshot.goodCount, fill: colors.oee.hex },
      ],
    }
  }, [loss, snapshot])

  if (!loss || !snapshot) return <AnalyticsEmpty message="Ideal rate required for parts loss view." />

  return (
    <Box h={260}>
      <WaterfallChart steps={steps} max={max} unit="" />
    </Box>
  )
}
