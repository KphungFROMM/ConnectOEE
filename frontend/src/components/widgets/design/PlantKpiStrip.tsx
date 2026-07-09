import { Group, SimpleGrid, Stack } from '@mantine/core'
import { factorColor, fmtNumber } from '../common'
import { GaugeRing } from './GaugeRing'
import { MetricHero } from './MetricHero'

function FactorTile({
  label,
  value,
  field,
}: {
  label: string
  value: string
  field: 'availabilityPct' | 'performancePct' | 'qualityPct'
}) {
  const accent = factorColor(field)
  return (
    <Stack
      gap={0}
      justify="center"
      h="100%"
      pl="sm"
      style={{ borderLeft: `3px solid ${accent}`, minWidth: 0 }}
    >
      <MetricHero label={label} value={value} color={accent} helpId={field} />
    </Stack>
  )
}

function CountTile({ label, value, color, helpId }: { label: string; value: string; color: string; helpId?: string }) {
  return (
    <Stack
      gap={0}
      justify="center"
      h="100%"
      pl="sm"
      style={{ borderLeft: `3px solid ${color}`, minWidth: 0 }}
    >
      <MetricHero label={label} value={value} color={color} helpId={helpId} />
    </Stack>
  )
}

export function PlantKpiStrip({
  oeePct,
  availabilityPct,
  performancePct,
  qualityPct,
  goodCount,
  rejectCount,
  teepPct,
}: {
  oeePct: number
  availabilityPct: number
  performancePct: number
  qualityPct: number
  goodCount: number
  rejectCount: number
  teepPct?: number
}) {
  return (
    <Group align="stretch" wrap="nowrap" gap="lg" h="100%" style={{ minHeight: 112 }}>
      <Stack align="center" justify="center" style={{ flex: '0 0 auto', minWidth: 128 }}>
        <GaugeRing
          value={oeePct}
          label="OEE"
          size={118}
          compact
          showLabelBelow
          sublabel="target 85%"
        />
      </Stack>
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" style={{ flex: 1, alignItems: 'center' }}>
        <FactorTile label="Availability" value={`${availabilityPct.toFixed(0)}%`} field="availabilityPct" />
        <FactorTile label="Performance" value={`${performancePct.toFixed(0)}%`} field="performancePct" />
        <FactorTile label="Quality" value={`${qualityPct.toFixed(0)}%`} field="qualityPct" />
        <Stack
          gap={0}
          justify="center"
          h="100%"
          pl="sm"
          style={{ borderLeft: '3px solid var(--mantine-color-cyan-6)', minWidth: 0 }}
        >
          <MetricHero label="TEEP" value={`${(teepPct ?? 0).toFixed(0)}%`} color="var(--mantine-color-cyan-6)" helpId="teepPct" />
        </Stack>
        <CountTile label="Good" value={fmtNumber(goodCount)} color="var(--mantine-color-teal-6)" helpId="goodCount" />
        <CountTile label="Reject" value={fmtNumber(rejectCount)} color="var(--mantine-color-red-6)" helpId="rejectCount" />
      </SimpleGrid>
    </Group>
  )
}
