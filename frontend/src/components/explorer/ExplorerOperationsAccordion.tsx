import { useEffect, useState } from 'react'

import { Accordion, Badge, Stack, Table, Text, TextInput } from '@mantine/core'

import { notifications } from '@mantine/notifications'

import { listLineRates, upsertLineRate, type LineRateDto } from '../../lib/admin'



interface Props {

  lineId: string

  canManageRates: boolean

}



export function ExplorerOperationsAccordion({ lineId, canManageRates }: Props) {

  const [rates, setRates] = useState<LineRateDto[]>([])



  const reload = () => {

    void listLineRates(lineId).then(setRates).catch(() => setRates([]))

  }

  useEffect(reload, [lineId])



  async function saveRate(recipeId: string, cycle: number) {

    try {

      await upsertLineRate(lineId, recipeId, { idealCycleTimeSec: cycle })

      notifications.show({ message: 'Line speed saved', color: 'green' })

      reload()

    } catch {

      notifications.show({ message: 'Failed to save line speed', color: 'red' })

    }

  }



  if (rates.length === 0) return null



  return (

    <Accordion variant="contained" radius="md">

      <Accordion.Item value="operations">

        <Accordion.Control>

          <Text fw={600}>Line product speeds</Text>

        </Accordion.Control>

        <Accordion.Panel>

          <Stack gap="md">

            <Table fz="xs">

              <Table.Thead>

                <Table.Tr>

                  <Table.Th>Product</Table.Th>

                  <Table.Th>Default</Table.Th>

                  <Table.Th>Line cycle</Table.Th>

                </Table.Tr>

              </Table.Thead>

              <Table.Tbody>

                {rates.map((r) => (

                  <Table.Tr key={r.productRecipeId}>

                    <Table.Td>

                      {r.code}

                      {r.isAutoCreated ? (

                        <Badge size="xs" color="orange" ml={4}>

                          auto

                        </Badge>

                      ) : null}

                    </Table.Td>

                    <Table.Td>{r.defaultCycleSec}s</Table.Td>

                    <Table.Td>

                      {canManageRates ? (

                        <TextInput

                          size="xs"

                          type="number"

                          defaultValue={String(r.effectiveCycleSec)}

                          onBlur={(e) => {

                            const v = Number(e.currentTarget.value)

                            if (v > 0 && v !== r.effectiveCycleSec) void saveRate(r.productRecipeId, v)

                          }}

                          w={80}

                        />

                      ) : (

                        `${r.effectiveCycleSec}s`

                      )}

                    </Table.Td>

                  </Table.Tr>

                ))}

              </Table.Tbody>

            </Table>

          </Stack>

        </Accordion.Panel>

      </Accordion.Item>

    </Accordion>

  )

}

