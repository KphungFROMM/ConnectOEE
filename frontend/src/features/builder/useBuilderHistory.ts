import { useCallback, useRef, useState } from 'react'
import type { DashboardWidget } from '../../lib/dashboards'

const MAX_HISTORY = 50

function cloneWidgets(widgets: DashboardWidget[]): DashboardWidget[] {
  return structuredClone(widgets)
}

export function useBuilderHistory(initial: DashboardWidget[] = []) {
  const [widgets, setWidgetsInternal] = useState<DashboardWidget[]>(initial)
  const pastRef = useRef<DashboardWidget[][]>([])
  const futureRef = useRef<DashboardWidget[][]>([])
  const skipHistoryRef = useRef(false)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncHistoryFlags = () => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
    setHistoryVersion((v) => v + 1)
  }

  const setWidgets = useCallback(
    (
      updater: DashboardWidget[] | ((prev: DashboardWidget[]) => DashboardWidget[]),
      recordHistory = true,
    ) => {
      setWidgetsInternal((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (recordHistory && !skipHistoryRef.current && next !== prev) {
          pastRef.current.push(cloneWidgets(prev))
          if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
          futureRef.current = []
          queueMicrotask(syncHistoryFlags)
        }
        return next
      })
    },
    [],
  )

  const replaceWidgets = useCallback((next: DashboardWidget[]) => {
    skipHistoryRef.current = true
    pastRef.current = []
    futureRef.current = []
    setWidgetsInternal(next)
    skipHistoryRef.current = false
    syncHistoryFlags()
  }, [])

  const undo = useCallback(() => {
    const past = pastRef.current
    if (!past.length) return
    setWidgetsInternal((current) => {
      const prev = past.pop()!
      futureRef.current.push(cloneWidgets(current))
      queueMicrotask(syncHistoryFlags)
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (!future.length) return
    setWidgetsInternal((current) => {
      const next = future.pop()!
      pastRef.current.push(cloneWidgets(current))
      queueMicrotask(syncHistoryFlags)
      return next
    })
  }, [])

  return { widgets, setWidgets, replaceWidgets, undo, redo, canUndo, canRedo, historyVersion }
}
