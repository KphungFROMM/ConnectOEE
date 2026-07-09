import { Alert, Card, Stack, Text, Title } from '@mantine/core'
import { HierarchyEditor, type HierarchyWizardStep } from '../admin/editors'

interface HierarchySetupStepProps {
  wizardStep: Exclude<HierarchyWizardStep, 'full'>
  title: string
  description: string
  itemCount: number
  savedMessage: string
  onChange: () => void
}

export function HierarchySetupStep({
  wizardStep,
  title,
  description,
  itemCount,
  savedMessage,
  onChange,
}: HierarchySetupStepProps) {
  return (
    <Card withBorder padding="xl" radius="md" mx="auto" maw={640}>
      <Stack gap="lg">
        <div>
          <Title order={3}>{title}</Title>
          <Text size="sm" c="dimmed" mt={4}>
            {description}
          </Text>
        </div>
        {itemCount > 0 ? (
          <Alert color="green" variant="light">
            {savedMessage}
          </Alert>
        ) : null}
        <HierarchyEditor wizardStep={wizardStep} onChange={onChange} />
      </Stack>
    </Card>
  )
}
