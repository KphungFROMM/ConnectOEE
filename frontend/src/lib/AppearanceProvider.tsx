import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  defaultAppearanceSettings,
  getAppearance,
  resetAppearance,
  saveAppearance,
  type AppearanceSettings,
} from './appearance'
import { useAuth } from './auth'
import {
  applyAppearanceColors,
  appearanceFromMap,
  getFactorColors,
  resetFactorColorsToDefaults,
} from '../theme/factorColorsRuntime'
import {
  applyStatusColors,
  appearanceStatusFromMap,
  getStatusColors,
  resetStatusColorsToDefaults,
} from '../theme/statusColorsRuntime'

type AppearanceContextValue = {
  settings: AppearanceSettings
  /** @deprecated Use settings — kept for existing color editors. */
  colors: AppearanceSettings
  ready: boolean
  /** Bumps when settings change so dependents can remount if needed. */
  revision: number
  save: (settings: AppearanceSettings) => Promise<void>
  reset: () => Promise<void>
  setLocal: (settings: AppearanceSettings) => void
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null)

function fallbackSettings(): AppearanceSettings {
  return {
    ...appearanceFromMap(getFactorColors()),
    ...appearanceStatusFromMap(getStatusColors()),
    headerTitle: '',
    headerLogoUrl: '',
  }
}

function publishRuntimes(next: AppearanceSettings) {
  applyAppearanceColors(next)
  applyStatusColors(next)
}

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth()
  const [settings, setSettings] = useState<AppearanceSettings>(defaultAppearanceSettings)
  const [ready, setReady] = useState(false)
  const [revision, setRevision] = useState(0)

  const publish = useCallback((next: AppearanceSettings) => {
    publishRuntimes(next)
    setSettings(next)
    setRevision((r) => r + 1)
  }, [])

  useEffect(() => {
    if (!authReady) return
    if (!user) {
      resetFactorColorsToDefaults()
      resetStatusColorsToDefaults()
      setSettings(defaultAppearanceSettings())
      setReady(true)
      return
    }
    let cancelled = false
    void getAppearance()
      .then((loaded) => {
        if (cancelled) return
        publish(loaded)
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        publish(defaultAppearanceSettings())
        setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [authReady, user, publish])

  const save = useCallback(
    async (next: AppearanceSettings) => {
      const saved = await saveAppearance(next)
      publish(saved)
    },
    [publish],
  )

  const reset = useCallback(async () => {
    const saved = await resetAppearance()
    publish(saved)
  }, [publish])

  const setLocal = useCallback((next: AppearanceSettings) => {
    publishRuntimes(next)
    setSettings(next)
    setRevision((r) => r + 1)
  }, [])

  const value = useMemo(
    () => ({ settings, colors: settings, ready, revision, save, reset, setLocal }),
    [settings, ready, revision, save, reset, setLocal],
  )

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance(): AppearanceContextValue {
  const ctx = useContext(AppearanceContext)
  if (!ctx) {
    const fallback = fallbackSettings()
    return {
      settings: fallback,
      colors: fallback,
      ready: true,
      revision: 0,
      save: async () => undefined,
      reset: async () => undefined,
      setLocal: () => undefined,
    }
  }
  return ctx
}
