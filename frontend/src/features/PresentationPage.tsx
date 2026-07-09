import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Center, Group, Stack, Text } from '@mantine/core'
import { getDashboard, getKioskDashboard, establishKioskSession, type Dashboard } from '../lib/dashboards'
import { useAuth } from '../lib/auth'
import { DashboardRenderer } from '../components/DashboardRenderer'
import { profileForDashboard } from './builder/displayProfiles'

export function PresentationPage() {
  const { id } = useParams()
  const { token, ready } = useAuth()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [error, setError] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(true)
  const [fullscreenHint, setFullscreenHint] = useState(true)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      try {
        if (token) {
          const d = await getDashboard(id!)
          if (!cancelled) {
            if (!d.isPublished) {
              setError(true)
              return
            }
            setDashboard(d)
          }
          return
        }
        await establishKioskSession(id!)
        const d = await getKioskDashboard(id!)
        if (!cancelled) setDashboard(d)
      } catch {
        if (!cancelled) setError(true)
      }
    }

    if (ready) void load()
    return () => {
      cancelled = true
    }
  }, [id, token, ready])

  useEffect(() => {
    const t = setTimeout(() => setChromeVisible(false), 5000)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onKey() {
      setChromeVisible(true)
      window.setTimeout(() => setChromeVisible(false), 5000)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const wallProfile = useMemo(
    () => (dashboard ? profileForDashboard(dashboard.scope, dashboard.name) : 'plantWall'),
    [dashboard],
  )

  if (error || (dashboard && !dashboard.isPublished && dashboard.scope !== 'PublicKiosk')) {
    return (
      <Center h="100vh" style={{ background: 'var(--mantine-color-body)' }}>
        <Text c="dimmed">Presentation dashboard not found or not published.</Text>
      </Center>
    )
  }

  if (!dashboard) {
    return (
      <Center h="100vh" style={{ background: 'var(--mantine-color-body)' }}>
        <Text c="dimmed">Loading presentation…</Text>
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
        overflow: 'hidden',
      }}
      onClick={() => {
        setChromeVisible(true)
        if (!fullscreenHint) return
        setFullscreenHint(false)
        void document.documentElement.requestFullscreen?.().catch(() => undefined)
      }}
      onMouseMove={() => setChromeVisible(true)}
    >
      <Stack gap={6} style={{ flex: 1, minHeight: 0 }}>
        {chromeVisible ? (
          <Group justify="space-between" wrap="nowrap" px={4} style={{ flexShrink: 0 }}>
            <Text c="dimmed" fw={600} size="sm">
              {dashboard.name}
            </Text>
            <Group gap="xs">
              {fullscreenHint ? (
                <Text c="dimmed" size="xs">
                  Tap for full screen
                </Text>
              ) : null}
            </Group>
          </Group>
        ) : null}
        <DashboardRenderer dashboard={dashboard} displayMode="wallFit" wallProfile={wallProfile} />
      </Stack>
    </div>
  )
}
