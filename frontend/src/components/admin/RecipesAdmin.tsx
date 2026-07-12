import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Select,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
} from '@mantine/core'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import {
  createRecipe,
  deleteRecipe,
  getLineOee,
  listLineRates,
  listRecipeLineRates,
  listRecipes,
  updateRecipe,
  upsertLineRate,
  type LineRateDto,
  type RecipeDto,
  type RecipeLineRateRowDto,
} from '../../lib/admin'
import { cycleSecToPph } from '../../lib/idealRate'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'

interface RecipesAdminProps {
  initialLineId?: string
  initialTab?: string
  /** Called when auto-created count may have changed (parent badge refresh). */
  onAutoCreatedCountChange?: (count: number) => void
}

export function RecipesAdmin({ initialLineId, initialTab, onAutoCreatedCountChange }: RecipesAdminProps) {
  const [tab, setTab] = useState<string | null>(initialTab ?? 'catalog')
  const [autoCreatedCount, setAutoCreatedCount] = useState(0)

  const refreshAutoCount = useCallback(() => {
    void listRecipes(undefined, true)
      .then((rows) => {
        setAutoCreatedCount(rows.length)
        onAutoCreatedCountChange?.(rows.length)
      })
      .catch(() => {
        setAutoCreatedCount(0)
        onAutoCreatedCountChange?.(0)
      })
  }, [onAutoCreatedCountChange])

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  useEffect(() => {
    refreshAutoCount()
  }, [refreshAutoCount])

  return (
    <Tabs value={tab} onChange={setTab}>
      <Tabs.List>
        <Tabs.Tab value="catalog">Product catalog</Tabs.Tab>
        <Tabs.Tab value="line-speeds">Line speeds</Tabs.Tab>
        <Tabs.Tab
          value="review"
          rightSection={
            autoCreatedCount > 0 ? (
              <Badge size="sm" color="orange" variant="filled" circle>
                {autoCreatedCount}
              </Badge>
            ) : undefined
          }
        >
          Auto-created review
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="catalog" pt="md">
        <CatalogTab />
      </Tabs.Panel>
      <Tabs.Panel value="line-speeds" pt="md">
        <LineSpeedsTab initialLineId={initialLineId} />
      </Tabs.Panel>
      <Tabs.Panel value="review" pt="md">
        <ReviewTab onReviewed={refreshAutoCount} />
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
          <TextInput
            label="Default ideal cycle (sec)"
            type="number"
            value={String(idealCycle)}
            onChange={(e) => setIdealCycle(Number(e.currentTarget.value) || 2)}
          />
          <TextInput
            label="Target qty"
            description="Plant-wide default order size for attainment when no line override exists."
            type="number"
            value={targetQty === '' ? '' : String(targetQty)}
            onChange={(e) => setTargetQty(e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))}
          />
          <Switch label="Active" checked={isActive} onChange={(e) => setIsActive(e.currentTarget.checked)} />
          <Button onClick={save} disabled={!code.trim()}>
            {editId ? 'Update' : 'Add'}
          </Button>
        </Group>
      </Card>
      <ProductTable
        items={items}
        onEdit={(r) => {
          setEditId(r.id)
          setCode(r.code)
          setName(r.name)
          setPlcAlias(r.plcAlias ?? '')
          setIdealCycle(r.idealCycleTimeSec)
          setTargetQty(r.targetQuantity ?? '')
          setIsActive(r.isActive)
        }}
        onDelete={async (id) => {
          await deleteRecipe(id)
          reload()
        }}
      />
    </Stack>
  )
}

