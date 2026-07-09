import { Alert, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { CreateAccountForm } from '../auth/CreateAccountForm'
import { bootstrapAdmin } from '../../lib/setup'
import { useAuth } from '../../lib/auth'
import { useState } from 'react'

interface AdminBootstrapStepProps {
  hasAdminUser: boolean
  onBootstrapped: () => void
  onNext: () => void
}

export function AdminBootstrapStep({ hasAdminUser, onBootstrapped, onNext }: AdminBootstrapStepProps) {
  const { establishSession } = useAuth()
  const [creating, setCreating] = useState(false)

  if (hasAdminUser) {
    return (
      <Card withBorder padding="xl" radius="md" mx="auto" maw={560}>
        <Stack gap="md">
          <div>
            <Title order={3}>Create administrator</Title>
            <Text size="sm" c="dimmed" mt={4}>
              The first admin account is already set up for this installation.
            </Text>
          </div>
          <Alert color="green" variant="light">
            An administrator account already exists. Continue to plant setup, or manage users in Admin.
          </Alert>
          <Group justify="flex-end">
            <Button onClick={onNext}>Continue to plant setup</Button>
          </Group>
        </Stack>
      </Card>
    )
  }

  return (
    <Card withBorder padding="xl" radius="md" mx="auto" maw={640}>
      <Stack gap="lg">
        <div>
          <Title order={3}>Create administrator</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Set up the first admin account for this ConnectOEE installation. You will be signed in automatically.
          </Text>
        </div>
        <CreateAccountForm
          layout="wizard"
          submitLabel="Create & continue"
          loading={creating}
          onSubmit={async (values) => {
            setCreating(true)
            try {
              const res = await bootstrapAdmin(values)
              establishSession(res.token, res.user)
              notifications.show({ message: 'Administrator account created', color: 'green' })
              onBootstrapped()
            } finally {
              setCreating(false)
            }
          }}
        />
      </Stack>
    </Card>
  )
}
