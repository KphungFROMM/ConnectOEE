import { Alert, Anchor, Group, Text } from '@mantine/core'
import { Link } from 'react-router-dom'

export function DataCoverageBanner({
  withData,
  total,
}: {
  withData: number
  total: number
}) {
  if (total === 0 || withData >= total) return null
  return (
    <Alert color="yellow" variant="light" title="Sparse historian coverage">
      Historian has meaningful production data for {withData} of {total} buckets in this range. Wider ranges or
      coarser granularity may help.
    </Alert>
  )
}

export function AnalyticsEmpty({ message = 'No data in range.' }: { message?: string }) {
  return (
    <Group h={220} justify="center" align="center">
      <div style={{ textAlign: 'center' }}>
        <Text c="dimmed" size="sm" mb="xs">
          {message}
        </Text>
        <Group justify="center" gap="md">
          <Anchor component={Link} to="/plant-explorer" size="sm">
            Plant Explorer
          </Anchor>
          <Anchor component={Link} to="/reports" size="sm">
            Reports
          </Anchor>
          <Anchor component={Link} to="/admin" size="sm">
            Tag Mapping
          </Anchor>
        </Group>
      </div>
    </Group>
  )
}
