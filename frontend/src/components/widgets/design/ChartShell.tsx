import { Alert, Group, Stack, Text } from '@mantine/core'
import { IconHistory } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export function ChartShell({
  children,
  bucketCount,
  summary,
  partialHint = 'History building — showing shift-to-date summary',
}: {
  children: ReactNode
  bucketCount: number
  summary?: ReactNode
  partialHint?: string
}) {
  const partial = bucketCount > 0 && bucketCount < 2

  return (
    <Stack gap={8} h="100%">
      {summary ? <Group gap="xs">{summary}</Group> : null}
      {partial ? (
        <Alert variant="light" color="blue" icon={<IconHistory size={16} />} py={6} px="sm">
          <Text size="xs">{partialHint}</Text>
        </Alert>
      ) : null}
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
    </Stack>
  )
}

export function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={0} style={{ minWidth: 64 }}>
      <Text size="10px" c="dimmed" fw={700} tt="uppercase">
        {label}
      </Text>
      <Text size="sm" fw={700} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Text>
    </Stack>
  )
}
