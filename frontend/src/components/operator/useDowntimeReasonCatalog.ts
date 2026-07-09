import { useEffect, useMemo, useState } from 'react'
import { listOperatorCatalog, listOperatorPendingReasons } from '../../lib/admin'
import { DEFAULT_DOWNTIME_REASONS } from './defaultReasons'

export interface ReasonOption {
  label: string
  category: string
  code?: number
  needsReview?: boolean
}

export function useDowntimeReasonCatalog(lineId?: string | null, machineId?: string | null) {
  const [catalog, setCatalog] = useState<ReasonOption[]>([])
  const [pendingCodes, setPendingCodes] = useState<Set<number>>(new Set())
  const [catalogError, setCatalogError] = useState(false)
  const [catalogLoaded, setCatalogLoaded] = useState(false)

  useEffect(() => {
    if (!lineId) {
      setCatalog([])
      setPendingCodes(new Set())
      setCatalogError(false)
      setCatalogLoaded(false)
      return
    }
    setCatalogLoaded(false)
    void listOperatorCatalog(lineId, machineId ?? undefined)
      .then((rows) => {
        setCatalog(
          rows.map((r) => ({
            label: r.reason,
            category: r.category,
            code: r.code,
            needsReview: r.needsReview,
          })),
        )
        setCatalogError(false)
        setCatalogLoaded(true)
      })
      .catch(() => {
        setCatalog([])
        setCatalogError(true)
        setCatalogLoaded(false)
      })
    void listOperatorPendingReasons(lineId)
      .then((rows) => setPendingCodes(new Set(rows.map((r) => r.code))))
      .catch(() => setPendingCodes(new Set()))
  }, [lineId, machineId])

  const options: ReasonOption[] = useMemo(() => {
    if (catalog.length > 0) return catalog
    if (catalogError || !lineId) return DEFAULT_DOWNTIME_REASONS
    return []
  }, [catalog, catalogError, lineId])

  const byCategory = useMemo(() => {
    const map = new Map<string, ReasonOption[]>()
    for (const o of options) {
      const list = map.get(o.category) ?? []
      list.push(o)
      map.set(o.category, list)
    }
    return map
  }, [options])

  return { options, byCategory, pendingCodes, catalogLoaded, catalogError, usingFallback: catalog.length === 0 && catalogError }
}
