import fs from 'node:fs'

const gradesSrc = fs.readFileSync('frontend/src/features/builder/widgetCommissionGrades.ts', 'utf8')
const metaSrc = fs.readFileSync('frontend/src/components/widgets/widgetPaletteMeta.ts', 'utf8')
const regSrc = fs.readFileSync('frontend/src/components/widgets/registry.tsx', 'utf8')
const cat = regSrc.slice(regSrc.indexOf('export const widgetCatalog'))
const types = [...cat.matchAll(/type: '([^']+)'/g)].map((m) => m[1])
const labels = Object.fromEntries([...cat.matchAll(/type: '([^']+)', label: '([^']+)'/g)].map((m) => [m[1], m[2]]))

const families = {}
for (const m of metaSrc.matchAll(/'([^']+)':\s*\{[\s\S]*?visualFamily:\s*'([^']+)'/g)) {
  families[m[1]] = m[2]
}
for (const m of metaSrc.matchAll(/^  ([a-z][a-z0-9-]*):\s*\{[\s\S]*?visualFamily:\s*'([^']+)'/gm)) {
  families[m[1]] = m[2]
}

const grades = {}
for (const m of gradesSrc.matchAll(
  /(?:'([^']+)'|([a-z][a-z0-9-]*)):\s*\{\s*grade:\s*'([^']+)',\s*family:\s*'([^']+)',\s*notes:\s*'([^']*)'/g,
)) {
  grades[m[1] || m[2]] = { grade: m[3], family: m[4], notes: m[5] }
}

const order = ['status', 'oee', 'downtime', 'production', 'layout']
const byFam = Object.fromEntries(order.map((f) => [f, []]))

for (const t of types) {
  const g = grades[t] || { grade: 'Pass', family: families[t] || 'layout', notes: '' }
  const fam = families[t] || g.family
  byFam[fam].push({ t, ...g, fam, label: labels[t] || t })
}

let md = `# Widget commission scorecard (Jul 2026)

Living Pass / Fix / Defer grades for all 111 registry widgets. Gallery badges read from \`frontend/src/features/builder/widgetCommissionGrades.ts\`.

| Type | Label | Family | Grade | Notes |
|------|-------|--------|-------|-------|
`

for (const fam of order) {
  for (const row of (byFam[fam] || []).sort((a, b) => a.t.localeCompare(b.t))) {
    md += `| \`${row.t}\` | ${row.label} | ${row.fam} | **${row.grade}** | ${row.notes} |\n`
  }
}

const counts = { Pass: 0, Fix: 0, Defer: 0 }
for (const t of types) {
  counts[(grades[t] || { grade: 'Pass' }).grade]++
}

md += `
## Counts

| Grade | Count |
|-------|------:|
| Pass | ${counts.Pass} |
| Fix | ${counts.Fix} |
| Defer | ${counts.Defer} |
| **Total** | **${types.length}** |

## Pass bar

1. Renders in Admin Widget Gallery light + dark, default size
2. Functions with mock/live ctx (no blank/crash; correct scope)
3. Flavors intentional when applicable (presentation / statusStyle / colorMode / frame)
4. Presentable per visual language (calm surfaces, readable type, no overlap)
5. State-of-the-art enough for industrial wall — or Defer with reason
`

fs.writeFileSync('docs/WIDGET-COMMISSION-SCORECARD-2026-07.md', md)
console.log('wrote docs/WIDGET-COMMISSION-SCORECARD-2026-07.md', counts)
