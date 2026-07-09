import { Alert, Card, Stack, Text, Title } from '@mantine/core'
import { PlcEditor } from '../admin/editors'
import { getDriverStatus, type DriverStatus } from '../../lib/admin'
import { useEffect, useState } from 'react'

interface PlcSetupStepProps {
  plcConnectionCount: number
  onChange: () => void
}

export function PlcSetupStep({ plcConnectionCount, onChange }: PlcSetupStepProps) {
  const [health, setHealth] = useState<DriverStatus[]>([])

  useEffect(() => {
    void getDriverStatus().then(setHealth).catch(() => setHealth([]))
    const t = setInterval(() => {
      void getDriverStatus().then(setHealth).catch(() => undefined)
    }, 8000)
    return () => clearInterval(t)
  }, [plcConnectionCount])

  const faulted = health.filter((h) => h.state === 'Faulted' || h.state === 'Stale')

  return (
    <Card withBorder padding="xl" radius="md" mx="auto" maw={640}>
      <Stack gap="lg">
        <div>
          <Title order={3}>Connect PLCs</Title>
          <Text size="sm" c="dimmed" mt={4}>
            Pick a communication driver for your controllers. Use Mock for testing without hardware; choose a protocol
            family from the list as you add real PLCs.
          </Text>
        </div>
        {plcConnectionCount > 0 && faulted.length === 0 ? (
          <Alert color="green" variant="light">
            Connection saved. Add another or continue to tag mapping when ready.
          </Alert>
        ) : null}
        {faulted.map((h) => (
          <Alert key={h.connectionId ?? h.name} color="red" variant="light" title={`${h.name} — ${h.state}`}>
            {h.statusDetail ?? 'Driver cannot read mapped tags. Verify IP, CPU path/slot, and tag paths in Tag Browser.'}
          </Alert>
        ))}
        <PlcEditor wizardMode onChange={onChange} />
      </Stack>
    </Card>
  )
}
