import { useState } from 'react'
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core'

export function SaveTemplateModal({
  opened,
  onClose,
  onSave,
}: {
  opened: boolean
  onClose: () => void
  onSave: (body: { name: string; category?: string; description?: string }) => void
}) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('Custom')
  const [description, setDescription] = useState('')
  return (
    <Modal opened={opened} onClose={onClose} title="Save as template" centered>
      <Stack>
        <TextInput label="Template name" value={name} onChange={(e) => setName(e.currentTarget.value)} required />
        <TextInput label="Category" value={category} onChange={(e) => setCategory(e.currentTarget.value)} />
        <TextInput label="Description" value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!name.trim()} onClick={() => onSave({ name: name.trim(), category, description })}>
            Save template
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
