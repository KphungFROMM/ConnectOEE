import { chromium } from 'playwright'

const baseUrl = process.env.AUDIT_URL ?? 'http://localhost:5173/dev/templates'
const expected = 18

async function loginIfNeeded(page) {
  await page.waitForTimeout(400)
  const onLogin = page.url().includes('/login') || (await page.getByText('Sign in to continue').count()) > 0
  if (!onLogin) return
  await page.locator('input[placeholder="admin"]').fill(process.env.AUDIT_USER ?? 'Admin')
  await page.locator('input[placeholder="Your password"]').fill(process.env.AUDIT_PASS ?? 'ChangeMe!123')
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForTimeout(1500)
  if (!page.url().includes('/dev/templates')) await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
}

async function auditMode(page, mode) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await loginIfNeeded(page)
  await page.waitForSelector('[id^="template-audit-"]', { timeout: 30000 })
  if (mode === 'dark') {
    await page.getByText('Dark', { exact: true }).click()
    await page.waitForTimeout(400)
  }
  const cards = page.locator('[id^="template-audit-"]')
  const count = await cards.count()
  const issues = []
  if (count !== expected) issues.push(`${mode}: expected ${expected} cards, got ${count}`)

  for (let i = 0; i < count; i++) {
    const card = cards.nth(i)
    const id = await card.getAttribute('id')
    const badge = card.locator('text=/\\d+\\/\\d+ rows|over budget|OK|Pass|Fail/i').first()
    const badgeText = (await badge.count()) ? await badge.innerText() : ''
    const frame = card.locator('div[style*="overflow"]').first()
    if ((await frame.count()) === 0) {
      issues.push(`${mode} ${id}: missing frame`)
      continue
    }
    const overflow = await frame.evaluate((el) => {
      const scroll = el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2
      return { scroll, sh: el.scrollHeight, ch: el.clientHeight }
    })
    if (overflow.scroll) issues.push(`${mode} ${id}: frame scroll ${overflow.sh}>${overflow.ch}`)
    if (/over budget|fail/i.test(badgeText)) issues.push(`${mode} ${id}: badge ${badgeText}`)
  }
  return { mode, count, issues }
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const page = await (await browser.newContext({ viewport: { width: 1920, height: 1080 } })).newPage()
  const light = await auditMode(page, 'light')
  const dark = await auditMode(page, 'dark')
  await browser.close()
  console.log(JSON.stringify({ light, dark }, null, 2))
  const all = [...light.issues, ...dark.issues]
  if (all.length) {
    console.error('QA FAILED', all)
    process.exit(2)
  }
  console.log('QA PASS: 18/18 light+dark, no frame scroll')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
