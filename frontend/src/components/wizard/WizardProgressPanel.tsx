import { Accordion, Box, Card, Group, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconCheck, IconCircle } from '@tabler/icons-react'
import { useMediaQuery } from '@mantine/hooks'
import type { WizardStatus } from '../../lib/admin'

interface WizardProgressPanelProps {
  status: WizardStatus
  activeStep?: number
  mobileAccordion?: boolean
}

function ProgressItem({
  done,
  label,
  current,
}: {
  done: boolean
  label: string
  current?: boolean
}) {
  return (
    <Group gap={8} wrap="nowrap" align="flex-start">
      <ThemeIcon
        size={20}
        radius="xl"
        variant="light"
        color={done ? 'green' : current ? 'blue' : 'gray'}
        style={{ flexShrink: 0 }}
      >
        {done ? <IconCheck size={12} stroke={2.5} /> : <IconCircle size={12} stroke={2} />}
      </ThemeIcon>
      <Text size="sm" c={done ? undefined : current ? undefined : 'dimmed'} fw={current ? 600 : undefined}>
        {label}
      </Text>
    </Group>
  )
}

function ProgressContent({ status, activeStep }: { status: WizardStatus; activeStep?: number }) {
  const plantLabel =
    status.plants > 0 ? `${status.plants} plant(s) configured` : 'Plant pending'
  const deptLabel =
    status.departments > 0 ? `${status.departments} department(s)` : 'Departments pending'
  const lineLabel = status.lines > 0 ? `${status.lines} line(s)` : 'Lines pending'
  const machineLabel =
    status.machines > 0 ? `${status.machines} machine(s)` : 'Machines pending'

  return (
    <Stack gap="sm">
      <ProgressItem
        done={status.hasAdminUser}
        current={activeStep === 0}
        label={status.hasAdminUser ? 'Administrator created' : 'Administrator pending'}
      />
      <ProgressItem done={status.plants > 0} current={activeStep === 1} label={plantLabel} />
      <ProgressItem done={status.departments > 0} current={activeStep === 2} label={deptLabel} />
      <ProgressItem done={status.lines > 0} current={activeStep === 3} label={lineLabel} />
      <ProgressItem done={status.machines > 0} current={activeStep === 4} label={machineLabel} />
      <ProgressItem
        done={status.plcConnections > 0}
        current={activeStep === 5}
        label={
          status.plcConnections > 0
            ? `${status.plcConnections} PLC connection(s)`
            : 'PLC connections pending'
        }
      />
      <ProgressItem
        done={status.requiredTagsMapped}
        current={activeStep === 6}
        label={status.requiredTagsMapped ? 'Required tags mapped' : 'Required tags pending'}
      />
      <ProgressItem
        done={status.optionalTagsMapped > 0}
        current={activeStep === 7}
        label={
          status.optionalTagsMapped > 0
            ? `${status.optionalTagsMapped} optional tag(s) mapped`
            : 'Optional tags pending'
        }
      />
      <ProgressItem
        done={status.shiftsAssigned}
        current={activeStep === 8}
        label={status.shiftsAssigned ? 'Shifts assigned' : 'Shifts pending'}
      />
      <ProgressItem
        done={status.dashboards > 0}
        current={activeStep === 9}
        label={status.dashboards > 0 ? `${status.dashboards} dashboard(s)` : 'Dashboards pending'}
      />
      {!status.hasAdminUser ? (
        <Text size="xs" c="dimmed" mt={4}>
          Guided setup takes about 10 minutes for a single line.
        </Text>
      ) : null}
    </Stack>
  )
}

export function WizardProgressPanel({ status, activeStep, mobileAccordion = true }: WizardProgressPanelProps) {
  const isMobile = useMediaQuery('(max-width: 62em)')

  if (mobileAccordion && isMobile) {
    return (
      <Accordion variant="contained" radius="md">
        <Accordion.Item value="progress">
          <Accordion.Control>
            <Text size="sm" fw={600}>
              Setup progress
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <ProgressContent status={status} activeStep={activeStep} />
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion>
    )
  }

  return (
    <Card withBorder radius="md" padding="md">
      <Text size="xs" c="dimmed" fw={700} tt="uppercase" mb="sm">
        Setup progress
      </Text>
      <Box>
        <ProgressContent status={status} activeStep={activeStep} />
      </Box>
    </Card>
  )
}
