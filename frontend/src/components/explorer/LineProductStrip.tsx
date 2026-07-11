import { useEffect, useState } from 'react'
import { Alert, Anchor, Badge, Group, Paper, Select, Stack, Text } from '@mantine/core'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { getLineProductionContext, type NodeKpi } from '../../lib/hierarchy'
import { listRecipes, selectLineRecipe, type RecipeDto } from '../../lib/admin'
import { changeoverModeHint } from '../../lib/productChange'

interface Props {
  lineId: string
  kpi: NodeKpi
  canSelect: boolean
}

export function LineProductStrip({ lineId, kpi, canSelect }: Props) {
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getLineProductionContext>> | null>(null)
  const [recipes, setRecipes] = useState<RecipeDto[]>([])

  const reload = () => {
    void getLineProductionContext(lineId).then(setCtx).catch(() => setCtx(null))
    void listRecipes(lineId).then(setRecipes).catch(() => setRecipes([]))
  }
  useEffect(reload, [lineId])

  async function pickProduct(recipeId: string | null) {
    try {
      await selectLineRecipe(lineId, recipeId)
      const mode = ctx?.changeoverMode ?? 'SetupTracked'
      notifications.show({
        message: mode === 'LogOnly' ? 'Product updated' : 'Product updated — setup changeover started',
        color: 'green',
      })
      reload()
    } catch (e) {
      notifications.show({ message: e instanceof Error ? e.message : 'Failed to select product', color: 'red' })
    }
  }

  const sourceLabel =
    ctx?.productSource === 'plc'
      ? 'PLC PartId'
      : ctx?.productSource === 'manual'
        ? 'Manual selection'
        : ctx?.productSource === 'auto'
          ? 'Auto-created from PLC'
          : 'Not assigned'

  const mode = ctx?.changeoverMode ?? 'SetupTracked'

  return (
    <Paper withBorder p="md" radius="md" id="line-product-strip">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="wrap">
          <div>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Active product
            </Text>
            <Text fw={700} size="lg">
              {ctx?.activeRecipeName ?? kpi.activeRecipeName ?? ctx?.activeRecipeCode ?? 'No product assigned'}
            </Text>
            <Text size="sm" c="dimmed">
              {ctx?.activeRecipeCode ?? kpi.activeRecipeCode ?? '—'} · Ideal {ctx?.idealCycleTimeSec ?? kpi.idealCycleTimeSec}s ·{' '}
              {sourceLabel}
            </Text>
          </div>
          {ctx?.recipeIsAutoCreated ? (
            <Badge color="orange" variant="light">
              Auto-created — set ideal cycle
            </Badge>
          ) : null}
        </Group>

        <Text size="xs" c="dimmed">
          {changeoverModeHint(mode)}
        </Text>

        {mode === 'SetupTracked' && ctx?.changeoverOpen ? (
          <Alert color="yellow" variant="light" title="Changeover in progress">
            {ctx.changeoverReason ?? 'Setup until line returns to Running'}
          </Alert>
        ) : null}

        {canSelect && !ctx?.plcPartIdMapped ? (
          <Select
            label="Change product"
            placeholder="Select product"
            data={recipes.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` }))}
            value={ctx?.activeRecipeId ?? null}
            onChange={(v) => void pickProduct(v)}
            searchable
            clearable
          />
        ) : ctx?.plcPartIdMapped ? (
          <Text size="sm" c="dimmed">
            Product is driven by PLC PartId. Map or unmap in{' '}
            <Anchor component={Link} to="/admin?tab=tags">
              Tag Mapping
            </Anchor>
            .
          </Text>
        ) : null}

        {ctx?.recentProductChanges && ctx.recentProductChanges.length > 0 ? (
          <Stack gap={4}>
            <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
              Recent product changes
            </Text>
            {ctx.recentProductChanges.map((c, i) => (
              <Text key={`${c.changedUtc}-${i}`} size="sm">
                {c.fromProductId ? `${c.fromProductId} → ` : ''}
                <strong>{c.toProductId}</strong>
                {' · '}
                {new Date(c.changedUtc).toLocaleString()}
              </Text>
            ))}
          </Stack>
        ) : null}
      </Stack>
    </Paper>
  )
}
