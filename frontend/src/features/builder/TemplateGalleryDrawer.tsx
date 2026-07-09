import { useEffect, useMemo, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Drawer,
  Group,
  Image,
  Modal,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import { IconStarFilled } from '@tabler/icons-react'
import { listTemplates, type DashboardTemplate } from '../../lib/dashboards'
import { getTemplateMeta, systemTemplateMetaByName } from './systemTemplateMeta'

interface TemplateGalleryDrawerProps {
  opened: boolean
  onClose: () => void
  onApply: (templateId: string) => void
}

const CATEGORY_ORDER = ['Executive', 'Plant', 'Line', 'Shift', 'Analysis', 'Production', 'Kiosk', 'General']

function TemplatePreviewImage({ name }: { name: string }) {
  const meta = getTemplateMeta(name)
  const [failed, setFailed] = useState(false)
  if (!meta || failed) {
    return (
      <div
        style={{
          height: 120,
          borderRadius: 8,
          background: 'linear-gradient(135deg, var(--mantine-color-blue-light) 0%, var(--mantine-color-gray-1) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text size="xs" c="dimmed" fw={600} ta="center" px="sm">
          {name}
        </Text>
      </div>
    )
  }
  return (
    <Image
      src={meta.previewPath}
      alt={`${name} preview`}
      h={120}
      fit="cover"
      radius="md"
      onError={() => setFailed(true)}
      fallbackSrc={`/template-previews/${meta.slug}.svg`}
    />
  )
}

export function TemplateGalleryDrawer({ opened, onClose, onApply }: TemplateGalleryDrawerProps) {
  const [templates, setTemplates] = useState<DashboardTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [confirmTemplate, setConfirmTemplate] = useState<DashboardTemplate | null>(null)

  useEffect(() => {
    if (!opened) return
    setLoading(true)
    void listTemplates()
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [opened])

  const grouped = useMemo(() => {
    const sorted = [...templates].sort((a, b) => {
      const ma = systemTemplateMetaByName.get(a.name)
      const mb = systemTemplateMetaByName.get(b.name)
      if (ma?.recommended && !mb?.recommended) return -1
      if (!ma?.recommended && mb?.recommended) return 1
      return a.name.localeCompare(b.name)
    })
    const map = new Map<string, DashboardTemplate[]>()
    for (const t of sorted) {
      const list = map.get(t.category) ?? []
      list.push(t)
      map.set(t.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a)
      const ib = CATEGORY_ORDER.indexOf(b)
      if (ia >= 0 && ib >= 0) return ia - ib
      if (ia >= 0) return -1
      if (ib >= 0) return 1
      return a.localeCompare(b)
    })
  }, [templates])

  function requestApply(template: DashboardTemplate) {
    setConfirmTemplate(template)
  }

  function confirmApply() {
    if (!confirmTemplate) return
    onApply(confirmTemplate.id)
    setConfirmTemplate(null)
  }

  const confirmMeta = confirmTemplate ? getTemplateMeta(confirmTemplate.name) : null

  return (
    <>
      <Drawer opened={opened} onClose={onClose} title="Template gallery" position="left" size="xl">
        <Stack gap="md">
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Ready-to-go v7 layouts — pick a role-based board and apply to your plant or line.
            </Text>
            <Badge size="sm" variant="light">
              {templates.length} templates
            </Badge>
          </Group>
          {loading ? (
            <Text size="sm" c="dimmed">
              Loading templates…
            </Text>
          ) : templates.length === 0 ? (
            <Text size="sm" c="dimmed">
              No templates available.
            </Text>
          ) : (
            grouped.map(([category, items]) => (
              <Stack key={category} gap="sm">
                <Group gap="xs">
                  <Text fw={700}>{category}</Text>
                  <Badge size="xs" variant="outline" color="gray">
                    {items.length}
                  </Badge>
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
                  {items.map((t) => {
                    const meta = getTemplateMeta(t.name)
                    return (
                      <Card key={t.id} withBorder padding="sm" radius="md" style={{ position: 'relative' }}>
                        {meta?.recommended ? (
                          <Badge
                            color="blue"
                            variant="filled"
                            size="xs"
                            leftSection={<IconStarFilled size={10} />}
                            style={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}
                          >
                            Recommended
                          </Badge>
                        ) : null}
                        <Stack gap="xs">
                          <TemplatePreviewImage name={t.name} />
                          <Text size="sm" fw={700} lineClamp={1}>
                            {t.name}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={2}>
                            {meta?.bestFor ?? t.description}
                          </Text>
                          <Group gap={6}>
                            {meta?.roles.slice(0, 2).map((r) => (
                              <Badge key={r} size="xs" variant="light">
                                {r}
                              </Badge>
                            ))}
                            <Badge size="xs" variant="outline" color="gray">
                              {meta?.scope ?? 'line'}
                            </Badge>
                            <Badge size="xs" variant="outline" color="gray">
                              {t.widgetCount ?? meta?.widgetCount ?? '—'} widgets
                            </Badge>
                          </Group>
                          <Button size="xs" variant="light" onClick={() => requestApply(t)}>
                            Use template
                          </Button>
                        </Stack>
                      </Card>
                    )
                  })}
                </SimpleGrid>
              </Stack>
            ))
          )}
        </Stack>
      </Drawer>

      <Modal
        opened={!!confirmTemplate}
        onClose={() => setConfirmTemplate(null)}
        title="Apply template?"
        centered
      >
        <Stack gap="md">
          {confirmTemplate ? <TemplatePreviewImage name={confirmTemplate.name} /> : null}
          <Text size="sm">
            Replace the current dashboard layout with{' '}
            <Text span fw={600}>
              {confirmTemplate?.name}
            </Text>
            ? {confirmMeta ? ` Best for: ${confirmMeta.bestFor}` : ''} This action can be undone with Ctrl+Z in the
            builder.
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setConfirmTemplate(null)}>
              Cancel
            </Button>
            <Button onClick={confirmApply}>Apply template</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
