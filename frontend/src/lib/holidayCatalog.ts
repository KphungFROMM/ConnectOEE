export type HolidayId =
  | 'newYearsDay'
  | 'mlkDay'
  | 'presidentsDay'
  | 'memorialDay'
  | 'juneteenth'
  | 'independenceDay'
  | 'laborDay'
  | 'thanksgiving'
  | 'dayAfterThanksgiving'
  | 'christmasEve'
  | 'christmasDay'
  | 'newYearsEve'

export interface HolidayDefinition {
  id: HolidayId
  name: string
  federal: boolean
  commonPlantClosure: boolean
}

export const HOLIDAY_DEFINITIONS: HolidayDefinition[] = [
  { id: 'newYearsDay', name: "New Year's Day", federal: true, commonPlantClosure: false },
  { id: 'mlkDay', name: 'Martin Luther King Jr. Day', federal: true, commonPlantClosure: false },
  { id: 'presidentsDay', name: "Presidents' Day", federal: true, commonPlantClosure: false },
  { id: 'memorialDay', name: 'Memorial Day', federal: true, commonPlantClosure: false },
  { id: 'juneteenth', name: 'Juneteenth', federal: true, commonPlantClosure: false },
  { id: 'independenceDay', name: 'Independence Day', federal: true, commonPlantClosure: false },
  { id: 'laborDay', name: 'Labor Day', federal: true, commonPlantClosure: false },
  { id: 'thanksgiving', name: 'Thanksgiving', federal: true, commonPlantClosure: false },
  { id: 'dayAfterThanksgiving', name: 'Day after Thanksgiving', federal: false, commonPlantClosure: true },
  { id: 'christmasEve', name: 'Christmas Eve', federal: false, commonPlantClosure: true },
  { id: 'christmasDay', name: 'Christmas Day', federal: true, commonPlantClosure: false },
  { id: 'newYearsEve', name: "New Year's Eve", federal: false, commonPlantClosure: true },
]

export const HOLIDAY_PRESETS = {
  usFederal: {
    label: 'US Federal',
    ids: HOLIDAY_DEFINITIONS.filter((h) => h.federal).map((h) => h.id),
  },
  usFederalPlusClosures: {
    label: 'Federal + plant closures',
    ids: HOLIDAY_DEFINITIONS.filter((h) => h.federal || h.commonPlantClosure).map((h) => h.id),
  },
  all: {
    label: 'All listed',
    ids: HOLIDAY_DEFINITIONS.map((h) => h.id),
  },
} as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toIso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`
}

/** nth weekday of month (1=first, -1=last) where weekday 0=Sun..6=Sat */
function nthWeekday(year: number, month: number, weekday: number, n: number): Date {
  if (n > 0) {
    const first = new Date(year, month - 1, 1)
    const offset = (weekday - first.getDay() + 7) % 7
    return new Date(year, month - 1, 1 + offset + (n - 1) * 7)
  }
  const last = new Date(year, month, 0)
  const offset = (last.getDay() - weekday + 7) % 7
  return new Date(year, month - 1, last.getDate() - offset)
}

export function resolveHolidayDate(id: HolidayId, year: number): string {
  switch (id) {
    case 'newYearsDay':
      return toIso(year, 1, 1)
    case 'mlkDay':
      return toIso(year, nthWeekday(year, 1, 1, 3).getMonth() + 1, nthWeekday(year, 1, 1, 3).getDate())
    case 'presidentsDay':
      return toIso(year, nthWeekday(year, 2, 1, 3).getMonth() + 1, nthWeekday(year, 2, 1, 3).getDate())
    case 'memorialDay': {
      const d = nthWeekday(year, 5, 1, -1)
      return toIso(year, d.getMonth() + 1, d.getDate())
    }
    case 'juneteenth':
      return toIso(year, 6, 19)
    case 'independenceDay':
      return toIso(year, 7, 4)
    case 'laborDay': {
      const d = nthWeekday(year, 9, 1, 1)
      return toIso(year, d.getMonth() + 1, d.getDate())
    }
    case 'thanksgiving': {
      const d = nthWeekday(year, 11, 4, 4)
      return toIso(year, d.getMonth() + 1, d.getDate())
    }
    case 'dayAfterThanksgiving': {
      const tg = nthWeekday(year, 11, 4, 4)
      const next = new Date(tg)
      next.setDate(next.getDate() + 1)
      return toIso(year, next.getMonth() + 1, next.getDate())
    }
    case 'christmasEve':
      return toIso(year, 12, 24)
    case 'christmasDay':
      return toIso(year, 12, 25)
    case 'newYearsEve':
      return toIso(year, 12, 31)
    default:
      return toIso(year, 1, 1)
  }
}

export interface ResolvedHoliday {
  id: HolidayId
  name: string
  date: string
}

export function resolveHolidayDates(ids: HolidayId[], year: number): ResolvedHoliday[] {
  return ids.map((id) => {
    const def = HOLIDAY_DEFINITIONS.find((h) => h.id === id)
    return { id, name: def?.name ?? id, date: resolveHolidayDate(id, year) }
  })
}

export function formatHolidayDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
