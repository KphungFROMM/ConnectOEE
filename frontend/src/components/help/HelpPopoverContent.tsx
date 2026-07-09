import { Code, List, Stack, Text, Title } from '@mantine/core'
import type { ContextHelpEntry, MetricHelpEntry } from '../../lib/help/types'
import { isMetricHelp } from '../../lib/help/types'

export function HelpPopoverContent({ entry }: { entry: MetricHelpEntry | ContextHelpEntry }) {
  return (
    <Stack gap="xs" maw={320}>
      <Title order={6} fw={700}>
        {entry.title}
      </Title>
      <Text size="sm">{entry.definition ?? entry.summary}</Text>
      {isMetricHelp(entry) && entry.formula ? (
        <Code block fz="xs">
          {entry.formula}
        </Code>
      ) : null}
      {isMetricHelp(entry) && entry.unit ? (
        <Text size="xs" c="dimmed">
          Unit: {entry.unit}
        </Text>
      ) : null}
      {'bullets' in entry && entry.bullets && entry.bullets.length > 0 ? (
        <List size="xs" spacing={4} withPadding>
          {entry.bullets.map((b) => (
            <List.Item key={b}>{b}</List.Item>
          ))}
        </List>
      ) : null}
      {'caveats' in entry && entry.caveats && entry.caveats.length > 0 ? (
        <Stack gap={2}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Note
          </Text>
          <List size="xs" spacing={4} withPadding>
            {entry.caveats.map((c) => (
              <List.Item key={c}>{c}</List.Item>
            ))}
          </List>
        </Stack>
      ) : null}
    </Stack>
  )
}
