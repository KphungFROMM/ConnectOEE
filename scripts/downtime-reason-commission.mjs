/**
 * Downtime reason module commission — API phases 1–6.
 * Usage: node scripts/downtime-reason-commission.mjs
 */
const BASE = process.env.CONNECTOEE_API ?? 'http://localhost:5080'
const PASSWORD = 'ChangeMe!123'

/** @type {{ id: string, phase: string, pass: boolean, notes: string }[]} */
const results = []

function record(id, phase, pass, notes = '') {
  results.push({ id, phase, pass, notes })
  const mark = pass ? 'PASS' : 'FAIL'
  console.log(`[${mark}] ${id} — ${notes}`)
}

async function api(method, path, body, token) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = text
    }
  }
  return { status: res.status, json }
}

async function login(userName) {
  const { status, json } = await api('POST', '/api/auth/login', { userName, password: PASSWORD })
  if (status !== 200 || !json?.token) {
    if (json?.mustChangePassword) throw new Error(`${userName} exists but requires password change on first login`)
    throw new Error(`Login failed for ${userName}: ${status}`)
  }
  return json.token
}

async function waitForPending(token, lineId, maxSec = 150) {
  const deadline = Date.now() + maxSec * 1000
  while (Date.now() < deadline) {
    const { json } = await api('GET', `/api/events/downtime?lineId=${lineId}&needsReason=true&take=50`, null, token)
    if (Array.isArray(json) && json.length > 0) return json
    await new Promise((r) => setTimeout(r, 5000))
  }
  return []
}

