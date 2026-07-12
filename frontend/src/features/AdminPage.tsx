import { useCallback, useEffect, useState } from 'react'
import { Badge, Button, Group, Stack, Tabs, Title } from '@mantine/core'
import {
  IconBinaryTree2,
  IconPlugConnected,
  IconTags,
  IconCalendarTime,
  IconWand,
  IconServer2,
  IconUsers,
  IconAlertTriangle,
  IconChefHat,
  IconAdjustments,
  IconLayoutGrid,
  IconComponents,
  IconKey,
  IconPalette,
} from '@tabler/icons-react'
import { Link, useSearchParams } from 'react-router-dom'
import { HierarchyEditor, PlcEditor, TagMappingEditor } from '../components/admin/editors'
import { AppearanceAdmin } from '../components/admin/AppearanceAdmin'
import { ShiftAdmin } from '../components/admin/ShiftAdmin'
import { SystemAdmin } from '../components/admin/SystemAdmin'
import { AuditAdmin } from '../components/admin/AuditAdmin'
import { DowntimeReasonsAdmin } from '../components/admin/DowntimeReasonsAdmin'
import { LicenseAdmin } from '../components/admin/LicenseAdmin'
import { UsersAdmin } from '../components/admin/UsersAdmin'
import { RecipesAdmin } from '../components/admin/RecipesAdmin'
import { ControlTagsAdmin } from '../components/admin/ControlTagsAdmin'
import { TemplateAuditGallery } from './builder/TemplateAuditGallery'
import { WidgetAuditGallery } from './builder/WidgetAuditGallery'
import { listRecipes } from '../lib/admin'
import { useAuth } from '../lib/auth'
import { Permissions } from '../lib/permissions'

