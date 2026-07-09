import { useEffect, useState } from 'react'
import { Alert, Button, Card, Group, Select, Stack, Switch, Table, Tabs, Text, TextInput, Badge } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  createRecipe,
  deleteRecipe,
  getLineOee,
  listLineRates,
  listRecipes,
  updateRecipe,
  upsertLineRate,
  type LineRateDto,
  type RecipeDto,
} from '../../lib/admin'
import { cycleSecToPph } from '../../lib/idealRate'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'

interface RecipesAdminProps {
  initialLineId?: string
  initialTab?: string
}

export function RecipesAdmin({ initialLineId, initialTab }: RecipesAdminProps) {
  const [tab, setTab] = useState<string | null>(initialTab ?? 'catalog')
  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  return (
    <Tabs value={tab} onChange={setTab}>
      <Tabs.List>
        <Tabs.Tab value="catalog">Product catalog</Tabs.Tab>
        <Tabs.Tab value="line-speeds">Line speeds</Tabs.Tab>
        <Tabs.Tab value="review">Auto-created review</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="catalog" pt="md">
        <CatalogTab />
      </Tabs.Panel>
      <Tabs.Panel value="line-speeds" pt="md">
        <LineSpeedsTab initialLineId={initialLineId} />
      </Tabs.Panel>
      <Tabs.Panel value="review" pt="md">
        <ReviewTab />
      </Tabs.Panel>
    </Tabs>
  )
}

function CatalogTab() {
  const [items, setItems] = useState<RecipeDto[]>([])
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [plcAlias, setPlcAlias] = useState('')
  const [idealCycle, setIdealCycle] = useState(2)
  const [targetQty, setTargetQty] = useState<number | ''>('')
  const [isActive, setIsActive] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)

  const reload = () => void listRecipes().then(setItems).catch(() => undefined)
  useEffect(reload, [])

  async function save() {
    try {
      const body = {
        lineId: null,
        code,
        name: name || code,
        plcAlias: plcAlias || null,
        idealCycleTimeSec: idealCycle,
        targetQuantity: targetQty === '' ? null : targetQty,
        isActive,
      }
      if (editId) await updateRecipe(editId, body)
      else await createRecipe(body)
      setEditId(null)
      setCode('')
      setName('')
      reload()
      notifications.show({ message: 'Product saved', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to save', color: 'red' })
    }
  }

  return (
    <Stack>
      <Card withBorder padding="md">
        <Text fw={600} mb="xs">
          {editId ? 'Edit product' : 'Add product'}
        </Text>
        <Group grow align="flex-end">
          <TextInput label="Code / SKU" value={code} onChange={(e) => setCode(e.currentTarget.value)} />
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput label="PLC alias" value={plcAlias} onChange={(e) => setPlcAlias(e.currentTarget.value)} />
          <TextInput label="Default ideal cycle (sec)" type="number" value={String(idealCycle)} onChange={(e) => setIdealCycle(Number(e.currentTarget.value) || 2)} />
          <TextInput label="Target qty" description="Plant-wide default order size for attainment when no line override exists." type="number" value={targetQty === '' ? '' : String(targetQty)} onChange={(e) => setTargetQty(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))} />
          <Switch label="Active" checked={isActive} onChange={(e) => setIsActive(e.currentTarget.checked)} />
          <Button onClick={save} disabled={!code.trim()}>
            {editId ? 'Update' : 'Add'}
          </Button>
        </Group>
      </Card>
      <ProductTable items={items} onEdit={(r) => {
        setEditId(r.id)
        setCode(r.code)
        setName(r.name)
        setPlcAlias(r.plcAlias ?? '')
        setIdealCycle(r.idealCycleTimeSec)
        setTargetQty(r.targetQuantity ?? '')
        setIsActive(r.isActive)
      }} onDelete={async (id) => { await deleteRecipe(id); reload() }} />
    </Stack>
  )
}

