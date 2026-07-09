import { apiGet, apiPost } from './api'

// Generic helpers for PUT/DELETE (api.ts only had GET/POST).
import { getToken } from './auth'
async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    let message = `${method} ${path} failed: ${res.status}`
    try {
      const errBody = (await res.json()) as { message?: string }
      if (errBody?.message) message = errBody.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  return (res.status === 204 ? (undefined as T) : ((await res.json()) as T))
}
export const apiPut = <T>(path: string, body: unknown) => send<T>('PUT', path, body)
export const apiDelete = <T = void>(path: string) => send<T>('DELETE', path)

// ---- Hierarchy admin ----
export interface IdResult {
  id: string
}
export interface PlantDto {
  id: string
  name: string
  code?: string | null
  timeZoneId: string
  location?: string | null
}
export const listPlants = () => apiGet<PlantDto[]>('/api/plants')
export const createPlant = (body: { name: string; code?: string; timeZoneId?: string; location?: string }) =>
  apiPost<{ id: string }>('/api/plants', body)
export const updatePlant = (id: string, body: { name?: string; code?: string; timeZoneId?: string; location?: string }) =>
  apiPut<PlantDto>(`/api/plants/${id}`, body)
export const deletePlant = (id: string) => apiDelete(`/api/plants/${id}`)
export const createDepartment = (body: { plantId: string; name: string }) =>
  apiPost<IdResult>('/api/hierarchy/departments', body)
export const updateDepartment = (id: string, name: string) =>
  apiPut<void>(`/api/hierarchy/departments/${id}`, { name })
export const deleteDepartment = (id: string) => apiDelete(`/api/hierarchy/departments/${id}`)
export const createLine = (body: {
  departmentId: string
  name: string
  idealRatePerHour?: number
}) => apiPost<IdResult>('/api/hierarchy/lines', body)
export const updateLine = (id: string, name: string) => apiPut<void>(`/api/hierarchy/lines/${id}`, { name })
export const deleteLine = (id: string) => apiDelete(`/api/hierarchy/lines/${id}`)
export interface LineOeeDto {
  idealRatePerHour: number
  idealCycleTimeSec: number
  targetOeePct: number
  targetAvailabilityPct: number
  targetPerformancePct: number
  targetQualityPct: number
  microStopThresholdSec: number
  productionMode: import('./idealRate').LineProductionMode
  changeoverMode: import('./idealRate').ChangeoverMode
  reworkTracking: import('./idealRate').ReworkTrackingMode
}
export const getLineOee = (lineId: string) => apiGet<LineOeeDto>(`/api/hierarchy/lines/${lineId}/oee`)
export const updateLineOee = (
  lineId: string,
  body: {
    idealRatePerHour: number
    targetOeePct?: number
    targetAvailabilityPct?: number
    targetPerformancePct?: number
    targetQualityPct?: number
    microStopThresholdSec?: number
    productionMode?: import('./idealRate').LineProductionMode
    changeoverMode?: import('./idealRate').ChangeoverMode
    reworkTracking?: import('./idealRate').ReworkTrackingMode
  },
) => apiPut<void>(`/api/hierarchy/lines/${lineId}/oee`, body)
export const createMachine = (body: { lineId: string; name: string; sequenceIndex?: number }) =>
  apiPost<IdResult>('/api/hierarchy/machines', body)
export const updateMachine = (id: string, name: string) => apiPut<void>(`/api/hierarchy/machines/${id}`, { name })
export const deleteMachine = (id: string) => apiDelete(`/api/hierarchy/machines/${id}`)
export const reorderMachines = (lineId: string, machineIds: string[]) =>
  apiPut<void>(`/api/hierarchy/lines/${lineId}/machines/reorder`, { machineIds })

export interface HierarchyDeleteBlockers {
  departments?: number
  lines?: number
  machines?: number
  plcConnections?: number
  tagMappings?: number
  dashboards?: number
  shiftAssignments?: number
  logicalSignals?: number
  isBlocked?: boolean
  messages?: string[]
}

// ---- PLC ----
export interface PlcConnection {
  id: string
  name: string
  driverType: string
  endpoint?: string | null
  path?: string | null
  pollIntervalMs: number
  enabled: boolean
  lineId?: string | null
  tagCount: number
}
export const listConnections = () => apiGet<PlcConnection[]>('/api/plc/connections')
export const createConnection = (body: Partial<PlcConnection> & { name: string; driverType: string }) =>
  apiPost<PlcConnection>('/api/plc/connections', body)
