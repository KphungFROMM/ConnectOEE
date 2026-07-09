import { Group, PasswordInput, Progress, Stack, Text } from '@mantine/core'
import {
  countMetRules,
  passwordMeetsPolicy,
  passwordRules,
  passwordStrengthLabel,
} from '../../lib/passwordPolicy'
import { PasswordRequirementsList } from './PasswordRequirementsList'

interface PasswordFieldWithRequirementsProps {
  label?: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  /** Show validation styling after the user interacts with the field. */
  touched?: boolean
  autoFocus?: boolean
  required?: boolean
  autoComplete?: string
  /** Hide inline checklist (use PasswordRequirementsList in a side panel instead). */
  hideRequirements?: boolean
}

export function PasswordFieldWithRequirements({
  label = 'Password',
  placeholder = 'Create a strong password',
  value,
  onChange,
  onBlur,
  touched = false,
  autoFocus,
  required,
  autoComplete,
  hideRequirements = false,
}: PasswordFieldWithRequirementsProps) {
  const met = countMetRules(value)
  const strength = passwordStrengthLabel(met)
  const showValidation = touched && value.length > 0
  const invalid = showValidation && !passwordMeetsPolicy(value)

  return (
    <Stack gap={6}>
      <PasswordInput
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onBlur={onBlur}
        autoFocus={autoFocus}
        required={required}
        autoComplete={autoComplete}
        error={invalid ? 'Password does not meet all requirements' : undefined}
      />
      {value.length > 0 ? (
        <Stack gap={4}>
          <Group justify="space-between" gap="xs">
            <Text size="xs" c={strength.color} fw={600}>
              {strength.label}
            </Text>
            <Text size="xs" c="dimmed">
              {met}/{passwordRules.length}
            </Text>
          </Group>
          <Progress value={(met / passwordRules.length) * 100} color={strength.color} size="xs" radius="xl" />
        </Stack>
      ) : null}
      {!hideRequirements ? <PasswordRequirementsList password={value} touched={touched} /> : null}
    </Stack>
  )
}
