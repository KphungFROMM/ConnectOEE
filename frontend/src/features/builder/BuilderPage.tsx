import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Badge, Drawer, Group, Button, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  applyTemplate,
  autosaveDashboard,
  createDashboard,
  getDashboard,
  getVersions,
  rollbackVersion,
  saveAsTemplate,
  updateDashboard,
  type Dashboard,
  type DashboardVersion,
  type DashboardWidget,
  type SaveDashboardRequest,
} from '../../lib/dashboards'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { useLiveSnapshots } from '../../lib/useLiveSnapshots'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import type { WidgetCtx } from '../../components/widgets/common'
import { GRID_COLS } from './gridConstants'
import { profileForDashboard, type DisplayProfileId } from './displayProfiles'
import { dashboardMaxRow } from './viewportGrid'
import { BuilderToolbar } from './BuilderToolbar'
import { WidgetPalette } from './WidgetPalette'
import { BuilderCanvas } from './BuilderCanvas'
import { PropertiesPanel } from './PropertiesPanel'
import { TemplateGalleryDrawer } from './TemplateGalleryDrawer'
import { SaveTemplateModal } from './SaveTemplateModal'
import { useBuilderHistory } from './useBuilderHistory'
import { clickAddPosition, createWidget } from './widgetFactory'