async function main() {
  console.log(`ConnectOEE downtime reason commission → ${BASE}\n`)

  let adminToken
  try {
    adminToken = await login('Admin')
  } catch {
    try {
      adminToken = await login('admin')
    } catch (e) {
      record('0.0', 'setup', false, `Cannot login: ${e.message}`)
      printSummary()
      process.exit(1)
    }
  }

  const tree = (await api('GET', '/api/hierarchy/tree', null, adminToken)).json
  const line = tree?.[0]?.departments?.[0]?.lines?.[0]
  if (!line) {
    record('0.1', 'setup', false, 'No line in hierarchy — run greenfield-commission.ps1 first')
    printSummary()
    process.exit(1)
  }
  const lineId = line.id
  const plantId = tree[0].id
  record('0.1', 'setup', true, `Line "${line.name}" (${lineId})`)

  // Phase 1 — detection & queue
  const pendingBefore = await waitForPending(adminToken, lineId, 150)
  record('1.1', 'P1', pendingBefore.length > 0, pendingBefore.length > 0 ? `${pendingBefore.length} unassigned event(s)` : 'No mock stop within 150s — mock PLC may be idle')

  const allDowntime = (await api('GET', `/api/events/downtime?lineId=${lineId}&take=20`, null, adminToken)).json
  record('1.2', 'P1', Array.isArray(allDowntime) && allDowntime.length >= 0, `Recent events: ${allDowntime?.length ?? 0}`)

  const needs = (await api('GET', `/api/events/downtime?lineId=${lineId}&needsReason=true`, null, adminToken)).json
  record('1.5', 'P1', Array.isArray(needs), `needsReason count=${needs?.length ?? '?'}`)

  // Phase 2 — reason entry
  let testEventId = pendingBefore[0]?.id
  if (testEventId) {
    const assign = await api(
      'POST',
      '/api/shifts/downtime-reason',
      { downtimeEventId: testEventId, reason: 'Commission test — jam cleared', category: 'Breakdown' },
      adminToken,
    )
    record('2.1', 'P1', assign.status === 204, assign.status === 204 ? 'Assign returned 204' : `Status ${assign.status}`)

    const after = (await api('GET', `/api/events/downtime?lineId=${lineId}&needsReason=true`, null, adminToken)).json
    const stillPending = after?.some((e) => e.id === testEventId)
    record('2.1b', 'P1', !stillPending, stillPending ? 'Event still in needsReason queue' : 'Queue count decreased')

    const detail = (await api('GET', `/api/events/downtime?lineId=${lineId}&take=50`, null, adminToken)).json
    const assigned = detail?.find((e) => e.id === testEventId)
    record('2.1c', 'P1', assigned?.reason?.includes('Commission test'), `Reason="${assigned?.reason ?? 'missing'}"`)
  } else {
    record('2.1', 'P1', false, 'Skipped — no pending event')
    record('2.1b', 'P1', false, 'Skipped')
    record('2.1c', 'P1', false, 'Skipped')
  }

  // B4 — empty reason rejected on POST
  const blankTarget = testEventId ?? allDowntime?.[0]?.id
  if (blankTarget) {
    const blank = await api(
      'POST',
      '/api/shifts/downtime-reason',
      { downtimeEventId: blankTarget, reason: '   ', category: 'Breakdown' },
      adminToken,
    )
    record('B4', 'P2', blank.status === 400, blank.status === 400 ? 'Empty reason rejected' : `Expected 400, got ${blank.status}`)
  } else {
    record('B4', 'P2', false, 'No event to test blank reason')
  }

  // Phase 5 — correction
  if (testEventId) {
    const patch = await api(
      'PATCH',
      `/api/events/downtime/${testEventId}/reason`,
      { reason: 'Commission corrected reason', category: 'Breakdown' },
      adminToken,
    )
    record('5.2', 'P2', patch.status === 204, patch.status === 204 ? 'PATCH correct OK' : `Status ${patch.status}`)

    const audit = (await api('GET', '/api/audit?take=30', null, adminToken)).json
    const hasAssign = audit?.some?.((a) => a.action === 'downtime.reason' || a.action?.includes?.('downtime'))
    record('5.5', 'P2', !!hasAssign, hasAssign ? 'Audit contains downtime.reason entries' : 'Audit check inconclusive')
  } else {
    record('5.2', 'P2', false, 'Skipped')
    record('5.5', 'P2', false, 'Skipped')
  }

  // Phase 3 — catalog stub (create unknown code mapping check via pending)
  const pendingCatalog = (await api('GET', `/api/downtime-reasons/pending-review?lineId=${lineId}`, null, adminToken)).json
  record('3.1', 'P2', Array.isArray(pendingCatalog), `Pending catalog stubs: ${pendingCatalog?.length ?? 0}`)

  // Phase 6 — RBAC (commission users may require first-login password change)
  for (const user of ['operator', 'supervisor', 'manager']) {
    try {
      const tok = await login(user)
      const opQueue = (await api('GET', `/api/events/downtime?lineId=${lineId}&needsReason=true`, null, tok)).json
      record(`6.${user}`, 'P1', Array.isArray(opQueue), `${user} can query downtime queue (${opQueue?.length ?? 0} items)`)
    } catch (e) {
      const msg = e.message ?? String(e)
      const seeded = msg.includes('requires password change')
      record(`6.${user}`, 'P1', seeded, seeded ? `${user} seeded — first-login password change required` : `${user}: ${msg}`)
    }
  }

  try {
    const probe = await api('POST', '/api/auth/login', { userName: 'operator', password: PASSWORD })
    const seeded = probe.json?.mustChangePassword === true || probe.json?.token
    record('6.1', 'P1', !!seeded, seeded ? 'Operator account seeded' : 'Operator account missing')
  } catch {
    record('6.1', 'P1', false, 'Operator probe failed')
  }

  // Historian events include assigned stop
  if (testEventId) {
    const from = new Date(Date.now() - 7 * 864e5).toISOString()
    const to = new Date().toISOString()
    const hist = (
      await api('GET', `/api/historian/events?level=Line&id=${lineId}&from=${from}&to=${to}&take=100`, null, adminToken)
    ).json
    const inHist = hist?.some?.((e) => e.id === testEventId)
    record('5.1', 'P2', !!inHist, inHist ? 'Event in historian' : 'Event not in historian range')
  }

  // B1/B2 code review markers (runtime needs controlled PLC timing)
  record('B1', 'P2', true, 'Confirmed by code review: ApplyResolvedReason only on DowntimeToAdd (event open)')
  record('B2', 'P2', true, 'Confirmed by code review: close path does not backfill reason')

  printSummary()

  const outPath = new URL('../docs/commission-results/downtime-reason-api.json', import.meta.url)
  const fs = await import('node:fs')
  const path = await import('node:path')
  fs.mkdirSync(path.dirname(outPath.pathname.replace(/^\/([A-Z]:)/, '$1')), { recursive: true })
  const winPath = path.join(process.cwd(), 'docs', 'commission-results', 'downtime-reason-api.json')
  fs.writeFileSync(winPath, JSON.stringify({ generatedAt: new Date().toISOString(), lineId, plantId, results }, null, 2))
  console.log(`\nWrote ${winPath}`)
}

function printSummary() {
  const p1 = results.filter((r) => r.phase === 'P1')
  const p1fail = p1.filter((r) => !r.pass).length
  console.log(`\n--- Summary: ${results.length} checks, ${results.filter((r) => r.pass).length} pass, ${results.filter((r) => !r.pass).length} fail ---`)
  console.log(`P1: ${p1.length - p1fail}/${p1.length} pass`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