export const updateConnection = (
  id: string,
  body: Partial<PlcConnection> & { name: string; driverType: string },
) => apiPut<void>(`/api/plc/connections/${id}`, body)
export const deleteConnection = (id: string) => apiDelete(`/api/plc/connections/${id}`)

// ---- Live driver / connection health ----
export interface DriverStatus {
  connectionId?: string | null
  name: string
  driverType: string
  state: string
  machineCount: number
  statusDetail?: string | null
  mappedTagCount?: number
}
export const getDriverStatus = () => apiGet<DriverStatus[]>('/api/plc/status')

// ---- System / ops ----
export interface RetentionPolicy {
  hypertable: string
  policyType: string
  schedule?: string | null
}
export interface SystemInfo {
  version: string
  environment: string
  serverTimeUtc: string
  startedUtc: string
  uptimeHours: number
  databaseReachable: boolean
  policies: RetentionPolicy[]
}
export interface BackupFile {
  name: string
  sizeBytes: number
  createdUtc: string
}
export const getSystemInfo = () => apiGet<SystemInfo>('/api/system/info')
export const listBackups = () => apiGet<BackupFile[]>('/api/system/backups')
export const createBackup = () => apiPost<BackupFile>('/api/system/backup', {})

export interface CommissioningCheck {
  key: string
  label: string
  passed: boolean
  detail?: string | null
  required?: boolean
}
export interface CommissioningStatus {
  lineId: string
  lineName: string
  ready: boolean
  checks: CommissioningCheck[]
}
export const getCommissioningStatus = (lineId: string) =>
  apiGet<CommissioningStatus>(`/api/system/commissioning?lineId=${lineId}`)

export interface SecurityCommissioningStatus {
  ready: boolean
  checks: CommissioningCheck[]
}
export const getSecurityCommissioning = () =>
  apiGet<SecurityCommissioningStatus>('/api/system/security-commissioning')

// ---- System monitor (presence + pipeline) ----
export interface ClientSession {
  sessionId: string
  clientKind: string
  userId?: string | null
  userName?: string | null
  displayName?: string | null
  route?: string | null
  pageLabel?: string | null
  theme?: string | null
  kioskDashboardId?: string | null
  kioskDashboardName?: string | null
  lineId?: string | null
  lineName?: string | null
  connectedUtc: string
  lastSeenUtc: string
}

export interface MonitorSummary {
  staffSessions: number
  operatorSessions: number
  kioskSessions: number
  uniqueUsers: number
  signalRConnections: number
  tagPreviewClients: number
}

export interface PipelineHealth {
  connected: number
  stale: number
  disconnected: number
  total: number
}

export interface RecentSignIn {
  timestampUtc: string
  userName?: string | null
  result?: string | null
}

export interface ReportScheduleHealth {
  id: string
  name: string
  enabled: boolean
  nextRunUtc?: string | null
  lastError?: string | null
}

export interface SystemMonitor {
  summary: MonitorSummary
  sessions: ClientSession[]
  pipeline: PipelineHealth
  recentSignIns: RecentSignIn[]
  enabledSchedules: number
  upcomingSchedules: ReportScheduleHealth[]
  schedulesWithErrors: ReportScheduleHealth[]
}

export const getSystemMonitor = () => apiGet<SystemMonitor>('/api/system/monitor')

export const sendPlcCommand = (machineId: string, command: string) =>
  apiPost<{ ok: boolean }>(`/api/plc/machines/${machineId}/command`, { command })

export interface ShiftCalendarEntry {
  id: string
  date: string
  isWorkingDay: boolean
  isHoliday: boolean
  isPlannedDown: boolean
  note?: string | null
}
export const listShiftCalendar = (plantId: string) =>
  apiGet<ShiftCalendarEntry[]>(`/api/shifts/calendar?plantId=${plantId}`)
export const saveShiftCalendar = (body: {
  plantId: string
  date: string
  isWorkingDay: boolean
  isHoliday: boolean
  isPlannedDown: boolean
  note?: string | null
}) => apiPost<void>('/api/shifts/calendar', body)

// ---- Tags ----
export interface SignalDto {
  id: string
  name: string
  role: string
  expectedType: string
  countIngestMode: string
  runStateIngestMode?: string
  unit?: string | null
  machineId?: string | null
  lineId?: string | null
  isMapped: boolean
  mappedPath?: string | null
  isManual: boolean
  required: boolean
}
export const listSignals = (machineId?: string) =>
  apiGet<SignalDto[]>(`/api/tags/signals${machineId ? `?machineId=${machineId}` : ''}`)
