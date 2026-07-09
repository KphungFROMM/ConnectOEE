import { useEffect, useMemo, useState } from 'react'
import type { UserInfo } from './auth'
import { getOperatorStations, type PlantNode } from './hierarchy'
import type { MachineSnapshot } from './liveHub'
import { getUnassignedDowntime, type DowntimeEvent } from './metrics'
import {
  buildMachineGridGroups,
} from '../components/widgets/machineGridUtils'

export interface OperatorFilters {
  plantId: string | null
  lineId: string | null
  machineId: string | null
}

export interface OperatorStation {
  machineId: string
  machineName: string
  lineId: string
  lineName: string
  deptName: string
  plantId: string
  plantName: string
  snapshot: MachineSnapshot
}

function isDown(state: string) {
  return state === 'Down' || state === 'Setup' || state === 'PlannedDown'
}

export function useOperatorStations(
  filters: OperatorFilters,
  user: UserInfo | null,
  snapshots: MachineSnapshot[],
) {
  const [tree, setTree] = useState<PlantNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [unassigned, setUnassigned] = useState<DowntimeEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  useEffect(() => {
    setTreeLoading(true)
    void getOperatorStations()
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setTreeLoading(false))
  }, [user?.id])

  const plantId = filters.plantId ?? tree[0]?.id ?? null

  const gridGroups = useMemo(
    () => buildMachineGridGroups(tree, snapshots, plantId ?? undefined, 'state'),
    [tree, snapshots, plantId],
  )

  const filteredGroups = useMemo(() => {
    let groups = gridGroups
    if (filters.lineId) groups = groups.filter((g) => g.lineId === filters.lineId)
    if (filters.machineId) {
      groups = groups
        .map((g) => ({
          ...g,
          machines: g.machines.filter((m) => m.machineId === filters.machineId),
        }))
        .filter((g) => g.machines.length > 0)
    }
    return groups
  }, [gridGroups, filters.lineId, filters.machineId])

  const stations: OperatorStation[] = useMemo(() => {
    const rows: OperatorStation[] = []
    for (const g of filteredGroups) {
      for (const m of g.machines) {
        rows.push({
          machineId: m.machineId,
          machineName: m.snapshot.machineName,
          lineId: m.lineId,
          lineName: g.lineName,
          deptName: g.deptName,
          plantId: tree.find((p) => p.name === g.plantName)?.id ?? plantId ?? '',
          plantName: g.plantName,
          snapshot: m.snapshot,
        })
      }
    }
    return rows
  }, [filteredGroups, tree, plantId])

  const machineNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of stations) map.set(s.machineId.toLowerCase(), s.machineName)
    for (const snap of snapshots) map.set(snap.machineId.toLowerCase(), snap.machineName)
    return map
  }, [stations, snapshots])

  const queryPlantId = filters.lineId ? null : plantId
  const queryLineId = filters.lineId

  useEffect(() => {
    if (!queryPlantId && !queryLineId) return
    let cancelled = false
    setEventsLoading(true)
    const load = () =>
      getUnassignedDowntime(queryLineId, queryPlantId, filters.machineId, 500)
        .then((rows) => !cancelled && setUnassigned(rows))
        .catch(() => !cancelled && setUnassigned([]))
        .finally(() => !cancelled && setEventsLoading(false))
    void load()
    const id = setInterval(load, 8000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [queryPlantId, queryLineId, filters.machineId])

  const unassignedByMachine = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of unassigned) {
      const mid = e.machineId?.toLowerCase()
      if (mid) map.set(mid, (map.get(mid) ?? 0) + 1)
    }
    return map
  }, [unassigned])

  const summary = useMemo(
    () => ({
      stationCount: stations.length,
      needReasonCount: unassigned.length,
      downCount: stations.filter((s) => isDown(s.snapshot.state)).length,
    }),
    [stations, unassigned],
  )

  const plantOptions = useMemo(
    () => tree.map((p) => ({ value: p.id, label: p.name })),
    [tree],
  )

  const lineOptions = useMemo(() => {
    const plant = tree.find((p) => p.id === plantId)
    if (!plant) return []
    const opts: { value: string; label: string }[] = []
    for (const d of plant.departments) {
      for (const l of d.lines) {
        opts.push({ value: l.id, label: `${d.name} › ${l.name}` })
      }
    }
    return opts
  }, [tree, plantId])

  const machineOptions = useMemo(() => {
    if (!filters.lineId) return []
    for (const p of tree) {
      for (const d of p.departments) {
        const line = d.lines.find((l) => l.id === filters.lineId)
        if (line) return line.machines.map((m) => ({ value: m.id, label: m.name }))
      }
    }
    return []
  }, [tree, filters.lineId])

  return {
    tree,
    treeLoading,
    gridGroups: filteredGroups,
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
    refreshUnassigned: () =>
      getUnassignedDowntime(queryLineId, queryPlantId, filters.machineId, 500).then(setUnassigned),
  }
}
