import { useEffect } from 'react'
import { Badge, Box, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { TagBrowseTree } from './TagBrowseTree'
import { useTagBrowse } from './useTagBrowse'
import { formatTagValue, tagTypeLabel } from './tagBrowseUtils'
import type { BrowseTag } from '../../lib/tags'

interface TagPickerModalProps {
  opened: boolean
  onClose: () => void
  connectionId: string | null
  signalName: string
  onSelect: (tag: BrowseTag) => void
}

export function TagPickerModal({ opened, onClose, connectionId, signalName, onSelect }: TagPickerModalProps) {
  const {
    browse,
    loading,
    loadingProgress,
    filter,
    selected,
    scrollTop,
    values,
    rows,
    toggle,
    setFilter,
    setSelected,
    setScrollTop,
    resetBrowseState,
  } = useTagBrowse(opened ? connectionId : null)

  useEffect(() => {
    if (opened) resetBrowseState()
    else setSelected(null)
  }, [opened, resetBrowseState, setSelected])

  const supportsBrowsing = browse?.supportsBrowsing ?? false
  const selectedSample = selected?.bindable ? values[selected.fullPath] : undefined
  const selectedValue = formatTagValue(selectedSample)

  function confirm() {
    if (!selected?.bindable) return
    onSelect(selected)
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Select PLC tag" size="lg" centered>
      <Stack gap="md">
        <Box>
          <Text size="sm" fw={600}>
            Signal: {signalName}
          </Text>
          <Text size="xs" c="dimmed">
            Browse the controller namespace, expand UDTs, and pick a bindable member. Values refresh every 2 seconds.
          </Text>
        </Box>
        <TagBrowseTree
          supportsBrowsing={supportsBrowsing}
          loading={loading}
          loadingProgress={loadingProgress}
          filter={filter}
          onFilterChange={setFilter}
          rows={rows}
          selected={selected}
          onSelect={setSelected}
          onToggle={toggle}
          values={values}
          scrollTop={scrollTop}
          onScrollTopChange={setScrollTop}
          viewportHeight={400}
        />
        {selected?.bindable ? (
          <Box
            p="sm"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
              background: 'var(--mantine-color-gray-light)',
            }}
          >
            <Stack gap={4}>
              <Group gap="xs">
                <Text size="sm" fw={600}>
                  Selected tag
                </Text>
                <Badge size="sm" variant="light">
                  {tagTypeLabel(selected)}
                </Badge>
              </Group>
              <Text size="sm" ff="monospace" style={{ wordBreak: 'break-all' }}>
                {selected.fullPath}
              </Text>
              <Group gap="xs">
                <Text size="sm" c="dimmed">
                  Live value:
                </Text>
                <Text size="sm" ff="monospace" c={selectedValue.color}>
                  {selectedValue.text}
                </Text>
                {selectedSample ? (
                  <>
                    <Badge
                      size="xs"
                      color={selectedSample.quality === 'Good' ? 'green' : 'red'}
                      variant="light"
                    >
                      {selectedSample.quality}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {new Date(selectedSample.timestampUtc).toLocaleTimeString()}
                    </Text>
                  </>
                ) : null}
              </Group>
            </Stack>
          </Box>
        ) : selected ? (
          <Text size="sm" c="dimmed">
            Expand the tree and select a bindable tag (not a container node).
          </Text>
        ) : null}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selected?.bindable}>
            Select tag
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
