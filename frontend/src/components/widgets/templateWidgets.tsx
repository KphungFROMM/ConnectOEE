import { useEffect, useMemo, useState } from 'react'
import { Anchor, Badge, Button, Group, Progress, ScrollArea, SimpleGrid, Stack, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import { IconAlertTriangle, IconChartHistogram, IconDeviceDesktop, IconMap2, IconReportAnalytics } from '@tabler/icons-react'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { getUnassignedDowntime, type DowntimeEvent } from '../../lib/metrics'
import { statusColors } from '../../theme/tokens'
import { WidgetFrame, fmtNumber, oeeColor, stateColor, resolveFrameVariant } from './common'
import type { WidgetProps } from './common'
import { MetricHero } from './design/MetricHero'
import { InfoStrip } from './design/InfoStrip'
import { GaugeRing } from './design/GaugeRing'
import { TrafficBandBadge } from './design/StatusVisual'
import { resolveStatusStyle } from './design/statusStyle'
import { flatLines } from './plantLineRanking'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import { resolveScopedSnapshot } from './resolveScopedSnapshot'
import { usePolling } from './usePolling'
import { factorColor } from './common'

function trafficColor(pct: number, green = 85, amber = 65): string {
  if (pct >= green) return statusColors.running
  if (pct >= amber) return statusColors.warning
  return statusColors.fault
}

export function OeeTrafficLightWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const oee = snap?.oeePct ?? 0
  const green = (widget.options.greenThreshold as number) ?? 85
  const amber = (widget.options.amberThreshold as number) ?? 65
  const color = trafficColor(oee, green, amber)
  const variant = resolveFrameVariant(widget, ctx)
  const kiosk = variant === 'kiosk' || ctx.density === 'kiosk'
  const statusStyle = resolveStatusStyle(widget.options.statusStyle, 'pill')
  const bandLabel = oee >= green ? 'On target' : oee >= amber ? 'Watch' : 'At risk'
  const valueText = `${oee.toFixed(1)}%`

  return (
    <WidgetFrame
      title={widget.title ?? 'OEE Signal'}
      noData={!snap}
      stale={!ctx.hubConnected}
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
      tone={oee >= green ? 'good' : oee >= amber ? 'warn' : 'bad'}
      calmMuted={oee >= green}
    >
      {statusStyle === 'beacon' || statusStyle === 'tower' ? (
        <Stack align="center" justify="center" h="100%" gap={kiosk ? 10 : 6}>
          <GaugeRing
            value={oee}
            label="OEE"
            size={kiosk ? 120 : 96}
            ringColor={color}
            showLabelBelow
            valueOutside={false}
            decimals={1}
          />
          <TrafficBandBadge label={bandLabel} color={color} size={kiosk ? 'lg' : 'md'} />
        </Stack>
      ) : statusStyle === 'minimal' ? (
        <Stack align="center" justify="center" h="100%" gap={8}>
          <Text fw={900} size={kiosk ? '2.25rem' : 'xl'} style={{ fontVariantNumeric: 'tabular-nums', color }} lh={1}>
            {valueText}
          </Text>
          <TrafficBandBadge label={bandLabel} color={color} size={kiosk ? 'lg' : 'md'} />
        </Stack>
      ) : statusStyle === 'strip' ? (
        <Stack justify="center" h="100%" gap={10} px={4}>
          <Group justify="space-between" wrap="nowrap">
            <Text fw={900} size={kiosk ? '2rem' : 'xl'} style={{ fontVariantNumeric: 'tabular-nums', color }} lh={1}>
              {valueText}
            </Text>
            <TrafficBandBadge label={bandLabel} color={color} size={kiosk ? 'lg' : 'md'} />
          </Group>
          <Progress
            value={Math.min(100, Math.max(0, oee))}
            size="lg"
            radius="xl"
            styles={{
              section: { backgroundColor: color },
            }}
          />
        </Stack>
      ) : (
        <Stack justify="center" h="100%" gap={10} px={4}>
          <div
            style={{
              borderRadius: 12,
              padding: kiosk ? '16px 18px' : '12px 14px',
              border: `1px solid color-mix(in srgb, ${color} 28%, var(--mantine-color-default-border))`,
              background: `color-mix(in srgb, ${color} 10%, var(--mantine-color-body))`,
              borderLeft: `4px solid ${color}`,
            }}
          >
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb={4}>
              OEE
            </Text>
            <Text fw={900} size={kiosk ? '2.25rem' : 'xl'} style={{ fontVariantNumeric: 'tabular-nums', color }} lh={1}>
              {valueText}
            </Text>
          </div>
          <Group justify="center">
            <TrafficBandBadge label={bandLabel} color={color} size={kiosk ? 'lg' : 'md'} />
          </Group>
        </Stack>
      )}
    </WidgetFrame>
  )
}

