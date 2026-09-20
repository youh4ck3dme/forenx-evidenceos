#!/usr/bin/env node
/**
 * Pure unit checks for API abuse guards (same-origin + rate limit).
 * Mirrors / exercises api/ai/_shared.ts via Node strip-types when available,
 * otherwise runs an equivalent inline implementation.
 */
import assert from 'node:assert/strict'

async function loadGuards() {
  // Prefer real shared module (Node TS strip).
  return await import('../api/ai/_shared.ts')
}

function req(url, headers = {}) {
  return new Request(url, { method: 'POST', headers })
}

async function main() {
  const g = await loadGuards()
  const base = 'https://forenx.example.com/api/ai/analyze'

  assert.equal(
    g.assertSameOrigin(req(base, { Origin: 'https://forenx.example.com' })),
    null,
    'same Origin allowed',
  )
  assert.equal(
    g.assertSameOrigin(
      req(base, { Referer: 'https://forenx.example.com/sandbox' }),
    ),
    null,
    'same Referer allowed',
  )
  assert.equal(
    g.assertSameOrigin(req(base, { 'Sec-Fetch-Site': 'same-origin' })),
    null,
    'Sec-Fetch-Site same-origin allowed',
  )
  assert.equal(
    g.assertSameOrigin(req(base, { Origin: 'https://evil.example' }))?.status,
    403,
    'cross Origin blocked',
  )
  assert.equal(
    g.assertSameOrigin(req(base))?.status,
    403,
    'missing Origin/Referer blocked',
  )

  g.resetRateLimitBucketsForTests()
  const limit = { windowMs: 60_000, max: 3 }
  assert.equal(g.checkRateLimit('t:1', limit, 1000), null)
  assert.equal(g.checkRateLimit('t:1', limit, 1001), null)
  assert.equal(g.checkRateLimit('t:1', limit, 1002), null)
  assert.equal(g.checkRateLimit('t:1', limit, 1003)?.status, 429)
  // new window
  assert.equal(g.checkRateLimit('t:1', limit, 1000 + 60_000), null)

  console.log('ABUSE_GUARDS_OK')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
