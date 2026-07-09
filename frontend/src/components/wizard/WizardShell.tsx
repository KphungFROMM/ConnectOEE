import { Badge, Box, Button, Container, Grid, Group, Stack, Text, Title, Tooltip, useMantineColorScheme, useMantineTheme } from '@mantine/core'
import type { ReactNode } from 'react'
import { lightTheme } from '../../theme/tokens'
import { WizardStepProgress } from './WizardStepProgress'

interface WizardShellProps {
  active: number
  stepCount: number
  hasAdminUser: boolean
  onStepClick: (step: number) => void
  onBack: () => void
  onNext: () => void
  showFooterNav: boolean
  nextDisabled?: boolean
  nextDisabledReason?: string
  wideContent?: boolean
  hideRerunHint?: boolean
  children: ReactNode
  sidebar?: ReactNode
}

export function WizardShell({
  active,
  stepCount,
  hasAdminUser,
  onStepClick,
  onBack,
  onNext,
  showFooterNav,
  nextDisabled = false,
  nextDisabledReason,
  wideContent = false,
  hideRerunHint = false,
  children,
  sidebar,
}: WizardShellProps) {
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const isDark = colorScheme === 'dark'
  const pageBg = isDark ? theme.colors.dark[8] : lightTheme.sunken
  const iconBg = isDark ? theme.colors.dark[6] : lightTheme.surface
  const iconBorder = isDark ? theme.colors.dark[4] : lightTheme.border

  const maxReachableStep = hasAdminUser ? stepCount - 1 : 0

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: pageBg,
        paddingTop: theme.spacing.xl,
        paddingBottom: theme.spacing.xl,
      }}
    >
      <Container size={wideContent ? 'xl' : 'lg'}>
        <Stack gap="lg">
          <Group justify="space-between" align="flex-start" wrap="nowrap">
            <Group gap="md" align="center" wrap="nowrap">
              <Box
                style={{
                  background: iconBg,
                  border: `1px solid ${iconBorder}`,
                  borderRadius: 12,
                  padding: 8,
                  lineHeight: 0,
                  flexShrink: 0,
                }}
              >
                <img src="/app-icon.png" alt="ConnectOEE" width={40} height={40} />
              </Box>
              <div>
                <Title order={2} lh={1.2}>
                  ConnectOEE
                </Title>
                <Text size="sm" c="dimmed">
                  Setup Wizard
                </Text>
              </div>
            </Group>
            <Badge variant="light" color="blue" size="lg">
              Step {active + 1} of {stepCount}
            </Badge>
          </Group>

          {hasAdminUser && !hideRerunHint ? (
            <Text c="dimmed" size="sm">
              Re-runnable — each step edits existing configuration without duplicating it.
            </Text>
          ) : null}

          <WizardStepProgress
            active={active}
            maxReachableStep={maxReachableStep}
            onStepClick={onStepClick}
          />

          {sidebar ? (
            <Grid align="flex-start">
              <Grid.Col span={{ base: 12, md: 8 }}>{children}</Grid.Col>
              <Grid.Col span={{ base: 12, md: 4 }}>
                <Box visibleFrom="md" style={{ position: 'sticky', top: 16 }}>
                  {sidebar}
                </Box>
                <Box hiddenFrom="md">{sidebar}</Box>
              </Grid.Col>
            </Grid>
          ) : (
            children
          )}

          {showFooterNav ? (
            <Group justify="space-between">
              <Button variant="default" onClick={onBack} disabled={active === 0}>
                Back
              </Button>
              <Tooltip label={nextDisabledReason} disabled={!nextDisabled || !nextDisabledReason} withArrow>
                <Button onClick={onNext} disabled={active >= stepCount - 1 || nextDisabled}>
                  Next
                </Button>
              </Tooltip>
            </Group>
          ) : null}
        </Stack>
      </Container>
    </Box>
  )
}