export function GapClusterWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const items = [
    { label: 'OEE', gap: snap?.oeeGapPct, color: oeeColor() },
    { label: 'A', gap: snap?.availabilityGapPct, color: factorColor('availabilityPct') },
    { label: 'P', gap: snap?.performanceGapPct, color: factorColor('performancePct') },
    { label: 'Q', gap: snap?.qualityGapPct, color: factorColor('qualityPct') },
  ]

  return (
    <WidgetFrame title={widget.title ?? 'Gap vs Target'} noData={!snap} stale={!ctx.hubConnected}>
      <SimpleGrid cols={4} spacing="xs" h="100%">
        {items.map((item) => {
          const g = item.gap ?? 0
          const positive = g >= 0
          return (
            <Stack key={item.label} gap={4} justify="center" align="center">
              <Text size="10px" c="dimmed" fw={700} tt="uppercase">
                {item.label}
              </Text>
              <Text fw={800} size="lg" c={positive ? 'teal' : 'orange'} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {positive ? '+' : ''}
                {g.toFixed(1)}%
              </Text>
              <Progress value={Math.min(100, Math.abs(g) * 3)} size="sm" color={positive ? 'teal' : 'orange'} w="100%" radius="xl" />
            </Stack>
          )
        })}
      </SimpleGrid>
    </WidgetFrame>
  )
}

export function ShiftContextStripWidget({ widget, ctx }: WidgetProps) {
  const snap = ctx.snapshot ?? ctx.lineSnapshots[0]
  const shiftName = snap?.shiftName ?? 'Shift'
  const start = snap?.shiftStartUtc ? new Date(snap.shiftStartUtc).getTime() : Date.now() - 3600_000
  const end = snap?.shiftEndUtc ? new Date(snap.shiftEndUtc).getTime() : Date.now() + 4 * 3600_000
  const total = Math.max(1, end - start)
  const elapsed = Math.min(total, Math.max(0, Date.now() - start))
  const pct = (elapsed / total) * 100
  const remMin = Math.max(0, Math.floor((end - Date.now()) / 60_000))
  const connected = ctx.hubConnected && snap?.connectionState !== 'Stale'

  return (
    <WidgetFrame title={widget.title} live={false} stale={!ctx.hubConnected} variant="kiosk" density={ctx.density ?? 'kiosk'}>
      <Group justify="space-between" wrap="nowrap" h="100%" align="center">
        <Group gap="sm">
          <Badge size="lg" variant="light" color="blue">
            {shiftName}
          </Badge>
          <Text size="sm" fw={600}>
            {remMin >= 60 ? `${Math.floor(remMin / 60)}h ${remMin % 60}m left` : `${remMin}m left`}
          </Text>
        </Group>
        <Progress value={pct} size="md" radius="xl" color="blue" style={{ flex: 1, maxWidth: 200 }} />
        <Badge color={connected ? 'green' : 'orange'} variant="dot">
          {connected ? 'Live' : 'Stale'}
        </Badge>
      </Group>
    </WidgetFrame>
  )
}

