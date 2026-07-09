import { useEffect, useRef } from 'react'

const EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const

/** Logs out after idle period on operator/staff routes (factory HMI hygiene). */
export function useIdleTimeout(enabled: boolean, timeoutMinutes: number, onTimeout: () => void) {
  const timerRef = useRef<number | null>(null)
  const onTimeoutRef = useRef(onTimeout)
  onTimeoutRef.current = onTimeout

  useEffect(() => {
    if (!enabled || timeoutMinutes <= 0) return

    const reset = () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(
        () => onTimeoutRef.current(),
        timeoutMinutes * 60_000,
      )
    }

    reset()
    for (const ev of EVENTS) window.addEventListener(ev, reset, { passive: true })
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      for (const ev of EVENTS) window.removeEventListener(ev, reset)
    }
  }, [enabled, timeoutMinutes])
}
