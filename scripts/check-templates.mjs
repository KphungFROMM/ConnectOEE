const base = 'http://localhost:5080'

async function main() {
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'Admin', password: 'ChangeMe!123' }),
  })
  const loginText = await loginRes.text()
  if (!loginRes.ok) {
    console.error('Login failed', loginRes.status, loginText)
    process.exit(1)
  }
  console.log('Login:', loginRes.status, loginText.slice(0, 120))

  const setCookie = loginRes.headers.get('set-cookie')
  const headers = setCookie ? { Cookie: setCookie.split(',').map((c) => c.split(';')[0]).join('; ') } : {}

  const res = await fetch(`${base}/api/dashboards/templates`, { headers })
  const text = await res.text()
  if (!res.ok) {
    console.error('Templates failed', res.status, text)
    process.exit(1)
  }
  const templates = JSON.parse(text)
  if (!Array.isArray(templates)) {
    console.error('Unexpected response', templates)
    process.exit(1)
  }

  const kiosk = new Set(['Operator Kiosk', 'Line Andon Wall', 'Maintenance Wallboard'])
  const rows = templates.map((t) => {
    const layout = JSON.parse(t.layoutJson || '[]')
    const maxRow = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    const budget = kiosk.has(t.name) || t.category === 'Kiosk' ? 8 : 9
    return { name: t.name, category: t.category, maxRow, budget, widgets: layout.length, ok: maxRow <= budget }
  })
  rows.sort((a, b) => b.maxRow - a.maxRow)
  console.table(rows)
  const bad = rows.filter((r) => !r.ok)
  console.log(`\n${rows.length} templates, ${bad.length} over budget`)
  if (bad.length) process.exit(2)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
