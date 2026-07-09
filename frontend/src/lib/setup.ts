import { apiGet, apiPost } from './api'
import type { UserInfo } from './auth'

export interface SetupStatus {
  needsSetup: boolean
}

export const getSetupStatus = () => apiGet<SetupStatus>('/api/setup/status')

export const bootstrapAdmin = (body: { userName: string; password: string; displayName?: string }) =>
  apiPost<{ token: string; user: UserInfo }>('/api/setup/bootstrap-admin', body)
