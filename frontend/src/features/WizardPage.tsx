import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Center, Group, Loader, Stack, Text, Title } from '@mantine/core'
import { IconCheck, IconRocket } from '@tabler/icons-react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { notifications } from '@mantine/notifications'
import { ShiftSetupStep } from '../components/wizard/ShiftSetupStep'
import { AdminBootstrapStep } from '../components/wizard/AdminBootstrapStep'
import { HierarchySetupStep } from '../components/wizard/HierarchySetupStep'
import { PlantSetupStep } from '../components/wizard/PlantSetupStep'
import { PlcSetupStep } from '../components/wizard/PlcSetupStep'
import { TagMappingSetupStep } from '../components/wizard/TagMappingSetupStep'
import { WizardProgressPanel } from '../components/wizard/WizardProgressPanel'
import { WizardShell } from '../components/wizard/WizardShell'
import { useAuth } from '../lib/auth'
import { generateDashboards, getWizardStatus, type WizardStatus } from '../lib/admin'
import { getSetupStatus } from '../lib/setup'
import { Permissions, permissionDeniedPath } from '../lib/permissions'

const STEP_COUNT = 10

function nextDisabledForStep(active: number, status: WizardStatus | null): boolean {
  if (!status) return false
  if (active === 1 && status.plants === 0) return true
  if (active === 2 && status.departments === 0) return true
  if (active === 3 && status.lines === 0) return true
  if (active === 4 && status.machines === 0) return true
  if (active === 5 && status.plcConnections === 0) return true
  if (active === 6 && !status.requiredTagsMapped) return true
  if (active === 8 && !status.shiftsAssigned) return true
  return false
}

function nextDisabledReasonForStep(active: number, status: WizardStatus | null): string | undefined {
  if (!status || !nextDisabledForStep(active, status)) return undefined
  if (active === 1) return 'Add at least one plant to continue.'
  if (active === 2) return 'Add at least one department to continue.'
  if (active === 3) return 'Add at least one line to continue.'
  if (active === 4) return 'Add at least one machine to continue.'
  if (active === 5) return 'Add at least one PLC connection to continue.'
  if (active === 6) return 'Map Run State and Good Count on every machine to continue.'
  if (active === 8) return 'Save a shift pattern and assign it to a plant or line to continue.'
  return undefined
}

export function WizardPage() {
  const { user, ready: authReady, hasPermission } = useAuth()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    void getSetupStatus()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false))
  }, [])

  if (!authReady || needsSetup === null) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }

  if (!needsSetup && !user) {
    return <Navigate to="/login" state={{ from: { pathname: '/wizard' } }} replace />
  }

  if (!needsSetup && user && !hasPermission(Permissions.RunWizard)) {
    return <Navigate to={permissionDeniedPath(user)} replace />
  }

  return <WizardPageContent needsSetup={needsSetup} />
}

function WizardPageContent({ needsSetup }: { needsSetup: boolean }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<WizardStatus | null>(null)
  const [active, setActive] = useState(needsSetup ? 0 : 1)
  const [initialized, setInitialized] = useState(false)
  const [generating, setGenerating] = useState(false)

  const stepFromUrl = searchParams.get('step')
  const parsedStep = stepFromUrl !== null ? parseInt(stepFromUrl, 10) : NaN
  const urlStepIndex = Number.isFinite(parsedStep)
    ? Math.min(STEP_COUNT - 1, Math.max(0, parsedStep - 1))
    : null

  const refresh = useCallback(async () => {
    if (needsSetup) return
    try {
      const s = await getWizardStatus()
      setStatus(s)
      if (!initialized) {
        const fromApi = Math.min(STEP_COUNT - 1, Math.max(needsSetup ? 0 : 1, s.currentStep - 1))
        const nextActive = urlStepIndex ?? fromApi
        setActive(nextActive)
        setInitialized(true)
      }
    } catch {
      /* ignore */
    }
  }, [initialized, needsSetup, urlStepIndex])

  useEffect(() => {
    if (needsSetup) {
      setInitialized(true)
      return
    }
    void refresh()
  }, [refresh, needsSetup])

  async function runGenerate() {
    setGenerating(true)
    try {
      const result = await generateDashboards()
      notifications.show({ message: `Generated ${result.created} dashboard(s)`, color: 'green' })
      await refresh()
      navigate('/')
    } catch {
      notifications.show({ message: 'Failed to generate dashboards', color: 'red' })
    } finally {
      setGenerating(false)
    }
  }

  const next = () => setActive((a) => Math.min(STEP_COUNT - 1, a + 1))
  const prev = () => setActive((a) => Math.max(needsSetup ? 0 : 1, a - 1))

  const hasAdminUser = needsSetup ? (status?.hasAdminUser ?? false) : true
  const hideFooterNav = active === 0 && !hasAdminUser
  const nextDisabled = nextDisabledForStep(active, status)
  const nextDisabledReason = nextDisabledReasonForStep(active, status)
  const sidebar = status ? <WizardProgressPanel status={status} activeStep={active} /> : null

  return (
    <WizardShell
      active={active}
      stepCount={STEP_COUNT}
      hasAdminUser={hasAdminUser}
      onStepClick={setActive}
      onBack={prev}
      onNext={next}
      showFooterNav={!hideFooterNav}
      nextDisabled={nextDisabled}
      nextDisabledReason={nextDisabledReason}
      wideContent={active === 8}
      hideRerunHint={active === 8}
      sidebar={sidebar}
    >
      {renderStep(active, {
        needsSetup,
        hasAdminUser,
        status,
        generating,
        refresh,
        next,
        runGenerate,
        navigate,
      })}
    </WizardShell>
  )
}

