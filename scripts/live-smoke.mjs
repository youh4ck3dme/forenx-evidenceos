#!/usr/bin/env node
/**
 * Live production smoke against a deployed ForenX URL.
 *
 * Usage:
 *   FORENX_BASE_URL=https://your-app.vercel.app node scripts/live-smoke.mjs
 *
 * Requires MISTRAL_API_KEY configured on the deployment.
 * Sends Origin header (required by same-origin API guards).
 * Does NOT print secrets.
 */
const BASE = (process.env.FORENX_BASE_URL || '').replace(/\/$/, '')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

async function post(path, body) {
  const url = `${BASE}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: BASE,
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text.slice(0, 200) }
  }
  return { status: res.status, json, text }
}

async function main() {
  assert(BASE, 'Set FORENX_BASE_URL to your Vercel deployment origin')
  console.log('Live smoke against', BASE)

  // 1) Cross-origin must fail
  {
    const res = await fetch(`${BASE}/api/ai/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example',
      },
      body: JSON.stringify({ probe: true }),
    })
    assert(res.status === 403, `Expected 403 for evil Origin, got ${res.status}`)
    console.log('OK same-origin reject')
  }

  // 2) Probe
  {
    const { status, json } = await post('/api/ai/analyze', { probe: true })
    assert(status === 200, `probe status ${status}`)
    assert(json && typeof json.ok === 'boolean', 'probe returns ok')
    assert(json.mode === 'live' || json.mode === 'unavailable', 'probe mode')
    console.log('OK probe', json)
    if (!json.ok || json.mode !== 'live') {
      console.log(
        'WARN: deployment is not LIVE (missing MISTRAL_API_KEY?). Remaining live calls skipped.',
      )
      console.log('LIVE_SMOKE_PARTIAL')
      return
    }
  }

  // 3) Tiny analyze (structured) — proves proxy works; not a full UI confirm test
  {
    const { status, json, text } = await post('/api/ai/analyze', {
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'user',
          content:
            'Return ONLY JSON: {"statement":"smoke","epistemicClass":"UNKNOWN","confidence":0.1,"sourceReferences":[]}',
        },
      ],
      temperature: 0,
    })
    assert(status === 200 || status === 422 || status === 400, `analyze status ${status}`)
    assert(!/mistral_api_key|sk-[a-z0-9]/i.test(text), 'must not echo secrets')
    console.log('OK analyze proxy status', status, json?.object || json?.model || 'ok')
  }

  // 4) OCR probe path (same origin + rate limit path)
  {
    const { status, json } = await post('/api/ai/ocr', { probe: true })
    assert(status === 200, `ocr probe ${status}`)
    assert(json?.ok === true && json?.mode === 'live', 'ocr probe live')
    console.log('OK ocr probe')
  }

  console.log('LIVE_SMOKE_OK')
  console.log(
    'Note: UI confirm-gated analyze/OCR still require manual browser check (click + confirm).',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
