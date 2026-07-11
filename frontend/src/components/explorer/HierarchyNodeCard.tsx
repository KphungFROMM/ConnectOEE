import { Badge, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import { explorerRunStateColor, oeeExplorerHexColor, statusSurfaceTone } from '../widgets/common'
import { GaugeRing } from '../widgets/design/GaugeRing'
import { toneSurfaceStyle } from '../widgets/design/widgetTheme'
import { ConnectionPill } from './explorerStatus'
import type { ExplorerChildSummary } from './explorerTree'
import type { ExplorerNode } from './explorerTypes'

/**
 * Primary navigation unit for Plant/Department/Line drill-down — a status- and
 * OEE-aware card that doubles as a glanceable health tile.
 */
export function HierarchyNodeCard({
  node,
  onSelect,
}: {
  node: ExplorerChildSummary
  onSelect: (node: ExplorerNode) => void
}) {
  const tone = statusSurfaceTone(node.kpi.status, node.kpi.connectionState)
  const runColor = explorerRunStateColor(node.kpi.status, node.kpi.connectionState)
  const oeeHex = oeeExplorerHexColor(node.kpi.oeePct, node.kpi.connectionState)

  return (
    <UnstyledButton
      onClick={() => onSelect(node)}
      style={{ display: 'block', width: '100%', height: '100%', textAlign: 'left' }}
      aria-label={`Open ${node.name}`}
    >
      <Card
        withBorder
        radius="md"
        padding="md"
        h="100%"
        className="hoverLift explorerFadeIn"
        style={{
          ...toneSurfaceStyle(tone),
          boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
        }}
      >
        <Stack gap={10} h="100%" justify="space-between">
          <Group justify="space-between" wrap="nowrap" align="flex-start">
            <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: runColor,
                  boxShadow: `0 0 6px ${runColor}`,
                  flexShrink: 0,
                  marginTop: 4,
                }}
              />
              <Stack gap={0} style={{ minWidth: 0 }}>
                <Text size="xs" c="dimmed" fw={700} tt="uppercase">
                  {node.level}
                </Text>
                <Text fw={700} truncate>
                  {node.name}
                </Text>
              </Stack>
            </Group>
            <IconChevronRight size={16} style={{ opacity: 0.5, flexShrink: 0 }} />
          </Group>

          <Group justify="space-between" align="center" wrap="nowrap">
            <GaugeRing value={node.kpi.oeePct} size={64} thickness={8} ringColor={oeeHex} valueOutside />
            <Stack gap={6} align="flex-end">
              <ConnectionPill connectionState={node.kpi.connectionState} />
              {node.level === 'Line' && node.topology === 'Continuous' ? (
                <Badge variant="light" color="violet" size="sm" maw={140} style={{ overflow: 'hidden' }}>
                  <Text size="xs" truncate>
                    Continuous{node.lineOutputMachineName ? ` · ${node.lineOutputMachineName}` : ''}
                  </Text>
                </Badge>
              ) : null}
              {node.childCount != null ? (
                <Badge variant="light" color="gray" size="sm">
                  {node.childCount} {node.childLabel}
                </Badge>
              ) : null}
              {node.activeProductCode ? (
                <Badge variant="outline" color="blue" size="sm" maw={130} style={{ overflow: 'hidden' }}>
                  <Text size="xs" truncate>
                    {node.activeProductCode}
                  </Text>
                </Badge>
              ) : null}
            </Stack>
          </Group>
        </Stack>
      </Card>
    </UnstyledButton>
  )
}
