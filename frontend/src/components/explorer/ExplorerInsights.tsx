import { useEffect, useMemo, useState } from 'react'
import { Anchor, Group, SimpleGrid, Stack, Tabs, Text } from '@mantine/core'
import { Link, useSearchParams } from 'react-router-dom'
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
  TopReasonChips,
} from './ExplorerDetailSections'
import { ExplorerPartsSection } from './ExplorerPartsSection'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import {
  liveMetricsForExplorerNode,
  machineNamesForLine,
  mergeKpiWithSnapshot,
  pickSnapshot,
  teepPctForExplorerNode,
} from './explorerKpi'
import { WidgetFrame } from '../widgets/common'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import type { ExplorerNode, ExplorerRange } from './explorerTypes'

type InsightsTab = 'overview' | 'downtime' | 'reliability'

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
  return parent.level !== 'Machine'
    ? { ...parent, id: drill.id, name: drill.name, level: drill.level as ExplorerNode['level'] }
    : null
}

function parseTab(raw: string | null): InsightsTab {
  if (raw === 'downtime' || raw === 'reliability' || raw === 'overview') return raw
  return 'overview'
}

interface Props {
  node: ExplorerNode
  tree: PlantNode[]
  snapshots: MachineSnapshot[]
  onSelectNode: (node: ExplorerNode) => void
}

/** Insights band only: one KPI hero + URL-synced deep dive tabs. */
export function ExplorerInsights({ node, tree, snapshots, onSelectNode }: Props) {
  const { hasPermission } = useAuth()
  const canSelect = hasPermission(Permissions.SelectProduct)
  const canManageRates = hasPermission(Permissions.ManageProducts)
  const [searchParams, setSearchParams] = useSearchParams()

  const [range, setRange] = useState<ExplorerRange>('shift')
  const [shiftStart, setShiftStart] = useState<string | null>(null)
  const [shiftEnd, setShiftEnd] = useState<string | null>(null)
  const deepTab = parseTab(searchParams.get('tab'))

  const setDeepTab = (tab: string | null) => {
    const next = parseTab(tab)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )
  }

  const plantId = useMemo(() => node.plantId ?? findPlantId(tree, node.id), [tree, node.id, node.plantId])

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
  const lineMachineNames = useMemo(
    () => (resolvedLineId ? machineNamesForLine(tree, resolvedLineId) : {}),
    [tree, resolvedLineId],
  )

  useEffect(() => {
    if (resolvedLineId) {
      void getCurrentShift(resolvedLineId, null).then((s) => {
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
  }, [resolvedLineId, plantId, live?.shiftStartUtc, live?.shiftEndUtc])

  const historian = useExplorerHistorian(
    historianScope,
    range,
    shiftStart ?? live?.shiftStartUtc,
    shiftEnd ?? live?.shiftEndUtc,
  )

  const analyticsScope = `${node.level}:${node.id}`

  const downtimeChartTitle =
    node.level === 'Line'
      ? 'Downtime by machine'
      : node.level === 'Department'
        ? 'Downtime by line'
        : 'Downtime by department'
  const downtimeDrillLevels =
    node.level === 'Line'
      ? ['Machine']
      : node.level === 'Department'
        ? ['Line']
        : node.level === 'Plant'
          ? ['Department']
          : []
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

  const showReliability = Boolean(resolvedLineId || plantId)

  return (
    <Stack gap="md" className="explorerDrillTransition">
      <OfflineHint connectionState={kpi.connectionState} />

      {resolvedLineId ? <LineProductStrip lineId={resolvedLineId} kpi={kpi} canSelect={canSelect} /> : null}

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

      <Tabs value={deepTab} onChange={setDeepTab}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="downtime">Downtime</Tabs.Tab>
          <Tabs.Tab value="reliability">Reliability</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
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

            {node.level !== 'Machine' ? (
              <ExplorerChildCompare
                parentLevel={node.level}
                children={historian.children}
                snapshot={historian.snapshot}
                initialLoading={historian.initialLoading}
                compact
                onSelect={(d) => {
                  const next = drillToExplorerNode(tree, d, node)
                  if (next) onSelectNode(next)
                }}
              />
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="downtime" pt="md">
          <Stack gap="md">
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

            {resolvedLineId ? (
              <LineDowntimeSection
                lineId={resolvedLineId}
                machineId={machineScopeId}
                machineNames={lineMachineNames}
                showChart={false}
              />
            ) : null}
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="reliability" pt="md">
          <Stack gap="md">
            {showReliability && live ? <ReliabilityStrip live={live} /> : null}

            {showReliability ? (
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
            ) : (
              <Text size="sm" c="dimmed">
                Select a plant, department, line, or machine to view reliability.
              </Text>
            )}

            {node.level === 'Line' && resolvedLineId ? (
              <ExplorerOperationsAccordion lineId={resolvedLineId} canManageRates={canManageRates} />
            ) : null}
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <WidgetSurface tone="neutral" padding="md" radius="md">
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
          <Anchor component={Link} to={`/reports?scope=${encodeURIComponent(analyticsScope)}`}>
            Reports
          </Anchor>
          <Anchor component={Link} to="/admin?tab=tags">
            Tag Mapping
          </Anchor>
          {node.level === 'Line' ? (
            <Text size="sm" c="dimmed">
              Line: {node.name}
            </Text>
          ) : null}
        </Group>
      </WidgetSurface>
    </Stack>
  )
}
