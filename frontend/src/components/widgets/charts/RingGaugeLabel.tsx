import { Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

/** Flex-centered label for Mantine RingProgress (fixes off-center numeric labels). */
export function RingGaugeLabel({
  children,
  sublabel,
  size = 'md',
  color,
  maxWidth,
}: {
  children: ReactNode
  sublabel?: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string
  color?: string
  /** Constrain text to the ring hole so digits do not paint under the stroke. */
  maxWidth?: number
}) {
  return (
    <Stack
      align="center"
      justify="center"
      gap={0}
      w="100%"
      h="100%"
      style={{ pointerEvents: 'none', minHeight: 0 }}
    >
      <Text
        ta="center"
        lh={1}
        fw={800}
        size={size}
        c={color}
        style={{
          fontVariantNumeric: 'tabular-nums',
          maxWidth: maxWidth != null ? maxWidth : undefined,
          overflow: 'hidden',
          textOverflow: 'clip',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </Text>
      {sublabel ? (
        <Text ta="center" lh={1.1} size="xs" c="dimmed" fw={700}>
          {sublabel}
        </Text>
      ) : null}
    </Stack>
  )
}
