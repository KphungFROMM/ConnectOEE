import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_URL ?? 'http://localhost:5173/dev/templates'
const outDir = path.resolve(process.env.OUT_DIR ?? 'docs/template-screenshots/v7.2')
const slugs = [
  'operator-floor',
  'line-andon',
  'maintenance-wall',
  'plant-overview',
  'shift-supervisor',
  'quality-pulse',
  'production-board',
  'analytics-starter',
]

async function ensureAuth(page) {
  const token = process.env.AUDIT_TOKEN
  if (token) {
    await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' })
    await page.evaluate((t) => {
      localStorage.setItem('connectoee.token', t)
    }, token)
    return
  }
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(500)
  const onLogin = page.url().includes('/login') || (await page.getByText('Sign in to continue').count()) > 0
  if (!onLogin) return
  await page.locator('input[placeholder="admin"]').fill(process.env.AUDIT_USER ?? 'admin')
  await page.locator('input[placeholder="Your password"]').fill(process.env.AUDIT_PASS ?? 'ChangeMe!123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForTimeout(1500)
}

async function captureMode(page, mode) {
  await ensureAuth(page)
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[id^="template-audit-"]', { timeout: 30000 })
  if (mode === 'dark') {
    await page.getByText('Dark', { exact: true }).click()
    await page.waitForTimeout(300)
  }
  const galleryFile = path.join(outDir, `gallery-${mode}.png`)
  await page.screenshot({ path: galleryFile, fullPage: true })
  console.log('Saved', galleryFile)
  for (const slug of slugs) {
    const card = page.locator(`#template-audit-${slug}`)
    if ((await card.count()) === 0) {
      console.warn('Missing', slug)
      continue
    }
    await card.scrollIntoViewIfNeeded()
    const frame = card.locator('div[style*="overflow: hidden"]').first()
    const file = path.join(outDir, `${slug}-${mode}.png`)
    await frame.screenshot({ path: file })
    console.log('Saved', file)
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } })
  const page = await context.newPage()
  const modeArg = process.argv[2] ?? 'all'
  if (modeArg === 'all' || modeArg === 'light') await captureMode(page, 'light')
  if (modeArg === 'all' || modeArg === 'dark') await captureMode(page, 'dark')
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
