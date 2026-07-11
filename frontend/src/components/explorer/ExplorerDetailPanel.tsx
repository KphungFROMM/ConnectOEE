import { useEffect, useMemo, useState } from 'react'
import { Anchor, Badge, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import type { PlantNode } from '../../lib/hierarchy'
import type { MachineSnapshot } from '../../lib/liveHub'
import { getCurrentShift } from '../../lib/metrics'
import { useExplorerHistorian } from '../../lib/useExplorerHistorian'
import type { DrillNode } from '../../lib/historian'
import { ProductionChart } from '../analytics/ProductionChart'
import { LossesDonut } from '../analytics/LossesDonut'
import { LossParetoChart } from '../analytics/LossParetoChart'
import { ReliabilityTrendChart } from '../analytics/ReliabilityTrendChart'
import { DowntimeByMachineChart } from './DowntimeByMachineChart'
import { ExplorerChildCompare } from './ExplorerChildCompare'
import { ExplorerKpiHero } from './ExplorerKpiHero'
import { LineProductStrip } from './LineProductStrip'
import { ExplorerOperationsAccordion } from './ExplorerOperationsAccordion'
import { ExplorerTrendSection } from './ExplorerTrendSection'
import {
  LineDowntimeSection,
  OfflineHint,
  ReliabilityStrip,
  ShiftContextBar,
  TopReasonChips,
} from './ExplorerDetailSections'
import { ExplorerPartsSection } from './ExplorerPartsSection'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import { liveMetricsForExplorerNode, machineNamesForLine, mergeKpiWithSnapshot, pickSnapshot, teepPctForExplorerNode } from './explorerKpi'
import { ConnectionPill } from './explorerStatus'
import { GaugeRing } from '../widgets/design/GaugeRing'
import { StatusPill } from '../widgets/design/StatusPill'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import { oeeExplorerHexColor, statusSurfaceTone, WidgetFrame } from '../widgets/common'
import type { ExplorerNode, ExplorerRange } from './explorerTypes'

function findPlantId(tree: PlantNode[], nodeId: string): string | undefined {
  for (const p of tree) {
    if (p.id === nodeId) return p.id
    for (const d of p.departments) {
      if (d.id === nodeId) return p.id
      for (const l of d.lines) {
        if (l.id === nodeId) return p.id
        for (const m of l.machines) {
          if (m.id === nodeId) return p.id
        }
      }
    }
  }
  return tree[0]?.id
}

function drillToExplorerNode(tree: PlantNode[], drill: DrillNode, parent: ExplorerNode): ExplorerNode | null {
  for (const p of tree) {
    if (drill.level === 'Department' && p.departments.some((d) => d.id === drill.id)) {
      const d = p.departments.find((x) => x.id === drill.id)!
      return { level: 'Department', id: d.id, name: d.name, kpi: d.kpi, plantId: p.id }
    }
    for (const d of p.departments) {
      if (drill.level === 'Line' && d.lines.some((l) => l.id === drill.id)) {
        const l = d.lines.find((x) => x.id === drill.id)!
        return { level: 'Line', id: l.id, name: l.name, kpi: l.kpi, lineId: l.id, plantId: p.id }
      }
      for (const l of d.lines) {
        if (drill.level === 'Machine' && l.machines.some((m) => m.id === drill.id)) {
          const m = l.machines.find((x) => x.id === drill.id)!
          return {
            level: 'Machine',
            id: m.id,
            name: m.name,
            kpi: m.kpi,
            lineId: l.id,
            machineId: m.id,
            plantId: p.id,
          }
        }
      }
    }
  }
  return parent.level !== 'Machine' ? { ...parent, id: drill.id, name: drill.name, level: drill.level as ExplorerNode['level'] } : null
}

interface Props {
  node: ExplorerNode
  tree: PlantNode[]
  snapshots: MachineSnapshot[]
  onSelectNode: (node: ExplorerNode) => void
}

export function ExplorerDetailPanel({ node, tree, snapshots, onSelectNode }: Props) {
  const { hasPermission } = useAuth()
  const canSelect = hasPermission(Permissions.SelectProduct)
  const canManageRates = hasPermission(Permissions.ManageProducts)

  const [range, setRange] = useState<ExplorerRange>('shift')
  const [shiftStart, setShiftStart] = useState<string | null>(null)
  const [shiftEnd, setShiftEnd] = useState<string | null>(null)

  const plantId = useMemo(() => findPlantId(tree, node.id), [tree, node.id])

  const historianScope = useMemo(
    () => ({
      level: node.level,
      id: node.id,
      lineId: node.lineId ?? (node.level === 'Line' ? node.id : undefined),
      plantId: node.plantId ?? plantId,
    }),
    [node.level, node.id, node.lineId, node.plantId, plantId],
  )

  const machineScopeId = node.level === 'Machine' ? (node.machineId ?? node.id) : undefined
  const snapshot = node.level === 'Machine' ? pickSnapshot(snapshots, node) : undefined
  const kpi = snapshot ? mergeKpiWithSnapshot(node.kpi, snapshot) : node.kpi
  const live = liveMetricsForExplorerNode(snapshots, node, tree)

  const resolvedLineId = node.lineId ?? (node.level === 'Line' ? node.id : undefined)
  const lineIdForShift = resolvedLineId
  const lineMachineNames = useMemo(
    () => (resolvedLineId ? machineNamesForLine(tree, resolvedLineId) : {}),
    [tree, resolvedLineId],
  )

  useEffect(() => {
    if (lineIdForShift) {
      void getCurrentShift(lineIdForShift, null).then((s) => {
        setShiftStart(s?.startUtc ?? live?.shiftStartUtc ?? null)
        setShiftEnd(s?.endUtc ?? live?.shiftEndUtc ?? null)
      })
      return
    }
    if (plantId) {
      void getCurrentShift(null, plantId).then((s) => {
        setShiftStart(s?.startUtc ?? null)
        setShiftEnd(s?.endUtc ?? null)
      })
      return
    }
    setShiftStart(live?.shiftStartUtc ?? null)
    setShiftEnd(live?.shiftEndUtc ?? null)
  }, [lineIdForShift, plantId, live?.shiftStartUtc, live?.shiftEndUtc])

  const historian = useExplorerHistorian(
    historianScope,
    range,
    shiftStart ?? live?.shiftStartUtc,
    shiftEnd ?? live?.shiftEndUtc,
  )

  const analyticsScope = `${node.level}:${node.id}`
  const activeProduct = kpi.activeRecipeCode
  const isMachine = node.level === 'Machine'
  const oeeHex = oeeExplorerHexColor(kpi.oeePct, kpi.connectionState)

  const continuousLineMeta = useMemo(() => {
    if (node.level !== 'Line') return null
    for (const p of tree) {
      for (const d of p.departments) {
        const line = d.lines.find((l) => l.id === node.id)
        if (!line) continue
        if ((line.topology ?? node.topology ?? 'Independent') !== 'Continuous') return null
        return {
          outputName: line.lineOutputMachineName ?? node.lineOutputMachineName ?? null,
        }
      }
    }
    if (node.topology === 'Continuous') {
      return { outputName: node.lineOutputMachineName ?? null }
    }
    return null
  }, [node, tree])

  const downtimeChartTitle =
    node.level === 'Line' ? 'Downtime by machine' : node.level === 'Department' ? 'Downtime by line' : 'Downtime by department'
  const downtimeDrillLevels =
    node.level === 'Line' ? ['Machine'] : node.level === 'Department' ? ['Line'] : node.level === 'Plant' ? ['Department'] : []
  const showDowntimeBreakdown = node.level !== 'Machine' && downtimeDrillLevels.length > 0

  const lineSnapshots = useMemo(
    () => (resolvedLineId ? snapshots.filter((s) => s.lineId === resolvedLineId) : []),
    [snapshots, resolvedLineId],
  )

  const scopedSnapshots = useMemo(() => {
    if (node.level === 'Line') return lineSnapshots
    if (node.level === 'Department') {
      const machineIds = new Set<string>()
      for (const p of tree) {
        for (const d of p.departments) {
          if (d.id !== node.id) continue
          for (const l of d.lines) {
            for (const m of l.machines) machineIds.add(m.id)
          }
        }
      }
      return snapshots.filter((s) => machineIds.has(s.machineId))
    }
    return snapshots
  }, [node.level, node.id, tree, snapshots, lineSnapshots])

  return (
    <Stack gap="md">
      <WidgetSurface
        tone={statusSurfaceTone(kpi.status, kpi.connectionState)}
        padding="md"
        radius="md"
        style={{ position: 'sticky', top: 0, zIndex: 10 }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <Group gap="md" wrap="wrap">
            {isMachine ? (
              <GaugeRing value={kpi.oeePct} label="OEE" size={80} thickness={10} ringColor={oeeHex} showLabelBelow />
            ) : null}
            <StatusPill state={kpi.status} />
            <div>
              <Group gap="xs">
                <Text fw={700} size="lg">
                  {node.name}
                </Text>
                <Badge variant="light" size="sm">
                  {node.level}
                </Badge>
                {continuousLineMeta ? (
                  <Badge variant="light" color="violet" size="sm">
                    Continuous{continuousLineMeta.outputName ? ` · ${continuousLineMeta.outputName}` : ''}
                  </Badge>
                ) : null}
                {activeProduct ? (
                  <Badge
                    variant="outline"
                    color="blue"
                    size="sm"
                    style={{ cursor: resolvedLineId ? 'pointer' : undefined }}
                    onClick={() => {
                      if (resolvedLineId) document.getElementById('line-product-strip')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  >
                    {activeProduct}
                  </Badge>
                ) : null}
              </Group>
              <Text size="xs" c="dimmed">
                {range === 'shift' ? 'Current shift view' : 'Last 8 hours'}
              </Text>
            </div>
          </Group>
          <Stack gap="xs" align="flex-end">
            <Group gap="sm">
              <ConnectionPill connectionState={kpi.connectionState} />
              <Anchor component={Link} to={`/analytics?scope=${encodeURIComponent(analyticsScope)}`} size="sm">
                Open in Analytics
              </Anchor>
            </Group>
            {isMachine ? (
              <Group gap="xs">
                <Badge variant="light" color="blue">
                  A {kpi.availabilityPct.toFixed(0)}%
                </Badge>
                <Badge variant="light" color="indigo">
                  P {kpi.performancePct.toFixed(0)}%
                </Badge>
                <Badge variant="light" color="grape">
                  Q {kpi.qualityPct.toFixed(0)}%
                </Badge>
              </Group>
            ) : null}
          </Stack>
        </Group>
      </WidgetSurface>

      <OfflineHint connectionState={kpi.connectionState} />

      {resolvedLineId ? (
        <LineProductStrip lineId={resolvedLineId} kpi={kpi} canSelect={canSelect} />
      ) : null}

      <ExplorerKpiHero
        level={node.level}
        id={node.id}
        name={node.name}
        kpi={kpi}
        snapshot={historian.snapshot}
        live={live}
        reliability={historian.reliability}
        teepPct={teepPctForExplorerNode(snapshots, node, tree)}
        preferLive={range === 'shift'}
      />

      {(resolvedLineId || (node.level === 'Plant' && plantId)) && live ? (
        <ShiftContextBar
          lineId={resolvedLineId}
          plantId={!resolvedLineId && node.level === 'Plant' ? plantId : undefined}
          snapshot={snapshot}
        />
      ) : null}

      {node.level !== 'Machine' ? (
        <ExplorerChildCompare
          parentLevel={node.level}
          children={historian.children}
          snapshot={historian.snapshot}
          initialLoading={historian.initialLoading}
          onSelect={(d) => {
            const next = drillToExplorerNode(tree, d, node)
            if (next) onSelectNode(next)
          }}
        />
      ) : null}

      <ExplorerPartsSection
        snapshots={scopedSnapshots}
        historianSnapshot={historian.snapshot}
        analyticsScope={analyticsScope}
        preferLive={range === 'shift'}
      />

      <ExplorerTrendSection
        trend={historian.trend}
        initialLoading={historian.initialLoading}
        range={range}
        onRangeChange={setRange}
      />

      {historian.production.length > 0 ? (
        <WidgetFrame title="Production" live={!historian.initialLoading}>
          <ProductionChart production={historian.production} showScrapTrend />
        </WidgetFrame>
      ) : null}

      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <WidgetFrame title="Downtime by category" live={!historian.initialLoading}>
          <LossesDonut losses={historian.losses} />
        </WidgetFrame>
        <WidgetFrame title="Loss pareto" live={!historian.initialLoading}>
          <LossParetoChart reasons={historian.reasons} />
        </WidgetFrame>
      </SimpleGrid>

      {showDowntimeBreakdown ? (
        <DowntimeByMachineChart
          events={[]}
          machineNames={lineMachineNames}
          drilldown={historian.children}
          drilldownLevels={downtimeDrillLevels}
          liveSnapshots={scopedSnapshots}
          lineId={resolvedLineId}
          title={downtimeChartTitle}
        />
      ) : null}

      {historian.reasons.length > 0 ? <TopReasonChips reasons={historian.reasons} /> : null}

      {(resolvedLineId || (node.level === 'Plant' && plantId)) && live ? (
        <>
          <ReliabilityStrip live={live} />
          <WidgetFrame title="Reliability trend" live={!historian.initialLoading}>
            <ReliabilityTrendChart
              trend={historian.reliabilityTrend}
              liveFallback={
                live
                  ? {
                      uptimeMin: live.uptimeMin,
                      downtimeMin: live.downtimeMin,
                      mttrMin: live.mttrMin,
                      mtbfMin: live.mtbfMin,
                      stopsPerHour: live.stopsPerHour,
                    }
                  : null
              }
            />
          </WidgetFrame>
        </>
      ) : null}

      {node.level === 'Line' && resolvedLineId ? (
        <ExplorerOperationsAccordion lineId={resolvedLineId} canManageRates={canManageRates} />
      ) : null}

      {resolvedLineId ? (
        <LineDowntimeSection
          lineId={resolvedLineId}
          machineId={machineScopeId}
          machineNames={lineMachineNames}
          showChart={false}
        />
      ) : null}

      <DrillLinks lineName={node.level === 'Line' ? node.name : undefined} scope={analyticsScope} />
    </Stack>
  )
}

function DrillLinks({ lineName, scope }: { lineName?: string; scope: string }) {
  return (
    <Card withBorder padding="md" radius="md">
      <Text fw={600} mb="xs">
        Quick links
      </Text>
      <Group gap="md">
        <Anchor component={Link} to="/dashboards">
          Dashboards
        </Anchor>
        <Anchor component={Link} to="/analytics">
          Analytics
        </Anchor>
        <Anchor component={Link} to={`/reports?scope=${encodeURIComponent(scope)}`}>
          Reports
        </Anchor>
        <Anchor component={Link} to="/admin?tab=tags">
          Tag Mapping
        </Anchor>
        {lineName ? (
          <Text size="sm" c="dimmed">
            Line: {lineName}
          </Text>
        ) : null}
      </Group>
    </Card>
  )
}
