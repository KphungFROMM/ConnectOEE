import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Anchor,
  Badge,
  Group,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Title,
} from '@mantine/core'
import { getHierarchyTree, type PlantNode } from '../lib/hierarchy'
import type { DrillNode, EntityLevel, Granularity, TrendPoint } from '../lib/historian'
import { buildTimeBalanceFromSnapshot } from '../lib/kpiTimeBalance'
import { resolveScopeSelection, scopeToParam } from '../lib/scopeFromUrl'
import { useAnalyticsQuery, type AnalyticsTab } from '../lib/useAnalyticsQuery'
import { ScopeBreadcrumb, type BreadcrumbSegment } from '../components/analytics/ScopeBreadcrumb'
import { TimeRangeBar, resolveTimeRange } from '../components/analytics/TimeRangeBar'
import { ModernKpiHero, ModernKpiHeroSkeleton } from '../components/analytics/ModernKpiHero'
import { DataCoverageBanner } from '../components/analytics/AnalyticsEmpty'
import { OverviewTab } from '../components/analytics/OverviewTab'
import { DowntimeTab } from '../components/analytics/DowntimeTab'
import { ProductionTab } from '../components/analytics/ProductionTab'
import { ReliabilityTab } from '../components/analytics/ReliabilityTab'
import { exportAnalyticsCsv } from '../components/analytics/exportAnalyticsCsv'

