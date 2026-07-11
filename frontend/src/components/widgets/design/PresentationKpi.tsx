import { Badge, Progress, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import { Sparkline } from '../charts/Sparkline'
import { GaugeRing } from './GaugeRing'
import { KpiValue } from './KpiValue'
import { MetricHero } from './MetricHero'
import type { WidgetDensity } from './widgetTheme'

export type KpiPresentation =
  | 'number'
  | 'ring'
  | 'bar'
  | 'spark'
  | 'ringSpark'
  | 'barSpark'
  | 'tile'
  | 'delta'
  | 'gauge'

export const KPI_PRESENTATION_OPTIONS: { value: KpiPresentation; label: string }[] = [
  { value: 'number', label: 'number' },
  { value: 'ring', label: 'ring' },
  { value: 'bar', label: 'bar' },
  { value: 'spark', label: 'spark' },
  { value: 'ringSpark', label: 'ring+spark' },
  { value: 'barSpark', label: 'bar+spark' },
  { value: 'tile', label: 'tile' },
  { value: 'delta', label: 'delta' },
  { value: 'gauge', label: 'gauge' },
]

const PRESENTATION_SET = new Set<string>(KPI_PRESENTATION_OPTIONS.map((p) => p.value))

export function resolveKpiPresentation(raw: unknown, fallback: KpiPresentation = 'number'): KpiPresentation {
  if (typeof raw === 'string' && PRESENTATION_SET.has(raw)) {
    return raw as KpiPresentation
  }
  return fallback
}

/** Short series ending at current value — used when historian spark data isn't available yet. */
export function synthesizeSparkSeries(n: number, points = 14): { label: string; v: number }[] {
  const safe = Number.isFinite(n) ? n : 0
  return Array.from({ length: points }, (_, i) => {
    const t = i / Math.max(1, points - 1)
    const wobble = Math.sin(i * 1.35 + safe * 0.07) * Math.max(0.8, Math.abs(safe) * 0.04)
    const v = i === points - 1 ? safe : Math.max(0, safe * (0.88 + 0.1 * t) + wobble)
    return { label: `${i}`, v }
  })
}

function sparkSeries(
  n: number,
  sparklineData?: { label: string; v: number }[],
): { label: string; v: number }[] {
  return sparklineData && sparklineData.length >= 2 ? sparklineData : synthesizeSparkSeries(n)
}

function progressColor(color?: string) {
  if (color?.includes('teal') || color?.includes('2E9E') || color?.includes('2e9e')) return 'teal'
  if (color?.includes('red') || color?.includes('D645')) return 'red'
  if (color?.includes('grape') || color?.includes('violet') || color?.includes('9333')) return 'grape'
  return 'blue'
}

/**
 * Same KPI binding, multiple skins — number / ring / bar / spark / combos / tile / delta / gauge.
 */
export function PresentationKpi({
  presentation = 'number',
  value,
  numericValue,
  unit,
  label,
  color,
  density,
  delta,
  sparklineData,
  max = 100,
  helpId,
  subtitle,
  decimals,
}: {
  presentation?: KpiPresentation
  value: string
  numericValue?: number
  unit?: string
  label?: string
  color?: string
  density?: WidgetDensity
  delta?: number | null
  sparklineData?: { label: string; v: number }[]
  max?: number
  helpId?: string
  subtitle?: string
  decimals?: number
}): ReactNode {
  const n =
    numericValue ??
    (() => {
      const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''))
      return Number.isFinite(parsed) ? parsed : 0
    })()

  const ringValue = Math.min(100, Math.max(0, max === 100 ? n : (n / max) * 100))
  const barPct = Math.min(100, Math.max(0, max === 100 ? n : (n / Math.max(max, 1)) * 100))
  const series = sparkSeries(n, sparklineData)
  const sparkH = density === 'kiosk' ? 40 : 28
  const accent = color ?? 'var(--mantine-color-blue-6)'
  const isKiosk = density === 'kiosk'

  if (presentation === 'ring') {
    return (
      <GaugeRing
        value={ringValue}
        label={label}
        size={density === 'kiosk' ? 152 : 112}
        ringColor={color}
        showLabelBelow={Boolean(label)}
        valueOutside={false}
        sublabel={unit}
        decimals={decimals}
      />
    )
  }

  if (presentation === 'ringSpark') {
    return (
      <Stack gap={6} justify="center" h="100%" align="center">
        <GaugeRing
          value={ringValue}
          label={label}
          size={density === 'kiosk' ? 128 : 96}
          ringColor={color}
          showLabelBelow={Boolean(label)}
          valueOutside={false}
          sublabel={unit}
          decimals={decimals}
        />
        <div style={{ width: '100%', minHeight: sparkH }}>
          <Sparkline data={series} color={color} filled showLastPoint height={sparkH} />
        </div>
      </Stack>
    )
  }

  if (presentation === 'bar') {
    return (
      <Stack gap={8} justify="center" h="100%">
        <MetricHero label={label} value={value} unit={unit} color={color} density={density} helpId={helpId} subtitle={subtitle} />
        <Progress value={barPct} size="lg" radius="xl" color={progressColor(color)} />
      </Stack>
    )
  }

  if (presentation === 'barSpark') {
    return (
      <Stack gap={6} justify="center" h="100%">
        <MetricHero label={label} value={value} unit={unit} color={color} density={density} helpId={helpId} subtitle={subtitle} />
        <Progress value={barPct} size="md" radius="xl" color={progressColor(color)} />
        <Sparkline data={series} color={color} filled showLastPoint height={sparkH} />
      </Stack>
    )
  }

  if (presentation === 'spark') {
    return (
      <KpiValue
        label={label}
        value={value}
        unit={unit}
        color={color}
        density={density}
        delta={delta}
        sparklineData={series}
        sparklineColor={color}
        helpId={helpId}
        showSparkline
      />
    )
  }

  if (presentation === 'tile') {
    return (
      <Stack justify="center" h="100%" gap={8} px={2}>
        <div
          style={{
            borderRadius: 12,
            padding: isKiosk ? '14px 16px' : '10px 12px',
            border: `1px solid color-mix(in srgb, ${accent} 28%, var(--mantine-color-default-border))`,
            background: `color-mix(in srgb, ${accent} 9%, var(--mantine-color-body))`,
          }}
        >
          {label ? (
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={4}>
              {label}
            </Text>
          ) : null}
          <Text
            fw={900}
            size={isKiosk ? '2.25rem' : 'xl'}
            lh={1}
            style={{ fontVariantNumeric: 'tabular-nums', color: accent }}
          >
            {value}
            {unit ? (
              <Text span size="sm" c="dimmed" fw={600} ml={6}>
                {unit}
              </Text>
            ) : null}
          </Text>
          {subtitle ? (
            <Text size="xs" c="dimmed" mt={6}>
              {subtitle}
            </Text>
          ) : null}
        </div>
      </Stack>
    )
  }

  if (presentation === 'delta') {
    const d = delta ?? 0
    const up = d >= 0
    return (
      <Stack justify="center" h="100%" gap={10} align="center">
        <MetricHero label={label} value={value} unit={unit} color={color} density={density} helpId={helpId} subtitle={subtitle} />
        <Badge
          size={isKiosk ? 'lg' : 'md'}
          variant="light"
          color={up ? 'teal' : 'orange'}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {up ? '▲' : '▼'} {Math.abs(d).toFixed(1)}
          {unit === '%' || String(value).includes('%') ? ' pts' : ''}
        </Badge>
      </Stack>
    )
  }

  if (presentation === 'gauge') {
    const segments = 20
    const filled = Math.round((barPct / 100) * segments)
    return (
      <Stack justify="center" h="100%" gap={10} px={2}>
        <MetricHero label={label} value={value} unit={unit} color={color} density={density} helpId={helpId} subtitle={subtitle} />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${segments}, 1fr)`,
            gap: 3,
            width: '100%',
          }}
        >
          {Array.from({ length: segments }, (_, i) => (
            <div
              key={i}
              style={{
                height: isKiosk ? 12 : 8,
                borderRadius: 2,
                background:
                  i < filled
                    ? accent
                    : 'color-mix(in srgb, var(--mantine-color-default-border) 70%, transparent)',
              }}
            />
          ))}
        </div>
      </Stack>
    )
  }

  return <MetricHero label={label} value={value} unit={unit} color={color} density={density} helpId={helpId} subtitle={subtitle} />
}
