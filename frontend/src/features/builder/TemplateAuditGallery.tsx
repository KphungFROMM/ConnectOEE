import { useEffect, useMemo, useState } from 'react'
import { Badge, Card, Group, SegmentedControl, Stack, Text, Title } from '@mantine/core'
import { setAuditApiMode } from './auditApiMode'
import { DashboardRenderer } from '../../components/DashboardRenderer'
import { listTemplates, type DashboardTemplate } from '../../lib/dashboards'
import { createMockWidgetCtx } from './mockWidgetCtx'
import { getTemplateMeta } from './systemTemplateMeta'
import { templateToPreviewDashboard } from './templateAuditUtils'
import { profileForDashboard } from './displayProfiles'
import { dashboardMaxRow, profileContentHeight } from './viewportGrid'

const WALL_FRAME_HEIGHT = profileContentHeight('plantWall')

interface TemplateAuditGalleryProps {
  /** When true, omit full-page chrome for embedding in Admin. */
  embedded?: boolean
}

export function TemplateAuditGallery({ embedded = false }: TemplateAuditGalleryProps) {
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('light')
  const [templates, setTemplates] = useState<DashboardTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const mockCtx = useMemo(() => createMockWidgetCtx(), [])

  useEffect(() => {
    setAuditApiMode(true)
    return () => setAuditApiMode(false)
  }, [])

  useEffect(() => {
    void listTemplates()
      .then((rows) => setTemplates(rows.filter((t) => t.layoutJson)))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false))
  }, [])

  const sorted = useMemo(
    () =>
      [...templates]
        .filter((t) => getTemplateMeta(t.name))
        .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)),
    [templates],
  )

  return (
    <Stack
      gap="xl"
      p={embedded ? 0 : 'md'}
      data-mantine-color-scheme={colorScheme}
      style={
        embedded
          ? undefined
          : { minHeight: '100vh', background: 'var(--mantine-color-body)' }
      }
    >
      <Group justify="space-between" wrap="wrap">
        <div>
          <Title order={embedded ? 3 : 2}>Template Audit Gallery (v8)</Title>
          <Text size="sm" c="dimmed">
            Curated system templates in a 1080p wall frame — no scroll, wall-fit preview with the v8 visual language.
            Screenshot each in light and dark at 1920×1080 for QA.
          </Text>
        </div>
        <SegmentedControl
          value={colorScheme}
          onChange={(v) => setColorScheme(v as 'light' | 'dark')}
          data={[
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
        />
      </Group>

      {loading ? (
        <Text c="dimmed">Loading templates…</Text>
      ) : sorted.length === 0 ? (
        <Text c="dimmed">No templates with layout data. Sign in with build permission and ensure v8 seed ran.</Text>
      ) : (
        sorted.map((t) => {
          const meta = getTemplateMeta(t.name)
          const dashboard = templateToPreviewDashboard(t)
          const wallProfile = profileForDashboard(t.category === 'Kiosk' ? 'PublicKiosk' : 'RoleRestricted', t.name)
          const maxRow = dashboardMaxRow(dashboard.widgets)
          const budget = wallProfile === 'kioskWall' ? 8 : 9
          const withinBudget = maxRow <= budget
          return (
            <Card
              key={t.id}
              withBorder
              padding="md"
              radius="md"
              id={`template-audit-${meta?.slug ?? t.id}`}
            >
              <Stack gap="sm">
                <Group justify="space-between" wrap="wrap">
                  <div>
                    <Group gap="xs">
                      <Title order={4}>{t.name}</Title>
                      <Badge variant="light">{t.category}</Badge>
                      {meta?.recommended ? (
                        <Badge color="blue" variant="filled">
                          Recommended
                        </Badge>
                      ) : null}
                      <Badge color={withinBudget ? 'teal' : 'red'} variant="light">
                        {maxRow}/{budget} rows
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {meta?.bestFor ?? t.description}
                    </Text>
                  </div>
                  <Group gap={6}>
                    {meta?.roles.map((r) => (
                      <Badge key={r} size="sm" variant="outline" color="gray">
                        {r}
                      </Badge>
                    ))}
                    <Badge size="sm" variant="outline">
                      {meta?.scope ?? 'line'} scope
                    </Badge>
                    <Badge size="sm" variant="outline">
                      {t.widgetCount ?? dashboard.widgets.length} widgets
                    </Badge>
                  </Group>
                </Group>
                <div
                  data-wall-frame
                  data-template-slug={meta?.slug ?? t.id}
                  style={{
                    width: '100%',
                    maxWidth: 1920,
                    aspectRatio: '16 / 9',
                    height: WALL_FRAME_HEIGHT,
                    borderRadius: 12,
                    border: '1px solid var(--mantine-color-default-border)',
                    background: 'var(--mantine-color-body)',
                    overflow: 'hidden',
                  }}
                >
                  <DashboardRenderer
                    dashboard={dashboard}
                    displayMode="wallFit"
                    wallProfile={wallProfile}
                    containerHeight={WALL_FRAME_HEIGHT}
                    mockCtx={mockCtx}
                  />
                </div>
              </Stack>
            </Card>
          )
        })
      )}
    </Stack>
  )
}
