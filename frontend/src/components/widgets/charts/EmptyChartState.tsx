import { Stack, Text } from '@mantine/core'
import { IconChartBarOff } from '@tabler/icons-react'

export function EmptyChartState({ hint }: { hint?: string }) {
  return (
    <Stack align="center" justify="center" h="100%" gap={6}>
      <IconChartBarOff size={28} stroke={1.5} opacity={0.35} />
      <Text size="sm" c="dimmed" ta="center">
        {hint ?? 'No data yet'}
      </Text>
    </Stack>
  )
}
