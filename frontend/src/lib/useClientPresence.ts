import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useComputedColorScheme } from '@mantine/core'
import { getToken } from './auth'

const SESSION_KEY = 'connectoee.presenceSessionId'
const HEARTBEAT_MS = 30_000

export type ClientKind = 'Staff' | 'Operator' | 'Kiosk'

export interface PresencePayload {
  sessionId: string
  clientKind: ClientKind
  route?: string
  pageLabel?: string
  theme?: string
  kioskDashboardId?: string
  kioskDashboardName?: string
  lineId?: string
  lineName?: string
}

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

function routePageLabel(pathname: string): string {
  if (pathname.startsWith('/kiosk/')) return 'Kiosk display'
  if (pathname === '/operator') return 'Operator Station'
  if (pathname === '/plant-explorer') return 'Plant Explorer'
  if (pathname === '/analytics') return 'Analytics'
  if (pathname === '/reports') return 'Reports'
  if (pathname === '/tags') return 'Tag Browser'
  if (pathname.startsWith('/builder')) return 'Dashboard Builder'
  if (pathname === '/admin') return 'Admin'
  if (pathname === '/wizard') return 'Setup Wizard'
  if (pathname.startsWith('/dashboards/')) return 'Dashboard'
  if (pathname === '/') return 'Dashboards'
  return pathname
}

function clientKindForRoute(pathname: string): ClientKind {
  if (pathname.startsWith('/kiosk/')) return 'Kiosk'
  if (pathname === '/operator') return 'Operator'
  return 'Staff'
}

async function sendPresence(body: PresencePayload, remove = false): Promise<void> {
  const url = remove
    ? `/api/system/presence/${body.sessionId}`
    : '/api/system/presence'
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  if (remove) {
    await fetch(url, { method: 'DELETE', headers, keepalive: true })
    return
  }

  await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

export interface UseClientPresenceOptions {
  clientKind?: ClientKind
  pageLabel?: string
  kioskDashboardId?: string
  kioskDashboardName?: string
  lineId?: string
  lineName?: string
  enabled?: boolean
}

/** Registers this browser tab with the server for Admin → System monitoring. */
export function useClientPresence(options: UseClientPresenceOptions = {}) {
  const location = useLocation()
  const theme = useComputedColorScheme('light')
  const sessionId = useRef(getSessionId())
  const enabled = options.enabled !== false

  useEffect(() => {
    if (!enabled) return

    const pathname = location.pathname
    const kind = options.clientKind ?? clientKindForRoute(pathname)
    const payload: PresencePayload = {
      sessionId: sessionId.current,
      clientKind: kind,
      route: pathname,
      pageLabel: options.pageLabel ?? routePageLabel(pathname),
      theme,
      kioskDashboardId: options.kioskDashboardId,
      kioskDashboardName: options.kioskDashboardName,
      lineId: options.lineId,
      lineName: options.lineName,
    }

    const beat = () => {
      void sendPresence(payload).catch(() => undefined)
    }

    beat()
    const timer = window.setInterval(beat, HEARTBEAT_MS)

    const onHide = () => {
      if (document.visibilityState === 'hidden') {
        void sendPresence(payload, true).catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onHide)
      void sendPresence(payload, true).catch(() => undefined)
    }
  }, [
    enabled,
    location.pathname,
    theme,
    options.clientKind,
    options.pageLabel,
    options.kioskDashboardId,
    options.kioskDashboardName,
    options.lineId,
    options.lineName,
  ])
}

export const KIOSK_DEFAULT_KEY = 'connectoee.kioskDefaultId'

export function getKioskDefaultId(): string | null {
  return localStorage.getItem(KIOSK_DEFAULT_KEY)
}

export function setKioskDefaultId(id: string): void {
  localStorage.setItem(KIOSK_DEFAULT_KEY, id)
}

export function clearKioskDefaultId(): void {
  localStorage.removeItem(KIOSK_DEFAULT_KEY)
}
