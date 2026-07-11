import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// Resolve catalog types from registry source (no TS compile needed)
function loadCatalogTypes() {
  const registryPath = path.resolve('frontend/src/components/widgets/registry.tsx')
  const src = fs.readFileSync(registryPath, 'utf8')
  const cat = src.slice(src.indexOf('export const widgetCatalog'))
  return [...cat.matchAll(/type: '([^']+)'/g)].map((m) => m[1])
}

const baseUrl = process.env.AUDIT_URL ?? 'http://localhost:5173/dev/widgets'
const outDir = path.resolve(process.env.OUT_DIR ?? 'docs/widget-screenshots/v1')
const types = loadCatalogTypes()

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
  await page.waitForSelector('[id^="widget-audit-"]', { timeout: 90000 })
  if (mode === 'dark') {
    await page.getByText('Dark', { exact: true }).click()
    await page.waitForTimeout(400)
  } else {
    const light = page.getByText('Light', { exact: true })
    if ((await light.count()) > 0) {
      await light.click()
      await page.waitForTimeout(200)
    }
  }
  let ok = 0
  for (const type of types) {
    let saved = false
    for (let attempt = 0; attempt < 3 && !saved; attempt++) {
      try {
        const card = page.locator(`#widget-audit-${type}`)
        if ((await card.count()) === 0) {
          console.warn('Missing', type)
          break
        }
        await card.scrollIntoViewIfNeeded()
        await page.waitForTimeout(80)
        const frame = card.locator('[data-widget-preview]').first()
        const target = (await frame.count()) > 0 ? frame : card
        const file = path.join(outDir, `${type}-${mode}.png`)
        await target.screenshot({ path: file, timeout: 10000 })
        ok++
        saved = true
        if (ok % 20 === 0) console.log(`… ${ok}/${types.length} ${mode}`)
      } catch (err) {
        if (attempt === 2) console.warn('Failed', type, mode, err.message?.split('\n')[0])
        await page.waitForTimeout(200)
      }
    }
  }
  console.log(`Saved ${ok}/${types.length} ${mode} screenshots → ${outDir}`)
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  console.log(`Capturing ${types.length} widgets from ${baseUrl}`)
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
