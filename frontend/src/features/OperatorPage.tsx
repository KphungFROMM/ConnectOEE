import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader, Stack } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { useLiveSnapshots } from '../lib/useLiveSnapshots'
import { useAuth } from '../lib/auth'
import { useOperatorStations, type OperatorFilters } from '../lib/useOperatorStations'
import type { DowntimeEvent } from '../lib/metrics'
import { OperatorScopeBar } from '../components/operator/OperatorScopeBar'
import { OperatorMachineTabs } from '../components/operator/OperatorMachineTabs'
import { StationGrid } from '../components/operator/StationGrid'
import { StationDetail } from '../components/operator/StationDetail'
import { ReasonQueue } from '../components/operator/ReasonQueue'
import { ReasonAssignModal } from '../components/operator/ReasonAssignModal'
import { ProductSelectModal, type ProductSelectModalVariant } from '../components/operator/ProductSelectModal'
import {
  CHANGEOVER_REASON_SAVED_MESSAGE,
  isChangeoverReason,
  shouldOfferProductAfterChangeover,
} from '../lib/productChange'
import { useDowntimeReasonCatalog } from '../components/operator/useDowntimeReasonCatalog'
import { scopeToParam } from '../lib/scopeFromUrl'

export function OperatorPage() {
  const { user } = useAuth()
  const wallDisplay = useMediaQuery('(min-width: 1400px)')
  const { snapshots, hubConnected } = useLiveSnapshots()
  const [searchParams, setSearchParams] = useSearchParams()

  const [filters, setFilters] = useState<OperatorFilters>({
    plantId: null,
    lineId: null,
    machineId: null,
  })

  const machineParam = searchParams.get('machine')

  const {
    treeLoading,
    gridGroups,
    stations,
    unassigned,
    unassignedByMachine,
    machineNameById,
    eventsLoading,
    summary,
    plantOptions,
    lineOptions,
    machineOptions,
    plantId,
    refreshUnassigned,
  } = useOperatorStations(filters, user, snapshots)

  useEffect(() => {
    if (plantId && !filters.plantId) {
      setFilters((f) => ({ ...f, plantId }))
    }
  }, [plantId, filters.plantId])

  const selectedStation = useMemo(
    () => {
      const fromUrl = machineParam
        ? snapshots.find((s) => s.machineId === machineParam) ?? null
        : null
      if (fromUrl && machineParam) {
        const meta = stations.find((s) => s.machineId === machineParam)
        if (meta) return meta
        if (fromUrl) {
          return {
            machineId: fromUrl.machineId,
            machineName: fromUrl.machineName,
            lineId: fromUrl.lineId,
            lineName: '',
            deptName: '',
            plantId: filters.plantId ?? plantId ?? '',
            plantName: '',
            snapshot: fromUrl,
          }
        }
      }
      return stations.find((s) => s.machineId === machineParam) ?? null
    },
    [stations, machineParam, snapshots, filters.plantId, plantId],
  )

  const lineStations = useMemo(() => {
    if (!selectedStation) return []
    const rows: typeof stations = []
    for (const g of gridGroups) {
      if (g.lineId !== selectedStation.lineId) continue
      for (const m of g.machines) {
        rows.push({
          machineId: m.machineId,
          machineName: m.snapshot.machineName,
          lineId: m.lineId,
          lineName: g.lineName,
          deptName: g.deptName,
          plantId: selectedStation.plantId,
          plantName: g.plantName,
          snapshot: m.snapshot,
        })
      }
    }
    return rows
  }, [gridGroups, selectedStation])

  // Sync URL machine param with scope filters + line context
  useEffect(() => {
    if (!machineParam) return
    const station = stations.find((s) => s.machineId === machineParam)
    if (!station) return
    setFilters((f) => {
      if (f.lineId === station.lineId && f.machineId === machineParam) return f
      return { ...f, lineId: station.lineId, machineId: machineParam }
    })
  }, [machineParam, stations])

  const view = selectedStation ? 'detail' : 'grid'
  const effectiveMachineId = machineParam ?? filters.machineId

  useEffect(() => {
    if (machineParam || treeLoading || stations.length === 0) return
    if (stations.length === 1) {
      setSearchParams({ machine: stations[0].machineId }, { replace: true })
    }
  }, [machineParam, treeLoading, stations, setSearchParams])

  const [assignTarget, setAssignTarget] = useState<DowntimeEvent | null>(null)
  const [productPickOpen, setProductPickOpen] = useState(false)
  const [productPickVariant, setProductPickVariant] = useState<ProductSelectModalVariant>('manual')
  const [productPickContext, setProductPickContext] = useState<{ lineId: string; machineId?: string } | null>(null)
  const autoPromptedRef = useRef<string | null>(null)
  const assignLineId = assignTarget?.lineId ?? filters.lineId ?? stations[0]?.lineId ?? null
  const downtimeLogHref = assignLineId
    ? `/analytics?scope=${encodeURIComponent(scopeToParam('Line', assignLineId))}&tab=downtime`
    : undefined
  const productPickLineId =
    productPickContext?.lineId ??
    selectedStation?.lineId ??
    assignTarget?.lineId ??
    filters.lineId ??
    stations[0]?.lineId ??
    null
  const { pendingCodes } = useDowntimeReasonCatalog(assignLineId ?? filters.lineId ?? stations[0]?.lineId)

  const pendingForStation = useMemo(
    () => (selectedStation ? unassigned.find((e) => e.machineId === selectedStation.machineId) ?? null : null),
    [unassigned, selectedStation],
  )

  useEffect(() => {
    if (!pendingForStation || !selectedStation) return
    if (selectedStation.snapshot.state === 'Down' && autoPromptedRef.current !== pendingForStation.id) {
      autoPromptedRef.current = pendingForStation.id
      setAssignTarget(pendingForStation)
    }
  }, [pendingForStation, selectedStation])

  function machineStateForEvent(event: DowntimeEvent): string | undefined {
    if (event.machineId) {
      const station = stations.find((s) => s.machineId === event.machineId)
      if (station) return station.snapshot.state
      const snap = snapshots.find((s) => s.machineId === event.machineId)
      if (snap) return snap.state
    }
    return selectedStation?.snapshot.state
  }

  function handleChangeoverReasonAssigned(event: DowntimeEvent) {
    const machineState = machineStateForEvent(event)
    if (!shouldOfferProductAfterChangeover(event, { machineState })) {
      notifications.show({ message: CHANGEOVER_REASON_SAVED_MESSAGE, color: 'green' })
      return
    }

    const lineId =
      event.lineId ?? selectedStation?.lineId ?? filters.lineId ?? stations[0]?.lineId ?? null
    if (!lineId) {
      notifications.show({ message: CHANGEOVER_REASON_SAVED_MESSAGE, color: 'green' })
      return
    }

    setProductPickContext({ lineId, machineId: event.machineId ?? undefined })
    setProductPickVariant('afterChangeoverReason')
    setProductPickOpen(true)
  }

  function closeProductPickModal() {
    setProductPickOpen(false)
    setProductPickContext(null)
    setProductPickVariant('manual')
  }

  const shiftSnapshot = selectedStation?.snapshot ?? stations[0]?.snapshot ?? snapshots[0] ?? null

  function openMachine(machineId: string) {
    const station = stations.find((s) => s.machineId === machineId)
    if (station) {
      setFilters((f) => ({ ...f, lineId: station.lineId, machineId }))
    }
    setSearchParams({ machine: machineId })
  }

  function backToGrid() {
    setSearchParams({})
    setFilters((f) => ({ ...f, machineId: null }))
  }

  function patchFilters(patch: Partial<OperatorFilters>) {
    setFilters((f) => ({ ...f, ...patch }))
    if (patch.machineId) {
      setSearchParams({ machine: patch.machineId })
    } else if (patch.machineId === null || patch.lineId === null) {
      setSearchParams({})
    }
  }

  const queueMode = effectiveMachineId ? 'machine' : 'line'
  const queueMachineName = effectiveMachineId
    ? machineNameById.get(effectiveMachineId.toLowerCase()) ?? selectedStation?.machineName
    : undefined

  if (treeLoading && stations.length === 0) {
    return (
      <Stack align="center" py="xl">
        <Loader />
      </Stack>
    )
  }

  return (
    <Stack gap="md" data-operator-density="touch">
      <OperatorScopeBar
        filters={{ ...filters, plantId: filters.plantId ?? plantId }}
        plantOptions={plantOptions}
        lineOptions={lineOptions}
        machineOptions={machineOptions}
        onFiltersChange={patchFilters}
        hubConnected={hubConnected}
        summary={summary}
        shiftSnapshot={shiftSnapshot}
        selectedMachineName={selectedStation?.machineName ?? null}
        onBackToGrid={view === 'detail' ? backToGrid : undefined}
        machineTabs={
          view === 'detail' && lineStations.length > 1 ? (
            <OperatorMachineTabs
              stations={lineStations}
              value={selectedStation!.machineId}
              onChange={openMachine}
            />
          ) : undefined
        }
      />

      {view === 'detail' && selectedStation ? (
        <StationDetail
          station={selectedStation}
          pendingEvent={pendingForStation}
          onOpenAssignModal={setAssignTarget}
          onReasonAssigned={() => void refreshUnassigned()}
          onChangeoverReason={handleChangeoverReasonAssigned}
        />
      ) : (
        <StationGrid
          groups={gridGroups}
          unassignedByMachine={unassignedByMachine}
          onSelectMachine={openMachine}
          loading={treeLoading}
          compact={wallDisplay}
        />
      )}

      <ReasonQueue
        events={unassigned}
        machineNameById={machineNameById}
        loading={eventsLoading}
        onAssign={setAssignTarget}
        pendingReviewCodes={pendingCodes}
        mode={queueMode}
        machineName={queueMachineName}
        downtimeLogHref={downtimeLogHref}
      />

      <ReasonAssignModal
        opened={!!assignTarget}
        event={assignTarget}
        lineId={assignLineId}
        pendingReviewCodes={pendingCodes}
        onClose={() => setAssignTarget(null)}
        onAssigned={() => void refreshUnassigned()}
        onAssignedReason={(reason, category) => {
          if (isChangeoverReason(reason, category) && assignTarget) {
            const event = assignTarget
            setAssignTarget(null)
            handleChangeoverReasonAssigned(event)
          }
        }}
      />

      {productPickLineId ? (
        <ProductSelectModal
          opened={productPickOpen}
          lineId={productPickLineId}
          machineId={productPickContext?.machineId ?? selectedStation?.machineId ?? filters.machineId ?? undefined}
          variant={productPickVariant}
          onClose={closeProductPickModal}
          onSelected={() => void refreshUnassigned()}
        />
      ) : null}
    </Stack>
  )
}
