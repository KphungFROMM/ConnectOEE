import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useComputedColorScheme } from '@mantine/core'
import { useLiveSnapshots } from '../lib/useLiveSnapshots'
import type { Dashboard } from '../lib/dashboards'
import { getHierarchyTree, type PlantNode } from '../lib/hierarchy'
import { buildLineTopologyByLineId } from '../lib/lineTopology'
import { resolveWidget } from './widgets/registry'
import type { WidgetCtx } from './widgets/common'
import { DashboardWidgetTreeProvider } from './widgets/NestedWidgetHost'
import { rootWidgets } from '../lib/widgetNesting'
import { GRID_COLS, GRID_GAP, GRID_ROW_HEIGHT } from '../features/builder/gridConstants'
import { type DisplayProfileId, profileForDashboard } from '../features/builder/displayProfiles'
import { computeWallRowHeight, dashboardMaxRow, wallFitRowCount } from '../features/builder/viewportGrid'
import { wallBoardCssVars } from './widgets/design/widgetTheme'
import { WallDisplayContext } from './widgets/design/WallDisplayContext'

/** default = admin scroll; kioskPreview = small sidebar; wallFit = full-viewport floor display */
export type DashboardDisplayMode = 'default' | 'kioskPreview' | 'wallFit'

const KIOSK_PREVIEW_HEIGHT = 560

