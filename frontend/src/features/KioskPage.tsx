import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ActionIcon, Button, Center, Group, Stack, Text, Tooltip, useComputedColorScheme, useMantineColorScheme } from '@mantine/core'
import { IconMoon, IconSun } from '@tabler/icons-react'
import type { HubConnection } from '@microsoft/signalr'
import { createLiveConnection, HubConnectionState, normalizeLiveUpdates, type MachineSnapshot } from '../lib/liveHub'
import { getKioskDashboard, establishKioskSession, type Dashboard } from '../lib/dashboards'
import { useClientPresence } from '../lib/useClientPresence'
import { DashboardRenderer } from '../components/DashboardRenderer'
import type { WidgetCtx } from '../components/widgets/common'
import { useAuth } from '../lib/auth'
import { Permissions } from '../lib/permissions'

function WallThemeToggle() {
  const { setColorScheme } = useMantineColorScheme()
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true })
  const isDark = computed === 'dark'
  return (
    <Tooltip label={isDark ? 'Switch to light' : 'Switch to dark'}>
      <ActionIcon
        variant="subtle"
        color="gray"
        size="sm"
        aria-label="Toggle color scheme"
        onClick={(e) => {
          e.stopPropagation()
          setColorScheme(isDark ? 'light' : 'dark')
        }}
      >
        {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
      </ActionIcon>
    </Tooltip>
  )
}

export function KioskPage() {
  const { id } = useParams()
  const { user, hasPermission } = useAuth()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [error, setError] = useState(false)
  const [byMachine, setByMachine] = useState<Record<string, MachineSnapshot>>({})
  const [hubConnected, setHubConnected] = useState(false)
  const connRef = useRef<HubConnection | null>(null)
  const [fullscreenHint, setFullscreenHint] = useState(true)

  const hasInteractiveWidgets = useMemo(
    () =>
      (dashboard?.widgets ?? []).some((w) =>
        ['operator-downtime-pad', 'fault-ack-button', 'plc-write-controls'].includes(w.type),
      ),
    [dashboard],
  )
  const canAct =
    Boolean(user) &&
    (hasPermission(Permissions.PlcWrite) || hasPermission(Permissions.EnterDowntimeReason))
  const allowInteractiveWrites = hasInteractiveWidgets && canAct

  useClientPresence({
    clientKind: 'Kiosk',
    pageLabel: dashboard?.name ?? 'Kiosk display',
    kioskDashboardId: id,
    kioskDashboardName: dashboard?.name,
    lineId: dashboard?.lineId ?? undefined,
    enabled: Boolean(id && dashboard),
  })

  useEffect(() => {
    if (!id) return
    let cancelled = false
    void establishKioskSession(id)
      .then(() => getKioskDashboard(id))
      .then((d) => {
        if (!cancelled) setDashboard(d)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(true)
          console.error('Kiosk load failed', err)
        }
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !dashboard) return
    let disposed = false
    const conn = createLiveConnection({ useCookieAuth: true })
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
        const res = await fetch(`/api/dashboards/kiosk/${id}/live`)
        if (res.ok) {
          const seed = (await res.json()) as MachineSnapshot[]
          if (!disposed) {
            const map: Record<string, MachineSnapshot> = {}
            for (const s of seed) map[s.machineId] = s
            setByMachine(map)
          }
        }
        await conn.start()
        if (disposed) return
        setHubConnected(conn.state === HubConnectionState.Connected)
        if (dashboard?.lineId) await conn.invoke('SubscribeLine', dashboard.lineId)
      } catch {
        if (!disposed) setHubConnected(false)
      }
    }
    void start()
    return () => {
      disposed = true
      void conn.stop()
    }
  }, [id, dashboard])

  const snapshots = useMemo(() => Object.values(byMachine), [byMachine])

  const mockCtx: WidgetCtx | undefined = useMemo(() => {
    if (!dashboard) return undefined
    const lineSnapshots = dashboard.lineId ? snapshots.filter((s) => s.lineId === dashboard.lineId) : snapshots
    const snapshot = dashboard.machineId
      ? snapshots.find((s) => s.machineId === dashboard.machineId)
      : lineSnapshots[0]
    return {
      lineId: dashboard.lineId,
      machineId: dashboard.machineId,
      plantId: dashboard.plantId,
      snapshot,
      lineSnapshots,
      hubConnected,
      density: 'kiosk',
      wallBoard: true,
      allowInteractiveWrites,
    }
  }, [snapshots, hubConnected, dashboard, allowInteractiveWrites])

  if (error || (dashboard && !dashboard.lineId)) {
    return (
      <Center h="100vh" style={{ background: 'var(--mantine-color-body)' }}>
        <Text c="dimmed">
          {error ? 'Kiosk dashboard not found or not published.' : 'Kiosk dashboard is not bound to a line. Bind a line in Admin before publishing.'}
        </Text>
      </Center>
    )
  }
  if (!dashboard || !mockCtx) {
    return (
      <Center h="100vh" style={{ background: 'var(--mantine-color-body)' }}>
        <Text c="dimmed">Loading kiosk…</Text>
      </Center>
    )
  }

  return (
    <div
      style={{
        height: '100vh',
        background: 'var(--mantine-color-body)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={() => {
        if (!fullscreenHint) return
        setFullscreenHint(false)
        void document.documentElement.requestFullscreen?.().catch(() => undefined)
      }}
    >
      <Stack gap={6} style={{ flex: 1, minHeight: 0 }}>
        <Group justify="space-between" wrap="nowrap" px={4} style={{ flexShrink: 0 }}>
          <Text c="dimmed" fw={600} size="sm">
            {dashboard.name}
          </Text>
          <Group gap="xs">
            {hasInteractiveWidgets && !canAct ? (
              <Button component={Link} to={`/login?returnUrl=/kiosk/${id}`} size="compact-xs" variant="light">
                Sign in to act
              </Button>
            ) : null}
            {hasInteractiveWidgets && canAct ? (
              <Text c="teal.6" size="xs" fw={600}>
                Operator actions enabled
              </Text>
            ) : null}
            {fullscreenHint ? (
              <Text c="dimmed" size="xs">
                Tap anywhere for full screen
              </Text>
            ) : null}
            {!hubConnected ? (
              <Text c="orange.6" size="xs">
                reconnecting…
              </Text>
            ) : null}
            <WallThemeToggle />
          </Group>
        </Group>
        <DashboardRenderer
          dashboard={dashboard}
          displayMode="wallFit"
          wallProfile="kioskWall"
          mockCtx={mockCtx}
        />
      </Stack>
    </div>
  )
}
