import { useCallback, useState } from 'react'
import { Alert, Card, Group, Progress, Stack, Text, Title } from '@mantine/core'
import { TagMappingEditor, type TagSignalFilter } from '../admin/editors'

interface TagMappingSetupStepProps {
  title: string
  description: string
  signalFilter: TagSignalFilter
  milestoneMet: boolean
  savedMessage: string
  onChange: () => void
}

export function TagMappingSetupStep({
  title,
  description,
  signalFilter,
  milestoneMet,
  savedMessage,
  onChange,
}: TagMappingSetupStepProps) {
  const [mappedCount, setMappedCount] = useState(0)
  const [totalMachines, setTotalMachines] = useState(0)

  const onRequiredProgressChange = useCallback((mapped: number, total: number) => {
    setMappedCount(mapped)
    setTotalMachines(total)
  }, [])

  const requiredIncomplete = signalFilter === 'required' && totalMachines > 0 && mappedCount < totalMachines
  const progressPct = totalMachines > 0 ? Math.round((mappedCount / totalMachines) * 100) : 0

  return (
    <Card withBorder padding="xl" radius="md" mx="auto" maw={640}>
      <Stack gap="lg">
        <div>
          <Title order={3}>{title}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {description}
          </Text>
        </div>
        {signalFilter === 'required' && totalMachines > 0 ? (
          <Stack gap={6}>
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                Required mapping progress
              </Text>
              <Text size="sm" c="dimmed">
                {mappedCount} / {totalMachines} machines
              </Text>
            </Group>
            <Progress value={progressPct} size="sm" color={milestoneMet ? 'green' : 'blue'} />
          </Stack>
        ) : null}
        {requiredIncomplete ? (
          <Alert color="orange" variant="light" title="Mapping incomplete">
            Map Run State and Good Count on every machine before continuing. Use the checklist to jump to incomplete
            machines — each machine needs unique tag paths from the PLC browse tree.
          </Alert>
        ) : null}
        {milestoneMet ? (
          <Alert color="green" variant="light">
            {savedMessage}
          </Alert>
        ) : null}
        <TagMappingEditor
          wizardMode
          signalFilter={signalFilter}
          onChange={onChange}
          onRequiredProgressChange={signalFilter === 'required' ? onRequiredProgressChange : undefined}
        />
      </Stack>
    </Card>
  )
}
