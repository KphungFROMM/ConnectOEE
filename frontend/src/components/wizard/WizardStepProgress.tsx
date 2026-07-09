import { Box, Group, Stack, Text, UnstyledButton, useMantineColorScheme, useMantineTheme } from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { WIZARD_STEP_LABELS } from './wizardSteps'

interface WizardStepProgressProps {
  active: number
  maxReachableStep: number
  onStepClick: (step: number) => void
}

export function WizardStepProgress({ active, maxReachableStep, onStepClick }: WizardStepProgressProps) {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const trackColor = isDark ? theme.colors.dark[4] : theme.colors.gray[3]
  const doneColor = theme.colors.brand[6]
  const pendingColor = isDark ? theme.colors.dark[5] : theme.colors.gray[2]
  const pendingText = isDark ? theme.colors.dark[2] : theme.colors.gray[6]
  const lastIndex = WIZARD_STEP_LABELS.length - 1

  function connectorColor(index: number, side: 'left' | 'right'): string {
    if (side === 'left') {
      return index > 0 && index <= active ? doneColor : trackColor
    }
    return index < lastIndex && index < active ? doneColor : trackColor
  }

  return (
    <Stack gap={6}>
      <Group gap={0} wrap="nowrap" w="100%" align="flex-start">
        {WIZARD_STEP_LABELS.map((label, index) => {
          const isActive = index === active
          const isDone = index < active
          const canClick = index <= maxReachableStep

          return (
            <Box key={label} style={{ flex: 1, minWidth: 0 }}>
              <Group gap={0} wrap="nowrap" align="center" w="100%">
                <Box
                  style={{
                    flex: 1,
                    height: 2,
                    minWidth: 2,
                    borderRadius: 1,
                    background: index > 0 ? connectorColor(index, 'left') : 'transparent',
                  }}
                />
                <UnstyledButton
                  aria-label={`Step ${index + 1}: ${label}`}
                  aria-current={isActive ? 'step' : undefined}
                  disabled={!canClick}
                  onClick={() => canClick && onStepClick(index)}
                  style={{
                    flexShrink: 0,
                    cursor: canClick ? 'pointer' : 'default',
                    opacity: canClick ? 1 : 0.55,
                  }}
                  title={label}
                >
                  <Box
                    w={28}
                    h={28}
                    style={{
                      borderRadius: '50%',
                      border: `2px solid ${isActive || isDone ? doneColor : trackColor}`,
                      background: isActive ? doneColor : isDone ? doneColor : pendingColor,
                      color: isActive || isDone ? theme.white : pendingText,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      transition: 'background 150ms ease, border-color 150ms ease',
                    }}
                  >
                    {isDone ? <IconCheck size={14} stroke={2.5} /> : index + 1}
                  </Box>
                </UnstyledButton>
                <Box
                  style={{
                    flex: 1,
                    height: 2,
                    minWidth: 2,
                    borderRadius: 1,
                    background: index < lastIndex ? connectorColor(index, 'right') : 'transparent',
                  }}
                />
              </Group>
            </Box>
          )
        })}
      </Group>
      <Group gap={0} wrap="nowrap" w="100%">
        {WIZARD_STEP_LABELS.map((label, index) => (
          <Box key={label} style={{ flex: 1, minWidth: 0, textAlign: 'center', paddingInline: 2 }}>
            {index === active ? (
              <Text size="sm" fw={600} lineClamp={2}>
                {label}
              </Text>
            ) : null}
          </Box>
        ))}
      </Group>
    </Stack>
  )
}
