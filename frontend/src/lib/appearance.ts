import { apiGet, apiPost } from './api'
import { apiPut } from './admin'
import { getToken } from './auth'
import { defaultAppearanceColors, type AppearanceColors } from '../theme/factorColorsRuntime'
import {
  defaultAppearanceStatusColors,
  type AppearanceStatusColors,
} from '../theme/statusColorsRuntime'

/** Product name — always shown somewhere in the authenticated shell. */
export const PRODUCT_NAME = 'ConnectOEE'

/** Default header logo (Vite public asset). */
export const DEFAULT_HEADER_LOGO = '/app-icon.png'

export type AppearanceSettings = AppearanceColors &
  AppearanceStatusColors & {
    headerTitle: string
    headerLogoUrl: string
  }

export type AppearanceDto = {
  oeeHex: string
  availabilityHex: string
  performanceHex: string
  qualityHex: string
  runningHex: string
  warningHex: string
  faultHex: string
  idleHex: string
  headerTitle: string
  headerLogoUrl: string
}

export function defaultAppearanceSettings(): AppearanceSettings {
  return {
    ...defaultAppearanceColors(),
    ...defaultAppearanceStatusColors(),
    headerTitle: '',
    headerLogoUrl: '',
  }
}

export function resolveHeaderTitle(settings: Pick<AppearanceSettings, 'headerTitle'>): string {
  const t = settings.headerTitle.trim()
  return t || PRODUCT_NAME
}

export function resolveHeaderLogoUrl(settings: Pick<AppearanceSettings, 'headerLogoUrl'>): string {
  const u = settings.headerLogoUrl.trim()
  return u || DEFAULT_HEADER_LOGO
}

/** True when the site uses a title other than ConnectOEE. */
export function isCustomHeaderTitle(settings: Pick<AppearanceSettings, 'headerTitle'>): boolean {
  return resolveHeaderTitle(settings).toLowerCase() !== PRODUCT_NAME.toLowerCase()
}

function fromApi(dto: AppearanceDto): AppearanceSettings {
  const statusDefaults = defaultAppearanceStatusColors()
  return {
    oeeHex: dto.oeeHex,
    availabilityHex: dto.availabilityHex,
    performanceHex: dto.performanceHex,
    qualityHex: dto.qualityHex,
    runningHex: dto.runningHex ?? statusDefaults.runningHex,
    warningHex: dto.warningHex ?? statusDefaults.warningHex,
    faultHex: dto.faultHex ?? statusDefaults.faultHex,
    idleHex: dto.idleHex ?? statusDefaults.idleHex,
    headerTitle: dto.headerTitle ?? '',
    headerLogoUrl: dto.headerLogoUrl ?? '',
  }
}

function toApiBody(settings: AppearanceSettings) {
  return {
    oeeHex: settings.oeeHex,
    availabilityHex: settings.availabilityHex,
    performanceHex: settings.performanceHex,
    qualityHex: settings.qualityHex,
    runningHex: settings.runningHex,
    warningHex: settings.warningHex,
    faultHex: settings.faultHex,
    idleHex: settings.idleHex,
    headerTitle: settings.headerTitle.trim(),
    headerLogoUrl: settings.headerLogoUrl.trim(),
  }
}

export async function getAppearance(): Promise<AppearanceSettings> {
  const dto = await apiGet<AppearanceDto>('/api/settings/appearance')
  return fromApi(dto)
}

export async function saveAppearance(settings: AppearanceSettings): Promise<AppearanceSettings> {
  const dto = await apiPut<AppearanceDto>('/api/settings/appearance', toApiBody(settings))
  return fromApi(dto)
}

export async function resetAppearance(): Promise<AppearanceSettings> {
  const dto = await apiPost<AppearanceDto>('/api/settings/appearance/reset', {})
  return fromApi(dto)
}

export async function uploadAppearanceLogo(file: File): Promise<AppearanceSettings> {
  const form = new FormData()
  form.append('file', file)
  const token = getToken()
  const res = await fetch('/api/settings/appearance/logo', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: 'include',
    body: form,
  })
  if (!res.ok) {
    let message = `Upload failed: ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body?.message) message = body.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return fromApi((await res.json()) as AppearanceDto)
}