function LineSpeedsTab({ initialLineId }: { initialLineId?: string }) {
  const [tree, setTree] = useState<PlantNode[]>([])
  const [lineId, setLineId] = useState<string | null>(initialLineId ?? null)
  const [rates, setRates] = useState<LineRateDto[]>([])
  const [noProductTracking, setNoProductTracking] = useState(false)

  const lineOpts = tree.flatMap((p) =>
    p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${p.name} / ${d.name} / ${l.name}` }))),
  )

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
        Per-line overrides take priority over catalog defaults when a product is active. Resolution: line speed → catalog →
        line fallback. Line-specific target quantities drive run attainment for the same SKU on different lines.
      </Text>
      <Select label="Line" data={lineOpts} value={lineId} onChange={setLineId} searchable placeholder="Pick a line" />
      {noProductTracking && lineId ? (
        <Alert color="blue" variant="light" title="No product tracking">
          This line uses the line fallback rate only. Change the operating profile in Admin → Hierarchy to enable per-product
          speeds.
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
                <LineRateRow
                  key={r.productRecipeId}
                  lineId={lineId}
                  rate={r}
                  onSaved={() => listLineRates(lineId).then(setRates)}
                />
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

function ReviewTab({ onReviewed }: { onReviewed?: () => void }) {
  const [items, setItems] = useState<RecipeDto[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(() => {
    setLoading(true)
    void listRecipes(undefined, true)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Products auto-created from unknown PLC PartIds. Set the catalog default cycle, then set{' '}
        <strong>line speeds</strong> for every line that runs this SKU. Independent lines share one line+SKU rate across peer
        machines (not a per-machine table). Continuous lines use the same line rate for pacing/output.
      </Text>
      {loading ? (
        <Text size="sm" c="dimmed">
          Loading…
        </Text>
      ) : items.length === 0 ? (
        <Alert color="green" variant="light" title="All caught up">
          No auto-created products awaiting review.
        </Alert>
      ) : (
        items.map((r) => (
          <ReviewCard
            key={r.id}
            recipe={r}
            onDone={() => {
              reload()
              onReviewed?.()
            }}
          />
        ))
      )}
    </Stack>
  )
}

function ReviewCard({ recipe, onDone }: { recipe: RecipeDto; onDone: () => void }) {
  const [name, setName] = useState(recipe.name)
  const [cycle, setCycle] = useState(String(recipe.idealCycleTimeSec))
  const [lineRows, setLineRows] = useState<RecipeLineRateRowDto[]>([])
  const [lineCycles, setLineCycles] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const loadLines = useCallback(() => {
    void listRecipeLineRates(recipe.id)
      .then((rows) => {
        setLineRows(rows)
        const map: Record<string, string> = {}
        for (const row of rows) {
          map[row.lineId] = row.idealCycleTimeSec != null ? String(row.idealCycleTimeSec) : String(recipe.idealCycleTimeSec)
        }
        setLineCycles(map)
      })
      .catch(() => setLineRows([]))
  }, [recipe.id, recipe.idealCycleTimeSec])

  useEffect(loadLines, [loadLines])

  async function saveAndMarkReviewed() {
    setSaving(true)
    try {
      const ideal = Number(cycle) || recipe.idealCycleTimeSec || 2
      await updateRecipe(recipe.id, {
        lineId: null,
        code: recipe.code,
        name: name.trim() || recipe.code,
        plcAlias: recipe.plcAlias,
        idealCycleTimeSec: ideal,
        targetQuantity: recipe.targetQuantity,
        isActive: recipe.isActive,
        isAutoCreated: false,
      })
      for (const row of lineRows) {
        const sec = Number(lineCycles[row.lineId])
        if (!Number.isFinite(sec) || sec <= 0) continue
        await upsertLineRate(row.lineId, recipe.id, { idealCycleTimeSec: sec })
      }
      notifications.show({ message: `${recipe.code} reviewed — removed from auto-created queue`, color: 'green' })
      onDone()
    } catch {
      notifications.show({ message: 'Failed to save review', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  async function saveLineOnly(lineId: string) {
    const sec = Number(lineCycles[lineId]) || recipe.idealCycleTimeSec || 2
    try {
      await upsertLineRate(lineId, recipe.id, { idealCycleTimeSec: sec })
      notifications.show({ message: 'Line speed saved', color: 'green' })
      loadLines()
      onDone()
    } catch {
      notifications.show({ message: 'Failed to save line speed', color: 'red' })
    }
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="wrap">
          <Group gap="sm">
            <Badge color="orange" variant="light">
              Auto-created
            </Badge>
            <Text fw={700}>{recipe.code}</Text>
            <Text size="sm" c="dimmed">
              PLC alias: {recipe.plcAlias ?? '—'}
            </Text>
          </Group>
        </Group>

        <Group grow align="flex-end">
          <TextInput label="Name" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <TextInput
            label="Catalog default cycle (sec)"
            type="number"
            value={cycle}
            onChange={(e) => setCycle(e.currentTarget.value)}
            description={`${cycleSecToPph(Number(cycle) || 2)} pph`}
          />
        </Group>

        <div>
          <Text fw={600} size="sm" mb={6}>
            Line speeds
          </Text>
          <Text size="xs" c="dimmed" mb="xs">
            Set cycle for each line that runs this SKU. Independent peer machines on a line share that line rate.
          </Text>
          {lineRows.length === 0 ? (
            <Text size="sm" c="dimmed">
              No lines in hierarchy yet.
            </Text>
          ) : (
            <Table fz="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Plant / Line</Table.Th>
                  <Table.Th>Topology</Table.Th>
                  <Table.Th>Cycle (sec)</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lineRows.map((row) => (
                  <Table.Tr key={row.lineId}>
                    <Table.Td>
                      {row.plantName} / {row.lineName}
                      {row.hasOverride ? (
                        <Badge ml={6} size="xs" variant="light" color="blue">
                          Override
                        </Badge>
                      ) : (
                        <Badge ml={6} size="xs" variant="light" color="gray">
                          Using catalog
                        </Badge>
                      )}
                    </Table.Td>
                    <Table.Td>{row.topology ?? 'Independent'}</Table.Td>
                    <Table.Td>
                      <TextInput
                        size="xs"
                        w={90}
                        value={lineCycles[row.lineId] ?? ''}
                        onChange={(e) =>
                          setLineCycles((prev) => ({ ...prev, [row.lineId]: e.currentTarget.value }))
                        }
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6}>
                        <Button size="xs" variant="light" onClick={() => void saveLineOnly(row.lineId)}>
                          Save line
                        </Button>
                        <Anchor
                          component={Link}
                          to={`/admin?tab=recipes&recipesTab=line-speeds&lineId=${row.lineId}`}
                          size="xs"
                        >
                          Open Line speeds
                        </Anchor>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </div>

        <Group justify="flex-end">
          <Button onClick={() => void saveAndMarkReviewed()} loading={saving}>
            Save catalog &amp; mark reviewed
          </Button>
        </Group>
      </Stack>
    </Card>
  )
}

function ProductTable({
  items,
  onEdit,
  onDelete,
}: {
  items: RecipeDto[]
  onEdit: (r: RecipeDto) => void
  onDelete: (id: string) => Promise<void>
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
          <Table.Th />
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
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  )
}
