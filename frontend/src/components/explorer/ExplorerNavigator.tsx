import { useMemo } from 'react'
import { ActionIcon, Badge, Chip, Group, ScrollArea, Select, Stack, Text, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconChevronLeft, IconHome2, IconLayoutSidebar, IconSearch } from '@tabler/icons-react'
import type { useExplorerNav, ExplorerStatusFilter } from '../../lib/useExplorerNav'
import { explorerRunStateColor, oeeExplorerBadgeColor } from '../widgets/common'
import type { ExplorerNode } from './explorerTypes'
import { scopeToParam } from '../../lib/scopeFromUrl'

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
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            flexShrink: 0,
          }}
        />
        <Text size="sm" fw={active ? 700 : 500} truncate style={{ maxWidth: 160 }}>
          {node.name}
        </Text>
        <Badge size="xs" variant="light" color={oeeColorTier}>
          {node.kpi.oeePct.toFixed(0)}%
        </Badge>
      </Group>
    </UnstyledButton>
  )
}

export function ExplorerNavigator({ nav }: { nav: Nav }) {
  const { selected, breadcrumb, searchIndex, select, goHome, statusFilter, setStatusFilter, railOpen, setRailOpen, hubConnected } =
    nav
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

  function handleSearchPick(value: string | null) {
    if (!value) return
    const match = nodeByScope.get(value)
    if (match) select(match)
  }

  return (
    <Stack
      gap={8}
      p="sm"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'var(--mantine-color-body)',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        borderRadius: 12,
        boxShadow: '0 1px 2px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.06)',
      }}
    >
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
                  <Text size="sm" c="dimmed">
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
          onChange={handleSearchPick}
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
    </Stack>
  )
}
