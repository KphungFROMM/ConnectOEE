import { Anchor, Card, ScrollArea, Stack, Tabs, Text, TextInput } from '@mantine/core'
import type { DashboardWidget } from '../../lib/dashboards'
import type { WidgetCtx } from '../../components/widgets/common'
import { widgetMetaByType } from '../../components/widgets/registry'
import { BindingEditor, LayoutFields } from './BindingEditor'
import { WidgetOptionsEditor, hasWidgetOptions } from './WidgetOptionsEditor'
import { DISPLAY_PROFILES, exceedsProfile, type DisplayProfileId } from './displayProfiles'

interface PropertiesPanelProps {
  widget: DashboardWidget | null
  machineId?: string | null
  lineId?: string | null
  ctx: WidgetCtx
  maxRow: number
  displayProfile: DisplayProfileId
  dashId: string | null
  isPublished: boolean
  onChange: (patch: Partial<DashboardWidget>) => void
}

export function PropertiesPanel({
  widget,
  machineId,
  lineId,
  ctx,
  maxRow,
  displayProfile,
  dashId,
  isPublished,
  onChange,
}: PropertiesPanelProps) {
  const budget = DISPLAY_PROFILES[displayProfile].maxRows
  const overBudget = exceedsProfile(maxRow, displayProfile)

  return (
    <Card withBorder padding="sm" w={280} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Text size="xs" fw={700} tt="uppercase" c="dimmed" mb={6}>
        Properties
      </Text>
      <Text size="xs" c={overBudget ? 'red' : 'dimmed'} mb={6}>
        {budget !== null
          ? `${maxRow} / ${budget} rows (${DISPLAY_PROFILES[displayProfile].label})`
          : `${maxRow} rows (freeform)`}
      </Text>
      {isPublished && dashId ? (
        <Anchor href={`/present/${dashId}`} target="_blank" rel="noreferrer" size="xs" mb={6}>
          Open presentation preview
        </Anchor>
      ) : null}
      {!widget ? (
        <Text size="sm" c="dimmed">
          Select a widget to edit its title, binding, and layout.
        </Text>
      ) : (
        <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars>
          <Stack gap="sm">
            <TextInput
              label="Title"
              size="xs"
              value={widget.title ?? ''}
              onChange={(e) => onChange({ title: e.currentTarget.value })}
            />
            <Text size="10px" c="dimmed">
              {widgetMetaByType[widget.type]?.label ?? widget.type}
            </Text>
            <Tabs defaultValue="data" variant="outline">
              <Tabs.List grow>
                <Tabs.Tab value="data" fz="xs">
                  Data
                </Tabs.Tab>
                {hasWidgetOptions(widget.type) ? (
                  <Tabs.Tab value="widget" fz="xs">
                    Widget
                  </Tabs.Tab>
                ) : null}
                <Tabs.Tab value="layout" fz="xs">
                  Layout
                </Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="data" pt="xs">
                <BindingEditor widget={widget} machineId={machineId} lineId={lineId} onChange={onChange} ctx={ctx} />
              </Tabs.Panel>
              {hasWidgetOptions(widget.type) ? (
                <Tabs.Panel value="widget" pt="xs">
                  <WidgetOptionsEditor widget={widget} onChange={onChange} />
                </Tabs.Panel>
              ) : null}
              <Tabs.Panel value="layout" pt="xs">
                <LayoutFields widget={widget} onChange={onChange} />
              </Tabs.Panel>
            </Tabs>
          </Stack>
        </ScrollArea>
      )}
    </Card>
  )
}
