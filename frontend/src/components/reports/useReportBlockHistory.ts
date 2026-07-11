import { useCallback, useRef, useState } from 'react'
import type { ReportBlock } from '../../lib/reportBlocks'

const MAX_HISTORY = 50

function cloneBlocks(blocks: ReportBlock[]): ReportBlock[] {
  return structuredClone(blocks)
}

/** Undo/redo stack for report designer blocks (mirrors dashboard builder history). */
export function useReportBlockHistory(initial: ReportBlock[] = []) {
  const [blocks, setBlocksInternal] = useState<ReportBlock[]>(initial)
  const pastRef = useRef<ReportBlock[][]>([])
  const futureRef = useRef<ReportBlock[][]>([])
  const skipHistoryRef = useRef(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const syncHistoryFlags = () => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }

  const setBlocks = useCallback(
    (updater: ReportBlock[] | ((prev: ReportBlock[]) => ReportBlock[]), recordHistory = true) => {
      setBlocksInternal((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        if (recordHistory && !skipHistoryRef.current && next !== prev) {
          pastRef.current.push(cloneBlocks(prev))
          if (pastRef.current.length > MAX_HISTORY) pastRef.current.shift()
          futureRef.current = []
          queueMicrotask(syncHistoryFlags)
        }
        return next
      })
    },
    [],
  )

  const replaceBlocks = useCallback((next: ReportBlock[]) => {
    skipHistoryRef.current = true
    pastRef.current = []
    futureRef.current = []
    setBlocksInternal(next)
    skipHistoryRef.current = false
    syncHistoryFlags()
  }, [])

  const undo = useCallback(() => {
    const past = pastRef.current
    if (!past.length) return
    setBlocksInternal((current) => {
      const prev = past.pop()!
      futureRef.current.push(cloneBlocks(current))
      queueMicrotask(syncHistoryFlags)
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (!future.length) return
    setBlocksInternal((current) => {
      const next = future.pop()!
      pastRef.current.push(cloneBlocks(current))
      queueMicrotask(syncHistoryFlags)
      return next
    })
  }, [])

  return { blocks, setBlocks, replaceBlocks, undo, redo, canUndo, canRedo }
}
