import { useEffect, useRef, useState } from 'react'
import { apiGet } from './api'
import {
  createLiveConnection,
  HubConnectionState,
  normalizeLiveUpdates,
  type MachineSnapshot,
} from './liveHub'
import type { HubConnection } from '@microsoft/signalr'

/**
 * Loads initial machine snapshots via REST, then keeps them live via SignalR.
 * Subscribes to every line present in the initial load.
 */
export function useLiveSnapshots(): {
  snapshots: MachineSnapshot[]
  hubConnected: boolean
} {
  const [byMachine, setByMachine] = useState<Record<string, MachineSnapshot>>({})
  const [hubConnected, setHubConnected] = useState(false)
  const connRef = useRef<HubConnection | null>(null)

  useEffect(() => {
    let disposed = false
    const conn = createLiveConnection()
    connRef.current = conn

    conn.on('liveUpdate', (payload: MachineSnapshot | MachineSnapshot[]) => {
      const updates = normalizeLiveUpdates(payload)
      if (updates.length === 0) return
      setByMachine((prev) => {
        const next = { ...prev }
        for (const snap of updates) next[snap.machineId] = snap
        return next
      })
    })
    conn.onreconnected(() => setHubConnected(true))
    conn.onclose(() => setHubConnected(false))

    async function start() {
      try {
        const initial = await apiGet<MachineSnapshot[]>('/api/live')
        if (disposed) return
        const map: Record<string, MachineSnapshot> = {}
        for (const s of initial) map[s.machineId] = s
        setByMachine(map)

        await conn.start()
        if (disposed) return
        setHubConnected(conn.state === HubConnectionState.Connected)

        const lineIds = Array.from(new Set(initial.map((s) => s.lineId)))
        for (const lineId of lineIds) await conn.invoke('SubscribeLine', lineId)
      } catch {
        if (!disposed) setHubConnected(false)
      }
    }
    void start()

    return () => {
      disposed = true
      void conn.stop()
    }
  }, [])

  return { snapshots: Object.values(byMachine).filter((s) => s.machineId), hubConnected }
}
