import {

  createContext,

  useCallback,

  useContext,

  useEffect,

  useMemo,

  useState,

  type ReactNode,

} from 'react'

import { useLocation } from 'react-router-dom'

import { setUnauthorizedHandler } from './api'

import { useIdleTimeout } from './useIdleTimeout'



export interface UserInfo {

  id: string

  userName: string

  displayName: string

  roles: string[]

  permissions: string[]

  plantScopes: string[]

  lineScopes: string[]

  mustChangePassword?: boolean

  twoFactorEnabled?: boolean

  idleTimeoutMinutes?: number

}



interface AuthState {

  token: string | null

  user: UserInfo | null

  ready: boolean

  login: (userName: string, password: string) => Promise<LoginResult>

  loginTwoFactor: (userId: string, password: string, code: string) => Promise<void>

  establishSession: (token: string, user: UserInfo) => void

  logout: () => Promise<void>

  refreshSession: () => Promise<boolean>

  hasPermission: (key: string) => boolean

  hasRole: (role: string) => boolean

}



export type LoginResult =

  | { kind: 'success' }

  | { kind: 'mustChangePassword'; userId: string }

  | { kind: 'requiresTwoFactor'; userId: string }



const TOKEN_KEY = 'connectoee.token'



const AuthContext = createContext<AuthState>({

  token: null,

  user: null,

  ready: false,

  login: async () => ({ kind: 'success' }),

  loginTwoFactor: async () => {},

  establishSession: () => {},

  logout: async () => {},

  refreshSession: async () => false,

  hasPermission: () => false,

  hasRole: () => false,

})



export function getToken(): string | null {

  return localStorage.getItem(TOKEN_KEY)

}



export function AuthProvider({ children }: { children: ReactNode }) {

  const [token, setToken] = useState<string | null>(() => getToken())

  const [user, setUser] = useState<UserInfo | null>(null)

  const [ready, setReady] = useState(false)

  const location = useLocation()



  const logout = useCallback(async () => {

    try {

      await fetch('/api/auth/logout', {

        method: 'POST',

        headers: token ? { Authorization: `Bearer ${token}` } : {},

        credentials: 'include',

      })

    } catch {

      /* ignore */

    }

    localStorage.removeItem(TOKEN_KEY)

    setToken(null)

    setUser(null)

  }, [token])



  const refreshSession = useCallback(async () => {

    try {

      const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })

      if (!res.ok) return false

      const data = (await res.json()) as { token: string; user: UserInfo }

      localStorage.setItem(TOKEN_KEY, data.token)

      setToken(data.token)

      setUser(data.user)

      return true

    } catch {

      return false

    }

  }, [])



  useEffect(() => {

    setUnauthorizedHandler(() => {

      void logout()

    })

  }, [logout])



  useEffect(() => {

    let cancelled = false

    async function hydrate() {

      try {

        const setupRes = await fetch('/api/setup/status')

        if (setupRes.ok) {

          const setup = (await setupRes.json()) as { needsSetup: boolean }

          if (setup.needsSetup) {

            localStorage.removeItem(TOKEN_KEY)

            if (!cancelled) {

              setToken(null)

              setUser(null)

              setReady(true)

            }

            return

          }

        }

      } catch {

        /* continue */

      }



      if (!token) {

        const refreshed = await refreshSession()

        if (refreshed) {

          if (!cancelled) setReady(true)

          return

        }

        setUser(null)

        setReady(true)

        return

      }

      try {

        const res = await fetch('/api/auth/me', {

          headers: { Authorization: `Bearer ${token}` },

          credentials: 'include',

        })

        if (!res.ok) throw new Error('unauthorized')

        const me = (await res.json()) as UserInfo

        if (!cancelled) setUser(me)

      } catch {

        const refreshed = await refreshSession()

        if (!refreshed && !cancelled) {

          localStorage.removeItem(TOKEN_KEY)

          setToken(null)

          setUser(null)

        }

      } finally {

        if (!cancelled) setReady(true)

      }

    }

    void hydrate()

    return () => {

      cancelled = true

    }

  }, [token, refreshSession])



  const establishSession = useCallback((newToken: string, newUser: UserInfo) => {

    localStorage.setItem(TOKEN_KEY, newToken)

    setToken(newToken)

    setUser(newUser)

    setReady(true)

  }, [])



  const finishLogin = useCallback(

    (data: { token: string; user: UserInfo }) => {

      localStorage.setItem(TOKEN_KEY, data.token)

      setToken(data.token)

      setUser(data.user)

    },

    [],

  )



  const login = useCallback(async (userName: string, password: string): Promise<LoginResult> => {

    const res = await fetch('/api/auth/login', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      credentials: 'include',

      body: JSON.stringify({ userName, password }),

    })

    if (!res.ok) {

      const msg = await res.json().catch(() => ({ message: 'Login failed' }))

      throw new Error(msg.message ?? 'Login failed')

    }

    const data = await res.json()

    if (data.token) {
      finishLogin(data as { token: string; user: UserInfo })
      return { kind: 'success' }
    }

    if (data.requiresTwoFactor) {

      return { kind: 'requiresTwoFactor', userId: data.userId as string }

    }

    if (data.mustChangePassword) {

      return { kind: 'mustChangePassword', userId: data.userId as string }

    }

    throw new Error('Unexpected login response')

  }, [finishLogin])



  const loginTwoFactor = useCallback(

    async (userId: string, password: string, code: string) => {

      const res = await fetch('/api/auth/login-2fa', {

        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        credentials: 'include',

        body: JSON.stringify({ userId, password, code }),

      })

      if (!res.ok) {

        const msg = await res.json().catch(() => ({ message: 'Invalid code' }))

        throw new Error(msg.message ?? 'Invalid code')

      }

      finishLogin((await res.json()) as { token: string; user: UserInfo })

    },

    [finishLogin],

  )



  const idleMinutes = user?.idleTimeoutMinutes ?? 15

  const idleEnabled =

    !!user &&

    (location.pathname.startsWith('/operator') || location.pathname.startsWith('/admin'))



  useIdleTimeout(idleEnabled, idleMinutes, () => {

    void logout()

  })



  const value = useMemo<AuthState>(

    () => ({

      token,

      user,

      ready,

      login,

      loginTwoFactor,

      establishSession,

      logout,

      refreshSession,

      hasPermission: (key: string) => !!user?.permissions.includes(key),

      hasRole: (role: string) => !!user?.roles.includes(role),

    }),

    [token, user, ready, login, loginTwoFactor, establishSession, logout, refreshSession],

  )



  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>

}



export const useAuth = () => useContext(AuthContext)