export function ActiveDowntimeTimerWidget({ widget, ctx }: WidgetProps) {
  const snap = ctx.snapshot
  const state = snap?.state
  const isDown = state === 'Down' || state === 'Setup'
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!isDown) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [isDown, tick])

  const downMin = snap?.downMin ?? snap?.downtimeMin ?? 0
  const reason = snap?.downtimeReasonText ?? snap?.faultCode ? `Fault ${snap.faultCode}` : null
  const variant = resolveFrameVariant(widget, ctx)

  if (!isDown) {
    return (
      <WidgetFrame
        title={widget.title ?? 'Downtime'}
        tone="neutral"
        calmMuted
        variant={variant}
        density={ctx.density}
        wallBoard={ctx.wallBoard}
      >
        <InfoStrip
          variant="calm"
          density={ctx.density}
          wallBoard={ctx.wallBoard}
          compact
          title="RUNNING"
          subtitle="No active downtime"
        />
      </WidgetFrame>
    )
  }

  return (
    <WidgetFrame
      title={widget.title ?? 'Active Downtime'}
      tone="bad"
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
      stale={!ctx.hubConnected}
    >
      <Stack gap={6} justify="center" h="100%" align="center">
        <Text size={ctx.density === 'kiosk' ? '3rem' : '2rem'} fw={900} c="red" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {Math.floor(downMin)}m
        </Text>
        <Text size="sm" c="dimmed">
          {state} · {reason ?? 'Awaiting reason'}
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

const DEFAULT_LINKS = [
  { path: '/plant-explorer', label: 'Explorer', icon: IconMap2 },
  { path: '/analytics', label: 'Analytics', icon: IconChartHistogram },
  { path: '/reports', label: 'Reports', icon: IconReportAnalytics },
  { path: '/operator', label: 'Operator', icon: IconDeviceDesktop },
]

export function QuickLinksBarWidget({ widget }: WidgetProps) {
  const links = (widget.options.links as { path: string; label: string }[] | undefined) ?? DEFAULT_LINKS.map((l) => ({ path: l.path, label: l.label }))

  return (
    <WidgetFrame title={widget.title} live={false}>
      <Group gap="xs" h="100%" wrap="wrap" align="center">
        {links.map((link) => (
          <Button key={link.path} component={Link} to={link.path} variant="light" size="sm" radius="xl">
            {link.label}
          </Button>
        ))}
      </Group>
    </WidgetFrame>
  )
}

export function LineStatusStripWidget({ widget, ctx }: WidgetProps) {
  const { data: tree } = usePolling<PlantNode[]>(() => getHierarchyTree(), 15000, [])
  const plantId = ctx.plantId?.toLowerCase()
  const lineId = ctx.lineId?.toLowerCase()
  const source = widget.binding.source
  const lines = useMemo(() => {
    let list = flatLines(tree ?? [], plantId)
    if ((source === 'line' || lineId) && lineId) {
      list = list.filter(({ line }) => line.id.toLowerCase() === lineId)
    }
    return list.slice(0, 8)
  }, [tree, plantId, lineId, source])

  return (
    <WidgetFrame title={widget.title ?? 'Line Status'} noData={lines.length === 0} stale={!ctx.hubConnected}>
      <ScrollArea h="100%" type="auto">
        <Group gap="sm" wrap="nowrap" align="stretch">
          {lines.map(({ line }) => {
            const worst = line.machines.reduce<string | null>((w, m) => {
              const st = m.state ?? 'Idle'
              if (st === 'Down') return 'Down'
              if (st === 'Setup' && w !== 'Down') return 'Setup'
              if ((st === 'Idle' || st === 'Starved') && !w) return st
              return w
            }, null)
            const state = worst ?? 'Running'
            const color = stateColor(state)
            return (
              <Stack
                key={line.id}
                gap={4}
                p="xs"
                style={{
                  minWidth: 100,
                  borderRadius: 10,
                  border: `1px solid var(--mantine-color-default-border)`,
                  background: `${color}11`,
                }}
              >
                <Group gap={6} wrap="nowrap">
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}` }} />
                  <Text size="xs" fw={700} truncate>
                    {line.name}
                  </Text>
                </Group>
                <Text size="10px" c="dimmed" tt="uppercase" fw={600}>
                  {state}
                </Text>
                <Text size="sm" fw={800} c={oeeColor()} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {line.kpi.oeePct.toFixed(1)}%
                </Text>
              </Stack>
            )
          })}
        </Group>
      </ScrollArea>
    </WidgetFrame>
  )
}

export function PaceGaugeWidget({ widget, ctx }: WidgetProps) {
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const runPct = snap?.runAttainmentPct ?? snap?.shiftAttainmentPct ?? 0
  const target = (widget.options.target as number) ?? snap?.shiftTargetQuantity ?? 5500
  const good = snap?.goodCount ?? 0
  const start = snap?.shiftStartUtc ? new Date(snap.shiftStartUtc).getTime() : Date.now() - 3600_000
  const end = snap?.shiftEndUtc ? new Date(snap.shiftEndUtc).getTime() : Date.now() + 4 * 3600_000
  const expected = target > 0 ? (target * (Date.now() - start)) / Math.max(1, end - start) : 0
  const pace = expected > 0 ? ((good - expected) / expected) * 100 : 0
  const variant = resolveFrameVariant(widget, ctx)

  return (
    <WidgetFrame
      title={widget.title ?? 'Pace & Attainment'}
      noData={!snap}
      stale={!ctx.hubConnected}
      variant={variant}
      density={ctx.density}
      wallBoard={ctx.wallBoard}
    >
      <Stack gap="sm" justify="center" h="100%">
        <MetricHero
          value={`${runPct.toFixed(1)}%`}
          label="Attainment"
          color="var(--mantine-color-teal-6)"
          density={ctx.density}
        />
        <Progress value={Math.min(100, runPct)} size="lg" radius="xl" color="teal" />
        <Text size="sm" fw={700} c={pace >= 0 ? 'teal' : 'orange'} ta="center">
          {pace >= 0 ? '+' : ''}
          {pace.toFixed(1)}% vs expected pace
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          {fmtNumber(good)} good · target {fmtNumber(target)}
        </Text>
      </Stack>
    </WidgetFrame>
  )
}

export function RecipeProductStripWidget({ widget, ctx }: WidgetProps) {
  const { hasPermission } = useAuth()
  const canManageProducts = hasPermission(Permissions.ManageProducts)
  const snap = resolveScopedSnapshot(ctx, widget.binding)
  const code = snap?.activeRecipeCode
  const name = snap?.activeRecipeName
  const ideal = snap?.idealRatePph ?? snap?.idealCycleTimeSec
  const auto = snap?.recipeIsAutoCreated

  return (
    <WidgetFrame title={widget.title ?? 'Product'} noData={!snap} stale={!ctx.hubConnected}>
      <Stack gap={6} justify="center" h="100%">
        <Group justify="space-between">
          <Text fw={800} size="lg" truncate>
            {code ?? '—'}
          </Text>
          {auto ? (
            canManageProducts ? (
              <Anchor component={Link} to="/admin?tab=recipes&recipesTab=review" size="sm">
                <Badge size="sm" color="orange" variant="light" style={{ cursor: 'pointer' }}>
                  Auto SKU
                </Badge>
              </Anchor>
            ) : (
              <Badge size="sm" color="orange" variant="light">
                Auto SKU
              </Badge>
            )
          ) : null}
        </Group>
        <Text size="sm" c="dimmed" truncate>
          {name ?? 'No active recipe'}
        </Text>
        <Group gap="md">
          <Text size="xs">
            Ideal: <strong>{typeof ideal === 'number' && ideal > 10 ? `${ideal.toFixed(0)} pph` : `${ideal ?? '—'}s cycle`}</strong>
          </Text>
          <Text size="xs">
            Actual: <strong>{snap?.actualRatePph?.toFixed(0) ?? '—'} pph</strong>
          </Text>
        </Group>
      </Stack>
    </WidgetFrame>
  )
}

export function UnassignedStopsBannerWidget({ widget, ctx }: WidgetProps) {
  const { data: events } = usePolling<DowntimeEvent[]>(
    () => getUnassignedDowntime(ctx.lineId, ctx.plantId, ctx.machineId, 50),
    8000,
    [ctx.lineId, ctx.plantId, ctx.machineId],
  )
  const count = events?.length ?? 0
  const variant = resolveFrameVariant(widget, ctx)

  if (count === 0) {
    return (
      <WidgetFrame title={widget.title ?? 'Reason queue'} tone="neutral" calmMuted variant={variant} density={ctx.density} wallBoard={ctx.wallBoard}>
        <InfoStrip
          variant="calm"
          compact
          wallBoard={ctx.wallBoard}
          density={ctx.density}
          title="All stops attributed"
          subtitle="No pending operator reasons"
        />
      </WidgetFrame>
    )
  }

  return (
    <WidgetFrame title={widget.title ?? 'Unassigned stops'} tone="warn" variant={variant} density={ctx.density} wallBoard={ctx.wallBoard} stale={!ctx.hubConnected}>
      <Group justify="space-between" align="center" h="100%">
        <Group gap="sm">
          <IconAlertTriangle size={28} color="var(--mantine-color-orange-6)" />
          <Stack gap={0}>
            <Text fw={900} size="xl">
              {count}
            </Text>
            <Text size="sm" c="dimmed">
              stops need a reason
            </Text>
          </Stack>
        </Group>
        <Anchor component={Link} to="/operator" size="sm" fw={600}>
          Open operator →
        </Anchor>
      </Group>
    </WidgetFrame>
  )
}
