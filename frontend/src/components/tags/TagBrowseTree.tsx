import { useEffect, useRef } from 'react'
import { Badge, Box, Group, Loader, Progress, ScrollArea, Stack, Text, TextInput } from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconSearch } from '@tabler/icons-react'
import type { BrowseTag, FlatRow, TagValueSample } from '../../lib/tags'
import { TAG_ROW_H, TAG_VIEWPORT_H, formatTagValue, tagTypeColor, tagTypeLabel } from './tagBrowseUtils'
import type { TagBrowseLoadingProgress } from './useTagBrowse'

const VIRTUALIZE_THRESHOLD = 250

interface TagBrowseTreeProps {
  supportsBrowsing: boolean
  loading: boolean
  loadingProgress?: TagBrowseLoadingProgress | null
  filter: string
  onFilterChange: (value: string) => void
  rows: FlatRow[]
  selected: BrowseTag | null
  onSelect: (tag: BrowseTag) => void
  onToggle: (path: string) => void
  values: Record<string, TagValueSample>
  scrollTop: number
  onScrollTopChange: (y: number) => void
  viewportHeight?: number
  compact?: boolean
  searchPlaceholder?: string
}

export function TagBrowseTree({
  supportsBrowsing,
  loading,
  loadingProgress = null,
  filter,
  onFilterChange,
  rows,
  selected,
  onSelect,
  onToggle,
  values,
  scrollTop,
  onScrollTopChange,
  viewportHeight = TAG_VIEWPORT_H,
  compact = false,
  searchPlaceholder = 'Search by name, path, or UDT type',
}: TagBrowseTreeProps) {
  const rowH = compact ? 30 : TAG_ROW_H
  const total = rows.length
  const isFiltering = filter.trim().length > 0
  const useVirtualization = !isFiltering && total > VIRTUALIZE_THRESHOLD
  const viewportRef = useRef<HTMLDivElement>(null)

  // Mantine ScrollArea keeps its own scroll offset — reset when the search filter changes.
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport) viewport.scrollTop = 0
    onScrollTopChange(0)
  }, [filter, onScrollTopChange])

  const maxScroll = Math.max(0, total * rowH - viewportHeight)
  const effectiveScrollTop = Math.min(scrollTop, maxScroll)
  const start = useVirtualization ? Math.max(0, Math.floor(effectiveScrollTop / rowH) - 5) : 0
  const end = useVirtualization
    ? Math.min(total, Math.ceil((effectiveScrollTop + viewportHeight) / rowH) + 5)
    : total
  const visibleRows = rows.slice(start, end)

  function renderRow(r: FlatRow, indexInSlice: number) {
    const top = useVirtualization ? (start + indexInSlice) * rowH : undefined
    const isSel = selected?.fullPath === r.tag.fullPath
    const sample = values[r.tag.fullPath]
    const valueCell = r.tag.bindable ? formatTagValue(sample) : null
    const typeLabel = tagTypeLabel(r.tag)
    const truncatedType =
      typeLabel.length > 10 ? `${typeLabel.slice(0, 9)}…` : typeLabel

    return (
      <div
        key={r.tag.fullPath}
        onClick={() => onSelect(r.tag)}
        style={{
          position: useVirtualization ? 'absolute' : undefined,
          top,
          left: 0,
          right: 0,
          height: rowH,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          paddingLeft: 8 + r.depth * 16,
          paddingRight: 8,
          cursor: 'pointer',
          background: isSel ? 'var(--mantine-color-blue-light)' : undefined,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          if (!isSel) e.currentTarget.style.background = 'var(--mantine-color-gray-light)'
        }}
        onMouseLeave={(e) => {
          if (!isSel) e.currentTarget.style.background = ''
        }}
      >
        {r.hasChildren ? (
          <Box
            component="span"
            w={14}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            onClick={(e) => {
              e.stopPropagation()
              onToggle(r.tag.fullPath)
            }}
          >
            {r.expanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </Box>
        ) : (
          <span style={{ width: 14, flexShrink: 0 }} />
        )}
        <Badge
          size="xs"
          color={tagTypeColor(r.tag.dataType)}
          variant="light"
          style={{ flexShrink: 0, maxWidth: compact ? 72 : 88 }}
          title={typeLabel}
        >
          {truncatedType}
        </Badge>
        <Text size={compact ? 'xs' : 'sm'} truncate style={{ flex: 1 }} title={r.tag.fullPath}>
          {r.tag.name}
        </Text>
        {valueCell ? (
          <Text
            size="xs"
            c={valueCell.color ?? 'dimmed'}
            ff="monospace"
            w={72}
            ta="right"
            style={{ flexShrink: 0 }}
          >
            {valueCell.text}
          </Text>
        ) : (
          <Box w={72} style={{ flexShrink: 0 }} />
        )}
      </div>
    )
  }

  return (
    <Stack gap="xs">
      <TextInput
        placeholder={searchPlaceholder}
        leftSection={<IconSearch size={16} />}
        value={filter}
        onChange={(e) => onFilterChange(e.currentTarget.value)}
        disabled={!supportsBrowsing}
        size={compact ? 'xs' : 'sm'}
      />
      {loading ? (
        <Stack gap="xs" py="sm">
          <Group gap="sm" wrap="nowrap">
            <Loader size="sm" />
            <Text size="sm" c="dimmed" style={{ flex: 1 }} lineClamp={2}>
              {loadingProgress?.message ?? 'Loading tags…'}
            </Text>
            {loadingProgress != null ? (
              <Text size="sm" fw={600} ff="monospace" style={{ flexShrink: 0 }}>
                {Math.round(loadingProgress.percent)}%
              </Text>
            ) : null}
          </Group>
          <Progress
            value={loadingProgress?.percent ?? 100}
            animated
            striped={loadingProgress == null || loadingProgress.percent < 100}
            size="sm"
            radius="sm"
          />
        </Stack>
      ) : !supportsBrowsing ? (
        <Text size="sm" c="dimmed">
          No browsable tags for this connection.
        </Text>
      ) : total === 0 ? (
        <Text size="sm" c="dimmed">
          {filter ? `No tags match "${filter}".` : 'No tags found.'}
        </Text>
      ) : (
        <Box
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 'var(--mantine-radius-sm)',
            overflow: 'hidden',
          }}
        >
          <Group
            gap={6}
            px={8}
            py={6}
            wrap="nowrap"
            style={{
              borderBottom: '1px solid var(--mantine-color-default-border)',
              background: 'var(--mantine-color-body)',
            }}
          >
            <Box w={14} style={{ flexShrink: 0 }} />
            <Text size="xs" c="dimmed" fw={600} w={compact ? 72 : 88} style={{ flexShrink: 0 }}>
              Type
            </Text>
            <Text size="xs" c="dimmed" fw={600} style={{ flex: 1 }}>
              Name
            </Text>
            <Text size="xs" c="dimmed" fw={600} w={72} ta="right" style={{ flexShrink: 0 }}>
              Value
            </Text>
          </Group>
          <ScrollArea
            h={viewportHeight}
            type="auto"
            viewportRef={viewportRef}
            onScrollPositionChange={({ y }) => onScrollTopChange(y)}
          >
            {useVirtualization ? (
              <div style={{ height: total * rowH, position: 'relative' }}>
                {visibleRows.map((r, i) => renderRow(r, i))}
              </div>
            ) : (
              <div>{visibleRows.map((r, i) => renderRow(r, i))}</div>
            )}
          </ScrollArea>
        </Box>
      )}
    </Stack>
  )
}
