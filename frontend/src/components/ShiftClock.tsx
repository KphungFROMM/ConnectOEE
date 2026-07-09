import { useEffect, useState } from 'react'
import { Badge, Text, Tooltip } from '@mantine/core'
import { getHierarchyTree } from '../lib/hierarchy'
import { listPlants } from '../lib/admin'
import { getCurrentShift } from '../lib/metrics'
import { createLiveConnection } from '../lib/liveHub'
import { formatDurationSeconds } from '../lib/formatDuration'

const FALLBACK_SHIFT = 'all day'

function isFallbackShift(name: string) {
  return name.trim().toLowerCase() === FALLBACK_SHIFT
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

function formatPlantEndTime(endMs: number, plantTz: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: plantTz,
    }).format(new Date(endMs))
  } catch {
    return ''
  }
}

function formatTzLabel(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(
      new Date(),
    )
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? tz
  } catch {
    return tz
  }
}

function formatLabel(shiftName: string, shiftEndMs: number, plantTz: string): string {
  if (isFallbackShift(shiftName)) return 'No shift assigned'
  const rem = Math.max(0, Math.floor((shiftEndMs - Date.now()) / 1000))
  const endLocal = formatPlantEndTime(shiftEndMs, plantTz)
  const tzLabel = formatTzLabel(plantTz)
  const suffix = endLocal ? ` · ends ${endLocal} ${tzLabel}` : ''
  return `${shiftName} · ${formatDurationSeconds(rem)} left${suffix}`
}

/** Header shift clock — active shift name + time remaining for the first line in hierarchy. */
export function ShiftClock() {
  const [label, setLabel] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const [tooltip, setTooltip] = useState<string | null>(null)

  useEffect(() => {
    let conn: ReturnType<typeof createLiveConnection> | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let lineId: string | null = null
    let shiftName = ''
    let shiftEnd = 0
    let plantTz = 'UTC'

    function applyShift(name: string, endUtc: string) {
      shiftName = name
      shiftEnd = new Date(endUtc).getTime()
      setFallback(isFallbackShift(name))
      setLabel(formatLabel(name, shiftEnd, plantTz))
    }

    function tick() {
      if (!shiftName) return
      setLabel(formatLabel(shiftName, shiftEnd, plantTz))
    }

    async function start() {
      try {
        const [tree, plants] = await Promise.all([getHierarchyTree(), listPlants()])
        const firstPlant = tree[0]
        const firstLine = tree.flatMap((p) => p.departments.flatMap((d) => d.lines))[0]
        if (!firstLine) return
        lineId = firstLine.id
        plantTz = plants.find((p) => p.id === firstPlant?.id)?.timeZoneId ?? browserTimeZone()

        const browserTz = browserTimeZone()
        if (browserTz !== plantTz) {
          setTooltip(
            `Shift windows use plant time (${plantTz}). Your browser is ${browserTz}. Change plant timezone under Admin → Hierarchy if needed.`,
          )
        } else {
          setTooltip(null)
        }

        const current = await getCurrentShift(lineId, null)
        if (current?.shiftName && current.endUtc) {
          applyShift(current.shiftName, current.endUtc)
        }

        conn = createLiveConnection()
        conn.on('liveUpdate', (snap: { lineId: string; shiftName: string; shiftEndUtc: string }) => {
          if (snap.lineId !== lineId) return
          applyShift(snap.shiftName, snap.shiftEndUtc)
        })
        conn.on('shiftChanged', () => tick())
        await conn.start()
        if (lineId) await conn.invoke('SubscribeLine', lineId)
        timer = setInterval(tick, 30000)
      } catch {
        setLabel(null)
        setFallback(false)
        setTooltip(null)
      }
    }
    void start()
    return () => {
      if (timer) clearInterval(timer)
      void conn?.stop()
    }
  }, [])

  if (!label) return null
  const badge = (
    <Badge variant="light" size="lg" color={fallback ? 'gray' : 'blue'} tt="none">
      <Text span size="sm" fw={600} c={fallback ? 'dimmed' : undefined} tt="none">
        {label}
      </Text>
    </Badge>
  )
  return tooltip ? (
    <Tooltip label={tooltip} multiline w={280}>
      {badge}
    </Tooltip>
  ) : (
    badge
  )
}