export function DashboardRenderer({
  dashboard,
  displayMode = 'default',
  mockCtx,
  wallProfile,
  containerHeight,
}: {
  dashboard: Dashboard
  displayMode?: DashboardDisplayMode
  mockCtx?: WidgetCtx
  /** Override profile for wallFit (else derived from dashboard scope/name). */
  wallProfile?: DisplayProfileId
  /** Explicit grid-area height for wallFit (chrome already outside). Else measured / window. */
  containerHeight?: number
}) {
  const { snapshots, hubConnected } = useLiveSnapshots()
  const isKioskScope = dashboard.scope === 'PublicKiosk'
  const effectiveMode: DashboardDisplayMode =
    displayMode !== 'default' ? displayMode : isKioskScope ? 'kioskPreview' : 'default'
  const isWallFit = effectiveMode === 'wallFit'
  const isKioskDensity = effectiveMode === 'kioskPreview' || isWallFit
  const wallBoard = isWallFit
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const [plantLineIds, setPlantLineIds] = useState<Set<string> | null>(null)
  const [hierarchyTree, setHierarchyTree] = useState<PlantNode[]>([])
  const wallContainerRef = useRef<HTMLDivElement>(null)
  const [measuredHeight, setMeasuredHeight] = useState<number | undefined>(containerHeight)

  useEffect(() => {
    if (!isWallFit || containerHeight !== undefined) return
    const el = wallContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (h && h > 0) setMeasuredHeight(h)
    })
    ro.observe(el)
    setMeasuredHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [isWallFit, containerHeight])

  useEffect(() => {
    if (mockCtx) return
    let cancelled = false
    void getHierarchyTree().then((tree) => {
      if (cancelled) return
      setHierarchyTree(tree)
      if (!dashboard.plantId) {
        setPlantLineIds(null)
        return
      }
      const plantKey = dashboard.plantId.toLowerCase()
      const ids = new Set<string>()
      for (const p of tree) {
        if (p.id.toLowerCase() !== plantKey) continue
        for (const d of p.departments) {
          for (const l of d.lines) ids.add(l.id.toLowerCase())
        }
      }
      setPlantLineIds(ids)
    })
    return () => {
      cancelled = true
    }
  }, [dashboard.plantId, mockCtx])

  const lineTopologyByLineId = useMemo(() => buildLineTopologyByLineId(hierarchyTree), [hierarchyTree])

  const ctx: WidgetCtx = useMemo(() => {
    if (mockCtx) {
      return {
        ...mockCtx,
        density: isKioskDensity ? 'kiosk' : mockCtx.density ?? 'normal',
        wallBoard,
        lineTopologyByLineId: mockCtx.lineTopologyByLineId ?? lineTopologyByLineId,
      }
    }
    let scoped = snapshots
    if (dashboard.machineId) {
      scoped = snapshots.filter((s) => s.machineId === dashboard.machineId)
    } else if (dashboard.lineId) {
      scoped = snapshots.filter((s) => s.lineId === dashboard.lineId)
    } else if (dashboard.plantId && plantLineIds && plantLineIds.size > 0) {
      scoped = snapshots.filter((s) => plantLineIds.has(s.lineId.toLowerCase()))
    }
    const lineSnapshots = scoped
    const snapshot = dashboard.machineId
      ? lineSnapshots.find((s) => s.machineId === dashboard.machineId) ?? lineSnapshots[0]
      : lineSnapshots[0]
    return {
      lineId: dashboard.lineId,
      machineId: dashboard.machineId,
      plantId: dashboard.plantId,
      snapshot,
      lineSnapshots,
      hubConnected,
      density: isKioskDensity ? 'kiosk' : 'normal',
      wallBoard,
      lineTopologyByLineId,
      allowInteractiveWrites: true,
    }
  }, [mockCtx, snapshots, hubConnected, dashboard.lineId, dashboard.machineId, dashboard.plantId, plantLineIds, isKioskDensity, wallBoard, lineTopologyByLineId])

  const maxRow = dashboardMaxRow(rootWidgets(dashboard.widgets))
  const profileId = wallProfile ?? profileForDashboard(dashboard.scope, dashboard.name)

  const rowHeight = useMemo(() => {
    if (effectiveMode === 'wallFit') {
      const h =
        measuredHeight ??
        containerHeight ??
        (typeof window !== 'undefined' ? window.innerHeight : 1080)
      // Size cells to the profile budget (or occupied rows if over) so sparse boards
      // don't stretch — matches builder edit stage.
      const rows = wallFitRowCount(maxRow, profileId)
      return computeWallRowHeight(rows, profileId, h)
    }
    if (effectiveMode === 'kioskPreview') {
      const gap = 10
      return Math.max(52, Math.min(80, Math.floor((KIOSK_PREVIEW_HEIGHT - gap * (maxRow - 1)) / maxRow)))
    }
    return GRID_ROW_HEIGHT
  }, [effectiveMode, maxRow, profileId, measuredHeight, containerHeight])

  const gridGap = effectiveMode === 'kioskPreview' ? 10 : GRID_GAP

  const gridStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
    gridAutoRows: `${rowHeight}px`,
    gap: gridGap,
    minHeight: effectiveMode === 'kioskPreview' ? KIOSK_PREVIEW_HEIGHT : undefined,
    height: isWallFit ? '100%' : undefined,
    overflow: isWallFit ? 'hidden' : undefined,
  }

  const wrapperStyle: CSSProperties = isWallFit
    ? {
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        flex: 1,
        background: 'var(--coee-wall-canvas, var(--mantine-color-body))',
        ...wallBoardCssVars(colorScheme === 'dark' ? 'dark' : 'light'),
      }
    : {}

  return (
    <WallDisplayContext.Provider value={wallBoard}>
      <DashboardWidgetTreeProvider widgets={dashboard.widgets} rowHeight={rowHeight} gridGap={gridGap}>
        <div ref={isWallFit ? wallContainerRef : undefined} style={wrapperStyle}>
          <div style={gridStyle}>
            {rootWidgets(dashboard.widgets).map((w) => {
              const Widget = resolveWidget(w.type)
              return (
                <div
                  key={w.id}
                  style={{
                    gridColumn: `${w.x + 1} / span ${Math.min(w.w, GRID_COLS)}`,
                    gridRow: `${w.y + 1} / span ${w.h}`,
                    minWidth: 0,
                    minHeight: 0,
                    overflow: 'hidden',
                  }}
                >
                  <Widget widget={w} ctx={ctx} />
                </div>
              )
            })}
          </div>
        </div>
      </DashboardWidgetTreeProvider>
    </WallDisplayContext.Provider>
  )
}
