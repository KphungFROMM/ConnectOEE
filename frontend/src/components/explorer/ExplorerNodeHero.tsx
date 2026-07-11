import { Badge, Group, Stack, Text } from '@mantine/core'
import { oeeExplorerHexColor, statusSurfaceTone } from '../widgets/common'
import { GaugeRing } from '../widgets/design/GaugeRing'
import { StatusPill } from '../widgets/design/StatusPill'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import { ConnectionPill } from './explorerStatus'
import type { ExplorerNode } from './explorerTypes'

/**
 * Compact "you are here" summary shown right under the Navigator — status, OEE ring, and
 * run state for the currently selected node, glanceable before scrolling to the drill
 * grid or the full deep-dive detail panel below.
 */
export function ExplorerNodeHero({ node }: { node: ExplorerNode }) {
  const { kpi } = node
  const tone = statusSurfaceTone(kpi.status, kpi.connectionState)
  const oeeHex = oeeExplorerHexColor(kpi.oeePct, kpi.connectionState)

  return (
    <WidgetSurface tone={tone} padding="md" radius="md">
      <Group justify="space-between" wrap="wrap" gap="lg">
        <Group gap="lg" wrap="wrap">
          <GaugeRing value={kpi.oeePct} label="OEE" size={88} thickness={10} ringColor={oeeHex} showLabelBelow />
          <StatusPill state={kpi.status} />
        </Group>
        <Stack gap="xs" align="flex-end">
          <ConnectionPill connectionState={kpi.connectionState} />
          <Group gap="xs">
            <Badge variant="light" color="blue">
              A {kpi.availabilityPct.toFixed(0)}%
            </Badge>
            <Badge variant="light" color="indigo">
              P {kpi.performancePct.toFixed(0)}%
            </Badge>
            <Badge variant="light" color="grape">
              Q {kpi.qualityPct.toFixed(0)}%
            </Badge>
          </Group>
          {kpi.activeRecipeCode ? (
            <Text size="xs" c="dimmed">
              Product: <Text span fw={600}>{kpi.activeRecipeCode}</Text>
            </Text>
          ) : null}
        </Stack>
      </Group>
    </WidgetSurface>
  )
}
