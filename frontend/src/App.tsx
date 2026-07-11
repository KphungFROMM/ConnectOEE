import { BrowserRouter, Route, Routes, Navigate, useLocation } from 'react-router-dom'
import { Center, Loader } from '@mantine/core'
import { useEffect, useState } from 'react'
import { AppLayout } from './components/AppLayout'
import { DashboardsPage } from './features/DashboardsPage'
import { PlantExplorerPage } from './features/PlantExplorerPage'
import { AnalyticsPage } from './features/AnalyticsPage'
import { ReportsPage } from './features/ReportsPage'
import { OperatorPage } from './features/OperatorPage'
import { AdminPage } from './features/AdminPage'
import { WizardPage } from './features/WizardPage'
import { BuilderPage } from './features/BuilderPage'
import { WidgetAuditGallery } from './features/builder/WidgetAuditGallery'
import { TemplateAuditGallery } from './features/builder/TemplateAuditGallery'
import { KioskPage } from './features/KioskPage'
import { PresentationPage } from './features/PresentationPage'
import { LoginPage } from './features/LoginPage'
import { AuthProvider, useAuth } from './lib/auth'
import { AppearanceProvider } from './lib/AppearanceProvider'
import { getSetupStatus } from './lib/setup'
import { Permissions, isOperatorOnly, permissionDeniedPath } from './lib/permissions'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  const location = useLocation()
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    void getSetupStatus()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false))
  }, [])

  if (!ready || needsSetup === null) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }
  if (needsSetup) {
    return <Navigate to="/wizard" replace />
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}

function SetupRedirect() {
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)

  useEffect(() => {
    void getSetupStatus()
      .then((s) => setNeedsSetup(s.needsSetup))
      .catch(() => setNeedsSetup(false))
  }, [])

  if (needsSetup === null) {
    return (
      <Center h="100vh">
        <Loader />
      </Center>
    )
  }
  return <Navigate to={needsSetup ? '/wizard' : '/login'} replace />
}

function RequirePermission({ permission, children }: { permission: string; children: React.ReactNode }) {
  const { hasPermission, ready, user } = useAuth()
  if (!ready) {
    return (
      <Center h="40vh">
        <Loader />
      </Center>
    )
  }
  if (!hasPermission(permission)) return <Navigate to={permissionDeniedPath(user)} replace />
  return <>{children}</>
}

function StaffOnly({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <Center h="40vh">
        <Loader />
      </Center>
    )
  }
  if (isOperatorOnly(user)) return <Navigate to="/operator" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppearanceProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/wizard" element={<WizardPage />} />
        <Route path="/kiosk/:id" element={<KioskPage />} />
        <Route path="/present/:id" element={<PresentationPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route
            path="/"
            element={
              <StaffOnly>
                <DashboardsPage />
              </StaffOnly>
            }
          />
          <Route
            path="/dashboards/:id"
            element={
              <StaffOnly>
                <DashboardsPage />
              </StaffOnly>
            }
          />
          <Route
            path="/builder"
            element={
              <RequirePermission permission={Permissions.BuildDashboards}>
                <BuilderPage />
              </RequirePermission>
            }
          />
          <Route
            path="/dev/templates"
            element={
              <RequirePermission permission={Permissions.BuildDashboards}>
                <TemplateAuditGallery />
              </RequirePermission>
            }
          />
          <Route
            path="/dev/widgets"
            element={
              <RequirePermission permission={Permissions.BuildDashboards}>
                <WidgetAuditGallery />
              </RequirePermission>
            }
          />
          <Route
            path="/admin/templates"
            element={<Navigate to="/admin?tab=templates" replace />}
          />
          <Route
            path="/admin/widgets"
            element={<Navigate to="/admin?tab=widgets" replace />}
          />
          <Route
            path="/builder/:id"
            element={
              <RequirePermission permission={Permissions.BuildDashboards}>
                <BuilderPage />
              </RequirePermission>
            }
          />
          <Route
            path="/plant-explorer"
            element={
              <RequirePermission permission={Permissions.ViewPlantExplorer}>
                <PlantExplorerPage />
              </RequirePermission>
            }
          />
          <Route
            path="/analytics"
            element={
              <RequirePermission permission={Permissions.ViewReports}>
                <AnalyticsPage />
              </RequirePermission>
            }
          />
          <Route
            path="/reports"
            element={
              <RequirePermission permission={Permissions.ViewReports}>
                <ReportsPage />
              </RequirePermission>
            }
          />
          <Route path="/tags" element={<Navigate to="/admin?tab=tags" replace />} />
          <Route
            path="/operator"
            element={
              <RequirePermission permission={Permissions.EnterDowntimeReason}>
                <OperatorPage />
              </RequirePermission>
            }
          />
          <Route
            path="/admin"
            element={
              <RequirePermission permission={Permissions.ManageUsers}>
                <AdminPage />
              </RequirePermission>
            }
          />
        </Route>
        <Route path="*" element={<SetupRedirect />} />
      </Routes>
        </AppearanceProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
