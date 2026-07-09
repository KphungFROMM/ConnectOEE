import { Anchor, Breadcrumbs, Group, Text } from '@mantine/core'
import type { PlantNode } from '../../lib/hierarchy'
import type { EntityLevel } from '../../lib/historian'

export interface BreadcrumbSegment {
  level: EntityLevel
  id: string
  name: string
}

interface Props {
  plant: PlantNode | null
  deptId: string | null
  lineId: string | null
  machineId: string | null
  onNavigate: (seg: BreadcrumbSegment | null) => void
}

export function ScopeBreadcrumb({ plant, deptId, lineId, machineId, onNavigate }: Props) {
  if (!plant) return null

  const segments: BreadcrumbSegment[] = [{ level: 'Plant', id: plant.id, name: plant.name }]
  const dept = plant.departments.find((d) => d.id === deptId)
  if (dept) segments.push({ level: 'Department', id: dept.id, name: dept.name })
  const line = dept?.lines.find((l) => l.id === lineId)
  if (line) segments.push({ level: 'Line', id: line.id, name: line.name })
  const machine = line?.machines.find((m) => m.id === machineId)
  if (machine) segments.push({ level: 'Machine', id: machine.id, name: machine.name })

  return (
    <Breadcrumbs separator="›" separatorMargin={6}>
      {segments.map((seg, i) => (
        <Anchor
          key={seg.id}
          size="sm"
          fw={i === segments.length - 1 ? 700 : 500}
          c={i === segments.length - 1 ? undefined : 'dimmed'}
          onClick={() => onNavigate(i < segments.length - 1 ? seg : null)}
          style={{ cursor: i < segments.length - 1 ? 'pointer' : 'default' }}
        >
          {seg.name}
        </Anchor>
      ))}
    </Breadcrumbs>
  )
}

export function scopeChipLabel(segments: BreadcrumbSegment[]): string {
  return segments.map((s) => s.name).join(' › ')
}

export function ScopeChipRow({ segments }: { segments: BreadcrumbSegment[] }) {
  if (segments.length === 0) return null
  return (
    <Group gap={6}>
      <Text size="xs" c="dimmed">
        Scope
      </Text>
      <Text size="sm" fw={600}>
        {scopeChipLabel(segments)}
      </Text>
    </Group>
  )
}