export function AnalyticsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tree, setTree] = useState<PlantNode[]>([])
  const [plantId, setPlantId] = useState<string | null>(null)
  const [deptId, setDeptId] = useState<string | null>(null)
  const [lineId, setLineId] = useState<string | null>(null)
  const [machineId, setMachineId] = useState<string | null>(null)
  const [scopeFromUrlApplied, setScopeFromUrlApplied] = useState(false)

  const [presetHours, setPresetHours] = useState('168')
  const [customRange, setCustomRange] = useState<[Date | null, Date | null]>([null, null])
  const [granularity, setGranularity] = useState<Granularity>('Auto')
  const [compare, setCompare] = useState(false)
  const [activeTab, setActiveTab] = useState<AnalyticsTab>(() => {
    const tab = searchParams.get('tab')
    if (tab === 'downtime' || tab === 'production' || tab === 'reliability' || tab === 'overview') return tab
    return 'overview'
  })
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'downtime' || tab === 'production' || tab === 'reliability' || tab === 'overview') {
      setActiveTab(tab)
    }
  }, [searchParams])

  useEffect(() => {
    getHierarchyTree()
      .then((t) => {
        setTree(t)
        if (t.length > 0 && !searchParams.get('scope')) setPlantId(t[0].id)
      })
      .catch(() => setTree([]))
  }, [searchParams])

  useEffect(() => {
    if (tree.length === 0 || scopeFromUrlApplied) return
    const scopeParam = searchParams.get('scope')
    if (scopeParam) {
      const resolved = resolveScopeSelection(tree, scopeParam)
      if (resolved) {
        setPlantId(resolved.plantId)
        setDeptId(resolved.deptId)
        setLineId(resolved.lineId)
        setMachineId(resolved.machineId)
      }
    }
    setScopeFromUrlApplied(true)
  }, [searchParams, tree, scopeFromUrlApplied])

  const plant = tree.find((p) => p.id === plantId) ?? null
  const dept = plant?.departments.find((d) => d.id === deptId) ?? null
  const line = dept?.lines.find((l) => l.id === lineId) ?? null

  const scope = useMemo(() => {
    if (machineId && line) {
      const m = line.machines.find((x) => x.id === machineId)
      if (m)
        return {
          level: 'Machine' as EntityLevel,
          id: m.id,
          name: m.name,
          plantId: plant?.id,
          lineId: line.id,
        }
    }
    if (line) return { level: 'Line' as EntityLevel, id: line.id, name: line.name, plantId: plant?.id, lineId: line.id }
    if (dept) return { level: 'Department' as EntityLevel, id: dept.id, name: dept.name, plantId: plant?.id }
    if (plant) return { level: 'Plant' as EntityLevel, id: plant.id, name: plant.name, plantId: plant.id }
    return null
  }, [plant, dept, line, machineId])

  useEffect(() => {
    if (!scope || !scopeFromUrlApplied) return
    const next = scopeToParam(scope.level, scope.id)
    if (searchParams.get('scope') !== next) {
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        p.set('scope', next)
        return p
      })
    }
  }, [scope, scopeFromUrlApplied, searchParams, setSearchParams])

  const { from, to } = useMemo(
    () => resolveTimeRange(presetHours, customRange),
    [presetHours, customRange],
  )

  const query = useAnalyticsQuery(scope, from, to, granularity, compare, activeTab)

  const plannedMin = useMemo(
    () => (query.trend?.points ?? []).reduce((s, p) => s + p.plannedDowntimeMin, 0),
    [query.trend],
  )
  const unplannedMin = useMemo(
    () => (query.trend?.points ?? []).reduce((s, p) => s + p.unplannedDowntimeMin, 0),
    [query.trend],
  )

  const timeBalance = useMemo(
    () =>
      query.snapshot
        ? buildTimeBalanceFromSnapshot(query.snapshot, query.reliability, plannedMin, unplannedMin)
        : null,
    [query.snapshot, query.reliability, plannedMin, unplannedMin],
  )

  function updateScope(next: { plantId?: string | null; deptId?: string | null; lineId?: string | null; machineId?: string | null }) {
    if ('plantId' in next) setPlantId(next.plantId ?? null)
    if ('deptId' in next) setDeptId(next.deptId ?? null)
    if ('lineId' in next) setLineId(next.lineId ?? null)
    if ('machineId' in next) setMachineId(next.machineId ?? null)
  }

  function selectChild(node: DrillNode) {
    if (node.level === 'Department') {
      updateScope({ deptId: node.id, lineId: null, machineId: null })
    } else if (node.level === 'Line') {
      updateScope({ lineId: node.id, machineId: null })
    } else if (node.level === 'Machine') {
      setMachineId(node.id)
    }
  }

  function navigateBreadcrumb(seg: BreadcrumbSegment | null) {
    if (!seg) return
    if (seg.level === 'Plant') {
      updateScope({ deptId: null, lineId: null, machineId: null })
    } else if (seg.level === 'Department') {
      updateScope({ deptId: seg.id, lineId: null, machineId: null })
    } else if (seg.level === 'Line') {
      updateScope({ lineId: seg.id, machineId: null })
    } else if (seg.level === 'Machine') {
      setMachineId(seg.id)
    }
  }

  function zoomToBucket(point: TrendPoint) {
    const start = new Date(point.bucketUtc)
    const gran = query.trend?.resolvedGranularity ?? 'Day'
    const end = new Date(start)
    if (gran === 'Hour') end.setHours(end.getHours() + 1)
    else if (gran === 'Day') end.setDate(end.getDate() + 1)
    else if (gran === 'Week') end.setDate(end.getDate() + 7)
    else end.setDate(end.getDate() + 1)
    setCustomRange([start, end])
    setPresetHours('')
  }

  const scopeParam = scope ? scopeToParam(scope.level, scope.id) : ''

  const downtimeDrilldownLevels = useMemo(() => {
    if (!scope) return ['Machine']
    if (scope.level === 'Plant') return ['Department']
    if (scope.level === 'Department') return ['Line']
    return ['Machine']
  }, [scope])

  const downtimeChartTitle = useMemo(() => {
    if (!scope) return 'Downtime by machine'
    if (scope.level === 'Plant') return 'Downtime by department'
    if (scope.level === 'Department') return 'Downtime by line'
    return 'Downtime by machine'
  }, [scope])

  return (
    <Stack gap="md">
      <Paper
        withBorder
        p="md"
        radius="md"
        style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--mantine-color-body)' }}
      >
        <Group justify="space-between" align="flex-start" wrap="wrap" mb="sm">
          <div>
            <Title order={2}>Analytics & History</Title>
            <Text c="dimmed" size="sm">
              Historian trends, roll-ups, and drill-through for any plant scope.
            </Text>
          </div>
          {scope ? (
            <Group gap="xs">
              <Anchor component={Link} to={`/plant-explorer?scope=${encodeURIComponent(scopeParam)}`} size="sm">
                View live
              </Anchor>
            </Group>
          ) : null}
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="sm" mb="sm">
          <Select
            label="Plant"
            value={plantId}
            onChange={(v) => updateScope({ plantId: v, deptId: null, lineId: null, machineId: null })}
            data={tree.map((p) => ({ value: p.id, label: p.name }))}
            allowDeselect={false}
          />
          <Select
            label="Department"
            placeholder="(whole plant)"
            value={deptId}
            onChange={(v) => updateScope({ deptId: v, lineId: null, machineId: null })}
            data={(plant?.departments ?? []).map((d) => ({ value: d.id, label: d.name }))}
            clearable
            disabled={!plant}
          />
          <Select
            label="Line"
            placeholder="(whole dept)"
            value={lineId}
            onChange={(v) => updateScope({ lineId: v, machineId: null })}
            data={(dept?.lines ?? []).map((l) => ({ value: l.id, label: l.name }))}
            clearable
            disabled={!dept}
          />
          <Select
            label="Machine"
            placeholder="(whole line)"
            value={machineId}
            onChange={setMachineId}
            data={(line?.machines ?? []).map((m) => ({ value: m.id, label: m.name }))}
            clearable
            disabled={!line}
          />
        </SimpleGrid>

        <Group justify="space-between" align="center" wrap="wrap" gap="xs" mb="xs">
          <ScopeBreadcrumb
            plant={plant}
            deptId={deptId}
            lineId={lineId}
            machineId={machineId}
            onNavigate={navigateBreadcrumb}
          />
          {scope ? (
            <Group gap={6}>
              <Badge variant="light" size="sm">
                {scope.level}
              </Badge>
              <Text size="sm" fw={600}>
                {scope.name}
              </Text>
            </Group>
          ) : null}
        </Group>

        <TimeRangeBar
          presetHours={presetHours}
          onPresetChange={setPresetHours}
          customRange={customRange}
          onCustomRangeChange={setCustomRange}
          granularity={granularity}
          onGranularityChange={setGranularity}
          resolvedGranularity={query.trend?.resolvedGranularity}
          pointCount={query.trend?.points.length}
          compare={compare}
          onCompareChange={setCompare}
          onExport={() => exportAnalyticsCsv(query.snapshot, query.trend)}
          onOpenReports={() => navigate(`/reports?scope=${encodeURIComponent(scopeParam)}`)}
        />
      </Paper>

      {query.coverage ? (
        <DataCoverageBanner withData={query.coverage.withData} total={query.coverage.total} />
      ) : null}

      {query.initialLoading && !query.snapshot ? (
        <ModernKpiHeroSkeleton />
      ) : query.snapshot ? (
        <ModernKpiHero
          display={query.snapshot}
          priorSnapshot={query.priorSnapshot}
          timeBalance={timeBalance}
          reliability={query.reliability}
          plannedMin={plannedMin}
          unplannedMin={unplannedMin}
        />
      ) : null}

      <Tabs
        value={activeTab}
        onChange={(v) => {
          const next = (v as AnalyticsTab) ?? 'overview'
          setActiveTab(next)
          setSearchParams((prev) => {
            const p = new URLSearchParams(prev)
            if (next === 'overview') p.delete('tab')
            else p.set('tab', next)
            return p
          })
        }}
      >
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="downtime">Downtime</Tabs.Tab>
          <Tabs.Tab value="production">Production</Tabs.Tab>
          <Tabs.Tab value="reliability">Reliability</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="overview" pt="md">
          <OverviewTab
            snapshot={query.snapshot}
            trend={query.trend}
            priorTrend={query.priorTrend}
            production={query.production}
            losses={query.losses}
            children={query.children}
            parentLevel={scope?.level ?? 'Plant'}
            compare={compare}
            initialLoading={query.initialLoading}
            loading={{
              trend: query.loading.trend,
              production: query.loading.production,
              drilldown: query.loading.drilldown,
            }}
            onSelectChild={selectChild}
            onBucketZoom={zoomToBucket}
          />
        </Tabs.Panel>

        <Tabs.Panel value="downtime" pt="md">
          <DowntimeTab
            reasons={query.reasons}
            losses={query.losses}
            events={query.events}
            children={query.children}
            drilldownLevels={downtimeDrilldownLevels}
            downtimeChartTitle={downtimeChartTitle}
            loading={query.loading.downtime}
            categoryFilter={categoryFilter}
            onCategoryFilter={setCategoryFilter}
            lineId={scope?.lineId}
            plantId={scope?.plantId}
            scopeLevel={scope?.level}
            scopeId={scope?.id}
            from={from}
            to={to}
            onEventsRefresh={query.refreshEvents}
          />
        </Tabs.Panel>

        <Tabs.Panel value="production" pt="md">
          <ProductionTab
            production={query.production}
            snapshot={query.snapshot}
            isMachine={scope?.level === 'Machine'}
            loading={query.loading.production}
          />
        </Tabs.Panel>

        <Tabs.Panel value="reliability" pt="md">
          <ReliabilityTab
            reliability={query.reliability}
            reliabilityTrend={query.reliabilityTrend}
            loading={query.loading.reliability}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