export const mapTag = (body: { logicalSignalId: string; tagPath: string; plcConnectionId?: string | null }) =>
  apiPost<void>('/api/tags/map', body)
export const updateCountIngestMode = (signalId: string, countIngestMode: string) =>
  apiPut<void>(`/api/tags/signals/${signalId}/ingest-mode`, { countIngestMode })
export const updateRunStateIngestMode = (signalId: string, runStateIngestMode: string) =>
  apiPut<void>(`/api/tags/signals/${signalId}/run-state-ingest-mode`, { runStateIngestMode })

// ---- Downtime reasons (PLC stop codes) ----
export interface DowntimeReasonDto {
  id: string
  code: number
  reason: string
  category: string
  kind: string
  lineId?: string | null
  machineId?: string | null
  isAutoCreated: boolean
  needsReview: boolean
}
export const listDowntimeReasons = (lineId?: string) =>
  apiGet<DowntimeReasonDto[]>(`/api/downtime-reasons${lineId ? `?lineId=${lineId}` : ''}`)
export const listPendingDowntimeReasons = (lineId?: string) =>
  apiGet<DowntimeReasonDto[]>(`/api/downtime-reasons/pending-review${lineId ? `?lineId=${lineId}` : ''}`)
export interface OperatorCatalogEntry {
  code: number
  reason: string
  category: string
  kind: string
  needsReview: boolean
}
export const listOperatorCatalog = (lineId: string, machineId?: string) => {
  const p = new URLSearchParams({ lineId })
  if (machineId) p.set('machineId', machineId)
  return apiGet<OperatorCatalogEntry[]>(`/api/downtime-reasons/operator-catalog?${p}`)
}
export const listOperatorPendingReasons = (lineId: string) =>
  apiGet<OperatorCatalogEntry[]>(`/api/downtime-reasons/operator-pending?lineId=${lineId}`)
export const createDowntimeReason = (body: Omit<DowntimeReasonDto, 'id' | 'isAutoCreated' | 'needsReview'>) =>
  apiPost<DowntimeReasonDto>('/api/downtime-reasons', body)
export const updateDowntimeReason = (id: string, body: Omit<DowntimeReasonDto, 'id' | 'isAutoCreated' | 'needsReview'>) =>
  apiPut<void>(`/api/downtime-reasons/${id}`, body)
export const deleteDowntimeReason = (id: string) => apiDelete(`/api/downtime-reasons/${id}`)

/** @deprecated Use downtime reason APIs */
export type FaultCodeDto = DowntimeReasonDto
export const listFaultCodes = listDowntimeReasons
export const createFaultCode = createDowntimeReason
export const updateFaultCode = updateDowntimeReason
export const deleteFaultCode = deleteDowntimeReason

// ---- Users ----
export interface ScopeDto {
  plantId: string
  lineId?: string | null
}
export interface UserDto {
  id: string
  userName: string
  displayName: string
  isActive: boolean
  roles: string[]
  scopes: ScopeDto[]
}
export const listUsers = () => apiGet<UserDto[]>('/api/users')
export const createUser = (body: { userName: string; password: string; displayName: string; roles: string[] }) =>
  apiPost<UserDto>('/api/users', body)
export const updateUser = (id: string, body: { displayName?: string; roles?: string[] }) =>
  apiPut<void>(`/api/users/${id}`, body)
export const resetUserPassword = (id: string, password: string) =>
  apiPut<void>(`/api/users/${id}/password`, { password })
export const deactivateUser = (id: string) => apiDelete(`/api/users/${id}`)
export const setUserScopes = (id: string, scopes: ScopeDto[]) => apiPut<void>(`/api/users/${id}/scopes`, { scopes })
export const setUserActive = (id: string, isActive: boolean) => apiPut<void>(`/api/users/${id}/active`, { isActive })

// ---- Recipes ----
export interface RecipeDto {
  id: string
  lineId?: string | null
  code: string
  name: string
  plcAlias?: string | null
  idealCycleTimeSec: number
  targetQuantity?: number | null
  isActive: boolean
  isAutoCreated?: boolean
}
export interface LineRateDto {
  productRecipeId: string
  code: string
  name: string
  defaultCycleSec: number
  effectiveCycleSec: number
  targetQuantity?: number | null
  hasLineOverride: boolean
  isAutoCreated: boolean
}
export const listLineRates = (lineId: string) => apiGet<LineRateDto[]>(`/api/recipes/lines/${lineId}/rates`)
export const upsertLineRate = (lineId: string, recipeId: string, body: { idealCycleTimeSec: number; targetQuantity?: number | null }) =>
  apiPut<void>(`/api/recipes/lines/${lineId}/rates/${recipeId}`, body)
