import { GaugeRing } from '../design/GaugeRing'
import { factorColorByLabel } from '../common'

export function FactorGaugeVisual({
  value,
  label,
  size = 88,
}: {
  value: number
  label?: string
  size?: number
}) {
  const ringColor =
    label === 'A' || label === 'P' || label === 'Q' ? factorColorByLabel(label) : undefined
  return (
    <GaugeRing
      value={value}
      size={size}
      thickness={size > 100 ? 12 : 10}
      showLabelBelow
      label={label}
      ringColor={ringColor}
    />
  )
}
