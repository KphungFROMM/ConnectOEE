import { useEffect, useRef, useState } from 'react'
import { checkReady } from './api'
import type { ConnectionStatus } from '../theme/tokens'

/**
 * Polls backend readiness and exposes a connection status for the status bar.
 * Surfacing connection/stale state is a core UX requirement (AGENTS.md).
 */
export function useConnectionState(pollMs = 5000): {
  status: ConnectionStatus
  lastChecked: Date | null
} {
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    let cancelled = false

    const tick = async () => {
      const ok = await checkReady()
      if (cancelled) return
      setStatus(ok ? 'connected' : 'disconnected')
      setLastChecked(new Date())
    }

    void tick()
    timer.current = window.setInterval(tick, pollMs)
    return () => {
      cancelled = true
      if (timer.current) window.clearInterval(timer.current)
    }
  }, [pollMs])

  return { status, lastChecked }
}
