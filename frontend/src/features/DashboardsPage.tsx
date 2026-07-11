import { useEffect, useMemo, useState } from 'react'

import { useNavigate, useParams } from 'react-router-dom'

import { Button, Group, Modal, Select, Stack, Text, TextInput, Badge, Card, Image, SimpleGrid } from '@mantine/core'

import { useDisclosure } from '@mantine/hooks'

import { notifications } from '@mantine/notifications'

import { IconRefresh } from '@tabler/icons-react'

import {

  applyTemplate,

  getDashboard,

  listDashboards,

  listTemplates,

  refreshSystemLayouts,

  type Dashboard,

  type DashboardSummary,

  type DashboardTemplate,

} from '../lib/dashboards'

import { getHierarchyTree, type PlantNode } from '../lib/hierarchy'

import { useAuth } from '../lib/auth'

import { Permissions } from '../lib/permissions'

import { DashboardActiveView } from './dashboards/DashboardActiveView'

import { DashboardsHub } from './dashboards/DashboardsHub'

import { getTemplateMeta, isPlantScopedTemplateMeta } from './builder/systemTemplateMeta'



export function DashboardsPage() {

  const { hasPermission, ready: authReady, token } = useAuth()

  const navigate = useNavigate()

  const { id: routeId } = useParams<{ id?: string }>()

  const canBuild = hasPermission(Permissions.BuildDashboards)



  const [dashboards, setDashboards] = useState<DashboardSummary[]>([])

  const [templates, setTemplates] = useState<DashboardTemplate[]>([])

  const [tree, setTree] = useState<PlantNode[]>([])

  const [active, setActive] = useState<Dashboard | null>(null)

  const [loadingDetail, setLoadingDetail] = useState(false)

  const [opened, { open, close }] = useDisclosure(false)

  const [refreshOpened, { open: openRefresh, close: closeRefresh }] = useDisclosure(false)

  const [refreshBusy, setRefreshBusy] = useState(false)

  const [applyTemplateId, setApplyTemplateId] = useState<string | null>(null)



  useEffect(() => {

    if (!authReady || !token) return

    void listDashboards().then(setDashboards).catch(() => undefined)

    void listTemplates().then(setTemplates).catch(() => undefined)

    if (canBuild) void getHierarchyTree().then(setTree).catch(() => undefined)

  }, [authReady, token, canBuild])



  useEffect(() => {

    if (!routeId) {

      setActive(null)

      return

    }

    let cancelled = false

    setLoadingDetail(true)

    void getDashboard(routeId)

      .then((d) => {

        if (!cancelled) setActive(d)

      })

      .catch(() => {

        if (!cancelled) {

          setActive(null)

          navigate('/', { replace: true })

        }

      })

      .finally(() => {

        if (!cancelled) setLoadingDetail(false)

      })

    return () => {

      cancelled = true

    }

  }, [routeId, navigate])



  function selectDashboard(id: string) {

    navigate(`/dashboards/${id}`)

  }



  return (

    <Stack>

      {loadingDetail ? (

        <Text c="dimmed" size="sm">

          Loading dashboard…

        </Text>

      ) : active ? (

        <DashboardActiveView

          dashboard={active}

          canBuild={canBuild}

          onBack={() => navigate('/')}

          onEdit={() => navigate(`/builder/${active.id}`)}

          onLayoutUpdated={async () => {

            if (!routeId) return

            const d = await getDashboard(routeId)

            setActive(d)

          }}

        />

      ) : (

        <DashboardsHub

          dashboards={dashboards}

          canBuild={canBuild}

          templates={templates}

          onSelect={selectDashboard}

          onEdit={(id) => navigate(`/builder/${id}`)}

          onNewFromTemplate={open}

          onNewBlank={() => navigate('/builder')}

          onRefreshLayouts={openRefresh}

          onApplyRecommended={(templateId) => {

            setApplyTemplateId(templateId)

            open()

          }}

        />

      )}



      <ApplyTemplateModal

        opened={opened}

        onClose={() => {

          close()

          setApplyTemplateId(null)

        }}

        templates={templates}

        tree={tree}

        initialTemplateId={applyTemplateId}

        onApplied={async (d) => {

          const summaries = await listDashboards().catch(() => dashboards)

          setDashboards(summaries)

          navigate(`/dashboards/${d.id}`)

          close()

          setApplyTemplateId(null)

        }}

      />



      <Modal opened={refreshOpened} onClose={closeRefresh} title="Refresh system dashboard layouts" centered>

        <Stack gap="md">

          <Text size="sm">

            Re-apply the latest built-in template layouts to wizard-generated dashboards (matched by name). Custom

            dashboards and manually edited layouts will not be changed unless their names match a system template pattern.

          </Text>

          <Group justify="flex-end">

            <Button variant="default" onClick={closeRefresh}>

              Cancel

            </Button>

            <Button

              color="blue"

              loading={refreshBusy}

              leftSection={<IconRefresh size={16} />}

              onClick={async () => {

                setRefreshBusy(true)

                try {

                  const result = await refreshSystemLayouts()

                  const andon = result.details?.find((d) => d.name.toLowerCase().includes('andon'))

                  const andonHint =

                    andon && andon.widgetTypes.length > 0

                      ? ` · Andon widgets: ${andon.widgetTypes.join(', ')}`

                      : ''

                  notifications.show({

                    message:

                      result.refreshed > 0

                        ? `Updated ${result.refreshed} dashboard${result.refreshed === 1 ? '' : 's'}${andonHint}`

                        : 'No matching wizard dashboards found',

                    color: result.refreshed > 0 ? 'green' : 'gray',

                  })

                  const summaries = await listDashboards().catch(() => dashboards)

                  setDashboards(summaries)

                  closeRefresh()

                } catch {

                  notifications.show({ message: 'Failed to refresh layouts', color: 'red' })

                } finally {

                  setRefreshBusy(false)

                }

              }}

            >

              Refresh now

            </Button>

          </Group>

        </Stack>

      </Modal>

    </Stack>

  )

}



