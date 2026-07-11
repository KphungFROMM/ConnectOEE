import { useMemo } from 'react'
import { Box } from '@mantine/core'
import { WaterfallChart } from '../widgets/charts/WaterfallChart'
import { getFactorColors } from '../../theme/factorColorsRuntime'
import type { KpiSnapshot } from '../../lib/historian'
import { AnalyticsEmpty } from './AnalyticsEmpty'

export function OeeWaterfall({ snapshot, mode = 'percent' }: { snapshot: KpiSnapshot | null; mode?: 'percent' | 'minutes' }) {
  const { steps, max } = useMemo(() => {
    if (!snapshot) return { steps: [], max: 100 }
    const oee = snapshot.oee
    const colors = getFactorColors()
    if (mode === 'minutes') {
      const total = Math.max(
        oee.availabilityLossMin + oee.performanceLossMin + oee.qualityLossMin,
        snapshot.downtimeMin + 1,
        1,
      )
      const oeeMin = (oee.oeePct / 100) * total
      return {
        max: total,
        steps: [
          { name: 'Start', value: total, fill: '#8A929E' },
          { name: 'A', value: oee.availabilityLossMin, fill: colors.availability.hex },
          { name: 'P', value: oee.performanceLossMin, fill: colors.performance.hex },
          { name: 'Q', value: oee.qualityLossMin, fill: colors.quality.hex },
          { name: 'OEE', value: oeeMin, fill: colors.oee.hex },
        ],
      }
    }
    return {
      max: 100,
      steps: [
        { name: 'Start', value: 100, fill: '#8A929E' },
        { name: 'A', value: 100 - oee.availabilityPct, fill: colors.availability.hex },
        { name: 'P', value: Math.max(0, oee.availabilityPct - oee.performancePct), fill: colors.performance.hex },
        { name: 'Q', value: Math.max(0, oee.performancePct - oee.qualityPct), fill: colors.quality.hex },
        { name: 'OEE', value: oee.oeePct, fill: colors.oee.hex },
      ],
    }
  }, [snapshot, mode])

  if (!snapshot) return <AnalyticsEmpty />
  return (
    <Box h={260}>
      <WaterfallChart steps={steps} max={max} unit={mode === 'minutes' ? 'm' : '%'} />
    </Box>
  )
}
