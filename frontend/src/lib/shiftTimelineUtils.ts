import type { BreakWindow, ShiftDefinitionDto } from './admin'
import { formatDurationMinutes } from './formatDuration'

const DAY_MINUTES = 24 * 60

export function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function formatMinutes(min: number): string {
  const normalized = ((min % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDuration(minutes: number): string {
  return formatDurationMinutes(minutes)
}

export interface DisplaySegment {
  shiftIndex: number
  name: string
  color: string
  startMin: number
  endMin: number
  crossesMidnight?: boolean
  continuesNextDay?: boolean
  continuesFromPrevDay?: boolean
}

export interface BreakSegment {
  shiftIndex: number
  startMin: number
  endMin: number
}

export function buildDisplaySegments(definitions: ShiftDefinitionDto[]): DisplaySegment[] {
  const segments: DisplaySegment[] = []

  definitions.forEach((d, shiftIndex) => {
    if (!d.name.trim()) return
    const start = toMinutes(d.startTime)
    const end = toMinutes(d.endTime)
    const color = d.color ?? '#4C8DFF'

    if (start === end) {
      segments.push({ shiftIndex, name: d.name, color, startMin: 0, endMin: DAY_MINUTES })
      return
    }

    if (end > start) {
      segments.push({ shiftIndex, name: d.name, color, startMin: start, endMin: end })
      return
    }

    segments.push({
      shiftIndex,
      name: d.name,
      color,
      startMin: start,
      endMin: DAY_MINUTES,
      crossesMidnight: true,
      continuesNextDay: true,
    })
    if (end > 0) {
      segments.push({
        shiftIndex,
        name: d.name,
        color,
        startMin: 0,
        endMin: end,
        crossesMidnight: true,
        continuesFromPrevDay: true,
      })
    }
  })

  return segments.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
}

export function buildBreakSegments(def: ShiftDefinitionDto, shiftIndex: number): BreakSegment[] {
  const breaks = def.breaks ?? []
  if (!def.name.trim() || breaks.length === 0) return []

  const shiftStart = toMinutes(def.startTime)
  const shiftEnd = toMinutes(def.endTime)
  const crossesMidnight = shiftEnd <= shiftStart && shiftStart !== shiftEnd
  const result: BreakSegment[] = []

  for (const b of breaks) {
    const bStart = toMinutes(b.start)
    const bEnd = toMinutes(b.end)
    if (bEnd <= bStart) continue

    if (!crossesMidnight) {
      const clipStart = Math.max(bStart, shiftStart)
      const clipEnd = Math.min(bEnd, shiftEnd)
      if (clipEnd > clipStart) {
        result.push({ shiftIndex, startMin: clipStart, endMin: clipEnd })
      }
      continue
    }

    if (bStart >= shiftStart) {
      const clipEnd = Math.min(bEnd, DAY_MINUTES)
      if (clipEnd > bStart) {
        result.push({ shiftIndex, startMin: bStart, endMin: clipEnd })
      }
    }
    if (bEnd <= shiftEnd || bStart < shiftEnd) {
      const clipStart = Math.max(bStart, 0)
      const clipEnd = Math.min(bEnd, shiftEnd)
      if (clipEnd > clipStart && clipStart < shiftEnd) {
        result.push({ shiftIndex, startMin: clipStart, endMin: clipEnd })
      }
    }
  }

  return result
}

export function buildAllBreakSegments(definitions: ShiftDefinitionDto[]): BreakSegment[] {
  return definitions.flatMap((d, i) => buildBreakSegments(d, i))
}

export function getShiftDurationMinutes(def: ShiftDefinitionDto): number {
  const start = toMinutes(def.startTime)
  const end = toMinutes(def.endTime)
  if (start === end) return DAY_MINUTES
  if (end > start) return end - start
  return DAY_MINUTES - start + end
}

export interface CoverageGap {
  startMin: number
  endMin: number
  minutes: number
}

export interface CoverageOverlap {
  startMin: number
  endMin: number
  minutes: number
  shiftA: string
  shiftB: string
}

export interface CoverageAnalysis {
  coveredMinutes: number
  gapMinutes: number
  overlapMinutes: number
  gaps: CoverageGap[]
  overlaps: CoverageOverlap[]
}

function mergeIntervals(intervals: { start: number; end: number }[]): { start: number; end: number }[] {
  if (intervals.length === 0) return []
  const sorted = [...intervals].sort((a, b) => a.start - b.start)
  const merged: { start: number; end: number }[] = [{ ...sorted[0] }]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    const cur = sorted[i]
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end)
    } else {
      merged.push({ ...cur })
    }
  }
  return merged
}

export function analyzeCoverage(segments: DisplaySegment[]): CoverageAnalysis {
  const intervals = segments.map((s) => ({ start: s.startMin, end: s.endMin, name: s.name }))
  const merged = mergeIntervals(intervals)

  const gaps: CoverageGap[] = []
  let cursor = 0
  for (const iv of merged) {
    if (iv.start > cursor) {
      gaps.push({ startMin: cursor, endMin: iv.start, minutes: iv.start - cursor })
    }
    cursor = Math.max(cursor, iv.end)
  }
  if (cursor < DAY_MINUTES) {
    gaps.push({ startMin: cursor, endMin: DAY_MINUTES, minutes: DAY_MINUTES - cursor })
  }

  const overlaps: CoverageOverlap[] = []
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const a = segments[i]
      const b = segments[j]
      const start = Math.max(a.startMin, b.startMin)
      const end = Math.min(a.endMin, b.endMin)
      if (end > start) {
        overlaps.push({
          startMin: start,
          endMin: end,
          minutes: end - start,
          shiftA: a.name,
          shiftB: b.name,
        })
      }
    }
  }

  const coveredMinutes = merged.reduce((sum, iv) => sum + (iv.end - iv.start), 0)
  const gapMinutes = gaps.reduce((sum, g) => sum + g.minutes, 0)
  const overlapMinutes = overlaps.reduce((sum, o) => sum + o.minutes, 0)

  return { coveredMinutes, gapMinutes, overlapMinutes, gaps, overlaps }
}

export function pctOfDay(minutes: number): number {
  return (minutes / DAY_MINUTES) * 100
}

export function segmentStyleLeftWidth(startMin: number, endMin: number): { left: string; width: string } {
  const left = pctOfDay(startMin)
  const width = pctOfDay(endMin - startMin)
  return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }
}

/** Segments for mini preview from template definitions (no breaks). */
export function segmentsFromDefinitions(definitions: Pick<ShiftDefinitionDto, 'name' | 'startTime' | 'endTime' | 'color'>[]): DisplaySegment[] {
  return buildDisplaySegments(
    definitions.map((d, i) => ({
      name: d.name,
      startTime: d.startTime,
      endTime: d.endTime,
      color: d.color,
      orderIndex: i,
      breaks: [] as BreakWindow[],
    })),
  )
}
