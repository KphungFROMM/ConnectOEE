import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Group,
  PasswordInput,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
  Alert,
  Anchor,
  SimpleGrid,
} from '@mantine/core'
import { IconAlertCircle, IconDeviceDesktop } from '@tabler/icons-react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { defaultHomePath } from '../lib/permissions'
import { getSetupStatus } from '../lib/setup'
import { listKioskDashboards, getKioskDashboard, establishKioskSession, type KioskListItem } from '../lib/dashboards'
import {
  clearKioskDefaultId,
  getKioskDefaultId,
  setKioskDefaultId,
} from '../lib/useClientPresence'

interface LocationState {
  from?: { pathname?: string }
}

function safeReturnPath(raw: string | null): string | null {
  if (!raw) return null
  // Only allow same-origin relative paths (blocks open redirects).
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  return raw
}

export function LoginPage() {
  const { login, loginTwoFactor, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loginMode, setLoginMode] = useState<'login' | '2fa' | 'changePassword'>('login')
  const [kiosks, setKiosks] = useState<KioskListItem[]>([])
  const [selectedKiosk, setSelectedKiosk] = useState<string | null>(null)
  const [savedKioskId, setSavedKioskId] = useState<string | null>(() => getKioskDefaultId())

  const from =
    safeReturnPath(searchParams.get('returnUrl')) ??
    (location.state as LocationState)?.from?.pathname ??
    defaultHomePath(user)

  useEffect(() => {
    void getSetupStatus().then((s) => {
      if (s.needsSetup) navigate('/wizard', { replace: true })
    })
  }, [navigate])

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user, from, navigate])

  useEffect(() => {
    const defaultId = getKioskDefaultId()
    if (!defaultId) return
    void establishKioskSession(defaultId)
      .then(() => getKioskDashboard(defaultId))
      .then(() => navigate(`/kiosk/${defaultId}`, { replace: true }))
      .catch(() => {
        clearKioskDefaultId()
        setSavedKioskId(null)
      })
  }, [navigate])

  useEffect(() => {
    void listKioskDashboards()
      .then((items) => {
        setKiosks(items)
        if (items.length === 1) setSelectedKiosk(items[0].id)
      })
      .catch(() => setKiosks([]))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (loginMode === '2fa' && pendingUserId) {
        await loginTwoFactor(pendingUserId, password, twoFactorCode)
        navigate(from, { replace: true })
        return
      }
      if (loginMode === 'changePassword' && pendingUserId) {
        const res = await fetch('/api/auth/force-change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: pendingUserId,
            currentPassword: password,
            newPassword,
          }),
        })
        if (!res.ok) {
          const msg = await res.json().catch(() => ({ message: 'Password change failed' }))
          throw new Error(msg.message ?? 'Password change failed')
        }
        const result = await login(userName, newPassword)
        if (result.kind === 'success') navigate(from, { replace: true })
        return
      }
      const result = await login(userName, password)
      if (result.kind === 'requiresTwoFactor') {
        setPendingUserId(result.userId)
        setLoginMode('2fa')
        return
      }
      if (result.kind === 'mustChangePassword') {
        setPendingUserId(result.userId)
        setLoginMode('changePassword')
        return
      }
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  function openKiosk(remember: boolean) {
    if (!selectedKiosk) return
    if (remember) {
      setKioskDefaultId(selectedKiosk)
      setSavedKioskId(selectedKiosk)
    }
    void establishKioskSession(selectedKiosk).then(() => {
      navigate(`/kiosk/${selectedKiosk}`)
    }).catch(() => setError('Could not establish kiosk session'))
  }

  const kioskOptions = kiosks.map((k) => ({
    value: k.id,
    label: `${k.name} · ${k.lineName}`,
  }))

  return (
    <Box
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" maw={820} w="100%">
        <Card withBorder padding="xl" radius="md">
          <Stack align="center" gap="xs" mb="md">
            <Box
              style={{
                background: '#FFFFFF',
                border: '1px solid #E3E5E8',
                borderRadius: 12,
                padding: 8,
                lineHeight: 0,
              }}
            >
              <img src="/app-icon.png" alt="ConnectOEE" width={48} height={48} />
            </Box>
            <Title order={3}>ConnectOEE</Title>
            <Text size="sm" c="dimmed">
              Sign in to continue
            </Text>
          </Stack>
          <form onSubmit={handleSubmit}>
            <Stack>
              {error && (
                <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                  {error}
                </Alert>
              )}
              <TextInput
                label="Username"
                placeholder="admin"
                value={userName}
                onChange={(e) => setUserName(e.currentTarget.value)}
                required
                autoFocus
              />
              <PasswordInput
                label="Password"
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                required
              />
              {loginMode === '2fa' ? (
                <TextInput
                  label="Authenticator code"
                  placeholder="6-digit code"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.currentTarget.value)}
                  required
                />
              ) : null}
              {loginMode === 'changePassword' ? (
                <PasswordInput
                  label="New password"
                  placeholder="Choose a new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.currentTarget.value)}
                  required
                />
              ) : null}
              <Button type="submit" fullWidth loading={loading}>
                {loginMode === '2fa'
                  ? 'Verify code'
                  : loginMode === 'changePassword'
                    ? 'Set new password'
                    : 'Sign in'}
              </Button>
            </Stack>
          </form>
        </Card>

        <Card withBorder padding="xl" radius="md">
          <Stack gap="md">
            <Group gap="xs">
              <IconDeviceDesktop size={20} />
              <Title order={4}>Display a dashboard</Title>
            </Group>
            <Text size="sm" c="dimmed">
              Open a published kiosk or Andon board without signing in — for wall displays and shared
              stations.
            </Text>
            {kiosks.length === 0 ? (
              <Text size="sm" c="dimmed">
                No published kiosk dashboards yet. An admin can publish one from the Builder (scope:
                Public Kiosk).
              </Text>
            ) : (
              <>
                <Select
                  label="Dashboard"
                  placeholder="Choose a display"
                  data={kioskOptions}
                  value={selectedKiosk}
                  onChange={setSelectedKiosk}
                  searchable
                />
                <Group grow>
                  <Button variant="light" disabled={!selectedKiosk} onClick={() => openKiosk(false)}>
                    Open now
                  </Button>
                  <Button disabled={!selectedKiosk} onClick={() => openKiosk(true)}>
                    Open and remember
                  </Button>
                </Group>
                {savedKioskId ? (
                  <Text size="xs" c="dimmed">
                    This device opens a saved display on startup.{' '}
                    <Anchor
                      component="button"
                      type="button"
                      size="xs"
                      onClick={() => {
                        clearKioskDefaultId()
                        setSavedKioskId(null)
                      }}
                    >
                      Clear saved display
                    </Anchor>
                  </Text>
                ) : null}
              </>
            )}
          </Stack>
        </Card>
      </SimpleGrid>
    </Box>
  )
}
