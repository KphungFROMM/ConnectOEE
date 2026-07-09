import { useMemo, useState } from 'react'
import {
  Accordion,
  Code,
  Drawer,
  List,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { METRIC_HELP_LIST } from '../../lib/help/metricHelp'
import { CONTEXT_HELP_LIST } from '../../lib/help/contextHelp'
import type { MetricHelpCategory } from '../../lib/help/types'

const CATEGORY_LABELS: Record<MetricHelpCategory, string> = {
  oee: 'OEE',
  reliability: 'Reliability',
  production: 'Production',
  loss: 'Loss attribution',
  rate: 'Rate & cycle',
  operational: 'Operational',
}

export function HelpDrawer({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')

  const filteredMetrics = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return METRIC_HELP_LIST
    return METRIC_HELP_LIST.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        m.summary.toLowerCase().includes(q) ||
        (m.definition?.toLowerCase().includes(q) ?? false) ||
        m.id.toLowerCase().includes(q),
    )
  }, [query])

  const filteredContext = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return CONTEXT_HELP_LIST
    return CONTEXT_HELP_LIST.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        (c.definition?.toLowerCase().includes(q) ?? false),
    )
  }, [query])

  const byCategory = useMemo(() => {
    const map = new Map<MetricHelpCategory, typeof filteredMetrics>()
    for (const m of filteredMetrics) {
      const list = map.get(m.category) ?? []
      list.push(m)
      map.set(m.category, list)
    }
    return map
  }, [filteredMetrics])

  return (
    <Drawer opened={opened} onClose={onClose} title="ConnectOEE help" position="right" size="md">
      <Stack gap="md">
        <TextInput
          placeholder="Search metrics and topics…"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <Text size="sm" c="dimmed">
          Tap <strong>?</strong> next to any KPI for quick help. Browse the full glossary below.
        </Text>

        {filteredContext.length > 0 ? (
          <Stack gap="xs">
            <Title order={6}>Topics</Title>
            <Accordion variant="separated">
              {filteredContext.map((c) => (
                <Accordion.Item key={c.id} value={c.id}>
                  <Accordion.Control>{c.title}</Accordion.Control>
                  <Accordion.Panel>
                    <Text size="sm" mb="xs">
                      {c.definition ?? c.summary}
                    </Text>
                    {c.bullets ? (
                      <List size="sm" spacing={4} withPadding>
                        {c.bullets.map((b) => (
                          <List.Item key={b}>{b}</List.Item>
                        ))}
                      </List>
                    ) : null}
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Stack>
        ) : null}

        <Stack gap="xs">
          <Title order={6}>Metrics</Title>
          <Accordion variant="separated" multiple>
            {[...byCategory.entries()].map(([cat, items]) =>
              items.length === 0 ? null : (
                <Accordion.Item key={cat} value={cat}>
                  <Accordion.Control>{CATEGORY_LABELS[cat]}</Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="md">
                      {items.map((m) => (
                        <Stack key={m.id} gap={4}>
                          <Text fw={600} size="sm">
                            {m.title}
                          </Text>
                          <Text size="sm" c="dimmed">
                            {m.summary}
                          </Text>
                          <Text size="sm">{m.definition ?? m.summary}</Text>
                          {m.formula ? (
                            <Code block fz="xs">
                              {m.formula}
                            </Code>
                          ) : null}
                        </Stack>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              ),
            )}
          </Accordion>
        </Stack>
      </Stack>
    </Drawer>
  )
}
