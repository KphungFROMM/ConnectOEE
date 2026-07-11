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
  /** Override path requirement (defaults from profile). MicroLogix omits path on embedded Ethernet. */
  requiresPath?: boolean
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
    hint: 'Micro820/850/870 over EtherNet/IP. Leave path blank (Micro800 has no backplane path). Uses CIP symbolic tags.',
    implemented: true,
    profile: 'ethernetIp',
    defaultPath: '',
    requiresPath: false,
  },
  {
    value: 'RockwellMicroLogix',
    label: 'MicroLogix',
    group: 'Rockwell Allen-Bradley',
    hint: 'MicroLogix 1100/1400 over EtherNet/IP. Leave path blank for onboard Ethernet. Tag Mapping discovers data files (N0–N255, F0–F255, …) automatically.',
    implemented: true,
    profile: 'ethernetIp',
    defaultPath: '',
    requiresPath: false,
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
    hint: 'Enter device IP, TCP port (default 502), and Unit ID. Map addresses as hr0 / 40001 (holding), ir0 / 30001 (input), c0 (coil), di0 (discrete). Append :f32 for IEEE float across two registers.',
    implemented: true,
    profile: 'modbusTcp',
    defaultPath: '1',
    requiresPath: true,
  },
  {
    value: 'OpcUa',
    label: 'OPC UA',
    group: 'Open protocols',
    hint: 'Enter the OPC UA endpoint URL (e.g. opc.tcp://127.0.0.1:50000 for the Docker opc-plc sim). Anonymous SignAndEncrypt is used by default; untrusted certs are auto-accepted for on-prem setup.',
    implemented: true,
    profile: 'opcUa',
    requiresPath: false,
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

export function isRockwellDriver(value: string): boolean {
  return value.startsWith('Rockwell')
}

export function driverRequiresEndpoint(profile: PlcConnectionProfile): boolean {
  return profile !== 'none'
}

export function driverRequiresPath(def: PlcDriverDefinition | PlcConnectionProfile): boolean {
  if (typeof def === 'string') return def === 'ethernetIp' || def === 'modbusTcp'
  if (def.requiresPath != null) return def.requiresPath
  return def.profile === 'ethernetIp' || def.profile === 'modbusTcp'
}

/** Grouped Mantine Select data; unimplemented drivers appear disabled with a coming-soon suffix. */
export function plcDriverSelectData(options?: { plcDriversEnabled?: boolean }): {
  group: string
  items: { value: string; label: string; disabled?: boolean }[]
}[] {
  const driversEnabled = options?.plcDriversEnabled ?? true
  const groups = new Map<string, { value: string; label: string; disabled?: boolean }[]>()
  for (const d of PLC_DRIVER_CATALOG) {
    const items = groups.get(d.group) ?? []
    const needsFullLicense = d.implemented && d.value !== 'Mock'
    const disabled = !d.implemented || (needsFullLicense && !driversEnabled)
    let label = d.label
    if (!d.implemented) label = `${d.label} (coming soon)`
    else if (needsFullLicense && !driversEnabled) label = `${d.label} (full license required)`
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
