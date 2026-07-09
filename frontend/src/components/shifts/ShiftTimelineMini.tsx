import { Box, useMantineColorScheme } from '@mantine/core'
import type { DisplaySegment } from '../../lib/shiftTimelineUtils'
import { segmentStyleLeftWidth } from '../../lib/shiftTimelineUtils'
import { darkTheme, lightTheme } from '../../theme/tokens'

interface ShiftTimelineMiniProps {
  segments: DisplaySegment[]
  height?: number
}

export function ShiftTimelineMini({ segments, height = 48 }: ShiftTimelineMiniProps) {
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const trackBg = isDark ? darkTheme.sunken : lightTheme.sunken
  const trackBorder = isDark ? darkTheme.border : lightTheme.border

  if (segments.length === 0) {
    return (
      <Box
        h={height}
        style={{
          background: trackBg,
          border: `1px solid ${trackBorder}`,
          borderRadius: 6,
        }}
      />
    )
  }

  return (
    <Box
      h={height}
      style={{
        position: 'relative',
        background: trackBg,
        border: `1px solid ${trackBorder}`,
        borderRadius: 6,
        overflow: 'hidden',
      }}
    >
      {segments.map((seg, idx) => {
        const { left, width } = segmentStyleLeftWidth(seg.startMin, seg.endMin)
        return (
          <Box
            key={`${seg.shiftIndex}-${seg.startMin}-${idx}`}
            title={`${seg.name}`}
            style={{
              position: 'absolute',
              left,
              width,
              top: 4,
              bottom: 4,
              backgroundColor: seg.color,
              opacity: 0.9,
              borderRadius: 4,
            }}
          />
        )
      })}
    </Box>
  )
}
