import { useMemo } from 'react'
import {
  ActionIcon,
  Anchor,
  Badge,
  Chip,
  Divider,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconChevronLeft, IconHome2, IconLayoutSidebar, IconSearch } from '@tabler/icons-react'
import { Link } from 'react-router-dom'
import type { useExplorerNav, ExplorerStatusFilter } from '../../lib/useExplorerNav'
import { scopeToParam } from '../../lib/scopeFromUrl'
import { explorerRunStateColor, oeeExplorerBadgeColor, statusSurfaceTone } from '../widgets/common'
import { StatusPill } from '../widgets/design/StatusPill'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import { ConnectionPill } from './explorerStatus'
import { ExplorerShiftPanel } from './ExplorerShiftPanel'
import { mergeKpiWithSnapshot, pickSnapshot } from './explorerKpi'
import type { ExplorerNode } from './explorerTypes'

type Nav = ReturnType<typeof useExplorerNav>

const FILTERS: { value: ExplorerStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'Running', label: 'Running' },
  { value: 'Idle', label: 'Idle' },
  { value: 'Down', label: 'Down' },
  { value: 'Disconnected', label: 'Disconnected' },
]

function BreadcrumbPill({
  node,
  onClick,
  active,
}: {
  node: ExplorerNode
  onClick: () => void
  active?: boolean
}) {
  const dotColor = explorerRunStateColor(node.kpi.status, node.kpi.connectionState)
  const oeeColorTier = oeeExplorerBadgeColor(node.kpi.oeePct, node.kpi.connectionState)
  return (
    <UnstyledButton onClick={onClick} style={{ flexShrink: 0 }}>
      <Group
        gap={6}
        wrap="nowrap"
        px={10}
        py={5}
        style={{
          borderRadius: 999,
          border: '1px solid var(--mantine-color-default-border)',
          background: active ? 'var(--mantine-color-default-hover)' : 'var(--mantine-color-body)',
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <Text size="sm" fw={active ? 700 : 500} truncate style={{ maxWidth: 140 }}>
          {node.name}
        </Text>
        <Badge size="xs" variant="light" color={oeeColorTier}>
          {node.kpi.oeePct.toFixed(0)}%
        </Badge>
      </Group>
    </UnstyledButton>
  )
}

/** Single sticky command plane: nav + scope identity + current shift. */
export function ExplorerCommandBar({ nav }: { nav: Nav }) {
  const {
    selected,
    breadcrumb,
    searchIndex,
    select,
    goHome,
    statusFilter,
    setStatusFilter,
    railOpen,
    setRailOpen,
    hubConnected,
    snapshots,
  } = nav
  const isMobile = useMediaQuery('(max-width: 768px)')

  const nodeByScope = useMemo(() => {
    const map = new Map<string, ExplorerNode>()
    for (const n of searchIndex) map.set(scopeToParam(n.level, n.id), n)
    return map
  }, [searchIndex])

  const searchOptions = useMemo(
    () => searchIndex.map((n) => ({ value: scopeToParam(n.level, n.id), label: n.name })),
    [searchIndex],
  )

  const snapshot = selected?.level === 'Machine' ? pickSnapshot(snapshots, selected) : undefined
  const kpi = selected ? (snapshot ? mergeKpiWithSnapshot(selected.kpi, snapshot) : selected.kpi) : null
  const lineId = selected ? (selected.lineId ?? (selected.level === 'Line' ? selected.id : undefined)) : undefined
  const plantIdForShift = selected && !lineId ? selected.plantId : undefined
  const analyticsScope = selected ? `${selected.level}:${selected.id}` : null
  const continuous =
    selected?.level === 'Line' && (selected.topology ?? 'Independent') === 'Continuous'
      ? selected.lineOutputMachineName
        ? `Continuous · ${selected.lineOutputMachineName}`
        : 'Continuous'
      : null

  const tone = kpi ? statusSurfaceTone(kpi.status, kpi.connectionState) : 'neutral'

  return (
    <WidgetSurface
      tone={tone}
      padding="md"
      radius="md"
      elevation="default"
      style={{ position: 'sticky', top: 0, zIndex: 20 }}
    >
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" gap={8}>
          <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <ActionIcon
              variant={railOpen ? 'filled' : 'light'}
              color="blue"
              onClick={() => setRailOpen(!railOpen)}
              aria-label="Toggle quick-jump list"
            >
              <IconLayoutSidebar size={16} />
            </ActionIcon>
            <ActionIcon variant="light" onClick={goHome} aria-label="Plant Explorer home">
              <IconHome2 size={16} />
            </ActionIcon>

            {isMobile && selected ? (
              <UnstyledButton
                onClick={() => select(breadcrumb.length > 1 ? breadcrumb[breadcrumb.length - 2] : null)}
                style={{ minWidth: 0, flex: 1 }}
              >
                <Group gap={4} wrap="nowrap">
                  <IconChevronLeft size={16} />
                  <Text fw={700} truncate>
                    {selected.name}
                  </Text>
                </Group>
              </UnstyledButton>
            ) : (
              <ScrollArea type="auto" scrollbarSize={4} style={{ flex: 1, minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  {breadcrumb.length === 0 ? (
                    <Text size="sm" c="dimmed" fw={600}>
                      All plants
                    </Text>
                  ) : (
                    breadcrumb.map((node, i) => (
                      <BreadcrumbPill
                        key={node.id}
                        node={node}
                        active={i === breadcrumb.length - 1}
                        onClick={() => select(node)}
                      />
                    ))
                  )}
                </Group>
              </ScrollArea>
            )}
          </Group>

          <Badge variant="dot" color={hubConnected ? 'green' : 'gray'} size="sm">
            {hubConnected ? 'Live' : 'Connecting'}
          </Badge>
        </Group>

        <Group justify="space-between" wrap="wrap" gap={8}>
          <Select
            placeholder="Jump to plant / line / machine…"
            leftSection={<IconSearch size={14} />}
            data={searchOptions}
            searchable
            clearable
            value={selected ? scopeToParam(selected.level, selected.id) : null}
            onChange={(value) => {
              if (!value) return
              const match = nodeByScope.get(value)
              if (match) select(match)
            }}
            maxDropdownHeight={360}
            nothingFoundMessage="No matches"
            style={{ flex: 1, minWidth: 220, maxWidth: 380 }}
            renderOption={({ option }) => {
              const node = nodeByScope.get(option.value)
              if (!node) return option.label
              return (
                <Group gap={8} wrap="nowrap" justify="space-between" style={{ width: '100%' }}>
                  <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: explorerRunStateColor(node.kpi.status, node.kpi.connectionState),
                        flexShrink: 0,
                      }}
                    />
                    <Stack gap={0} style={{ minWidth: 0 }}>
                      <Text size="sm" truncate>
                        {node.name}
                      </Text>
                      {node.parentPath ? (
                        <Text size="xs" c="dimmed" truncate>
                          {node.parentPath}
                        </Text>
                      ) : null}
                    </Stack>
                  </Group>
                  <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
                    <Badge size="xs" variant="light" color="gray">
                      {node.level}
                    </Badge>
                    <Badge size="xs" variant="light" color={oeeExplorerBadgeColor(node.kpi.oeePct, node.kpi.connectionState)}>
                      {node.kpi.oeePct.toFixed(0)}%
                    </Badge>
                  </Group>
                </Group>
              )
            }}
          />

          <Chip.Group value={statusFilter} onChange={(v) => setStatusFilter(v as ExplorerStatusFilter)}>
            <Group gap={6} wrap="wrap">
              {FILTERS.map((f) => (
                <Chip key={f.value} value={f.value} size="xs" variant="light">
                  {f.label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Group>

        {selected && kpi ? (
          <>
            <Divider />
            <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
              <Group gap="md" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
                <StatusPill state={kpi.status} />
                <div style={{ minWidth: 0 }}>
                  <Group gap="xs" wrap="wrap">
                    <Text fw={700} size="lg" truncate>
                      {selected.name}
                    </Text>
                    <Badge variant="light" size="sm">
                      {selected.level}
                    </Badge>
                    {continuous ? (
                      <Badge variant="light" color="violet" size="sm">
                        {continuous}
                      </Badge>
                    ) : null}
                    {kpi.activeRecipeCode ? (
                      <Badge variant="outline" color="blue" size="sm">
                        {kpi.activeRecipeCode}
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Live hierarchical cockpit · current shift
                  </Text>
                </div>
              </Group>
              <Group gap="sm">
                <ConnectionPill connectionState={kpi.connectionState} />
                {analyticsScope ? (
                  <Anchor component={Link} to={`/analytics?scope=${encodeURIComponent(analyticsScope)}`} size="sm">
                    Open in Analytics
                  </Anchor>
                ) : null}
              </Group>
            </Group>

            {lineId || plantIdForShift ? (
              <ExplorerShiftPanel lineId={lineId} plantId={plantIdForShift} snapshot={snapshot} variant="full" />
            ) : null}
          </>
        ) : (
          <>
            <Divider />
            <Text size="sm" c="dimmed">
              Select a plant to explore shift health, children, and live OEE — or use search to jump anywhere.
            </Text>
          </>
        )}
      </Stack>
    </WidgetSurface>
  )
}
