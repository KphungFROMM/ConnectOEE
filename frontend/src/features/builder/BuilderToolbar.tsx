import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core'
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconDeviceFloppy,
  IconEye,
  IconEyeOff,
  IconHistory,
  IconLayoutGrid,
  IconTemplate,
  IconHandMove,
} from '@tabler/icons-react'
import type { PlantNode } from '../../lib/hierarchy'
import { DISPLAY_PROFILES, exceedsProfile, type DisplayProfileId } from './displayProfiles'

interface BuilderToolbarProps {
  name: string
  scope: string
  isPublished: boolean
  plantId: string | null
  lineId: string | null
  machineId: string | null
  tree: PlantNode[]
  saving: boolean
  autoStatus: 'idle' | 'saving' | 'saved'
  previewMode: boolean
  displayProfile: DisplayProfileId
  maxRow: number
  canUndo: boolean
  canRedo: boolean
  dashId: string | null
  onNameChange: (v: string) => void
  onScopeChange: (v: string) => void
  onPublishedChange: (v: boolean) => void
  onPlantChange: (v: string | null) => void
  onLineChange: (v: string | null) => void
  onMachineChange: (v: string | null) => void
  onDisplayProfileChange: (v: DisplayProfileId) => void
  onSave: () => void
  onBack: () => void
  onVersions: () => void
  onSaveTemplate: () => void
  onOpenTemplates: () => void
  onTogglePreview: () => void
  onUndo: () => void
  onRedo: () => void
  fullWidgetDrag: boolean
  onFullWidgetDragChange: (v: boolean) => void
}