export function AdminPage() {
  const { hasPermission } = useAuth()
  const canMapTags = hasPermission(Permissions.MapTags)
  const canManageProducts = hasPermission(Permissions.ManageProducts)
  const canViewGalleries =
    hasPermission(Permissions.ManageUsers) || hasPermission(Permissions.BuildDashboards)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'hierarchy'
  const recipesLineId = searchParams.get('lineId') ?? undefined
  const recipesTab = searchParams.get('recipesTab') ?? undefined
  const [autoCreatedRecipeCount, setAutoCreatedRecipeCount] = useState(0)

  const refreshAutoCreatedCount = useCallback(() => {
    if (!canManageProducts) {
      setAutoCreatedRecipeCount(0)
      return
    }
    void listRecipes(undefined, true)
      .then((rows) => setAutoCreatedRecipeCount(rows.length))
      .catch(() => setAutoCreatedRecipeCount(0))
  }, [canManageProducts])

  useEffect(() => {
    refreshAutoCreatedCount()
  }, [refreshAutoCreatedCount, tab])

  function onTabChange(value: string | null) {
    const next = value ?? 'hierarchy'
    if (next === 'hierarchy') {
      setSearchParams({})
      return
    }
    const params: Record<string, string> = { tab: next }
    if (next === 'recipes' && recipesLineId) params.lineId = recipesLineId
    if (next === 'recipes' && recipesTab) params.recipesTab = recipesTab
    setSearchParams(params)
  }

  return (
    <Stack>
      <Group justify="space-between" wrap="wrap">
        <Title order={2}>Admin</Title>
        <Group gap="xs">
          {canViewGalleries ? (
            <>
              <Button
                component={Link}
                to="/admin?tab=templates"
                variant={tab === 'templates' ? 'filled' : 'light'}
                leftSection={<IconLayoutGrid size={16} />}
              >
                Template gallery
              </Button>
              <Button
                component={Link}
                to="/admin?tab=widgets"
                variant={tab === 'widgets' ? 'filled' : 'light'}
                leftSection={<IconComponents size={16} />}
              >
                Widget gallery
              </Button>
            </>
          ) : null}
          {hasPermission(Permissions.RunWizard) || hasPermission(Permissions.ManageHierarchy) ? (
            <Button component={Link} to="/wizard" variant="light" leftSection={<IconWand size={16} />}>
              Run setup wizard
            </Button>
          ) : null}
        </Group>
      </Group>

      <Tabs value={tab} onChange={onTabChange}>
        <Tabs.List>
          <Tabs.Tab value="hierarchy" leftSection={<IconBinaryTree2 size={16} />}>
            Hierarchy
          </Tabs.Tab>
          <Tabs.Tab value="plc" leftSection={<IconPlugConnected size={16} />}>
            PLC Connections
          </Tabs.Tab>
          <Tabs.Tab value="tags" leftSection={<IconTags size={16} />}>
            Tag Mapping
          </Tabs.Tab>
          <Tabs.Tab value="shifts" leftSection={<IconCalendarTime size={16} />}>
            Shifts
          </Tabs.Tab>
          {canMapTags ? (
            <Tabs.Tab value="faults" leftSection={<IconAlertTriangle size={16} />}>
              Reason catalog
            </Tabs.Tab>
          ) : null}
          <Tabs.Tab value="controls" leftSection={<IconAdjustments size={16} />}>
            Control Tags
          </Tabs.Tab>
          <Tabs.Tab
            value="recipes"
            leftSection={<IconChefHat size={16} />}
            rightSection={
              autoCreatedRecipeCount > 0 ? (
                <Badge size="sm" color="orange" variant="filled" circle>
                  {autoCreatedRecipeCount}
                </Badge>
              ) : undefined
            }
          >
            Recipes
          </Tabs.Tab>
          {hasPermission(Permissions.ManageUsers) ? (
            <Tabs.Tab value="users" leftSection={<IconUsers size={16} />}>
              Users
            </Tabs.Tab>
          ) : null}
          {hasPermission(Permissions.ManageUsers) ? (
            <Tabs.Tab value="audit" leftSection={<IconServer2 size={16} />}>
              Audit
            </Tabs.Tab>
          ) : null}
          {hasPermission(Permissions.ManageUsers) ? (
            <Tabs.Tab value="appearance" leftSection={<IconPalette size={16} />}>
              Appearance
            </Tabs.Tab>
          ) : null}
          <Tabs.Tab value="license" leftSection={<IconKey size={16} />}>
            License
          </Tabs.Tab>
          <Tabs.Tab value="system" leftSection={<IconServer2 size={16} />}>
            System
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="hierarchy" pt="md">
          <HierarchyEditor />
        </Tabs.Panel>
        <Tabs.Panel value="plc" pt="md">
          <PlcEditor />
        </Tabs.Panel>
        <Tabs.Panel value="tags" pt="md">
          <TagMappingEditor />
        </Tabs.Panel>
        <Tabs.Panel value="shifts" pt="md">
          <ShiftAdmin />
        </Tabs.Panel>
        {canMapTags ? (
          <Tabs.Panel value="faults" pt="md">
            <DowntimeReasonsAdmin />
          </Tabs.Panel>
        ) : null}
        <Tabs.Panel value="controls" pt="md">
          <ControlTagsAdmin />
        </Tabs.Panel>
        <Tabs.Panel value="recipes" pt="md">
          <RecipesAdmin
            initialLineId={recipesLineId}
            initialTab={recipesTab}
            onAutoCreatedCountChange={setAutoCreatedRecipeCount}
          />
        </Tabs.Panel>
        {hasPermission(Permissions.ManageUsers) ? (
          <Tabs.Panel value="users" pt="md">
            <UsersAdmin />
          </Tabs.Panel>
        ) : null}
        {hasPermission(Permissions.ManageUsers) ? (
          <Tabs.Panel value="audit" pt="md">
            <AuditAdmin />
          </Tabs.Panel>
        ) : null}
        {hasPermission(Permissions.ManageUsers) ? (
          <Tabs.Panel value="appearance" pt="md">
            <AppearanceAdmin />
          </Tabs.Panel>
        ) : null}
        <Tabs.Panel value="license" pt="md">
          <LicenseAdmin />
        </Tabs.Panel>
        {canViewGalleries ? (
          <Tabs.Panel value="templates" pt="md">
            <TemplateAuditGallery embedded />
          </Tabs.Panel>
        ) : null}
        {canViewGalleries ? (
          <Tabs.Panel value="widgets" pt="md">
            <WidgetAuditGallery embedded />
          </Tabs.Panel>
        ) : null}
        <Tabs.Panel value="system" pt="md">
          <SystemAdmin />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
