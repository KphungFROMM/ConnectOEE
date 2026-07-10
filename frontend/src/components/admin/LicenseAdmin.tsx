import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  ThemeIcon,
  Title,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconKey, IconShieldLock } from '@tabler/icons-react'
import {
  activateLicense,
  getLicenseStatus,
  licenseBadgeColor,
  type LicenseStatus,
} from '../../lib/license'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'

function formatLimit(value: number): string {
  return value >= 1_000_000 ? 'Unlimited' : String(value)
}

function formatBool(enabled: boolean): string {
  return enabled ? 'Yes' : 'No'
}

export function LicenseAdmin() {
  const { hasPermission } = useAuth()
  const canActivate = hasPermission(Permissions.ManageHierarchy)

  const [license, setLicense] = useState<LicenseStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [licenseKeyInput, setLicenseKeyInput] = useState('')
  const [activating, setActivating] = useState(false)

  const loadLicense = useCallback(() => {
    setLoading(true)
    void getLicenseStatus()
      .then(setLicense)
      .catch(() => setLicense(null))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    loadLicense()
  }, [loadLicense])

  async function runActivate() {
    if (!licenseKeyInput.trim()) return
    setActivating(true)
    try {
      const status = await activateLicense(licenseKeyInput.trim())
      setLicense(status)
      setLicenseKeyInput('')
      notifications.show({ message: 'License activated successfully', color: 'green' })
    } catch (e) {
      notifications.show({
        message: e instanceof Error ? e.message : 'Activation failed',
        color: 'red',
      })
    } finally {
      setActivating(false)
    }
  }

  if (loading && !license) {
    return (
      <Text size="sm" c="dimmed">
        Loading license status…
      </Text>
    )
  }

  if (!license) {
    return (
      <Alert color="red" variant="light" title="Could not load license status">
        Check that the ConnectOEE service is running and try again.
      </Alert>
    )
  }

  const needsActivation = license.edition === 'Trial' || license.edition === 'Expired'

  return (
    <Stack gap="lg">
      <Card withBorder padding="lg" radius="md">
        <Group justify="space-between" align="flex-start" mb="md">
          <Group gap="sm">
            <ThemeIcon size={40} radius="md" variant="light" color="brand">
              <IconKey size={22} />
            </ThemeIcon>
            <Stack gap={2}>
              <Title order={3}>Product license</Title>
              <Text size="sm" c="dimmed">
                Offline activation — no cloud account required
              </Text>
            </Stack>
          </Group>
          <Badge size="lg" color={licenseBadgeColor(license.edition)} variant="light">
            {license.edition}
          </Badge>
        </Group>

        <Text fw={600} mb="xs">
          {license.editionDisplay}
        </Text>

        {license.licenseHolder && license.edition === 'Full' ? (
          <Text size="sm" c="dimmed" mb="sm">
            Licensed to {license.licenseHolder}
            {license.expiresUtc ? ` · valid until ${license.expiresUtc.slice(0, 10)}` : ' · perpetual'}
          </Text>
        ) : null}

        {license.edition === 'Trial' ? (
          <Alert color="yellow" variant="light" title="Trial mode" mb="md">
            {license.trialDaysRemaining} day{license.trialDaysRemaining === 1 ? '' : 's'} remaining. Activate a
            full license to unlock Rockwell PLC connectivity, PDF reports, scheduled reports, and higher limits.
          </Alert>
        ) : null}

        {license.edition === 'Expired' ? (
          <Alert color="red" variant="light" title="License expired" mb="md">
            Your trial has ended or the license key has expired. Paste a new CONNECT-OEE- key below to restore full
            features.
          </Alert>
        ) : null}

        {license.edition === 'Full' || license.edition === 'Personal' ? (
          <Alert color="green" variant="light" icon={<IconCheck size={16} />} mb="md">
            All features are unlocked on this server.
          </Alert>
        ) : null}

        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <Stat label="Plants allowed" value={formatLimit(license.maxPlants)} />
          <Stat label="Lines allowed" value={formatLimit(license.maxLines)} />
          <Stat label="Kiosk dashboards" value={formatLimit(license.maxKioskDashboards)} />
          <Stat label="Rockwell driver" value={formatBool(license.rockwellDriverEnabled)} />
          <Stat label="PDF reports" value={formatBool(license.pdfReportsEnabled)} />
          <Stat label="Scheduled reports" value={formatBool(license.scheduledReportsEnabled)} />
        </SimpleGrid>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Group gap="xs" mb="md">
          <IconShieldLock size={18} />
          <Title order={4}>Activate license</Title>
        </Group>

        {canActivate ? (
          <Stack gap="md">
            <Textarea
              label="License key"
              description="Paste the full key from your license certificate. Keys start with CONNECT-OEE-."
              placeholder="CONNECT-OEE-..."
              value={licenseKeyInput}
              onChange={(e) => setLicenseKeyInput(e.currentTarget.value)}
              minRows={3}
              autosize
              styles={{ input: { fontFamily: 'Consolas, monospace', fontSize: 13 } }}
            />
            <Group>
              <Button
                onClick={() => void runActivate()}
                loading={activating}
                disabled={!licenseKeyInput.trim()}
              >
                Activate license
              </Button>
              {needsActivation ? (
                <Text size="sm" c="dimmed">
                  Contact your Connect vendor if you need a license key.
                </Text>
              ) : null}
            </Group>
          </Stack>
        ) : (
          <Alert color="blue" variant="light">
            You can view license status, but only administrators with hierarchy management permission can activate
            a license key.
          </Alert>
        )}

        <Text size="sm" c="dimmed" mt="md">
          Activation is validated locally on this server. The key is not sent to the cloud.
        </Text>
      </Card>

      <Card withBorder padding="lg" radius="md">
        <Title order={5} mb="sm">
          Trial vs full license
        </Title>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Feature</Table.Th>
              <Table.Th>Trial</Table.Th>
              <Table.Th>Full</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            <FeatureRow feature="Plants" trial="1" full="Unlimited" />
            <FeatureRow feature="Lines" trial="2" full="Unlimited" />
            <FeatureRow feature="PLC drivers" trial="Mock only" full="Mock + Rockwell" />
            <FeatureRow feature="PDF reports" trial="No" full="Yes" />
            <FeatureRow feature="Scheduled reports" trial="No" full="Yes" />
            <FeatureRow feature="Kiosk dashboards" trial="1" full="Unlimited" />
          </Table.Tbody>
        </Table>
      </Card>

      <Card withBorder padding="md" radius="md">
        <Title order={5} mb="xs">
          How to activate
        </Title>
        <List size="sm" spacing="xs">
          <List.Item>Open your license certificate PDF or email from your vendor.</List.Item>
          <List.Item>Copy the full CONNECT-OEE- license key.</List.Item>
          <List.Item>Paste it above and click Activate license.</List.Item>
          <List.Item>Confirm the status badge shows Full with your organization name.</List.Item>
        </List>
      </Card>
    </Stack>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Stack>
  )
}

function FeatureRow({ feature, trial, full }: { feature: string; trial: string; full: string }) {
  return (
    <Table.Tr>
      <Table.Td>{feature}</Table.Td>
      <Table.Td>{trial}</Table.Td>
      <Table.Td>{full}</Table.Td>
    </Table.Tr>
  )
}