const PLANT_TEMPLATE_CATEGORIES = new Set(['Plant', 'Executive'])

function isPlantScopedTemplate(t: DashboardTemplate | null) {
  if (!t) return false
  const meta = getTemplateMeta(t.name)
  if (meta) return isPlantScopedTemplateMeta(meta)
  return PLANT_TEMPLATE_CATEGORIES.has(t.category)
}

function ApplyTemplateModal({
  opened,
  onClose,
  templates,
  tree,
  initialTemplateId,
  onApplied,
}: {
  opened: boolean
  onClose: () => void
  templates: DashboardTemplate[]
  tree: PlantNode[]
  initialTemplateId?: string | null
  onApplied: (d: Dashboard) => void
}) {
  const [templateId, setTemplateId] = useState<string | null>(null)

  const [name, setName] = useState('')

  const [plantId, setPlantId] = useState<string | null>(null)

  const [lineId, setLineId] = useState<string | null>(null)

  const [machineId, setMachineId] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (opened && initialTemplateId) setTemplateId(initialTemplateId)
  }, [opened, initialTemplateId])

  const selectedTemplate = templates.find((t) => t.id === templateId) ?? null
  const selectedMeta = selectedTemplate ? getTemplateMeta(selectedTemplate.name) : null
  const plantScoped = isPlantScopedTemplate(selectedTemplate)



  const plantOptions = useMemo(() => tree.map((p) => ({ value: p.id, label: p.name })), [tree])



  const lineOptions = useMemo(

    () =>

      tree.flatMap((p) =>

        p.departments.flatMap((d) =>

          d.lines.map((l) => ({ value: l.id, label: `${p.name} / ${l.name}` })),

        ),

      ),

    [tree],

  )

  const machineOptions = useMemo(() => {

    const line = tree.flatMap((p) => p.departments.flatMap((d) => d.lines)).find((l) => l.id === lineId)

    return (line?.machines ?? []).map((m) => ({ value: m.id, label: m.name }))

  }, [tree, lineId])



  async function submit() {

    if (!templateId) return

    setBusy(true)

    try {

      const d = await applyTemplate({

        templateId,

        name: name.trim() || undefined,

        plantId: plantScoped ? plantId : plantId ?? undefined,

        lineId: plantScoped ? null : lineId,

        machineId: plantScoped ? null : machineId ?? machineOptions[0]?.value ?? null,

      })

      onApplied(d)

      notifications.show({ message: 'Dashboard created', color: 'green' })

      setTemplateId(null)

      setName('')

      setPlantId(null)

      setLineId(null)

      setMachineId(null)

    } catch {

      notifications.show({ message: 'Failed to apply template', color: 'red' })

    } finally {

      setBusy(false)

    }

  }



  return (

    <Modal opened={opened} onClose={onClose} title="Create dashboard from template" centered size="lg">

      <Stack>

        <Text size="sm" c="dimmed">
          Pick a ready-to-go v8 layout, bind it to your plant or line, and start monitoring immediately.
        </Text>

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
          {templates.map((t) => {
            const meta = getTemplateMeta(t.name)
            const selected = templateId === t.id
            return (
              <Card
                key={t.id}
                withBorder
                padding="xs"
                radius="md"
                style={{
                  cursor: 'pointer',
                  outline: selected ? '2px solid var(--mantine-color-blue-filled)' : undefined,
                }}
                onClick={() => setTemplateId(t.id)}
              >
                <Stack gap={4}>
                  {meta ? (
                    <Image
                      src={meta.previewPath}
                      alt=""
                      w="100%"
                      fit="contain"
                      radius="sm"
                      fallbackSrc={`/template-previews/${meta.slug}.svg`}
                      style={{
                        aspectRatio: '16 / 9',
                        background: 'var(--mantine-color-gray-0)',
                      }}
                    />
                  ) : null}
                  <Group gap={6} wrap="wrap">
                    <Text size="sm" fw={600} lineClamp={1}>
                      {t.name}
                    </Text>
                    {meta?.recommended ? (
                      <Badge size="xs" color="blue">
                        Recommended
                      </Badge>
                    ) : null}
                  </Group>
                  <Text size="xs" c="dimmed" lineClamp={2}>
                    {meta?.bestFor ?? t.description}
                  </Text>
                </Stack>
              </Card>
            )
          })}
        </SimpleGrid>

        {selectedTemplate ? (
          <Card withBorder padding="sm" radius="md">
            <Stack gap={4}>
              <Text fw={600}>{selectedTemplate.name}</Text>
              <Text size="sm" c="dimmed">
                {selectedMeta?.bestFor ?? selectedTemplate.description}
              </Text>
              <Group gap={6}>
                {selectedMeta?.roles.map((r) => (
                  <Badge key={r} size="xs" variant="light">
                    {r}
                  </Badge>
                ))}
                <Badge size="xs" variant="outline">
                  {selectedMeta?.scope ?? 'line'} scope
                </Badge>
              </Group>
            </Stack>
          </Card>
        ) : null}

        <TextInput label="Name (optional)" placeholder="Defaults to template name" value={name} onChange={(e) => setName(e.currentTarget.value)} />

        {plantScoped ? (

          <Select

            label="Plant"

            placeholder="Bind to plant"

            data={plantOptions}

            value={plantId}

            onChange={setPlantId}

            searchable

            required

          />

        ) : (

          <>

            <Select

              label="Line"

              placeholder="Bind to line"

              data={lineOptions}

              value={lineId}

              onChange={(v) => {

                setLineId(v)

                setMachineId(null)

                if (v) {

                  const pid = tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ plant: p.id, line: l.id })))).find((x) => x.line === v)?.plant

                  if (pid) setPlantId(pid)

                }

              }}

              searchable

            />

            <Select

              label="Machine (optional)"

              placeholder="Defaults to first machine on line"

              data={machineOptions}

              value={machineId}

              onChange={setMachineId}

              disabled={!lineId}

            />

          </>

        )}

        <Group justify="flex-end">

          <Button variant="default" onClick={onClose}>

            Cancel

          </Button>

          <Button onClick={submit} loading={busy} disabled={!templateId || (plantScoped ? !plantId : !lineId)}>

            Create dashboard

          </Button>

        </Group>

      </Stack>

    </Modal>

  )

}

