import type { SignalDto } from '../../lib/admin'

export interface MachineMappingStatus {
  machineId: string
  label: string
  complete: boolean
  missingSignals: string[]
}

export interface MachineOption {
  value: string
  label: string
}

function signalsForFilter(signals: SignalDto[], filter: 'required' | 'optional', excludeRoles: Set<string> = new Set()): SignalDto[] {
  const noSpeed = (s: SignalDto) => s.role !== 'Speed'
  const visible = (s: SignalDto) => !excludeRoles.has(s.role)
  if (filter === 'required') return signals.filter((s) => s.required && noSpeed(s) && visible(s))
  return signals.filter((s) => !s.required && noSpeed(s) && visible(s))
}

export function buildMachineStatuses(
  machineOpts: MachineOption[],
  allSignals: SignalDto[],
  filter: 'required' | 'optional',
  excludeRolesForMachine?: (machineId: string) => Set<string>,
): MachineMappingStatus[] {
  const byMachine = new Map<string, SignalDto[]>()
  for (const s of allSignals) {
    if (!s.machineId) continue
    const list = byMachine.get(s.machineId) ?? []
    list.push(s)
    byMachine.set(s.machineId, list)
  }

  return machineOpts.map(({ value, label }) => {
    const machineSignals = byMachine.get(value) ?? []
    const excludeRoles = excludeRolesForMachine?.(value) ?? new Set()
    const relevant = signalsForFilter(machineSignals, filter, excludeRoles)
    const missingSignals = relevant.filter((s) => !s.isMapped).map((s) => s.name)
    const complete = relevant.length > 0 && missingSignals.length === 0
    return { machineId: value, label, complete, missingSignals }
  })
}

export function countCompleteStatuses(statuses: MachineMappingStatus[]): number {
  return statuses.filter((s) => s.complete).length
}

export function firstIncompleteMachineId(
  statuses: MachineMappingStatus[],
  afterMachineId?: string | null,
): string | null {
  const incomplete = statuses.filter((s) => !s.complete)
  if (incomplete.length === 0) return null
  if (!afterMachineId) return incomplete[0].machineId
  const idx = incomplete.findIndex((s) => s.machineId === afterMachineId)
  const next = idx >= 0 ? incomplete[idx + 1] : incomplete[0]
  return next?.machineId ?? incomplete[0].machineId
}

export function checklistFilterLabel(filter: 'required' | 'optional'): string {
  return filter === 'required' ? 'required tags' : 'optional tags'
}
