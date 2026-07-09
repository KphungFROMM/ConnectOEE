import { Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'

/** Flex-centered label for Mantine RingProgress (fixes off-center numeric labels). */
export function RingGaugeLabel({
  children,
  sublabel,
  size = 'md',
  color,
}: {
  children: ReactNode
  sublabel?: ReactNode
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | string
  color?: string
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
      <Text ta="center" lh={1} fw={800} size={size} c={color} style={{ fontVariantNumeric: 'tabular-nums' }}>
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
