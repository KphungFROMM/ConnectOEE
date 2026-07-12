/**
 * Fill remaining snapshot-kit skips: hub chips + builder property tabs.
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
const USER = 'admin'
const PASS = 'ChangeMe!123'

async function loginToken() {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: USER, password: PASS }),
  })
  const j = await r.json()
  return j.token
}

async function main() {
  const token = await loginToken()
  const ids = JSON.parse(fs.readFileSync(path.join(KIT, 'ids.json'), 'utf8'))
  let browser
  try {
    browser = await chromium.launch({ headless: true })
  } catch {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
  }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(BASE + '/login')
  await page.evaluate((t) => localStorage.setItem('connectoee.token', t), token)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  if (page.url().includes('/login')) {
    await page.locator('input[placeholder="admin"]').fill(USER)
    await page.locator('input[placeholder="Your password"]').fill(PASS)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForTimeout(1500)
  }

  const indexPath = path.join(KIT, 'INDEX.csv')
  let csv = fs.readFileSync(indexPath, 'utf8')

  function upsert(slug, route, file, theme, status, notes = '') {
    const line = [slug, route, file, theme, status, `"${notes.replace(/"/g, '""')}"`].join(',')
    const re = new RegExp(`^${slug},.*$`, 'm')
    if (re.test(csv)) csv = csv.replace(re, line)
    else csv += `\n${line}`
    console.log(`${status} ${slug}`)
  }

  // Hub chips (Mantine Chip → checkbox role)
  for (const chip of ['Pinned', 'Kiosk', 'Analysis']) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1000)
    const label = page.getByText(chip, { exact: true }).first()
    if (await label.count()) {
      await label.click()
      await page.waitForTimeout(600)
      const file = `03-dashboards/dashboards-hub-filter-${chip.toLowerCase()}.png`
      await page.screenshot({ path: path.join(KIT, file), fullPage: true })
      upsert(`dashboards-hub-filter-${chip.toLowerCase()}`, `/?chip=${chip}`, file, 'light', 'pass')
    } else {
      upsert(`dashboards-hub-filter-${chip.toLowerCase()}`, '/', `03-dashboards/dashboards-hub-filter-${chip.toLowerCase()}.png`, 'light', 'skip', 'chip label missing')
    }
  }

  // Builder property tabs — select a widget first
  const editId = ids.dashBevProduction || ids.dashAny
  if (editId) {
    await page.goto(`${BASE}/builder/${editId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    // Click first canvas widget card/box
    const widget = page.locator('[data-widget-id], .react-grid-item, [class*="WidgetCard"]').first()
    if (await widget.count()) {
      await widget.click({ force: true }).catch(() => {})
      await page.waitForTimeout(500)
    } else {
      // click center of canvas
      const canvas = page.locator('main, [class*="BuilderCanvas"], .react-grid-layout').first()
      if (await canvas.count()) {
        const box = await canvas.boundingBox()
        if (box) await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3)
        await page.waitForTimeout(500)
      }
    }
    for (const tab of ['Data', 'Widget', 'Layout']) {
      const t = page.getByRole('tab', { name: new RegExp(`^${tab}$`, 'i') })
      const alt = page.getByText(tab, { exact: true })
      const target = (await t.count()) ? t.first() : (await alt.count()) ? alt.first() : null
      const file = `09-builder/builder-properties-${tab.toLowerCase()}.png`
      if (target) {
        await target.click().catch(() => {})
        await page.waitForTimeout(400)
        await page.screenshot({ path: path.join(KIT, file), fullPage: true })
        upsert(`builder-properties-${tab.toLowerCase()}`, `/builder/${editId} #${tab}`, file, 'light', 'pass')
      } else {
        upsert(`builder-properties-${tab.toLowerCase()}`, `/builder/${editId}`, file, 'light', 'skip', 'tab still missing after select')
      }
    }
  }

  // MFA / must-change — mark skip if not present
  upsert('login-mfa', '/login (mfa)', '01-auth/login-mfa.png', 'light', 'skip', 'seed admin has no MFA challenge')
  upsert('login-must-change-password', '/login (must-change)', '01-auth/login-must-change-password.png', 'light', 'skip', 'seed admin password already set')
  upsert('trial-banner', 'shell banner', '01-auth/trial-banner.png', 'light', 'skip', 'Personal/active license — trial banner not visible')

  fs.writeFileSync(indexPath, csv)
  await browser.close()
  console.log('gaps done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