export function BuilderPage() {
  const { id: routeId } = useParams()
  const navigate = useNavigate()
  const { hasPermission } = useAuth()
  const canBuild = hasPermission(Permissions.BuildDashboards)

  const [dashId, setDashId] = useState<string | null>(routeId ?? null)
  const [name, setName] = useState('New dashboard')
  const [scope, setScope] = useState('Private')
  const [isPublished, setIsPublished] = useState(false)
  const [lineId, setLineId] = useState<string | null>(null)
  const [machineId, setMachineId] = useState<string | null>(null)
  const [plantId, setPlantId] = useState<string | null>(null)
  const [tree, setTree] = useState<PlantNode[]>([])
  const [saving, setSaving] = useState(false)
  const [autoStatus, setAutoStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewMode, setPreviewMode] = useState(false)
  const [versionsOpen, setVersionsOpen] = useState(false)
  const [versions, setVersions] = useState<DashboardVersion[]>([])
  const [tplOpen, setTplOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [fullWidgetDrag, setFullWidgetDrag] = useState(true)
  const [displayProfile, setDisplayProfile] = useState<DisplayProfileId>('plantWall')

  const { widgets, setWidgets, replaceWidgets, undo, redo, canUndo, canRedo } = useBuilderHistory([])
  const dirty = useRef(false)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRoute = useRef<string | null>(null)
  const buildRequestRef = useRef<() => SaveDashboardRequest>(() => ({
    name: 'Untitled',
    scope: 'Private',
    widgets: [],
  }))

  const bindCtx = useMemo(() => ({ lineId, plantId, machineId }), [lineId, plantId, machineId])

  useEffect(() => {
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!routeId || loadedRoute.current === routeId) return
    loadedRoute.current = routeId
    void getDashboard(routeId).then((d) => {
      setDashId(d.id)
      setName(d.name)
      setScope(d.scope)
      setIsPublished(d.isPublished)
      setLineId(d.lineId ?? null)
      setMachineId(d.machineId ?? null)
      setPlantId(d.plantId ?? null)
      replaceWidgets(d.widgets)
      setDisplayProfile(profileForDashboard(d.scope, d.name))
    })
  }, [routeId, replaceWidgets])

  const { snapshots, hubConnected } = useLiveSnapshots()
  const plantLineIds = useMemo(() => {
    if (!plantId) return null
    const ids = new Set<string>()
    const plantKey = plantId.toLowerCase()
    for (const p of tree) {
      if (p.id.toLowerCase() !== plantKey) continue
      for (const d of p.departments) for (const l of d.lines) ids.add(l.id.toLowerCase())
    }
    return ids
  }, [tree, plantId])

  const ctx: WidgetCtx = useMemo(() => {
    let lineSnapshots = lineId ? snapshots.filter((s) => s.lineId === lineId) : snapshots
    if (plantId && plantLineIds) lineSnapshots = snapshots.filter((s) => plantLineIds.has(s.lineId.toLowerCase()))
    const snapshot = machineId ? snapshots.find((s) => s.machineId === machineId) : lineSnapshots[0]
    return { lineId, machineId, plantId, snapshot, lineSnapshots, hubConnected }
  }, [snapshots, hubConnected, lineId, machineId, plantId, plantLineIds])

  const selected = widgets.find((w) => w.id === selectedId) ?? null
  const maxRow = dashboardMaxRow(widgets)

  const dashboardPreview: Dashboard = useMemo(
    () => ({
      id: dashId ?? 'preview',
      name,
      scope,
      isPublished,
      version: 0,
      plantId,
      lineId,
      machineId,
      widgets,
    }),
    [dashId, name, scope, isPublished, plantId, lineId, machineId, widgets],
  )

  const buildRequest = useCallback((): SaveDashboardRequest => {
    return {
      name: name.trim() || 'Untitled',
      scope,
      isPublished,
      plantId,
      lineId,
      machineId,
      widgets: widgets
        .sort((a, b) => a.y - b.y || a.x - b.x)
        .map((w) => ({
          type: w.type,
          title: w.title,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          binding: w.binding,
          options: w.options,
        })),
    }
  }, [name, scope, isPublished, plantId, lineId, machineId, widgets])

  buildRequestRef.current = buildRequest

  const runAutosave = useCallback(async () => {
    if (!dashId || !dirty.current) return
    setAutoStatus('saving')
    try {
      await autosaveDashboard(dashId, buildRequestRef.current())
      dirty.current = false
      setAutoStatus('saved')
      setTimeout(() => setAutoStatus('idle'), 1500)
    } catch {
      setAutoStatus('idle')
      notifications.show({ message: 'Autosave failed', color: 'red' })
    }
  }, [dashId])

  const markDirty = useCallback(() => {
    dirty.current = true
    if (!dashId) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => void runAutosave(), 1500)
  }, [dashId, runAutosave])

  const patchWidget = useCallback(
    (id: string, patch: Partial<DashboardWidget>) => {
      setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)), true)
      markDirty()
    },
    [setWidgets, markDirty],
  )

  const addWidgetAt = useCallback(
    (type: string, x?: number, y?: number) => {
      const maxRow = widgets.reduce((m, w) => Math.max(m, w.y + w.h), 0)
      const pos = x !== undefined && y !== undefined ? { x, y } : clickAddPosition(type, widgets)
      const nw = createWidget(type, bindCtx, pos, maxRow)
      setWidgets((prev) => [...prev, nw], true)
      setSelectedId(nw.id)
      markDirty()
    },
    [widgets, bindCtx, setWidgets, markDirty],
  )

  const removeWidget = useCallback(
    (id: string) => {
      setWidgets((prev) => prev.filter((w) => w.id !== id), true)
      if (selectedId === id) setSelectedId(null)
      markDirty()
    },
    [setWidgets, selectedId, markDirty],
  )

  const duplicateWidget = useCallback(
    (id: string) => {
      setWidgets((prev) => {
        const src = prev.find((w) => w.id === id)
        if (!src) return prev
        const copy = createWidget(src.type, bindCtx, {
          x: Math.min(src.x + 1, GRID_COLS - src.w),
          y: src.y,
        })
        copy.title = `${src.title ?? src.type} (copy)`
        copy.binding = structuredClone(src.binding)
        copy.options = structuredClone(src.options)
        copy.w = src.w
        copy.h = src.h
        setSelectedId(copy.id)
        return [...prev, copy]
      }, true)
      markDirty()
    },
    [bindCtx, setWidgets, markDirty],
  )

  const handleLayoutChange = useCallback(
    (next: DashboardWidget[], recordHistory: boolean) => {
      setWidgets(next, recordHistory)
      if (recordHistory) markDirty()
    },
    [setWidgets, markDirty],
  )

  async function save() {
    setSaving(true)
    try {
      if (dashId) {
        await updateDashboard(dashId, buildRequest())
      } else {
        const created = await createDashboard(buildRequest())
        setDashId(created.id)
        replaceWidgets(created.widgets)
        navigate(`/builder/${created.id}`, { replace: true })
      }
      dirty.current = false
      notifications.show({ message: 'Dashboard saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  async function openVersions() {
    if (!dashId) return
    setVersions(await getVersions(dashId))
    setVersionsOpen(true)
  }

  async function doRollback(version: number) {
    if (!dashId) return
    try {
      const d = await rollbackVersion(dashId, version)
      replaceWidgets(d.widgets)
      setVersionsOpen(false)
      notifications.show({ message: `Restored version ${version}`, color: 'green' })
    } catch {
      notifications.show({ message: 'Rollback failed', color: 'red' })
    }
  }

  async function handleApplyTemplate(templateId: string) {
    try {
      const d = await applyTemplate({
        templateId,
        name: name.trim() || undefined,
        plantId,
        lineId,
        machineId,
      })
      setWidgets(d.widgets, true)
      setGalleryOpen(false)
      markDirty()
      notifications.show({ message: 'Template applied', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to apply template', color: 'red' })
    }
  }

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (previewMode) return
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault()
        redo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedId) {
        e.preventDefault()
        duplicateWidget(selectedId)
        return
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault()
        removeWidget(selectedId)
        return
      }
      if (selectedId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const w = widgets.find((x) => x.id === selectedId)
        if (!w) return
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
        if (e.shiftKey) {
          patchWidget(selectedId, {
            w: Math.max(1, Math.min(w.w + dx, GRID_COLS - w.x)),
            h: Math.max(1, w.h + dy),
          })
        } else {
          patchWidget(selectedId, {
            x: Math.min(Math.max(0, w.x + dx), GRID_COLS - w.w),
            y: Math.max(0, w.y + dy),
          })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewMode, undo, redo, selectedId, duplicateWidget, removeWidget, widgets, patchWidget])

  if (!canBuild) {
    return (
      <Alert color="orange" title="Access denied">
        You do not have permission to build dashboards.
      </Alert>
    )
  }

  return (
    <Stack gap="sm" h="calc(100vh - 120px)" style={{ minHeight: 480 }}>
      <BuilderToolbar
        name={name}
        scope={scope}
        isPublished={isPublished}
        plantId={plantId}
        lineId={lineId}
        machineId={machineId}
        tree={tree}
        saving={saving}
        autoStatus={autoStatus}
        previewMode={previewMode}
        displayProfile={displayProfile}
        maxRow={maxRow}
        canUndo={canUndo}
        canRedo={canRedo}
        dashId={dashId}
        onNameChange={(v) => {
          setName(v)
          markDirty()
        }}
        onScopeChange={(v) => {
          setScope(v)
          markDirty()
        }}
        onPublishedChange={(v) => {
          setIsPublished(v)
          markDirty()
        }}
        onPlantChange={(v) => {
          setPlantId(v)
          markDirty()
        }}
        onLineChange={(v) => {
          setLineId(v)
          markDirty()
        }}
        onMachineChange={(v) => {
          setMachineId(v)
          markDirty()
        }}
        onDisplayProfileChange={setDisplayProfile}
        onSave={save}
        onBack={() => navigate('/')}
        onVersions={openVersions}
        onSaveTemplate={() => setTplOpen(true)}
        onOpenTemplates={() => setGalleryOpen(true)}
        onTogglePreview={() => setPreviewMode((p) => !p)}
        onUndo={undo}
        onRedo={redo}
        fullWidgetDrag={fullWidgetDrag}
        onFullWidgetDragChange={setFullWidgetDrag}
      />

      {!dashId && widgets.length > 0 ? (
        <Text size="xs" c="dimmed">
          Save once to enable autosave and version history.
        </Text>
      ) : null}

      <Group align="stretch" gap="sm" wrap="nowrap" style={{ flex: 1, minHeight: 0 }}>
        {!previewMode ? <WidgetPalette onAdd={(type) => addWidgetAt(type)} /> : null}
        <BuilderCanvas
          widgets={widgets}
          selectedId={selectedId}
          previewMode={previewMode}
          displayProfile={displayProfile}
          fullWidgetDrag={fullWidgetDrag}
          ctx={ctx}
          dashboardPreview={dashboardPreview}
          onSelect={setSelectedId}
          onLayoutChange={handleLayoutChange}
          onRemove={removeWidget}
          onDuplicate={duplicateWidget}
          onAddAt={addWidgetAt}
        />
        {!previewMode ? (
          <PropertiesPanel
            widget={selected}
            machineId={machineId}
            lineId={lineId}
            ctx={ctx}
            maxRow={maxRow}
            displayProfile={displayProfile}
            dashId={dashId}
            isPublished={isPublished}
            onChange={(patch) => selected && patchWidget(selected.id, patch)}
          />
        ) : null}
      </Group>

      <Drawer opened={versionsOpen} onClose={() => setVersionsOpen(false)} title="Version history" position="right">
        <Stack gap={6}>
          {versions.length === 0 ? (
            <Text size="sm" c="dimmed">
              No saved versions yet.
            </Text>
          ) : (
            versions.map((v) => (
              <Group key={v.version} justify="space-between">
                <div>
                  <Text size="sm" fw={600}>
                    Version {v.version}{' '}
                    {v.isAutosave ? (
                      <Badge size="xs" variant="light" color="gray">
                        auto
                      </Badge>
                    ) : null}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(v.savedUtc).toLocaleString()}
                  </Text>
                </div>
                <Button size="xs" variant="light" onClick={() => doRollback(v.version)}>
                  Restore
                </Button>
              </Group>
            ))
          )}
        </Stack>
      </Drawer>

      <TemplateGalleryDrawer opened={galleryOpen} onClose={() => setGalleryOpen(false)} onApply={handleApplyTemplate} />

      <SaveTemplateModal
        opened={tplOpen}
        onClose={() => setTplOpen(false)}
        onSave={async (body) => {
          if (!dashId) return
          try {
            await saveAsTemplate(dashId, body)
            notifications.show({ message: 'Saved as template', color: 'green' })
            setTplOpen(false)
          } catch {
            notifications.show({ message: 'Failed to save template', color: 'red' })
          }
        }}
      />
    </Stack>
  )
}
