/**
 * Capture ConnectOEE product pages into docs/snapshot-kit-2026-07/
 *
 * Prerequisites: API :5080, Vite :5173, admin logged in via token or form.
 *
 * Usage:
 *   node scripts/capture-snapshot-kit.mjs
 *   AUDIT_TOKEN=... BASE_URL=http://localhost:5173 node scripts/capture-snapshot-kit.mjs
 */
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const KIT = path.join(ROOT, 'docs', 'snapshot-kit-2026-07')
const BASE = process.env.BASE_URL || 'http://localhost:5173'
const API = process.env.API_URL || 'http://localhost:5080'
const USER = process.env.ADMIN_USER || 'admin'
const PASS = process.env.ADMIN_PASSWORD || 'ChangeMe!123'

const indexRows = []

function ensureDir(d) {
  fs.mkdirSync(d, { recursive: true })
}

async function api(pathname, token) {
  const r = await fetch(`${API}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!r.ok) throw new Error(`${pathname} ${r.status}`)
  return r.json()
}

async function loginToken() {
  if (process.env.AUDIT_TOKEN) return process.env.AUDIT_TOKEN
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS }),
  })
  if (!r.ok) throw new Error(`login ${r.status}`)
  const j = await r.json()
  return j.token || j.accessToken
}

function record(slug, route, file, theme, status, notes = '') {
  indexRows.push({ slug, route, file, theme, status, notes })
  console.log(`${status.padEnd(7)} ${slug}`)
}

async function shot(page, folder, slug, route, theme = 'light', fullPage = true) {
  const dir = path.join(KIT, folder)
  ensureDir(dir)
  const file = path.join(folder, `${slug}.png`)
  const abs = path.join(KIT, file)
  try {
    await page.waitForTimeout(800)
    await page.screenshot({ path: abs, fullPage })
    record(slug, route, file.replace(/\\/g, '/'), theme, 'pass')
  } catch (e) {
    record(slug, route, file.replace(/\\/g, '/'), theme, 'blocked', String(e.message || e))
  }
}

async function goto(page, route) {
  const url = route.startsWith('http') ? route : `${BASE}${route}`
  // Prefer domcontentloaded — SignalR/live polls prevent networkidle on most pages.
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(1800)
}

async function setTheme(page, dark) {
  // Prefer UI toggle if present
  const btn = page.getByRole('button', { name: /Toggle color scheme|color scheme/i })
  const html = page.locator('html')
  const isDark = await html.evaluate((el) => el.getAttribute('data-mantine-color-scheme') === 'dark' || el.classList.contains('dark'))
  if (dark !== isDark) {
    if (await btn.count()) await btn.first().click().catch(() => {})
    else {
      await page.evaluate((wantDark) => {
        document.documentElement.setAttribute('data-mantine-color-scheme', wantDark ? 'dark' : 'light')
        localStorage.setItem('mantine-color-scheme-value', wantDark ? 'dark' : 'light')
      }, dark)
    }
    await page.waitForTimeout(400)
  }
}

async function main() {
  ensureDir(KIT)
  const token = await loginToken()
  const tree = await api('/api/hierarchy/tree', token)
  const plant = tree.id ? tree : tree[0]
  const dept = plant.departments[0]
  const lines = dept.lines || []
  const bev = lines.find((l) => l.name === 'Beverage Line') || lines[0]
  const mold = lines.find((l) => l.name === 'Molding Line') || lines[1]
  const filler = (bev.machines || []).find((m) => m.name === 'Filler') || (bev.machines || [])[0]
  const dashes = await api('/api/dashboards', token)
  const list = Array.isArray(dashes) ? dashes : dashes.value || []
  const find = (pred) => list.find(pred)

  const ids = {
    plantId: plant.id,
    deptId: dept.id,
    bevLineId: bev.id,
    moldLineId: mold.id,
    fillerMachineId: filler.id,
    dashPlantOverview: find((d) => /Plant Overview/i.test(d.name))?.id,
    dashAnalyticsStarter: find((d) => /Analytics Starter/i.test(d.name))?.id,
    dashBevAndon: find((d) => d.name === 'Beverage Line - Andon' || (d.lineId === bev.id && /Andon/i.test(d.name)))?.id,
    dashBevOperator: find((d) => /Beverage/i.test(d.name) && /Operator/i.test(d.name))?.id,
    dashBevProduction: find((d) => /Beverage/i.test(d.name) && /Production/i.test(d.name))?.id,
    dashBevQuality: find((d) => /Beverage/i.test(d.name) && /Quality/i.test(d.name))?.id,
    dashBevSupervisor: find((d) => /Beverage/i.test(d.name) && /Supervisor/i.test(d.name))?.id,
    dashMoldMaintenance: find((d) => /Maintenance/i.test(d.name))?.id,
    dashAny: list[0]?.id,
  }
  fs.writeFileSync(path.join(KIT, 'ids.json'), JSON.stringify(ids, null, 2))

  // Prefer bundled Chromium; fall back to system Chrome when Playwright browsers are missing.
  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()

  // Seed auth via localStorage JWT used by the app
  await page.goto(BASE + '/login')
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('connectoee.token', token)
      localStorage.setItem('connectoee.auth', JSON.stringify({ token, user }))
    },
    { token, user: { userName: USER, roles: ['Admin'] } },
  )

  // Detect actual auth storage keys from app
  await page.goto(BASE + '/')
  await page.waitForTimeout(500)
  // If redirected to login, do form login
  if (page.url().includes('/login')) {
    await page.getByLabel(/Username|User name/i).fill(USER)
    await page.getByLabel(/^Password$/i).fill(PASS)
    await page.getByRole('button', { name: /Sign in|Log in/i }).click()
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 }).catch(() => {})
  }

  // ---- 01 Auth (logout view) ----
  // Capture login by clearing storage in a new context
  {
    const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const lp = await loginCtx.newPage()
    await goto(lp, '/login')
    await shot(lp, '01-auth', 'login-sign-in', '/login', 'light')
    await setTheme(lp, true)
    await shot(lp, '01-auth', 'login-sign-in-dark', '/login', 'dark')
    await loginCtx.close()
  }

  // ---- Help drawer ----
  await goto(page, '/')
  await setTheme(page, false)
  const helpBtn = page.getByRole('button', { name: /^Help$/i })
  if (await helpBtn.count()) {
    await helpBtn.first().click()
    await page.waitForTimeout(500)
    await shot(page, '12-modals', 'shell-help-drawer', '/ (help drawer)', 'light')
    await page.keyboard.press('Escape').catch(() => {})
  } else record('shell-help-drawer', '/', '12-modals/shell-help-drawer.png', 'light', 'skip', 'Help button not found')

  // ---- 02 Wizard ----
  for (let step = 1; step <= 10; step++) {
    const route = `/wizard?step=${step}`
    await goto(page, route)
    await shot(page, '02-wizard', `wizard-${String(step).padStart(2, '0')}`, route)
  }

  // ---- 03 Dashboards ----
  await goto(page, '/')
  await shot(page, '03-dashboards', 'dashboards-hub', '/')
  await setTheme(page, true)
  await shot(page, '03-dashboards', 'dashboards-hub-dark', '/', 'dark')
  await setTheme(page, false)

  for (const chip of ['Pinned', 'Kiosk', 'Analysis']) {
    const c = page.getByRole('button', { name: new RegExp(`^${chip}$`, 'i') })
    if (await c.count()) {
      await c.first().click()
      await shot(page, '03-dashboards', `dashboards-hub-filter-${chip.toLowerCase()}`, `/?filter=${chip}`)
    } else record(`dashboards-hub-filter-${chip.toLowerCase()}`, '/', `03-dashboards/dashboards-hub-filter-${chip.toLowerCase()}.png`, 'light', 'skip', 'chip missing')
  }

  const dashTargets = [
    ['dashboard-plant-overview', ids.dashPlantOverview],
    ['dashboard-analytics-starter', ids.dashAnalyticsStarter],
    ['dashboard-beverage-andon', ids.dashBevAndon],
    ['dashboard-beverage-operator-floor', ids.dashBevOperator],
    ['dashboard-beverage-production', ids.dashBevProduction],
    ['dashboard-beverage-quality', ids.dashBevQuality],
    ['dashboard-beverage-supervisor', ids.dashBevSupervisor],
    ['dashboard-maintenance-wall', ids.dashMoldMaintenance],
  ]
  for (const [slug, id] of dashTargets) {
    if (!id) {
      record(slug, '/dashboards/{id}', `03-dashboards/${slug}.png`, 'light', 'skip', 'dashboard id missing')
      continue
    }
    const route = `/dashboards/${id}`
    await goto(page, route)
    await shot(page, '03-dashboards', slug, route)
  }

  // ---- 04 Kiosk / present ----
  if (ids.dashBevAndon) {
    await goto(page, `/kiosk/${ids.dashBevAndon}`)
    await page.waitForTimeout(1500)
    await shot(page, '04-kiosk-present', 'kiosk-beverage-andon-light', `/kiosk/${ids.dashBevAndon}`, 'light', false)
    // try theme toggle on kiosk
    const kt = page.getByRole('button', { name: /color scheme|theme|dark|light/i })
    if (await kt.count()) {
      await kt.first().click().catch(() => {})
      await page.waitForTimeout(500)
    }
    await shot(page, '04-kiosk-present', 'kiosk-beverage-andon-dark', `/kiosk/${ids.dashBevAndon}`, 'dark', false)
    await goto(page, `/present/${ids.dashBevAndon}`)
    await page.waitForTimeout(1000)
    await shot(page, '04-kiosk-present', 'present-beverage-andon', `/present/${ids.dashBevAndon}`, 'light', false)
  }

  // ---- 05 Explorer ----
  await goto(page, '/') // re-auth shell
  if (page.url().includes('/login')) {
    await page.getByLabel(/Username|User name/i).fill(USER)
    await page.getByLabel(/^Password$/i).fill(PASS)
    await page.getByRole('button', { name: /Sign in|Log in/i }).click()
    await page.waitForTimeout(2000)
  }

  const explorerRoutes = [
    ['explorer-fleet-root', '/plant-explorer'],
    ['explorer-plant', `/plant-explorer?scope=Plant%3A${ids.plantId}`],
    ['explorer-department', `/plant-explorer?scope=Department%3A${ids.deptId}`],
    ['explorer-line-beverage', `/plant-explorer?scope=Line%3A${ids.bevLineId}`],
    ['explorer-line-molding', `/plant-explorer?scope=Line%3A${ids.moldLineId}`],
    ['explorer-machine-filler', `/plant-explorer?scope=Machine%3A${ids.fillerMachineId}`],
    ['explorer-line-beverage-tab-overview', `/plant-explorer?scope=Line%3A${ids.bevLineId}`],
    ['explorer-line-beverage-tab-downtime', `/plant-explorer?scope=Line%3A${ids.bevLineId}&tab=downtime`],
    ['explorer-line-beverage-tab-reliability', `/plant-explorer?scope=Line%3A${ids.bevLineId}&tab=reliability`],
    ['explorer-machine-filler-tab-overview', `/plant-explorer?scope=Machine%3A${ids.fillerMachineId}`],
    ['explorer-machine-filler-tab-downtime', `/plant-explorer?scope=Machine%3A${ids.fillerMachineId}&tab=downtime`],
    ['explorer-machine-filler-tab-reliability', `/plant-explorer?scope=Machine%3A${ids.fillerMachineId}&tab=reliability`],
  ]
  for (const [slug, route] of explorerRoutes) {
    await goto(page, route)
    await shot(page, '05-explorer', slug, route)
  }
  await goto(page, `/plant-explorer?scope=Line%3A${ids.bevLineId}`)
  await setTheme(page, true)
  await shot(page, '05-explorer', 'explorer-line-beverage-dark', `/plant-explorer?scope=Line%3A${ids.bevLineId}`, 'dark')
  await setTheme(page, false)

  // ---- 06 Operator ----
  await goto(page, '/operator')
  await shot(page, '06-operator', 'operator-grid', '/operator')
  await setTheme(page, true)
  await shot(page, '06-operator', 'operator-grid-dark', '/operator', 'dark')
  await setTheme(page, false)
  await goto(page, `/operator?machine=${ids.fillerMachineId}`)
  await shot(page, '06-operator', 'operator-machine-detail-filler', `/operator?machine=${ids.fillerMachineId}`)

  // Reason modal if a Need reason badge/button exists
  const reasonBtn = page.getByRole('button', { name: /reason|Why|Assign/i }).first()
  if (await reasonBtn.count()) {
    await reasonBtn.click().catch(() => {})
    await page.waitForTimeout(600)
    await shot(page, '12-modals', 'modal-reason-assign', '/operator (reason modal)')
    await page.keyboard.press('Escape').catch(() => {})
  } else {
    // try from grid queue
    await goto(page, '/operator')
    const need = page.getByText(/NEED REASON|Need reason|Assign reason/i).first()
    if (await need.count()) {
      await need.click().catch(() => {})
      await page.waitForTimeout(600)
      await shot(page, '12-modals', 'modal-reason-assign', '/operator (reason)')
      await page.keyboard.press('Escape').catch(() => {})
    } else record('modal-reason-assign', '/operator', '12-modals/modal-reason-assign.png', 'light', 'skip', 'no reason UI visible')
  }

  // ---- 07 Analytics ----
  const analytics = [
    ['analytics-plant-overview', `/analytics?scope=Plant%3A${ids.plantId}`],
    ['analytics-beverage-downtime', `/analytics?scope=Line%3A${ids.bevLineId}&tab=downtime`],
    ['analytics-beverage-production', `/analytics?scope=Line%3A${ids.bevLineId}&tab=production`],
    ['analytics-beverage-reliability', `/analytics?scope=Line%3A${ids.bevLineId}&tab=reliability`],
    ['analytics-filler-overview', `/analytics?scope=Machine%3A${ids.fillerMachineId}`],
  ]
  for (const [slug, route] of analytics) {
    await goto(page, route)
    await shot(page, '07-analytics', slug, route)
  }
  await goto(page, `/analytics?scope=Plant%3A${ids.plantId}`)
  await setTheme(page, true)
  await shot(page, '07-analytics', 'analytics-plant-overview-dark', `/analytics?scope=Plant%3A${ids.plantId}`, 'dark')
  await setTheme(page, false)

  // ---- 08 Reports ----
  const reports = [
    ['reports-generate', '/reports'],
    ['reports-history', '/reports?tab=history'],
    ['reports-schedules-list', '/reports?tab=schedules'],
    ['reports-custom-designer', '/reports?tab=custom'],
  ]
  for (const [slug, route] of reports) {
    await goto(page, route)
    await shot(page, '08-reports', slug, route)
  }
  // Delivery sub-tab if present
  await goto(page, '/reports?tab=schedules')
  const delivery = page.getByRole('tab', { name: /Delivery/i })
  if (await delivery.count()) {
    await delivery.click()
    await shot(page, '08-reports', 'reports-schedules-delivery', '/reports?tab=schedules (Delivery)')
  } else record('reports-schedules-delivery', '/reports?tab=schedules', '08-reports/reports-schedules-delivery.png', 'light', 'skip', 'Delivery tab missing')

  // ---- 09 Builder ----
  await goto(page, '/builder')
  await shot(page, '09-builder', 'builder-new-blank', '/builder')
  const editId = ids.dashBevProduction || ids.dashAny
  if (editId) {
    await goto(page, `/builder/${editId}`)
    await shot(page, '09-builder', 'builder-edit', `/builder/${editId}`)
    await setTheme(page, true)
    await shot(page, '09-builder', 'builder-edit-dark', `/builder/${editId}`, 'dark')
    await setTheme(page, false)
    const preview = page.getByRole('button', { name: /Preview/i })
    if (await preview.count()) {
      await preview.first().click()
      await shot(page, '09-builder', 'builder-preview-mode', `/builder/${editId} preview`)
      await preview.first().click().catch(() => {})
    }
    for (const tab of ['Data', 'Widget', 'Layout']) {
      const t = page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })
      if (await t.count()) {
        await t.first().click()
        await shot(page, '09-builder', `builder-properties-${tab.toLowerCase()}`, `/builder/${editId} #${tab}`)
      } else record(`builder-properties-${tab.toLowerCase()}`, `/builder/${editId}`, `09-builder/builder-properties-${tab.toLowerCase()}.png`, 'light', 'skip', 'tab missing')
    }
    const tmpl = page.getByRole('button', { name: /Template|gallery/i })
    if (await tmpl.count()) {
      await tmpl.first().click()
      await page.waitForTimeout(500)
      await shot(page, '09-builder', 'builder-template-gallery-drawer', `/builder/${editId} templates`)
      await page.keyboard.press('Escape').catch(() => {})
    }
    const hist = page.getByRole('button', { name: /Version|History/i })
    if (await hist.count()) {
      await hist.first().click()
      await page.waitForTimeout(500)
      await shot(page, '09-builder', 'builder-version-history', `/builder/${editId} history`)
      await page.keyboard.press('Escape').catch(() => {})
    }
  }

  // ---- 10 Admin ----
  const adminTabs = [
    ['admin-hierarchy', '/admin?tab=hierarchy'],
    ['admin-plc', '/admin?tab=plc'],
    ['admin-tags', '/admin?tab=tags'],
    ['admin-shifts', '/admin?tab=shifts'],
    ['admin-reason-catalog', '/admin?tab=faults'],
    ['admin-control-tags', '/admin?tab=controls'],
    ['admin-recipes-catalog', '/admin?tab=recipes&recipesTab=catalog'],
    ['admin-recipes-line-speeds', `/admin?tab=recipes&recipesTab=line-speeds&lineId=${ids.bevLineId}`],
    ['admin-recipes-review', '/admin?tab=recipes&recipesTab=review'],
    ['admin-users', '/admin?tab=users'],
    ['admin-audit', '/admin?tab=audit'],
    ['admin-appearance', '/admin?tab=appearance'],
    ['admin-license', '/admin?tab=license'],
    ['admin-system', '/admin?tab=system'],
    ['admin-templates-gallery', '/admin?tab=templates'],
    ['admin-widgets-gallery', '/admin?tab=widgets'],
  ]
  for (const [slug, route] of adminTabs) {
    await goto(page, route)
    await shot(page, '10-admin', slug, route)
  }
  await goto(page, '/admin?tab=hierarchy')
  await setTheme(page, true)
  await shot(page, '10-admin', 'admin-hierarchy-dark', '/admin?tab=hierarchy', 'dark')
  await setTheme(page, false)

  // Tag picker modal if Bind / Browse available
  await goto(page, '/admin?tab=tags')
  const bind = page.getByRole('button', { name: /Bind|Pick tag|Browse/i }).first()
  if (await bind.count()) {
    await bind.click().catch(() => {})
    await page.waitForTimeout(700)
    await shot(page, '12-modals', 'modal-tag-picker', '/admin?tab=tags (picker)')
    await page.keyboard.press('Escape').catch(() => {})
  } else record('modal-tag-picker', '/admin?tab=tags', '12-modals/modal-tag-picker.png', 'light', 'skip', 'bind control not found')

  // PLC edit drawer
  await goto(page, '/admin?tab=plc')
  const editPlc = page.getByRole('button', { name: /^Edit$/i }).first()
  if (await editPlc.count()) {
    await editPlc.click()
    await page.waitForTimeout(500)
    await shot(page, '12-modals', 'drawer-plc-edit', '/admin?tab=plc edit')
    await page.keyboard.press('Escape').catch(() => {})
  }

  // Apply template modal from hub
  await goto(page, '/')
  const add = page.getByRole('button', { name: /Add dashboard/i })
  if (await add.count()) {
    await add.click()
    await page.waitForTimeout(400)
    const fromT = page.getByRole('menuitem', { name: /template/i }).or(page.getByText(/from template/i))
    if (await fromT.count()) {
      await fromT.first().click()
      await page.waitForTimeout(600)
      await shot(page, '12-modals', 'modal-apply-template', '/ apply template')
      await page.keyboard.press('Escape').catch(() => {})
    } else record('modal-apply-template', '/', '12-modals/modal-apply-template.png', 'light', 'skip', 'menu item missing')
  }

  // Dev galleries landing (script fills rest)
  await goto(page, '/dev/templates')
  await shot(page, '11-dev-galleries', 'dev-templates-gallery-light', '/dev/templates')
  await goto(page, '/dev/widgets')
  await shot(page, '11-dev-galleries', 'dev-widgets-gallery-light', '/dev/widgets')

  await browser.close()

  // Write INDEX.csv
  const header = 'slug,route,file,theme,status,notes'
  const csv = [header]
    .concat(
      indexRows.map((r) =>
        [r.slug, r.route, r.file, r.theme, r.status, `"${(r.notes || '').replace(/"/g, '""')}"`].join(','),
      ),
    )
    .join('\n')
  fs.writeFileSync(path.join(KIT, 'INDEX.csv'), csv)

  const pass = indexRows.filter((r) => r.status === 'pass').length
  const skip = indexRows.filter((r) => r.status === 'skip').length
  const blocked = indexRows.filter((r) => r.status === 'blocked').length
  console.log(`\nDone: pass=${pass} skip=${skip} blocked=${blocked} total=${indexRows.length}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
