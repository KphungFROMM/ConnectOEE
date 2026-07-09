import { useCallback, useEffect, useMemo, useState } from 'react'
import { notifications } from '@mantine/notifications'
import { createLiveConnection } from '../../lib/liveHub'
import {
  browseTags,
  flattenVisible,
  readTagValues,
  type BrowseResult,
  type BrowseTag,
  type FlatRow,
  type TagPathRequest,
  type TagValueSample,
} from '../../lib/tags'
import type { HubConnection } from '@microsoft/signalr'
import { TAG_MAX_PREVIEW, TAG_POLL_MS } from './tagBrowseUtils'

export function useTagBrowse(connectionId: string | null) {
  const [browse, setBrowse] = useState<BrowseResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [selected, setSelected] = useState<BrowseTag | null>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [values, setValues] = useState<Record<string, TagValueSample>>({})

  const loadBrowse = useCallback((id: string) => {
    setLoading(true)
    setSelected(null)
    setValues({})
    setScrollTop(0)
    browseTags(id)
      .then((r) => {
        setBrowse(r)
        setExpanded(new Set(r.tags.filter((t) => t.children.length > 0).map((t) => t.fullPath)))
        setScrollTop(0)
      })
      .catch(() => notifications.show({ message: 'Failed to browse tags', color: 'red' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (connectionId) loadBrowse(connectionId)
    else {
      setBrowse(null)
      setSelected(null)
      setValues({})
      setFilter('')
      setScrollTop(0)
      setExpanded(new Set())
    }
  }, [connectionId, loadBrowse])

  const rows: FlatRow[] = useMemo(
    () => (browse?.supportsBrowsing ? flattenVisible(browse.tags, expanded, filter) : []),
    [browse, expanded, filter],
  )

  const previewRequests: TagPathRequest[] = useMemo(() => {
    const leaves = rows.filter((r) => r.tag.bindable).map((r) => ({ path: r.tag.fullPath, dataType: r.tag.dataType }))
    if (selected?.bindable) leaves.push({ path: selected.fullPath, dataType: selected.dataType })
    const seen = new Set<string>()
    return leaves
      .filter((l) => {
        if (seen.has(l.path)) return false
        seen.add(l.path)
        return true
      })
      .slice(0, TAG_MAX_PREVIEW)
  }, [rows, selected])

  const previewKey = useMemo(
    () => previewRequests.map((r) => `${r.path}:${r.dataType ?? ''}`).join('|'),
    [previewRequests],
  )

  useEffect(() => {
    if (!connectionId || !browse?.supportsBrowsing) return
    let cancelled = false
    let conn: HubConnection | null = null

    const applySamples = (samples: TagValueSample[]) => {
      setValues((prev) => {
        const next = { ...prev }
        for (const s of samples) next[s.fullPath] = s
        return next
      })
    }

    const tick = async () => {
      if (previewRequests.length === 0) return
      try {
        applySamples(await readTagValues(connectionId, previewRequests))
      } catch {
        /* preview is best-effort */
      }
    }

    async function startHub() {
      try {
        conn = createLiveConnection()
        conn.on('tagValueUpdate', (samples: TagValueSample[]) => {
          if (!cancelled) applySamples(samples)
        })
        await conn.start()
        if (previewRequests.length > 0) {
          await conn.invoke('SubscribeTagPreview', connectionId, previewRequests)
        }
      } catch {
        conn = null
      }
    }

    void startHub()
    void tick()
    const h = setInterval(() => {
      if (conn?.state === 'Connected') {
        if (previewRequests.length > 0) void conn.invoke('SubscribeTagPreview', connectionId, previewRequests)
      } else {
        void tick()
      }
    }, TAG_POLL_MS)

    return () => {
      cancelled = true
      clearInterval(h)
      void conn?.stop()
    }
  }, [connectionId, browse, previewKey, previewRequests])

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const setFilterAndResetScroll = useCallback((value: string) => {
    setFilter(value)
    setScrollTop(0)
  }, [])

  return {
    browse,
    loading,
    expanded,
    filter,
    selected,
    scrollTop,
    values,
    rows,
    loadBrowse,
    toggle,
    setFilter: setFilterAndResetScroll,
    setSelected,
    setScrollTop,
    resetBrowseState: useCallback(() => {
      setFilter('')
      setScrollTop(0)
      setSelected(null)
    }, []),
  }
}
