import { Badge, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import type { MachineSnapshot } from '../../lib/liveHub'
import { explorerRunStateColor, oeeExplorerHexColor, statusSurfaceTone } from '../widgets/common'
import { GaugeRing } from '../widgets/design/GaugeRing'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import { ConnectionPill } from './explorerStatus'
import { ExplorerShiftPanel } from './ExplorerShiftPanel'
import type { ExplorerChildSummary } from './explorerTree'
import type { ExplorerNode } from './explorerTypes'

/**
 * Unified drill tile for Plant → Machine — one visual language across the hierarchy.
 */
export function ExplorerChildTile({
  node,
  snapshot,
  onSelect,
}: {
  node: ExplorerChildSummary
  snapshot?: MachineSnapshot
  onSelect: (node: ExplorerNode) => void
}) {
  const status = snapshot?.state ?? node.kpi.status
  const connectionState = snapshot?.connectionState ?? node.kpi.connectionState
  const oeePct = snapshot?.oeePct ?? node.kpi.oeePct
  const tone = statusSurfaceTone(status, connectionState)
  const runColor = explorerRunStateColor(status, connectionState)
  const oeeHex = oeeExplorerHexColor(oeePct, connectionState)
  const product =
    snapshot?.activeRecipeCode ?? snapshot?.activeRecipeName ?? node.activeProductCode ?? node.kpi.activeRecipeCode
  const plantIdForShift = node.level === 'Plant' ? node.id : undefined

  return (
    <UnstyledButton
      onClick={() => onSelect(node)}
      style={{ display: 'block', width: '100%', height: '100%', textAlign: 'left' }}
      aria-label={`Open ${node.name}`}
      className="hoverLift explorerFadeIn"
    >
      <WidgetSurface tone={tone} padding="md" radius="md" elevation="default" style={{ height: '100%' }}>
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
            <GaugeRing value={oeePct} size={68} thickness={8} ringColor={oeeHex} valueOutside />
            <Stack gap={6} align="flex-end">
              <ConnectionPill connectionState={connectionState} />
              {plantIdForShift ? <ExplorerShiftPanel plantId={plantIdForShift} variant="compact" /> : null}
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
              {product ? (
                <Badge variant="outline" color="blue" size="sm" maw={130} style={{ overflow: 'hidden' }}>
                  <Text size="xs" truncate>
                    {product}
                  </Text>
                </Badge>
              ) : null}
              {node.level === 'Machine' && snapshot?.state ? (
                <Badge variant="light" color="gray" size="sm">
                  {snapshot.state}
                </Badge>
              ) : null}
            </Stack>
          </Group>
        </Stack>
      </WidgetSurface>
    </UnstyledButton>
  )
}
