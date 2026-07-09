import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ActionIcon,
  Card,
  Grid,
  Group,
  ScrollArea,
  Stack,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconSearch } from '@tabler/icons-react'
import { getHierarchyTree, type PlantNode } from '../lib/hierarchy'
import { useLiveSnapshots } from '../lib/useLiveSnapshots'
import { ExplorerDetailPanel } from '../components/explorer/ExplorerDetailPanel'
import { applySnapshotsToTree } from '../components/explorer/explorerKpi'
import {
  ConnectionPill,
  ExplorerOeeBadge,
  ExplorerOeeMiniBar,
  ExplorerStatusDot,
} from '../components/explorer/explorerStatus'
import type { ExplorerNode } from '../components/explorer/explorerTypes'

function findNodeFromScope(tree: PlantNode[], scope: string): ExplorerNode | null {
  const [levelRaw, id] = scope.split(':')
  if (!id) return null
  const level = levelRaw as ExplorerNode['level']
  for (const plant of tree) {
    if (level === 'Plant' && plant.id === id) {
      return { level: 'Plant', id: plant.id, name: plant.name, kpi: plant.kpi, plantId: plant.id }
    }
    for (const dept of plant.departments) {
      if (level === 'Department' && dept.id === id) {
        return { level: 'Department', id: dept.id, name: dept.name, kpi: dept.kpi, plantId: plant.id }
      }
      for (const line of dept.lines) {
        if (level === 'Line' && line.id === id) {
          return { level: 'Line', id: line.id, name: line.name, kpi: line.kpi, lineId: line.id, plantId: plant.id }
        }
        for (const machine of line.machines) {
          if (level === 'Machine' && machine.id === id) {
            return {
              level: 'Machine',
              id: machine.id,
              name: machine.name,
              kpi: machine.kpi,
              lineId: line.id,
              machineId: machine.id,
              plantId: plant.id,
            }
          }
        }
      }
    }
  }
  return null
}

export function PlantExplorerPage() {
  const [searchParams] = useSearchParams()
  const scopeParam = searchParams.get('scope')
  const [tree, setTree] = useState<PlantNode[]>([])
  const [selected, setSelected] = useState<ExplorerNode | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])

  const { snapshots } = useLiveSnapshots()
  const liveTree = useMemo(() => applySnapshotsToTree(tree, snapshots), [tree, snapshots])

  useEffect(() => {
    if (!scopeParam || liveTree.length === 0) return
    const node = findNodeFromScope(liveTree, scopeParam)
    if (node) setSelected(node)
  }, [scopeParam, liveTree])

  const selectedFresh = useMemo(() => {
    if (!selected) return null
    for (const p of liveTree) {
      if (p.id === selected.id && selected.level === 'Plant') {
        return { ...selected, kpi: p.kpi, plantId: p.id }
      }
      for (const d of p.departments) {
        if (d.id === selected.id && selected.level === 'Department') {
          return { ...selected, kpi: d.kpi, plantId: p.id }
        }
        for (const l of d.lines) {
          if (l.id === selected.id && selected.level === 'Line') {
            return { ...selected, kpi: l.kpi, lineId: l.id, plantId: p.id }
          }
          for (const m of l.machines) {
            if (m.id === selected.id && selected.level === 'Machine') {
              return {
                ...selected,
                kpi: m.kpi,
                lineId: l.id,
                machineId: m.id,
                plantId: p.id,
              }
            }
          }
        }
      }
    }
    return selected
  }, [liveTree, selected])

  return (
    <Stack>
      <Title order={2}>Plant Explorer</Title>
      <Text size="sm" c="dimmed">
        Browse plant → department → line → machine with live OEE trends, loss charts, and production context.
      </Text>
      <Grid>
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <Card withBorder radius="md" padding="sm">
            <TextInput
              placeholder="Search lines / machines"
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              mb="xs"
            />
            <ScrollArea h={560}>
              {liveTree.map((plant) => (
                <PlantBranch
                  key={plant.id}
                  plant={plant}
                  search={search.toLowerCase()}
                  onSelect={setSelected}
                  selectedId={selected?.id}
                />
              ))}
            </ScrollArea>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
          {selectedFresh ? (
            <ExplorerDetailPanel
              node={selectedFresh}
              tree={liveTree}
              snapshots={snapshots}
              onSelectNode={setSelected}
            />
          ) : (
            <EmptyDetail />
          )}
        </Grid.Col>
      </Grid>
    </Stack>
  )
}

