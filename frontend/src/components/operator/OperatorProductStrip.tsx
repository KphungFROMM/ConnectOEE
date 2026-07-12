import { useEffect, useMemo, useState } from 'react'
import { Alert, Anchor, Badge, Button, Group, Paper, Select, Stack, Text } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { Link } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { getLineProductionContext } from '../../lib/hierarchy'
import { listRecipes, selectMachineRecipe, type RecipeDto } from '../../lib/admin'
import { idealCycleSourceLabel } from '../../lib/idealRate'
import { changeoverModeHint } from '../../lib/productChange'
import type { MachineSnapshot } from '../../lib/liveHub'
import { useAuth } from '../../lib/auth'
import { Permissions } from '../../lib/permissions'
import { ProductSelectModal } from './ProductSelectModal'

interface Props {
  lineId: string
  machineId: string
  machine: MachineSnapshot
  canSelect: boolean
}

export function OperatorProductStrip({ lineId, machineId, machine, canSelect }: Props) {
  const { hasPermission } = useAuth()
  const canManageProducts = hasPermission(Permissions.ManageProducts)
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getLineProductionContext>> | null>(null)
  const [recipes, setRecipes] = useState<RecipeDto[]>([])
  const [modalOpen, setModalOpen] = useState(false)

  const reload = () => {
    void getLineProductionContext(lineId).then(setCtx).catch(() => setCtx(null))
    void listRecipes(lineId).then(setRecipes).catch(() => setRecipes([]))
  }
  useEffect(reload, [lineId])

  const activeRecipeId = useMemo(
    () => recipes.find((r) => r.code === machine.activeRecipeCode)?.id ?? ctx?.activeRecipeId ?? null,
    [recipes, machine.activeRecipeCode, ctx?.activeRecipeId],
  )

  const recipeOptions = useMemo(
    () => recipes.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` })),
    [recipes],
  )

  const safeActiveRecipeId = useMemo(
    () => (activeRecipeId && recipeOptions.some((o) => o.value === activeRecipeId) ? activeRecipeId : null),
    [activeRecipeId, recipeOptions],
  )

  const sourceLabel = machine.idealCycleSource
    ? idealCycleSourceLabel(machine.idealCycleSource)
    : ctx?.productSource === 'plc'
      ? 'PLC PartId'
      : ctx?.productSource === 'manual'
        ? 'Manual selection'
        : ctx?.productSource === 'auto'
          ? 'Auto-created from PLC'
          : 'Not assigned'

  const mode = ctx?.changeoverMode ?? 'SetupTracked'
  const plcLocked = ctx?.plcPartIdMapped ?? false

  async function pickProduct(recipeId: string | null) {
    if (plcLocked) {
      notifications.show({ message: 'Product is driven by PLC PartId', color: 'orange' })
      return
    }
    try {
      await selectMachineRecipe(machineId, recipeId)
      notifications.show({
        message: mode === 'LogOnly' ? 'Product updated' : 'Product updated — setup changeover started',
        color: 'green',
      })
      reload()
    } catch (e) {
      notifications.show({ message: e instanceof Error ? e.message : 'Failed to select product', color: 'red' })
    }
  }

  const productName = machine.activeRecipeName ?? ctx?.activeRecipeName ?? machine.activeRecipeCode ?? 'No product assigned'
  const productCode = machine.activeRecipeCode ?? ctx?.activeRecipeCode ?? '—'

  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={4} style={{ flex: 1, minWidth: 200 }}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Active product
          </Text>
          <Text fw={700} size="lg">
            {productName}
          </Text>
          <Text size="sm" c="dimmed">
            {productCode}
            {machine.idealCycleTimeSec ? ` · ${machine.idealCycleTimeSec.toFixed(2)}s cycle` : ''}
            {machine.idealRatePph ? ` · ${machine.idealRatePph.toFixed(0)} pph ideal` : ''}
            {sourceLabel ? ` · ${sourceLabel}` : ''}
          </Text>
          <Text size="xs" c="dimmed">
            {changeoverModeHint(mode)}
          </Text>
        </Stack>

        {machine.recipeIsAutoCreated ? (
          canManageProducts ? (
            <Anchor component={Link} to="/admin?tab=recipes&recipesTab=review" size="sm">
              <Badge color="orange" variant="light" style={{ cursor: 'pointer' }}>
                Auto-created — set ideal cycle
              </Badge>
            </Anchor>
          ) : (
            <Badge color="orange" variant="light">
              Auto-created — set ideal cycle
            </Badge>
          )
        ) : null}

        {canSelect && !plcLocked ? (
          isDesktop ? (
            <Select
              label="Change product"
              placeholder="Choose product"
              data={recipeOptions}
              value={safeActiveRecipeId}
              onChange={(v) => void pickProduct(v)}
              onClear={() => void pickProduct(null)}
              searchable
              clearable
              rightSectionPointerEvents="all"
              w={280}
            />
          ) : (
            <Button variant="light" onClick={() => setModalOpen(true)}>
              Change product
            </Button>
          )
        ) : plcLocked ? (
          <Text size="sm" c="dimmed" maw={280}>
            Product is driven by PLC PartId on this line.
          </Text>
        ) : null}
      </Group>

      {mode === 'SetupTracked' && ctx?.changeoverOpen ? (
        <Alert color="yellow" variant="light" title="Changeover in progress" mt="sm">
          {ctx.changeoverReason ?? 'Setup until line returns to Running'}
        </Alert>
      ) : null}

      {ctx?.recentProductChanges && ctx.recentProductChanges.length > 0 ? (
        <Stack gap={4} mt="sm">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Recent product changes
          </Text>
          {ctx.recentProductChanges.slice(0, 3).map((c, i) => (
            <Text key={`${c.changedUtc}-${i}`} size="sm">
              {c.fromProductId ? `${c.fromProductId} → ` : ''}
              <strong>{c.toProductId}</strong>
              {' · '}
              {new Date(c.changedUtc).toLocaleString()}
            </Text>
          ))}
        </Stack>
      ) : null}

      <ProductSelectModal
        opened={modalOpen}
        lineId={lineId}
        machineId={machineId}
        onClose={() => setModalOpen(false)}
        onSelected={reload}
      />
    </Paper>
  )
}
