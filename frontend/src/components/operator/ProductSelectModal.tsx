import { useEffect, useMemo, useState } from 'react'

import { Button, Group, Modal, Select, Stack, Text } from '@mantine/core'

import { notifications } from '@mantine/notifications'

import { getLineProductionContext } from '../../lib/hierarchy'

import { listRecipes, selectLineRecipe, selectMachineRecipe, type RecipeDto } from '../../lib/admin'



export type ProductSelectModalVariant = 'manual' | 'afterChangeoverReason'



interface Props {

  opened: boolean

  lineId: string

  machineId?: string

  variant?: ProductSelectModalVariant

  onClose: () => void

  onSelected?: () => void

}



export function ProductSelectModal({

  opened,

  lineId,

  machineId,

  variant = 'manual',

  onClose,

  onSelected,

}: Props) {

  const [recipes, setRecipes] = useState<RecipeDto[]>([])

  const [ctx, setCtx] = useState<Awaited<ReturnType<typeof getLineProductionContext>> | null>(null)

  const [loading, setLoading] = useState(false)

  const [saving, setSaving] = useState(false)

  const [selectedId, setSelectedId] = useState<string | null>(null)



  const afterChangeover = variant === 'afterChangeoverReason'



  useEffect(() => {

    if (!opened) return

    setLoading(true)

    setSelectedId(null)

    void Promise.all([

      listRecipes(lineId).then(setRecipes).catch(() => setRecipes([])),

      getLineProductionContext(lineId).then(setCtx).catch(() => setCtx(null)),

    ]).finally(() => setLoading(false))

  }, [opened, lineId])



  useEffect(() => {

    if (!opened || loading) return

    const initial = ctx?.activeRecipeId ?? null

    setSelectedId(initial)

  }, [opened, loading, ctx?.activeRecipeId])



  const recipeOptions = useMemo(

    () => recipes.filter((r) => r.isActive).map((r) => ({ value: r.id, label: `${r.code} — ${r.name}` })),

    [recipes],

  )



  const safeValue = useMemo(

    () => (selectedId && recipeOptions.some((o) => o.value === selectedId) ? selectedId : null),

    [selectedId, recipeOptions],

  )



  const sameAsActive = Boolean(safeValue && ctx?.activeRecipeId && safeValue === ctx.activeRecipeId)



  async function apply() {

    if (ctx?.plcPartIdMapped) {

      notifications.show({ message: 'Product is driven by PLC PartId on this line', color: 'orange' })

      return

    }

    setSaving(true)

    try {

      if (machineId) await selectMachineRecipe(machineId, safeValue)

      else await selectLineRecipe(lineId, safeValue)

      const mode = ctx?.changeoverMode ?? 'SetupTracked'

      notifications.show({

        message: mode === 'LogOnly' ? 'Product updated' : 'Product updated — setup changeover started',

        color: 'green',

      })

      onSelected?.()

      onClose()

    } catch (e) {

      notifications.show({ message: e instanceof Error ? e.message : 'Failed to select product', color: 'red' })

    } finally {

      setSaving(false)

    }

  }



  return (

    <Modal

      opened={opened}

      onClose={onClose}

      title={afterChangeover ? 'Changeover reason saved' : 'Select product for changeover'}

      centered

      size="md"

    >

      <Stack gap="sm">

        <Text size="sm" c="dimmed">

          {afterChangeover

            ? 'Only change the active product if you switched SKU during this stop. Backfilled reasons do not need a product change.'

            : 'Choose the product now running on this line after changeover.'}

        </Text>

        {ctx?.plcPartIdMapped ? (

          <Text size="sm" c="dimmed">

            Product is set by PLC PartId. Update the tag or ask a supervisor to change the mapping.

          </Text>

        ) : (

          <>

            <Select

              label="Product / recipe"

              placeholder={loading ? 'Loading products…' : 'Choose product'}

              data={recipeOptions}

              value={safeValue}

              onChange={setSelectedId}

              searchable

              clearable

              disabled={loading || saving}

            />

            <Group justify="flex-end" mt="xs">

              <Button variant={afterChangeover ? 'filled' : 'default'} onClick={onClose} disabled={saving}>

                {afterChangeover ? 'Skip' : 'Cancel'}

              </Button>

              <Button

                onClick={() => void apply()}

                loading={saving}

                disabled={loading || !safeValue || sameAsActive}

              >

                Apply product

              </Button>

            </Group>

          </>

        )}

      </Stack>

    </Modal>

  )

}


