/**
 * Shared hardening helpers for ForenX Mistral proxy (Vercel Edge).
 * Never expose MISTRAL_API_KEY to the browser.
 */

export const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions'
export const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'

/** ~1.5 MiB JSON body ceiling for analyze; OCR may be larger. */
export const MAX_ANALYZE_BYTES = 1_500_000
export const MAX_OCR_BYTES = 4_000_000

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  })
}

export function methodNotAllowed(): Response {
  return jsonResponse({ error: 'Method not allowed' }, 405, {
    Allow: 'POST',
  })
}

export function missingKey(): Response {
  return jsonResponse(
    { error: 'MISTRAL_API_KEY not configured', mode: 'unavailable' },
    503,
  )
}

export function payloadTooLarge(): Response {
  return jsonResponse({ error: 'Payload too large' }, 413)
}

export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: Response }> {
  const lengthHeader = request.headers.get('content-length')
  if (lengthHeader) {
    const n = Number(lengthHeader)
    if (Number.isFinite(n) && n > maxBytes) {
      return { ok: false, response: payloadTooLarge() }
    }
  }

  const raw = await request.text()
  if (raw.length > maxBytes) {
    return { ok: false, response: payloadTooLarge() }
  }

  try {
    const body = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>
    return { ok: true, body }
  } catch {
    return {
      ok: false,
      response: jsonResponse({ error: 'Invalid JSON body' }, 400),
    }
  }
}

export function handleProbe(
  body: Record<string, unknown>,
  apiKey: string | undefined,
): Response | null {
  if (body.probe !== true) return null
  return jsonResponse(
    apiKey ? { ok: true, mode: 'live' } : { ok: false, mode: 'unavailable' },
    200,
  )
}

const ALLOWED_UPSTREAM = new Set([MISTRAL_CHAT_URL, MISTRAL_OCR_URL])

export async function proxyMistral(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (!ALLOWED_UPSTREAM.has(url)) {
    return jsonResponse({ error: 'Upstream not allowed' }, 500)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await upstream.text()
    // Never forward upstream auth headers; body is opaque JSON only.
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        ...SECURITY_HEADERS,
      },
    })
  } catch (error) {
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Upstream timeout'
        : error instanceof Error
          ? error.message
          : 'Proxy failure'
    return jsonResponse({ error: message }, 502)
  } finally {
    clearTimeout(timer)
  }
}
