/** Dev-only flag: when true, historian/metrics/hierarchy APIs return audit mock data. */
let auditApiMode = false

export function setAuditApiMode(enabled: boolean) {
  auditApiMode = enabled
}

export function isAuditApiMode() {
  return auditApiMode
}
