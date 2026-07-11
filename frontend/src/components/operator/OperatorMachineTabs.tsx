import { Badge, Group, ScrollArea, SegmentedControl, Text } from '@mantine/core'
import { stateColor } from '../widgets/common'
import type { OperatorStation } from '../../lib/useOperatorStations'

interface Props {
  stations: OperatorStation[]
  value: string
  onChange: (machineId: string) => void
}

export function OperatorMachineTabs({ stations, value, onChange }: Props) {
  if (stations.length <= 1) return null

  return (
    <ScrollArea type="auto" offsetScrollbars>
      <SegmentedControl
        value={value}
        onChange={onChange}
        fullWidth
        data={stations.map((s) => ({
          value: s.machineId,
          label: s.isLineOutput ? (
            <Group gap={4} wrap="nowrap" justify="center">
              <Text size="sm">{s.machineName}</Text>
              <Badge size="xs" color="grape" variant="light">
                Output
              </Badge>
            </Group>
          ) : (
            s.machineName
          ),
        }))}
        color={stateColor(stations.find((s) => s.machineId === value)?.snapshot.state)}
      />
    </ScrollArea>
  )
}
