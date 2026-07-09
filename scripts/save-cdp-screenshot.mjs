import fs from 'node:fs'
import path from 'node:path'

const cdpFile = process.argv[2]
const outFile = process.argv[3]
if (!cdpFile || !outFile) {
  console.error('Usage: node save-cdp-screenshot.mjs <cdp-json> <out.png>')
  process.exit(1)
}
const raw = JSON.parse(fs.readFileSync(cdpFile, 'utf8'))
const b64 = raw.result?.data ?? raw.data
if (!b64) {
  console.error('No screenshot data in', cdpFile)
  process.exit(1)
}
fs.mkdirSync(path.dirname(outFile), { recursive: true })
fs.writeFileSync(outFile, Buffer.from(b64, 'base64'))
console.log('Saved', outFile, fs.statSync(outFile).size, 'bytes')
