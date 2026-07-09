import { useState } from 'react'
import { Alert, Button, Grid, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useMediaQuery } from '@mantine/hooks'
import { IconAlertCircle } from '@tabler/icons-react'
import { PasswordFieldWithRequirements } from './PasswordFieldWithRequirements'
import { PasswordRequirementsList } from './PasswordRequirementsList'
import { passwordMeetsPolicy, usernameHint, usernameMeetsPolicy } from '../../lib/passwordPolicy'

export interface CreateAccountValues {
  userName: string
  displayName: string
  password: string
}

interface CreateAccountFormProps {
  submitLabel: string
  description?: string
  loading?: boolean
  layout?: 'default' | 'wizard'
  onSubmit: (values: CreateAccountValues) => Promise<void>
}

export function CreateAccountForm({
  submitLabel,
  description,
  loading,
  layout = 'default',
  onSubmit,
}: CreateAccountFormProps) {
  const isWizard = layout === 'wizard'
  const isDesktop = useMediaQuery('(min-width: 48em)')
  const [userName, setUserName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({ userName: false, password: false, confirm: false })
  const [error, setError] = useState<string | null>(null)

  const userNameInvalid = touched.userName && !usernameMeetsPolicy(userName)
  const passwordsMatch = password === confirmPassword
  const confirmInvalid = touched.confirm && confirmPassword.length > 0 && !passwordsMatch
  const canSubmit =
    usernameMeetsPolicy(userName) &&
    passwordMeetsPolicy(password) &&
    passwordsMatch &&
    confirmPassword.length > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ userName: true, password: true, confirm: true })
    if (!canSubmit) return
    setError(null)
    try {
      await onSubmit({
        userName: userName.trim(),
        displayName: displayName.trim() || userName.trim(),
        password,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    }
  }

  const passwordBlock =
    isWizard && isDesktop ? (
      <Grid align="flex-start">
        <Grid.Col span={7}>
          <Stack gap="md">
            <PasswordFieldWithRequirements
              value={password}
              onChange={setPassword}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              touched={touched.password}
              required
              autoComplete="new-password"
              hideRequirements
            />
            <PasswordInput
              label="Confirm password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.currentTarget.value)}
              onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
              error={confirmInvalid ? 'Passwords do not match' : undefined}
              required
              autoComplete="new-password"
            />
          </Stack>
        </Grid.Col>
        <Grid.Col span={5}>
          <PasswordRequirementsList password={password} touched={touched.password} panel />
        </Grid.Col>
      </Grid>
    ) : (
      <>
        <PasswordFieldWithRequirements
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          touched={touched.password}
          required
          autoComplete="new-password"
          hideRequirements={isWizard}
        />
        {isWizard && !isDesktop ? (
          <PasswordRequirementsList password={password} touched={touched.password} panel />
        ) : null}
        <PasswordInput
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.currentTarget.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          error={confirmInvalid ? 'Passwords do not match' : undefined}
          required
          autoComplete="new-password"
        />
      </>
    )

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md" maw={isWizard ? undefined : 440}>
        {!isWizard && description ? (
          <Text size="sm" c="dimmed">
            {description}
          </Text>
        ) : null}
        {error ? (
          <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
            {error}
          </Alert>
        ) : null}
        <TextInput
          label="Username"
          description={usernameHint}
          placeholder="admin"
          value={userName}
          onChange={(e) => setUserName(e.currentTarget.value)}
          onBlur={() => setTouched((t) => ({ ...t, userName: true }))}
          error={userNameInvalid ? 'Enter a valid username' : undefined}
          required
          autoFocus
          autoComplete="username"
        />
        <TextInput
          label="Display name"
          description="Shown in the header and audit log (optional)"
          placeholder="Plant Administrator"
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
          autoComplete="name"
        />
        {passwordBlock}
        <Button type="submit" loading={loading} disabled={!canSubmit} fullWidth size="md">
          {submitLabel}
        </Button>
      </Stack>
    </form>
  )
}