interface StepContext {
  needsSetup: boolean
  hasAdminUser: boolean
  status: WizardStatus | null
  generating: boolean
  refresh: () => void
  next: () => void
  runGenerate: () => void
  navigate: (path: string) => void
}

function renderStep(active: number, ctx: StepContext) {
  const s = ctx.status

  switch (active) {
    case 0:
      return (
        <AdminBootstrapStep
          hasAdminUser={ctx.hasAdminUser}
          onBootstrapped={() => {
            ctx.refresh()
            ctx.next()
          }}
          onNext={ctx.next}
        />
      )
    case 1:
      return <PlantSetupStep plantCount={s?.plants ?? 0} onChange={ctx.refresh} />
    case 2:
      return (
        <HierarchySetupStep
          wizardStep="department"
          title="Add departments"
          description="Group production lines by department within each plant."
          itemCount={s?.departments ?? 0}
          savedMessage="Department saved. Add another or continue to lines when ready."
          onChange={ctx.refresh}
        />
      )
    case 3:
      return (
        <HierarchySetupStep
          wizardStep="line"
          title="Add lines"
          description="Add production lines and set the ideal run rate used by the OEE engine."
          itemCount={s?.lines ?? 0}
          savedMessage="Line saved. Add another or continue to machines when ready."
          onChange={ctx.refresh}
        />
      )
    case 4:
      return (
        <HierarchySetupStep
          wizardStep="machine"
          title="Add machines"
          description="Each machine gets standard logical signals automatically for tag mapping."
          itemCount={s?.machines ?? 0}
          savedMessage="Machine saved. Add another or continue to PLC setup when ready."
          onChange={ctx.refresh}
        />
      )
    case 5:
      return <PlcSetupStep plcConnectionCount={s?.plcConnections ?? 0} onChange={ctx.refresh} />
    case 6:
      return (
        <TagMappingSetupStep
          title="Map required tags"
          description="Run State and Good Count are required on every machine for OEE. Browse controller tags and bind them to each signal."
          signalFilter="required"
          milestoneMet={s?.requiredTagsMapped ?? false}
          savedMessage="Required tags mapped on all machines. Continue to optional tags or skip ahead."
          onChange={ctx.refresh}
        />
      )
    case 7:
      return (
        <TagMappingSetupStep
          title="Map optional tags"
          description="Reject count and downtime reason enrich quality and downtime analytics. Skip any you do not need."
          signalFilter="optional"
          milestoneMet={(s?.optionalTagsMapped ?? 0) > 0}
          savedMessage="Optional tags saved. Continue to shift configuration when ready."
          onChange={ctx.refresh}
        />
      )
    case 8:
      return <ShiftSetupStep shiftsAssigned={s?.shiftsAssigned ?? false} onChange={ctx.refresh} />
    case 9:
      return (
        <StepFrame title="Generate dashboards" hint="Create dashboards from system templates (10 per line + plant dashboards; Multi-Line Overview when 2+ lines or multi-machine lines).">
          <Card withBorder radius="md" padding="lg">
            <Stack>
              <Text size="sm">
                Creates Line Overview, Shift Summary, Machine Detail, Downtime Analysis, Production Analysis,
                Operator kiosk, and Andon kiosk per line, plus Plant Overview, Executive Summary, and Maintenance
                dashboards. When you have two or more lines, or any line with multiple machines, a{' '}
                <strong>Multi-Line Overview</strong> dashboard is also created so you can see every machine at once.
              </Text>
              <Group>
                <Button leftSection={<IconRocket size={16} />} loading={ctx.generating} onClick={ctx.runGenerate}>
                  Generate dashboards & finish
                </Button>
                <Button variant="default" onClick={() => ctx.navigate('/')}>
                  Skip to dashboards
                </Button>
              </Group>
            </Stack>
          </Card>
        </StepFrame>
      )
    default:
      return (
        <StepFrame title="All set!" hint="">
          <Alert icon={<IconCheck size={16} />} color="green">
            Setup complete. Head to the dashboards to see live OEE.
          </Alert>
        </StepFrame>
      )
  }
}

function StepFrame({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Stack pt="md">
      <div>
        <Title order={4}>{title}</Title>
        {hint ? (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        ) : null}
      </div>
      {children}
    </Stack>
  )
}
