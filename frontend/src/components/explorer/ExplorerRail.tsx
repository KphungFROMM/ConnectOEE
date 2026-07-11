import { useMemo, useState } from 'react'
import { Badge, Drawer, Group, ScrollArea, Stack, Text, TextInput, UnstyledButton } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconClock, IconSearch } from '@tabler/icons-react'
import type { useExplorerNav } from '../../lib/useExplorerNav'
import { explorerRunStateColor, oeeExplorerBadgeColor } from '../widgets/common'
import { WidgetSurface } from '../widgets/design/WidgetSurface'
import type { ExplorerNode } from './explorerTypes'

type Nav = ReturnType<typeof useExplorerNav>

const LEVEL_INDENT: Record<ExplorerNode['level'], number> = {
  Plant: 0,
  Department: 14,
  Line: 28,
  Machine: 42,
}

/** Last segment of a "Plant › Dept › Line" path — the node's immediate parent, for compact disambiguation. */
function immediateParent(parentPath?: string): string | undefined {
  if (!parentPath) return undefined
  const parts = parentPath.split(' › ')
  return parts[parts.length - 1]
}

function RailRow({ node, active, onClick }: { node: ExplorerNode; active: boolean; onClick: () => void }) {
  return (
    <UnstyledButton onClick={onClick} pl={LEVEL_INDENT[node.level]} py={4} style={{ display: 'block', width: '100%' }}>
      <Group gap={6} wrap="nowrap" justify="space-between">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: explorerRunStateColor(node.kpi.status, node.kpi.connectionState),
              flexShrink: 0,
            }}
          />
          <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
            <Text size="sm" fw={active ? 700 : 500} truncate>
              {node.name}
            </Text>
            {node.level === 'Line' && node.topology === 'Continuous' ? (
              <Text size="10px" c="dimmed" truncate lh={1.2}>
                Continuous{node.lineOutputMachineName ? ` · ${node.lineOutputMachineName}` : ''}
              </Text>
            ) : null}
          </Stack>
        </Group>
        <Badge size="xs" variant="light" color={oeeExplorerBadgeColor(node.kpi.oeePct, node.kpi.connectionState)}>
          {node.kpi.oeePct.toFixed(0)}%
        </Badge>
      </Group>
    </UnstyledButton>
  )
}

/**
 * Compact "recently visited" chip — visually distinct (bordered pill, no indent) from the
 * indented tree rows below, and disambiguated with its immediate parent (e.g. a "Washing"
 * machine shows the line it belongs to) so recents don't read as an ambiguous flat list.
 */
function RecentChip({ node, active, onClick }: { node: ExplorerNode; active: boolean; onClick: () => void }) {
  const parent = immediateParent(node.parentPath)
  return (
    <UnstyledButton onClick={onClick}>
      <Group
        gap={6}
        wrap="nowrap"
        px={8}
        py={4}
        style={{
          borderRadius: 8,
          border: '1px solid var(--mantine-color-default-border)',
          background: active ? 'var(--mantine-color-default-hover)' : 'var(--mantine-color-body)',
          maxWidth: 220,
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: explorerRunStateColor(node.kpi.status, node.kpi.connectionState),
            flexShrink: 0,
          }}
        />
        <Stack gap={0} style={{ minWidth: 0 }}>
          <Text size="xs" fw={600} truncate>
            {node.name}
          </Text>
          {parent ? (
            <Text size="10px" c="dimmed" truncate lh={1.2}>
              {parent}
            </Text>
          ) : null}
        </Stack>
      </Group>
    </UnstyledButton>
  )
}

function RailContent({ nav, onNavigate }: { nav: Nav; onNavigate?: () => void }) {
  const { searchIndex, select, selected, recent } = nav
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return searchIndex
    return searchIndex.filter((n) => n.name.toLowerCase().includes(q))
  }, [search, searchIndex])

  function pick(node: ExplorerNode) {
    select(node)
    onNavigate?.()
  }

  return (
    <Stack gap="xs" h="100%">
      <TextInput
        placeholder="Search hierarchy…"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        size="sm"
      />
      {!search && recent.length > 0 ? (
        <Stack
          gap={6}
          p={8}
          style={{
            borderRadius: 8,
            background: 'var(--mantine-color-default-hover)',
          }}
        >
          <Group gap={4}>
            <IconClock size={12} />
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">
              Recent
            </Text>
          </Group>
          <Group gap={6} wrap="wrap">
            {recent.map((r) => {
              const node = searchIndex.find((n) => n.id === r.id && n.level === r.level)
              if (!node) return null
              return <RecentChip key={`recent-${node.id}`} node={node} active={selected?.id === node.id} onClick={() => pick(node)} />
            })}
          </Group>
        </Stack>
      ) : null}
      <ScrollArea style={{ flex: 1 }} type="auto">
        <Stack gap={1}>
          {!search ? (
            <Text size="xs" c="dimmed" fw={700} tt="uppercase" pb={2}>
              All plants
            </Text>
          ) : null}
          {filtered.map((node) => (
            <RailRow key={`${node.level}-${node.id}`} node={node} active={selected?.id === node.id} onClick={() => pick(node)} />
          ))}
          {filtered.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No matches
            </Text>
          ) : null}
        </Stack>
      </ScrollArea>
    </Stack>
  )
}

export function ExplorerRail({ nav }: { nav: Nav }) {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { railOpen, setRailOpen } = nav

  if (isMobile) {
    return (
      <Drawer opened={railOpen} onClose={() => setRailOpen(false)} title="Quick jump" position="left" size="280px">
        <RailContent nav={nav} onNavigate={() => setRailOpen(false)} />
      </Drawer>
    )
  }

  if (!railOpen) return null

  return (
    <div style={{ width: 280, flexShrink: 0 }}>
      <WidgetSurface tone="neutral" padding="sm" radius="md" style={{ height: '100%', position: 'sticky', top: 0 }}>
        <RailContent nav={nav} />
      </WidgetSurface>
    </div>
  )
}