export const selectLineRecipe = (lineId: string, recipeId: string | null) =>
  apiPost<{ recipeCode?: string; idealCycleSec?: number }>(`/api/recipes/lines/${lineId}/select`, { recipeId })
export const listRecipes = (lineId?: string, autoCreatedOnly?: boolean) => {
  const params = new URLSearchParams()
  if (lineId) params.set('lineId', lineId)
  if (autoCreatedOnly) params.set('autoCreatedOnly', 'true')
  const q = params.toString()
  return apiGet<RecipeDto[]>(`/api/recipes${q ? `?${q}` : ''}`)
}
export const createRecipe = (body: Omit<RecipeDto, 'id'>) => apiPost<RecipeDto>('/api/recipes', body)
export const updateRecipe = (id: string, body: Omit<RecipeDto, 'id'>) => apiPut<void>(`/api/recipes/${id}`, body)
export const deleteRecipe = (id: string) => apiDelete(`/api/recipes/${id}`)
export const selectMachineRecipe = (machineId: string, recipeId: string | null) =>
  apiPost<void>(`/api/recipes/machines/${machineId}/select`, { recipeId })

// ---- PLC control maps ----
export interface ControlMapDto {
  id: string
  machineId: string
  plcConnectionId: string
  command: string
  tagPath: string
  dataType: string
}
export const listControlMaps = (machineId?: string) =>
  apiGet<ControlMapDto[]>(`/api/plc/controls${machineId ? `?machineId=${machineId}` : ''}`)
export const saveControlMap = (body: { machineId: string; plcConnectionId: string; command: string; tagPath: string; dataType?: string }) =>
  apiPost<ControlMapDto>('/api/plc/controls', body)
export const deleteControlMap = (id: string) => apiDelete(`/api/plc/controls/${id}`)

// ---- Shifts (current) ----
export interface CurrentShiftDto {
  shiftName: string
  shiftStartUtc: string
  shiftEndUtc: string
  lineId?: string | null
  remainingSec: number
}
export const getCurrentShift = (lineId?: string) =>
  apiGet<CurrentShiftDto>(`/api/shifts/current${lineId ? `?lineId=${lineId}` : ''}`)

// ---- Shifts admin ----
export interface BreakWindow {
  start: string
  end: string
}
export interface ShiftDefinitionDto {
  id?: string
  name: string
  startTime: string
  endTime: string
  crossesMidnight?: boolean
  color?: string | null
  orderIndex?: number
  breaks: BreakWindow[]
}
export interface ShiftPatternDto {
  id: string
  name: string
  description?: string | null
  definitions: ShiftDefinitionDto[]
}
export interface AssignmentDto {
  id: string
  shiftPatternId: string
  patternName: string
  plantId?: string | null
  lineId?: string | null
  effectiveFrom: string
  effectiveTo?: string | null
}
export const listPatterns = () => apiGet<ShiftPatternDto[]>('/api/shifts/patterns')
export const createPattern = (body: { name: string; description?: string; definitions: ShiftDefinitionDto[] }) =>
  apiPost<ShiftPatternDto>('/api/shifts/patterns', body)
export const updatePattern = (id: string, body: { name: string; description?: string; definitions: ShiftDefinitionDto[] }) =>
  apiPut<ShiftPatternDto>(`/api/shifts/patterns/${id}`, body)
export const deletePattern = (id: string) => apiDelete(`/api/shifts/patterns/${id}`)
export const listAssignments = () => apiGet<AssignmentDto[]>('/api/shifts/assignments')
export const createAssignment = (body: {
  shiftPatternId: string
  plantId?: string | null
  lineId?: string | null
  effectiveFrom: string
  effectiveTo?: string | null
}) => apiPost<AssignmentDto>('/api/shifts/assignments', body)
export const deleteAssignment = (id: string) => apiDelete(`/api/shifts/assignments/${id}`)

// ---- Wizard ----
export interface WizardStatus {
  plants: number
  departments: number
  lines: number
  machines: number
  plcConnections: number
  requiredTagsMapped: boolean
  optionalTagsMapped: number
  shiftsAssigned: boolean
  hasAdminUser: boolean
  dashboards: number
  currentStep: number
}
export const getWizardStatus = () => apiGet<WizardStatus>('/api/wizard/status')
export const generateDashboards = () =>
  apiPost<{ created: number; names: string[] }>('/api/wizard/generate-dashboards', {})