function LineSpeedsTab({ initialLineId }: { initialLineId?: string }) {
  const [tree, setTree] = useState<PlantNode[]>([])
  const [lineId, setLineId] = useState<string | null>(initialLineId ?? null)
  const [rates, setRates] = useState<LineRateDto[]>([])
  const [noProductTracking, setNoProductTracking] = useState(false)

  const lineOpts = tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${p.name} / ${d.name} / ${l.name}` }))))

  useEffect(() => {
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])
  useEffect(() => {
    if (initialLineId) setLineId(initialLineId)
  }, [initialLineId])
  useEffect(() => {
    if (!lineId) return
    void listLineRates(lineId).then(setRates).catch(() => setRates([]))
    void getLineOee(lineId)
      .then((cfg) => setNoProductTracking(cfg.productionMode === 'NoProductTracking'))
      .catch(() => setNoProductTracking(false))
  }, [lineId])

  async function applyDefaultToAll(defaultCycle: number) {
    if (!lineId) return
    for (const r of rates) {
      await upsertLineRate(lineId, r.productRecipeId, { idealCycleTimeSec: defaultCycle })
    }
    void listLineRates(lineId).then(setRates)
    notifications.show({ message: 'Applied default cycle to all products on line', color: 'green' })
  }

  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Per-line overrides take priority over catalog defaults when a product is active. Resolution: line speed → catalog → line fallback. Line-specific target quantities drive run attainment for the same SKU on different lines.
      </Text>
      <Select label="Line" data={lineOpts} value={lineId} onChange={setLineId} searchable placeholder="Pick a line" />
      {noProductTracking && lineId ? (
        <Alert color="blue" variant="light" title="No product tracking">
          This line uses the line fallback rate only. Change the operating profile in Admin → Hierarchy to enable per-product speeds.
        </Alert>
      ) : null}
      {lineId && rates.length > 0 && !noProductTracking ? (
        <>
          <Group>
            <Button variant="light" size="xs" onClick={() => applyDefaultToAll(rates[0]?.defaultCycleSec ?? 2)}>
              Reset all to product defaults
            </Button>
          </Group>
          <Table fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Product</Table.Th>
                <Table.Th>Catalog default</Table.Th>
                <Table.Th>Line cycle (sec · pph)</Table.Th>
                <Table.Th>Line target qty</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rates.map((r) => (
                <LineRateRow key={r.productRecipeId} lineId={lineId} rate={r} onSaved={() => listLineRates(lineId).then(setRates)} />
              ))}
            </Table.Tbody>
          </Table>
        </>
      ) : lineId ? (
        <Text c="dimmed" size="sm">
          No products in catalog yet.
        </Text>
      ) : null}
    </Stack>
  )
}

function LineRateRow({ lineId, rate, onSaved }: { lineId: string; rate: LineRateDto; onSaved: () => void }) {
  const [cycle, setCycle] = useState(String(rate.effectiveCycleSec))
  const [targetQty, setTargetQty] = useState(rate.targetQuantity != null ? String(rate.targetQuantity) : '')
  return (
    <Table.Tr>
      <Table.Td>{rate.code}</Table.Td>
      <Table.Td>
        {rate.defaultCycleSec}s · {cycleSecToPph(rate.defaultCycleSec)} pph
      </Table.Td>
      <Table.Td>
        <Group gap="xs">
          <TextInput size="xs" w={80} value={cycle} onChange={(e) => setCycle(e.currentTarget.value)} />
          <Text size="xs" c="dimmed">
            {cycleSecToPph(Number(cycle) || rate.defaultCycleSec)} pph
          </Text>
          <Button
            size="xs"
            variant="light"
            onClick={async () => {
              await upsertLineRate(lineId, rate.productRecipeId, {
                idealCycleTimeSec: Number(cycle) || rate.defaultCycleSec,
                targetQuantity: targetQty === '' ? null : Number(targetQty) || null,
              })
              onSaved()
              notifications.show({ message: 'Saved', color: 'green' })
            }}
          >
            Save
          </Button>
        </Group>
      </Table.Td>
      <Table.Td>
        <TextInput
          size="xs"
          w={100}
          placeholder="Catalog default"
          value={targetQty}
          onChange={(e) => setTargetQty(e.currentTarget.value)}
        />
      </Table.Td>
    </Table.Tr>
  )
}

function ReviewTab() {
  const [items, setItems] = useState<RecipeDto[]>([])
  useEffect(() => {
    void listRecipes(undefined, true).then(setItems).catch(() => undefined)
  }, [])
  return (
    <Stack>
      <Text size="sm" c="dimmed">
        Products auto-created from unknown PLC PartIds. Set the correct ideal cycle per line in Line speeds.
      </Text>
      <ProductTable items={items} onEdit={() => undefined} onDelete={async () => undefined} reviewOnly />
    </Stack>
  )
}

function ProductTable({
  items,
  onEdit,
  onDelete,
  reviewOnly,
}: {
  items: RecipeDto[]
  onEdit: (r: RecipeDto) => void
  onDelete: (id: string) => Promise<void>
  reviewOnly?: boolean
}) {
  return (
    <Table fz="sm">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Code</Table.Th>
          <Table.Th>Name</Table.Th>
          <Table.Th>Default cycle</Table.Th>
          <Table.Th>PLC alias</Table.Th>
          <Table.Th>Status</Table.Th>
          {!reviewOnly ? <Table.Th /> : null}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {items.map((r) => (
          <Table.Tr key={r.id}>
            <Table.Td>{r.code}</Table.Td>
            <Table.Td>{r.name}</Table.Td>
            <Table.Td>{r.idealCycleTimeSec}s</Table.Td>
            <Table.Td>{r.plcAlias ?? '—'}</Table.Td>
            <Table.Td>
              {r.isAutoCreated ? (
                <Badge color="orange" variant="light" size="sm">
                  Auto-created
                </Badge>
              ) : (
                '—'
              )}
            </Table.Td>
            {!reviewOnly ? (
              <Table.Td>
                <Group gap={4}>
                  <Button size="xs" variant="light" onClick={() => onEdit(r)}>
                    Edit
                  </Button>
                  <Button size="xs" variant="subtle" color="red" onClick={() => onDelete(r.id)}>
                    Delete
                  </Button>
                </Group>
              </Table.Td>
            ) : null}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
