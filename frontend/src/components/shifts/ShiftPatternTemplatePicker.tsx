import { Card, Group, SimpleGrid, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { segmentsFromDefinitions } from '../../lib/shiftTimelineUtils'
import { SHIFT_PATTERN_TEMPLATES, type ShiftPatternTemplate } from '../../lib/shiftPatternCatalog'
import { ShiftTimelineMini } from './ShiftTimelineMini'

interface ShiftPatternTemplatePickerProps {
  selectedId: string | null
  onSelect: (template: ShiftPatternTemplate | null) => void
}

export function ShiftPatternTemplatePicker({ selectedId, onSelect }: ShiftPatternTemplatePickerProps) {
  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        Start from a template
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        {SHIFT_PATTERN_TEMPLATES.map((t) => (
          <UnstyledButton key={t.id} onClick={() => onSelect(t)}>
            <Card
              withBorder
              padding="sm"
              radius="md"
              style={{
                borderColor: selectedId === t.id ? 'var(--mantine-color-blue-5)' : undefined,
                background: selectedId === t.id ? 'var(--mantine-color-blue-light)' : undefined,
              }}
            >
              <Text fw={600} size="sm">
                {t.name}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={2} mb={6}>
                {t.description}
              </Text>
              <ShiftTimelineMini segments={segmentsFromDefinitions(t.definitions)} height={40} />
            </Card>
          </UnstyledButton>
        ))}
        <UnstyledButton onClick={() => onSelect(null)}>
          <Card
            withBorder
            padding="sm"
            radius="md"
            h="100%"
            style={{
              borderStyle: 'dashed',
              borderColor: selectedId === 'blank' ? 'var(--mantine-color-blue-5)' : undefined,
              background: selectedId === 'blank' ? 'var(--mantine-color-blue-light)' : undefined,
            }}
          >
            <Group gap={6}>
              <IconPlus size={16} />
              <Text fw={600} size="sm">
                Start blank
              </Text>
            </Group>
            <Text size="xs" c="dimmed" mt={4}>
              Build a custom pattern from scratch
            </Text>
          </Card>
        </UnstyledButton>
      </SimpleGrid>
    </Stack>
  )
}
