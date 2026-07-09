import { useMemo } from 'react'
import { Box } from '@mantine/core'
import { WaterfallChart } from '../widgets/charts/WaterfallChart'
import { oeeFactorColors } from '../../theme/tokens'
import type { KpiSnapshot } from '../../lib/historian'
import { AnalyticsEmpty } from './AnalyticsEmpty'

export function OeeWaterfall({ snapshot, mode = 'percent' }: { snapshot: KpiSnapshot | null; mode?: 'percent' | 'minutes' }) {
  const { steps, max } = useMemo(() => {
    if (!snapshot) return { steps: [], max: 100 }
    const oee = snapshot.oee
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
          { name: 'A', value: oee.availabilityLossMin, fill: oeeFactorColors.availability.hex },
          { name: 'P', value: oee.performanceLossMin, fill: oeeFactorColors.performance.hex },
          { name: 'Q', value: oee.qualityLossMin, fill: oeeFactorColors.quality.hex },
          { name: 'OEE', value: oeeMin, fill: oeeFactorColors.oee.hex },
        ],
      }
    }
    return {
      max: 100,
      steps: [
        { name: 'Start', value: 100, fill: '#8A929E' },
        { name: 'A', value: 100 - oee.availabilityPct, fill: oeeFactorColors.availability.hex },
        { name: 'P', value: Math.max(0, oee.availabilityPct - oee.performancePct), fill: oeeFactorColors.performance.hex },
        { name: 'Q', value: Math.max(0, oee.performancePct - oee.qualityPct), fill: oeeFactorColors.quality.hex },
        { name: 'OEE', value: oee.oeePct, fill: oeeFactorColors.oee.hex },
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
