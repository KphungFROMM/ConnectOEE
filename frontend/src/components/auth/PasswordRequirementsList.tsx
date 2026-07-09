import { Box, Group, Stack, Text, ThemeIcon, useMantineColorScheme, useMantineTheme } from '@mantine/core'
import { IconCheck, IconCircle, IconX } from '@tabler/icons-react'
import { passwordRules } from '../../lib/passwordPolicy'

interface PasswordRequirementsListProps {
  password: string
  touched?: boolean
  /** Wrap in a bordered panel with a heading. */
  panel?: boolean
  title?: string
}

export function PasswordRequirementsList({
  password,
  touched = false,
  panel = false,
  title = 'Password requirements',
}: PasswordRequirementsListProps) {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'

  const list = (
    <Stack gap={6}>
      {panel ? (
        <Text size="xs" fw={700} tt="uppercase" c="dimmed">
          {title}
        </Text>
      ) : null}
      <Stack gap={4}>
        {passwordRules.map((rule) => {
          const passed = rule.test(password)
          const showState = password.length > 0
          const color = !showState ? 'gray' : passed ? 'green' : touched ? 'red' : 'gray'
          const Icon = !showState ? IconCircle : passed ? IconCheck : touched ? IconX : IconCircle
          return (
            <Group key={rule.id} gap={8} wrap="nowrap" align="flex-start">
              <ThemeIcon size={18} radius="xl" variant="light" color={color} style={{ flexShrink: 0 }}>
                <Icon size={12} stroke={2.5} />
              </ThemeIcon>
              <Text
                size="sm"
                c={showState && touched && !passed ? 'red' : showState && passed ? 'green' : 'dimmed'}
              >
                {rule.label}
              </Text>
            </Group>
          )
        })}
      </Stack>
    </Stack>
  )

  if (!panel) return list

  return (
    <Box
      p="md"
      style={{
        borderRadius: theme.radius.md,
        border: `1px solid ${isDark ? theme.colors.dark[4] : theme.colors.gray[3]}`,
        background: isDark ? theme.colors.dark[6] : theme.colors.gray[0],
      }}
    >
      {list}
    </Box>
  )
}