function NodeRow({
  label,
  kpi,
  depth,
  expandable,
  expanded,
  onToggle,
  onSelect,
  active,
  subBadge,
}: {
  label: string
  kpi: ExplorerNode['kpi']
  depth: number
  expandable: boolean
  expanded?: boolean
  onToggle?: () => void
  onSelect: () => void
  active: boolean
  subBadge?: string | null
}) {
  return (
    <Group gap={4} wrap="nowrap" pl={depth * 14} py={3}>
      {expandable ? (
        <ActionIcon variant="subtle" size="sm" onClick={onToggle} aria-label="toggle">
          {expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </ActionIcon>
      ) : (
        <span style={{ width: 22 }} />
      )}
      <ExplorerStatusDot status={kpi.status} connectionState={kpi.connectionState} />
      <UnstyledButton onClick={onSelect} style={{ flex: 1, minWidth: 0 }}>
        <Group justify="space-between" wrap="nowrap" gap={4} align="flex-start">
          <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
            <Text size="sm" fw={active ? 700 : 500} truncate>
              {label}
            </Text>
            <ExplorerOeeMiniBar pct={kpi.oeePct} connectionState={kpi.connectionState} />
          </Stack>
          <Group gap={4} wrap="nowrap" align="flex-start">
            {subBadge ? (
              <Text size="xs" c="blue" fw={600} style={{ maxWidth: 56 }} truncate>
                {subBadge}
              </Text>
            ) : null}
            <ConnectionPill connectionState={kpi.connectionState} />
            <ExplorerOeeBadge pct={kpi.oeePct} connectionState={kpi.connectionState} />
          </Group>
        </Group>
      </UnstyledButton>
    </Group>
  )
}

function PlantBranch({
  plant,
  search,
  onSelect,
  selectedId,
}: {
  plant: PlantNode
  search: string
  onSelect: (s: ExplorerNode) => void
  selectedId?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <NodeRow
        label={plant.name}
        kpi={plant.kpi}
        depth={0}
        expandable
        expanded={open}
        onToggle={() => setOpen((o) => !o)}
        onSelect={() =>
          onSelect({ level: 'Plant', id: plant.id, name: plant.name, kpi: plant.kpi, plantId: plant.id })
        }
        active={selectedId === plant.id}
      />
      {open
        ? plant.departments.map((d) => (
            <DeptBranch key={d.id} plant={plant} dept={d} search={search} onSelect={onSelect} selectedId={selectedId} />
          ))
        : null}
    </div>
  )
}

function DeptBranch({
  plant,
  dept,
  search,
  onSelect,
  selectedId,
}: {
  plant: PlantNode
  dept: PlantNode['departments'][number]
  search: string
  onSelect: (s: ExplorerNode) => void
  selectedId?: string
}) {
  const [open, setOpen] = useState(true)
  return (
    <div>
      <NodeRow
        label={dept.name}
        kpi={dept.kpi}
        depth={1}
        expandable
        expanded={open}
        onToggle={() => setOpen((o) => !o)}
        onSelect={() =>
          onSelect({
            level: 'Department',
            id: dept.id,
            name: dept.name,
            kpi: dept.kpi,
            plantId: plant.id,
          })
        }
        active={selectedId === dept.id}
      />
      {open
        ? dept.lines.map((l) => (
            <LineBranch key={l.id} plant={plant} line={l} search={search} onSelect={onSelect} selectedId={selectedId} />
          ))
        : null}
    </div>
  )
}

function LineBranch({
  plant,
  line,
  search,
  onSelect,
  selectedId,
}: {
  plant: PlantNode
  line: PlantNode['departments'][number]['lines'][number]
  search: string
  onSelect: (s: ExplorerNode) => void
  selectedId?: string
}) {
  const [open, setOpen] = useState(true)
  const machineMatch = (name: string) => !search || name.toLowerCase().includes(search)
  if (search && !machineMatch(line.name) && !line.machines.some((m) => machineMatch(m.name))) return null
  return (
    <div>
      <NodeRow
        label={line.name}
        kpi={line.kpi}
        depth={2}
        expandable={line.machines.length > 0}
        expanded={open}
        onToggle={() => setOpen((o) => !o)}
        onSelect={() =>
          onSelect({
            level: 'Line',
            id: line.id,
            name: line.name,
            kpi: line.kpi,
            lineId: line.id,
            plantId: plant.id,
          })
        }
        active={selectedId === line.id}
        subBadge={line.activeProductCode ?? line.kpi.activeRecipeCode}
      />
      {open
        ? line.machines
            .filter((m) => machineMatch(m.name) || machineMatch(line.name))
            .map((m) => (
              <NodeRow
                key={m.id}
                label={m.name}
                kpi={m.kpi}
                depth={3}
                expandable={false}
                onSelect={() =>
                  onSelect({
                    level: 'Machine',
                    id: m.id,
                    name: m.name,
                    kpi: m.kpi,
                    lineId: line.id,
                    machineId: m.id,
                    plantId: plant.id,
                  })
                }
                active={selectedId === m.id}
              />
            ))
        : null}
    </div>
  )
}

function EmptyDetail() {
  return (
    <Card withBorder radius="md" padding="xl">
      <Stack gap="xs" align="center" py="xl">
        <Text fw={600}>Select a node from the tree</Text>
        <Text c="dimmed" size="sm" ta="center" maw={420}>
          Explore live OEE trends, loss pareto, machine grids, and shift context at any level of your plant hierarchy.
        </Text>
      </Stack>
    </Card>
  )
}
