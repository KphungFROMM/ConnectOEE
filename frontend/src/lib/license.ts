import { apiGet, apiPost } from './api'

export interface LicenseStatus {
  edition: string
  editionDisplay: string
  isValid: boolean
  licenseHolder: string | null
  trialDaysRemaining: number
  expiresUtc: string | null
  maxPlants: number
  maxLines: number
  rockwellDriverEnabled: boolean
  pdfReportsEnabled: boolean
  scheduledReportsEnabled: boolean
  maxKioskDashboards: number
}

export const getLicenseStatus = () => apiGet<LicenseStatus>('/api/license')

export const activateLicense = (key: string) =>
  apiPost<LicenseStatus>('/api/license/activate', { key })

export function licenseBadgeColor(edition: string): string {
  switch (edition) {
    case 'Full':
    case 'Personal':
      return 'green'
    case 'Trial':
      return 'yellow'
    case 'Expired':
      return 'red'
    default:
      return 'gray'
  }
}
