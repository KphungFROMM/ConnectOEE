import type { UserInfo } from './auth'

// Mirror of backend PermissionKeys (ConnectOEE.Core PermissionKeys).
export const Permissions = {
  ManageHierarchy: 'hierarchy.manage',
  BrowseTags: 'tags.browse',
  MapTags: 'tags.map',
  PlcWrite: 'plc.write',
  BuildDashboards: 'dashboards.build',
  ViewPlantExplorer: 'plantexplorer.view',
  EnterDowntimeReason: 'downtime.enter',
  ManageShifts: 'shifts.manage',
  ManageUsers: 'users.manage',
  ViewReports: 'reports.view',
  ManageReports: 'reports.manage',
  RunWizard: 'wizard.run',
  ManageProducts: 'products.manage',
  SelectProduct: 'products.select',
} as const

/** True when the user is an operator with no staff/analytics permissions. */
export function isOperatorOnly(user: UserInfo | null | undefined): boolean {
  if (!user) return false
  return user.roles.length === 1 && user.roles[0] === 'Operator'
}

/** Post-login landing route by role. */
export function defaultHomePath(user: UserInfo | null | undefined): string {
  return isOperatorOnly(user) ? '/operator' : '/'
}

/** Redirect target when a permission check fails. */
export function permissionDeniedPath(user: UserInfo | null | undefined): string {
  return defaultHomePath(user)
}
