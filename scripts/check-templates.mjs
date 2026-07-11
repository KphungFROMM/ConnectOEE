const base = 'http://localhost:5080'

async function main() {
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'Admin', password: 'ChangeMe!123' }),
  })
  const loginBody = await loginRes.json()
  if (!loginRes.ok) {
    console.error('Login failed', loginRes.status, loginBody)
    process.exit(1)
  }
  const token = loginBody.token || loginBody.accessToken
  if (!token) {
    console.error('No token in login response', loginBody)
    process.exit(1)
  }
  console.log('Login: OK')

  const headers = { Authorization: `Bearer ${token}` }
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

  const system = templates.filter((t) => t.isSystem !== false && t.category !== 'Custom')
  const kiosk = new Set(['Operator Kiosk', 'Line Andon Wall', 'Maintenance Wallboard'])
  const rows = system.map((t) => {
    const layout = JSON.parse(t.layoutJson || '[]')
    const maxRow = layout.reduce((m, w) => Math.max(m, w.y + w.h), 0)
    const budget = kiosk.has(t.name) || t.category === 'Kiosk' ? 8 : 9
    const withPresentation = layout.filter((w) => w.options && w.options.presentation).length
    return {
      name: t.name,
      category: t.category,
      maxRow,
      budget,
      widgets: layout.length,
      presentation: withPresentation,
      ok: maxRow <= budget,
    }
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
