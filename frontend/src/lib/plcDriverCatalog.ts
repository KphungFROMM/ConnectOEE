/** How a driver connects — drives which form fields appear in the PLC editor. */
export type PlcConnectionProfile = 'none' | 'ethernetIp' | 'modbusTcp' | 'opcUa'

export interface PlcDriverDefinition {
  /** API / enum value persisted on PlcConnection.DriverType */
  value: string
  label: string
  group: string
  hint: string
  implemented: boolean
  profile: PlcConnectionProfile
  defaultPath?: string
}

/** Single source of truth for PLC driver labels, groups, and connection UX. */
export const PLC_DRIVER_CATALOG: PlcDriverDefinition[] = [
  {
    value: 'Mock',
    label: 'Mock / Simulator',
    group: 'Simulation',
    hint: 'No IP required. Simulates run state, counts, and faults for setup and demos.',
    implemented: true,
    profile: 'none',
  },
  {
    value: 'RockwellEthernetIp',
    label: 'ControlLogix / CompactLogix (EtherNet/IP)',
    group: 'Rockwell Allen-Bradley',
    hint: 'Enter the controller IP and CPU path (e.g. 1,0 for slot 0 in rack 1).',
    implemented: true,
    profile: 'ethernetIp',
    defaultPath: '1,0',
  },
  {
    value: 'RockwellMicro800',
    label: 'Micro800',
    group: 'Rockwell Allen-Bradley',
    hint: 'EtherNet/IP connection to Micro800 controllers.',
    implemented: false,
    profile: 'ethernetIp',
    defaultPath: '1,0',
  },
  {
    value: 'RockwellMicroLogix',
    label: 'MicroLogix',
    group: 'Rockwell Allen-Bradley',
    hint: 'EtherNet/IP or serial gateway connection to MicroLogix controllers.',
    implemented: false,
    profile: 'ethernetIp',
    defaultPath: '1,0',
  },
  {
    value: 'RockwellSlc500',
    label: 'SLC 500',
    group: 'Rockwell Allen-Bradley',
    hint: 'Connection to SLC 500 controllers via EtherNet/IP gateway or serial.',
    implemented: false,
    profile: 'ethernetIp',
    defaultPath: '1,0',
  },
  {
    value: 'RockwellPlc5',
    label: 'PLC-5',
    group: 'Rockwell Allen-Bradley',
    hint: 'Connection to PLC-5 controllers via EtherNet/IP gateway or serial.',
    implemented: false,
    profile: 'ethernetIp',
    defaultPath: '1,0',
  },
  {
    value: 'ModbusTcp',
    label: 'Modbus TCP',
    group: 'Open protocols',
    hint: 'Enter the device IP address and Modbus TCP port (default 502).',
    implemented: false,
    profile: 'modbusTcp',
  },
  {
    value: 'OpcUa',
    label: 'OPC UA',
    group: 'Open protocols',
    hint: 'Enter the OPC UA server endpoint URL (e.g. opc.tcp://host:4840).',
    implemented: false,
    profile: 'opcUa',
  },
  {
    value: 'SiemensS7',
    label: 'Siemens S7',
    group: 'Siemens',
    hint: 'Enter the PLC IP address and rack/slot for S7 communication.',
    implemented: false,
    profile: 'ethernetIp',
    defaultPath: '0,1',
  },
]

const catalogByValue = new Map(PLC_DRIVER_CATALOG.map((d) => [d.value, d]))

export const DEFAULT_PLC_DRIVER = 'Mock'

export function getPlcDriver(value: string): PlcDriverDefinition {
  return catalogByValue.get(value) ?? catalogByValue.get(DEFAULT_PLC_DRIVER)!
}

export function getPlcDriverLabel(value: string): string {
  return getPlcDriver(value).label
}

export function driverRequiresEndpoint(profile: PlcConnectionProfile): boolean {
  return profile !== 'none'
}

export function driverRequiresPath(profile: PlcConnectionProfile): boolean {
  return profile === 'ethernetIp'
}

/** Grouped Mantine Select data; unimplemented drivers appear disabled with a coming-soon suffix. */
export function plcDriverSelectData(options?: { rockwellDriverEnabled?: boolean }): {
  group: string
  items: { value: string; label: string; disabled?: boolean }[]
}[] {
  const rockwellEnabled = options?.rockwellDriverEnabled ?? true
  const groups = new Map<string, { value: string; label: string; disabled?: boolean }[]>()
  for (const d of PLC_DRIVER_CATALOG) {
    const items = groups.get(d.group) ?? []
    const isRockwell = d.value === 'RockwellEthernetIp'
    const disabled = !d.implemented || (isRockwell && !rockwellEnabled)
    let label = d.label
    if (!d.implemented) label = `${d.label} (coming soon)`
    else if (isRockwell && !rockwellEnabled) label = `${d.label} (full license required)`
    items.push({
      value: d.value,
      label,
      disabled,
    })
    groups.set(d.group, items)
  }
  return [...groups.entries()].map(([group, items]) => ({ group, items }))
}

export const IMPLEMENTED_PLC_DRIVERS = PLC_DRIVER_CATALOG.filter((d) => d.implemented)
