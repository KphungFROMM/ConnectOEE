/**
 * Fallback abstract SVG generator for template gallery thumbnails.
 * Prefer real crops from `node scripts/capture-template-screenshots.mjs`
 * promoted to `public/template-previews/{slug}.png` (v7.2+).
 * This script only writes SVGs when a PNG is missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/template-previews')

const names = [
  'Plant Command Center',
  'Executive Briefing',
  'Floor At-a-Glance',
  'Plant Reliability Hub',
  'TEEP & Utilization',
  'Line Performance Board',
  'Shift Huddle Board',
  'Machine Station Detail',
  'Production & Pace',
  'Quality & Yield Lab',
  'Downtime Detective',
  'Setup & Changeover',
  'Supervisor Cockpit',
  'Operator Kiosk',
  'Line Andon Wall',
  'Maintenance Wallboard',
  'Attainment Tracker',
  'Shift Compare',
]

const slug = (n) =>
  n
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const colors = ['#228be6', '#15aabf', '#40c057', '#fab005', '#fa5252', '#7950f2']

fs.mkdirSync(outDir, { recursive: true })

let wrote = 0
let skipped = 0
for (const [i, name] of names.entries()) {
  const s = slug(name)
  const pngPath = path.join(outDir, `${s}.png`)
  if (fs.existsSync(pngPath)) {
    skipped++
    continue
  }
  const c = colors[i % colors.length]
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#f8f9fa"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#g)"/>
  <rect x="24" y="24" width="592" height="56" rx="8" fill="${c}" opacity="0.9"/>
  <rect x="24" y="96" width="280" height="120" rx="8" fill="white" opacity="0.85"/>
  <rect x="320" y="96" width="296" height="120" rx="8" fill="white" opacity="0.85"/>
  <rect x="24" y="232" width="180" height="104" rx="8" fill="white" opacity="0.75"/>
  <rect x="220" y="232" width="180" height="104" rx="8" fill="white" opacity="0.75"/>
  <rect x="416" y="232" width="200" height="104" rx="8" fill="white" opacity="0.75"/>
  <text x="40" y="60" fill="white" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700">${name}</text>
  <text x="40" y="340" fill="#495057" font-family="Segoe UI, Arial, sans-serif" font-size="14">ConnectOEE fallback preview</text>
</svg>`
  fs.writeFileSync(path.join(outDir, `${s}.svg`), svg)
  wrote++
}

console.log(`Fallback SVGs: wrote ${wrote}, skipped ${skipped} (PNG present) → ${outDir}`)
