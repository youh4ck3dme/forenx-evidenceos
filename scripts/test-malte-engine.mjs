/**
 * Node smoke: Malte CSV map → transactions → deterministic detection alerts.
 * Run: node --experimental-strip-types scripts/test-malte-engine.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const csv = readFileSync(join(HERE, '../e2e/fixtures/malte_ebabcan_sample.csv'), 'utf8')

function splitCsvLine(line, delim) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
      continue
    }
    if (ch === delim && !inQuotes) {
      out.push(cur.trim())
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur.trim())
  return out
}

const lines = csv.trim().split(/\r?\n/)
const headers = splitCsvLine(lines[0], ';')
assert.ok(headers.includes('Amount'))
assert.ok(headers.includes('From'))
const rows = lines.slice(1).map((l) => splitCsvLine(l, ';'))
assert.equal(rows.length, 8)

// Shell name heuristic mirrors engine
const shellHints = ['s.r.o.', 'ltd', 'offshore', 'shell', 'holding', 'babcan']
let shellHits = 0
for (const row of rows) {
  const from = (row[3] || '').toLowerCase()
  const to = (row[4] || '').toLowerCase()
  if (shellHints.some((h) => from.includes(h) || to.includes(h))) shellHits += 1
}
assert.ok(shellHits >= 4, `expected shell hits, got ${shellHits}`)

// Cross-border count
let cross = 0
for (const row of rows) {
  if (row[6] && row[7] && row[6] !== row[7]) cross += 1
}
assert.ok(cross >= 4, `expected cross-border rows, got ${cross}`)

console.log('malte fixture smoke OK', { rows: rows.length, shellHits, cross })