export function BuilderToolbar({
  name,
  scope,
  isPublished,
  plantId,
  lineId,
  machineId,
  tree,
  saving,
  autoStatus,
  previewMode,
  displayProfile,
  maxRow,
  canUndo,
  canRedo,
  dashId,
  onNameChange,
  onScopeChange,
  onPublishedChange,
  onPlantChange,
  onLineChange,
  onMachineChange,
  onDisplayProfileChange,
  onSave,  onBack,
  onVersions,
  onSaveTemplate,
  onOpenTemplates,
  onTogglePreview,
  onUndo,
  onRedo,
  fullWidgetDrag,
  onFullWidgetDragChange,
}: BuilderToolbarProps) {
  const plantOptions = tree.map((p) => ({ value: p.id, label: p.name }))
  const lineOptions = tree.flatMap((p) =>
    p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${p.name} / ${l.name}` }))),
  )
  const line = tree.flatMap((p) => p.departments.flatMap((d) => d.lines)).find((l) => l.id === lineId)
  const machineOptions = (line?.machines ?? []).map((m) => ({ value: m.id, label: m.name }))
  const profileBudget = DISPLAY_PROFILES[displayProfile].maxRows
  const overBudget = exceedsProfile(maxRow, displayProfile)

  return (    <Stack gap="xs">
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <ActionIcon variant="subtle" onClick={onBack} aria-label="Back">
            <IconArrowLeft size={18} />
          </ActionIcon>
          <TextInput value={name} onChange={(e) => onNameChange(e.currentTarget.value)} w={220} size="sm" />
          <Select
            data={['Private', 'RoleRestricted', 'PublicKiosk']}
            value={scope}
            onChange={(v) => onScopeChange(v ?? 'Private')}
            w={140}
            size="sm"
            aria-label="Scope"
          />
          <Switch label="Published" checked={isPublished} onChange={(e) => onPublishedChange(e.currentTarget.checked)} size="sm" />
          {isPublished ? (
            <Badge color="teal" variant="light" size="sm">
              Live
            </Badge>
          ) : (
            <Badge color="gray" variant="light" size="sm">
              Draft
            </Badge>
          )}
        </Group>
        <Group gap="xs" wrap="nowrap">
          {autoStatus !== 'idle' ? (
            <Text size="xs" c="dimmed">
              {autoStatus === 'saving' ? 'Autosaving…' : 'Autosaved'}
            </Text>
          ) : null}
          <Tooltip label="Undo (Ctrl+Z)">
            <ActionIcon variant="default" onClick={onUndo} disabled={!canUndo} aria-label="Undo">
              <IconArrowBackUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Redo (Ctrl+Shift+Z)">
            <ActionIcon variant="default" onClick={onRedo} disabled={!canRedo} aria-label="Redo">
              <IconArrowForwardUp size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={fullWidgetDrag ? 'Drag entire widget' : 'Drag via title bar only'}>
            <ActionIcon
              variant={fullWidgetDrag ? 'filled' : 'default'}
              onClick={() => onFullWidgetDragChange(!fullWidgetDrag)}
              aria-label="Toggle full-widget drag"
            >
              <IconHandMove size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={previewMode ? 'Edit mode' : 'Preview mode'}>
            <ActionIcon variant={previewMode ? 'filled' : 'default'} onClick={onTogglePreview} aria-label="Preview">
              {previewMode ? <IconEyeOff size={16} /> : <IconEye size={16} />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Template gallery">
            <ActionIcon variant="default" onClick={onOpenTemplates} aria-label="Templates">
              <IconLayoutGrid size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Version history">
            <ActionIcon variant="default" onClick={onVersions} disabled={!dashId} aria-label="Versions">
              <IconHistory size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Save as template">
            <ActionIcon variant="default" onClick={onSaveTemplate} disabled={!dashId} aria-label="Save as template">
              <IconTemplate size={16} />
            </ActionIcon>
          </Tooltip>
          <Button leftSection={<IconDeviceFloppy size={16} />} onClick={onSave} loading={saving} size="sm">
            Save
          </Button>
        </Group>
      </Group>
      <Group gap="xs" wrap="wrap" align="center">
        <SegmentedControl
          size="xs"
          value={displayProfile}
          onChange={(v) => onDisplayProfileChange(v as DisplayProfileId)}
          data={[
            { label: 'Wall 1080p', value: 'plantWall' },
            { label: 'Kiosk 1080p', value: 'kioskWall' },
            { label: 'Freeform', value: 'builderFreeform' },
          ]}
        />
        {profileBudget !== null ? (
          <Badge color={overBudget ? 'red' : 'gray'} variant={overBudget ? 'filled' : 'light'} size="sm">
            {maxRow} rows · {overBudget ? `exceeds ${profileBudget}-row wall budget` : `${profileBudget}-row budget`}
          </Badge>
        ) : (
          <Badge color="gray" variant="light" size="sm">
            {maxRow} rows · freeform
          </Badge>
        )}
        {isPublished && dashId ? (
          <Anchor href={`/present/${dashId}`} target="_blank" rel="noreferrer" size="xs">
            Open presentation preview
          </Anchor>
        ) : null}
        <Select          placeholder="Bind to plant"
          data={plantOptions}
          value={plantId}
          onChange={(v) => {
            onPlantChange(v)
            if (v && lineId) {
              const linePlant = tree
                .flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ plant: p.id, line: l.id }))))
                .find((x) => x.line === lineId)?.plant
              if (linePlant && linePlant !== v) {
                onLineChange(null)
                onMachineChange(null)
              }
            }
          }}
          searchable
          size="xs"
          w={180}
          clearable
        />
        <Select
          placeholder="Bind to line"
          data={lineOptions}
          value={lineId}
          onChange={(v) => {
            onLineChange(v)
            onMachineChange(null)
            if (v) {
              const pid = tree
                .flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ plant: p.id, line: l.id }))))
                .find((x) => x.line === v)?.plant
              if (pid) onPlantChange(pid)
            }
          }}
          searchable
          size="xs"
          w={240}
          clearable
        />
        <Select
          placeholder="Machine (optional)"
          data={machineOptions}
          value={machineId}
          onChange={onMachineChange}
          disabled={!lineId}
          searchable
          size="xs"
          w={200}
          clearable
        />
      </Group>
    </Stack>
  )
}
