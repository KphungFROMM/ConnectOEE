import { useMemo } from 'react'
import {
  Alert,
  Badge,
  Box,
  Card,
  Group,
  Stack,
  Text,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
import type { ShiftDefinitionDto } from '../../lib/admin'
import {
  analyzeCoverage,
  buildAllBreakSegments,
  buildDisplaySegments,
  formatDuration,
  formatMinutes,
  getShiftDurationMinutes,
  pctOfDay,
  segmentStyleLeftWidth,
} from '../../lib/shiftTimelineUtils'
import { darkTheme, lightTheme } from '../../theme/tokens'
import { SectionLabel } from './SectionLabel'

const HOUR_TICKS = [0, 6, 12, 18, 24]

interface ShiftScheduleChartProps {
  name: string
  definitions: ShiftDefinitionDto[]
  activeShiftIndex?: number | null
  variant?: 'hero' | 'compact'
  sticky?: boolean
}

export function ShiftScheduleChart({
  name,
  definitions,
  activeShiftIndex,
  variant = 'compact',
  sticky = false,
}: ShiftScheduleChartProps) {
  const { colorScheme } = useMantineColorScheme()
  const theme = useMantineTheme()
  const isDark = colorScheme === 'dark'
  const isHero = variant === 'hero'
  const trackBg = isDark ? darkTheme.sunken : lightTheme.sunken
  const trackBorder = isDark ? darkTheme.border : lightTheme.border
  const tickColor = isDark ? darkTheme.textMuted : lightTheme.sectionLabel
  const hatchColor = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.25)'

  const segments = useMemo(() => buildDisplaySegments(definitions), [definitions])
  const breaks = useMemo(() => buildAllBreakSegments(definitions), [definitions])
  const coverage = useMemo(() => analyzeCoverage(segments), [segments])

  const namedDefs = definitions.filter((d) => d.name.trim())
  const isEmpty = namedDefs.length === 0
  const hasMidnightContinuation = segments.some((s) => s.continuesNextDay)
  const barHeight = isHero ? 52 : 36

  const chartBody = (
    <>
      <Group gap="xs" wrap="nowrap" mb={6}>
        <Box w={52} style={{ flexShrink: 0 }} />
        <Box style={{ position: 'relative', flex: 1, height: 18 }}>
          {HOUR_TICKS.map((h) => (
            <Text
              key={h}
              size="xs"
              style={{
                position: 'absolute',
                left: `${pctOfDay(h * 60)}%`,
                transform: h === 24 ? 'translateX(-100%)' : h === 0 ? undefined : 'translateX(-50%)',
                color: tickColor,
                fontSize: 10,
                fontWeight: 600,
              }}
            >
              {formatMinutes(h * 60)}
            </Text>
          ))}
        </Box>
      </Group>

      <Group gap="xs" wrap="nowrap" align="center" mb="sm">
        <Text size="xs" w={52} c="dimmed" fw={700} style={{ flexShrink: 0 }}>
          Daily
        </Text>
        <Box
          style={{
            position: 'relative',
            flex: 1,
            height: barHeight,
            background: trackBg,
            border: `1px solid ${trackBorder}`,
            borderRadius: 8,
            overflow: 'hidden',
          }}
        >
          {isEmpty ? (
            <Text
              size="sm"
              c="dimmed"
              ta="center"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingInline: 16,
              }}
            >
              Select a template or edit shifts below to preview your schedule
            </Text>
          ) : null}
          {!isEmpty
            ? coverage.gaps.map((g, i) => {
                const { left, width } = segmentStyleLeftWidth(g.startMin, g.endMin)
                return (
                  <Box
                    key={`gap-${i}`}
                    style={{
                      position: 'absolute',
                      left,
                      width,
                      top: 0,
                      bottom: 0,
                      background: isDark ? 'rgba(214,69,69,0.12)' : 'rgba(214,69,69,0.1)',
                    }}
                  />
                )
              })
            : null}
          {!isEmpty
            ? segments.map((seg, idx) => {
                const { left, width } = segmentStyleLeftWidth(seg.startMin, seg.endMin)
                const isActive = activeShiftIndex === seg.shiftIndex
                const showLabel = parseFloat(width) > (isHero ? 8 : 12)
                return (
                  <Box
                    key={`${seg.shiftIndex}-${seg.startMin}-${idx}`}
                    title={`${seg.name} ${formatMinutes(seg.startMin)}–${formatMinutes(seg.endMin)}`}
                    style={{
                      position: 'absolute',
                      left,
                      width,
                      top: 4,
                      bottom: 4,
                      backgroundColor: seg.color,
                      opacity: isActive ? 1 : 0.88,
                      borderRadius: 6,
                      outline: isActive ? `2px solid ${theme.colors.brand[6]}` : undefined,
                      outlineOffset: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      paddingInline: 4,
                    }}
                  >
                    {showLabel ? (
                      <Text size="xs" c="white" fw={700} truncate style={{ textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}>
                        {seg.name}
                      </Text>
                    ) : null}
                    {seg.continuesNextDay ? (
                      <Text
                        size="xs"
                        fw={700}
                        c="white"
                        style={{
                          position: 'absolute',
                          right: 4,
                          bottom: 2,
                          fontSize: 9,
                          textShadow: '0 1px 2px rgba(0,0,0,0.35)',
                        }}
                      >
                        → {definitions[seg.shiftIndex]?.endTime.slice(0, 5)}
                      </Text>
                    ) : null}
                  </Box>
                )
              })
            : null}
          {!isEmpty
            ? breaks.map((b, i) => {
                const { left, width } = segmentStyleLeftWidth(b.startMin, b.endMin)
                return (
                  <Box
                    key={`break-${i}`}
                    style={{
                      position: 'absolute',
                      left,
                      width,
                      top: 4,
                      bottom: 4,
                      borderRadius: 4,
                      background: `repeating-linear-gradient(
                    -45deg,
                    transparent,
                    transparent 3px,
                    ${hatchColor} 3px,
                    ${hatchColor} 6px
                  )`,
                      pointerEvents: 'none',
                    }}
                  />
                )
              })
            : null}
        </Box>
      </Group>

      {!isEmpty && hasMidnightContinuation ? (
        <Text size="xs" c="dimmed" mb="xs">
          Night shifts spanning midnight continue on the next calendar day.
        </Text>
      ) : null}

      {!isEmpty ? (
        <>
          <Group gap="xs" mb="sm">
            <Badge variant="light" color="blue" size="sm">
              {formatDuration(coverage.coveredMinutes)} scheduled
            </Badge>
            {coverage.gapMinutes > 0 ? (
              <Badge variant="light" color="yellow" size="sm">
                {formatDuration(coverage.gapMinutes)} uncovered
              </Badge>
            ) : null}
            {coverage.overlapMinutes > 0 ? (
              <Badge variant="light" color="red" size="sm">
                {formatDuration(coverage.overlapMinutes)} overlap
              </Badge>
            ) : null}
          </Group>

          {coverage.gaps.length > 0 ? (
            <Alert color="yellow" variant="light" mb="xs" py={6}>
              {coverage.gaps.map((g, i) => (
                <Text key={i} size="xs">
                  {formatDuration(g.minutes)} uncovered ({formatMinutes(g.startMin)}–{formatMinutes(g.endMin)})
                </Text>
              ))}
            </Alert>
          ) : null}

          {coverage.overlaps.length > 0 ? (
            <Alert color="red" variant="light" mb="xs" py={6}>
              {coverage.overlaps.map((o, i) => (
                <Text key={i} size="xs">
                  {o.shiftA} and {o.shiftB} overlap by {formatDuration(o.minutes)}
                </Text>
              ))}
            </Alert>
          ) : null}

          <Stack gap={6}>
            {namedDefs.map((d, i) => (
              <Group key={i} gap="xs" wrap="nowrap">
                <Box
                  w={10}
                  h={10}
                  style={{
                    borderRadius: '50%',
                    backgroundColor: d.color ?? '#4C8DFF',
                    flexShrink: 0,
                    outline: activeShiftIndex === i ? `2px solid ${theme.colors.brand[6]}` : undefined,
                  }}
                />
                <Text size="xs" fw={600} style={{ minWidth: 64 }}>
                  {d.name}
                </Text>
                <Text size="xs" c="dimmed">
                  {d.startTime.slice(0, 5)}–{d.endTime.slice(0, 5)} ({formatDuration(getShiftDurationMinutes(d))})
                </Text>
                {(d.breaks ?? []).length > 0 ? (
                  <Text size="xs" c="dimmed">
                    · {(d.breaks ?? []).map((b) => `${b.start.slice(0, 5)}–${b.end.slice(0, 5)}`).join(', ')} break
                  </Text>
                ) : null}
              </Group>
            ))}
          </Stack>
        </>
      ) : null}
    </>
  )

  const wrapperStyle = sticky
    ? {
        position: 'sticky' as const,
        top: 0,
        zIndex: 2,
        borderBottom: `1px solid ${trackBorder}`,
        marginBottom: theme.spacing.md,
      }
    : undefined

  if (isHero) {
    return (
      <Box style={wrapperStyle}>
        <SectionLabel mb={4}>Schedule preview</SectionLabel>
        {name.trim() ? (
          <Text fw={600} size="sm" mb={4}>
            {name}
          </Text>
        ) : null}
        <Text size="xs" c="dimmed" mb="sm">
          Applies Monday–Sunday · local plant time
        </Text>
        {chartBody}
      </Box>
    )
  }

  if (isEmpty) return null

  return (
    <Card withBorder radius="md" padding="md">
      <SectionLabel mb={2}>Schedule preview</SectionLabel>
      {name.trim() ? (
        <Text fw={600} size="sm" mb={4}>
          {name}
        </Text>
      ) : null}
      <Text size="xs" c="dimmed" mb="sm">
        Applies Monday–Sunday · local plant time
      </Text>
      {chartBody}
    </Card>
  )
}

/** @deprecated Use ShiftScheduleChart */
export const WeeklyPreview = ShiftScheduleChart
