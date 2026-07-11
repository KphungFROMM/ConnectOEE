import { useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Group, MultiSelect, Select, Stack, Switch, Table, Text, TextInput } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { PasswordFieldWithRequirements } from '../auth/PasswordFieldWithRequirements'
import {
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
  setUserActive,
  setUserScopes,
  updateUser,
  type ScopeDto,
  type UserDto,
} from '../../lib/admin'
import { getHierarchyTree, type PlantNode } from '../../lib/hierarchy'
import { passwordMeetsPolicy, usernameMeetsPolicy } from '../../lib/passwordPolicy'

const ROLES = ['Admin', 'Manager', 'Supervisor', 'Operator', 'Viewer']

export function UsersAdmin() {
  const [users, setUsers] = useState<UserDto[]>([])
  const [tree, setTree] = useState<PlantNode[]>([])
  const [userName, setUserName] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [roles, setRoles] = useState<string[]>(['Operator'])
  const [editUser, setEditUser] = useState<UserDto | null>(null)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editRoles, setEditRoles] = useState<string[]>([])
  const [editPassword, setEditPassword] = useState('')
  const [editPasswordTouched, setEditPasswordTouched] = useState(false)
  const [scopeUser, setScopeUser] = useState<string | null>(null)
  const [scopePlant, setScopePlant] = useState<string | null>(null)
  const [scopeLine, setScopeLine] = useState<string | null>(null)
  const [scopes, setScopes] = useState<ScopeDto[]>([])
  const [creating, setCreating] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [editError, setEditError] = useState<string | null>(null)
  const [passwordTouched, setPasswordTouched] = useState(false)

  const plantOpts = tree.map((p) => ({ value: p.id, label: p.name }))
  const plantNameById = new Map(tree.map((p) => [p.id, p.name]))
  const lineNameById = new Map(
    tree.flatMap((p) => p.departments.flatMap((d) => d.lines.map((l) => [l.id, l.name] as const))),
  )
  const lineOpts = tree.flatMap((p) =>
    p.departments.flatMap((d) => d.lines.map((l) => ({ value: l.id, label: `${p.name} / ${l.name}` }))),
  )

  const reload = () => {
    void listUsers().then(setUsers).catch(() => undefined)
  }
  useEffect(() => {
    reload()
    void getHierarchyTree().then(setTree).catch(() => undefined)
  }, [])

  function startEdit(u: UserDto) {
    setEditUser(u)
    setEditDisplayName(u.displayName)
    setEditRoles(u.roles)
    setEditPassword('')
    setEditPasswordTouched(false)
    setEditError(null)
    setScopeUser(u.id)
    setScopes(u.scopes)
  }

  function cancelEdit() {
    setEditUser(null)
    setEditError(null)
    setEditPassword('')
    setEditPasswordTouched(false)
  }

  async function saveEdit() {
    if (!editUser) return
    setSavingEdit(true)
    setEditError(null)
    try {
      await updateUser(editUser.id, { displayName: editDisplayName.trim() || editUser.userName, roles: editRoles })
      if (editPassword.trim()) {
        if (!passwordMeetsPolicy(editPassword)) {
          setEditError('Password does not meet policy')
          return
        }
        await resetUserPassword(editUser.id, editPassword)
      }
      await setUserScopes(editUser.id, scopes)
      reload()
      cancelEdit()
      notifications.show({ message: 'User updated', color: 'green' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update user'
      setEditError(message)
      notifications.show({ message, color: 'red' })
    } finally {
      setSavingEdit(false)
    }
  }

  async function addUser() {
    setCreateError(null)
    setCreating(true)
    try {
      await createUser({ userName, password, displayName: displayName || userName, roles })
      setUserName('')
      setPassword('')
      setDisplayName('')
      setPasswordTouched(false)
      reload()
      notifications.show({ message: 'User created', color: 'green' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user'
      setCreateError(message)
      notifications.show({ message, color: 'red' })
    } finally {
      setCreating(false)
    }
  }

  const canCreateUser = usernameMeetsPolicy(userName) && passwordMeetsPolicy(password) && roles.length > 0
  const canSaveEdit = editRoles.length > 0 && (!editPassword || passwordMeetsPolicy(editPassword))

  async function saveScopes() {
    if (!scopeUser) return
    try {
      await setUserScopes(scopeUser, scopes)
      reload()
      notifications.show({ message: 'Scopes updated', color: 'green' })
    } catch {
      notifications.show({ message: 'Failed to update scopes', color: 'red' })
    }
  }

  function addScope() {
    if (!scopePlant) return
    setScopes((prev) => [
      ...prev.filter((s) => !(s.plantId === scopePlant && s.lineId === scopeLine)),
      { plantId: scopePlant, lineId: scopeLine },
    ])
  }

  function scopeLabel(s: ScopeDto) {
    const plant = plantNameById.get(s.plantId) ?? s.plantId.slice(0, 8)
    if (!s.lineId) return plant
    return `${plant} / ${lineNameById.get(s.lineId) ?? s.lineId.slice(0, 8)}`
  }

  return (
    <Stack>
      <Card withBorder padding="lg" radius="md">
        <Text fw={600} mb="md">
          Create user
        </Text>
        <Stack gap="md" maw={440}>
          {createError ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
              {createError}
            </Alert>
          ) : null}
          <TextInput label="Username" value={userName} onChange={(e) => setUserName(e.currentTarget.value)} required />
          <TextInput label="Display name" value={displayName} onChange={(e) => setDisplayName(e.currentTarget.value)} />
          <PasswordFieldWithRequirements
            value={password}
            onChange={setPassword}
            onBlur={() => setPasswordTouched(true)}
            touched={passwordTouched}
            required
          />
          <MultiSelect label="Roles" data={ROLES} value={roles} onChange={setRoles} required />
          <Button onClick={addUser} loading={creating} disabled={!canCreateUser}>
            Create user
          </Button>
        </Stack>
      </Card>

      {editUser ? (
        <Card withBorder padding="lg" radius="md">
          <Group justify="space-between" mb="md">
            <Text fw={600}>Edit user — {editUser.userName}</Text>
            <Button variant="subtle" size="xs" onClick={cancelEdit}>
              Cancel
            </Button>
          </Group>
          <Stack gap="md" maw={480}>
            {editError ? (
              <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
                {editError}
              </Alert>
            ) : null}
            <TextInput label="Display name" value={editDisplayName} onChange={(e) => setEditDisplayName(e.currentTarget.value)} />
            <MultiSelect label="Roles" data={ROLES} value={editRoles} onChange={setEditRoles} required />
            <PasswordFieldWithRequirements
              label="New password (optional)"
              value={editPassword}
              onChange={setEditPassword}
              onBlur={() => setEditPasswordTouched(true)}
              touched={editPasswordTouched}
            />
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Plant / line scopes
              </Text>
              <Group align="flex-end">
                <Select label="Plant" data={plantOpts} value={scopePlant} onChange={setScopePlant} searchable />
                <Select label="Line (optional)" data={lineOpts} value={scopeLine} onChange={setScopeLine} clearable searchable />
                <Button variant="light" onClick={addScope}>
                  Add scope
                </Button>
              </Group>
              {scopes.map((s, i) => (
                <Group key={i} justify="space-between">
                  <Text size="sm">{scopeLabel(s)}</Text>
                  <Button
                    size="xs"
                    variant="subtle"
                    color="red"
                    onClick={() => setScopes((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    Remove
                  </Button>
                </Group>
              ))}
            </Stack>
            <Group>
              <Button onClick={saveEdit} loading={savingEdit} disabled={!canSaveEdit}>
                Save changes
              </Button>
              <Button
                variant="light"
                color="red"
                onClick={async () => {
                  try {
                    await deactivateUser(editUser.id)
                    reload()
                    cancelEdit()
                    notifications.show({ message: 'User deactivated', color: 'green' })
                  } catch (err) {
                    notifications.show({
                      message: err instanceof Error ? err.message : 'Failed to deactivate user',
                      color: 'red',
                    })
                  }
                }}
              >
                Deactivate
              </Button>
            </Group>
          </Stack>
        </Card>
      ) : null}

      <Table fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>User</Table.Th>
            <Table.Th>Roles</Table.Th>
            <Table.Th>Scopes</Table.Th>
            <Table.Th>Active</Table.Th>
            <Table.Th />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users.map((u) => (
            <Table.Tr key={u.id}>
              <Table.Td>
                <Text fw={600}>{u.displayName}</Text>
                <Text size="xs" c="dimmed">
                  {u.userName}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  {u.roles.map((r) => (
                    <Badge key={r} size="xs">
                      {r}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                {u.scopes.length === 0 ? (
                  <Text size="xs" c="dimmed">
                    All plants
                  </Text>
                ) : (
                  u.scopes.map((s, i) => (
                    <Text key={i} size="xs">
                      {scopeLabel(s)}
                    </Text>
                  ))
                )}
              </Table.Td>
              <Table.Td>
                <Switch
                  checked={u.isActive}
                  onChange={async (e) => {
                    await setUserActive(u.id, e.currentTarget.checked)
                    reload()
                  }}
                />
              </Table.Td>
              <Table.Td>
                <Button size="xs" variant="subtle" onClick={() => startEdit(u)}>
                  Edit
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      <Card withBorder padding="md">
        <Text fw={600} mb="xs">
          Plant / line scopes
        </Text>
        <Group align="flex-end">
          <Select
            label="User"
            data={users.map((u) => ({ value: u.id, label: u.userName }))}
            value={scopeUser}
            onChange={(v) => {
              setScopeUser(v)
              const u = users.find((x) => x.id === v)
              setScopes(u?.scopes ?? [])
            }}
            searchable
          />
          <Select label="Plant" data={plantOpts} value={scopePlant} onChange={setScopePlant} searchable />
          <Select label="Line (optional)" data={lineOpts} value={scopeLine} onChange={setScopeLine} clearable searchable />
          <Button variant="light" onClick={addScope}>
            Add scope
          </Button>
          <Button onClick={saveScopes} disabled={!scopeUser}>
            Save scopes
          </Button>
        </Group>
        {scopes.map((s, i) => (
          <Text key={i} size="sm">
            {scopeLabel(s)}
          </Text>
        ))}
      </Card>
    </Stack>
  )
}
