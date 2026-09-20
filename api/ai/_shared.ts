/**
 * Shared hardening helpers for ForenX Mistral proxy (Vercel Edge).
 * Never expose MISTRAL_API_KEY to the browser.
 */

export const MISTRAL_CHAT_URL = 'https://api.mistral.ai/v1/chat/completions'
export const MISTRAL_OCR_URL = 'https://api.mistral.ai/v1/ocr'

/** ~1.5 MiB JSON body ceiling for analyze; OCR may be larger. */
export const MAX_ANALYZE_BYTES = 1_500_000
export const MAX_OCR_BYTES = 4_000_000

/** Soft per-isolate limits (resets on cold start — best-effort abuse brake). */
export const RATE_LIMIT_ANALYZE = { windowMs: 60_000, max: 20 }
export const RATE_LIMIT_OCR = { windowMs: 60_000, max: 8 }
export const RATE_LIMIT_PROBE = { windowMs: 60_000, max: 60 }

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
}

type Bucket = { resetAt: number; count: number }
const rateBuckets = new Map<string, Bucket>()

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

export function forbiddenOrigin(): Response {
  return jsonResponse({ error: 'Forbidden origin' }, 403)
}

export function rateLimited(retryAfterSec: number): Response {
  return jsonResponse(
    { error: 'Rate limit exceeded' },
    429,
    { 'Retry-After': String(retryAfterSec) },
  )
}

/** Extract client IP from common Edge / proxy headers. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}

/**
 * Same-origin gate for browser SPA calls.
 * Allows matching Origin, matching Referer origin, or Sec-Fetch-Site same-origin.
 * Rejects cross-site Origin/Referer. Tools (curl) must send Origin: <app origin>.
 */
export function assertSameOrigin(request: Request): Response | null {
  const url = new URL(request.url)
  const originHeader = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const secFetchSite = request.headers.get('sec-fetch-site')

  if (originHeader) {
    try {
      if (new URL(originHeader).origin === url.origin) return null
    } catch {
      /* invalid origin */
    }
    return forbiddenOrigin()
  }

  if (referer) {
    try {
      if (new URL(referer).origin === url.origin) return null
    } catch {
      /* invalid referer */
    }
    return forbiddenOrigin()
  }

  // Modern browsers on same-origin POST usually send Origin; if missing,
  // accept only explicit same-origin fetch metadata (not cross-site).
  if (secFetchSite === 'same-origin') return null

  // No Origin/Referer/Sec-Fetch-Site — treat as non-browser tooling without proof.
  return forbiddenOrigin()
}

/**
 * Fixed-window rate limit per key (IP + route class).
 * Returns null when allowed, or a 429 Response.
 */
export function checkRateLimit(
  key: string,
  limit: { windowMs: number; max: number },
  now = Date.now(),
): Response | null {
  const existing = rateBuckets.get(key)
  if (!existing || now >= existing.resetAt) {
    rateBuckets.set(key, { resetAt: now + limit.windowMs, count: 1 })
    return null
  }
  if (existing.count >= limit.max) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    return rateLimited(retryAfterSec)
  }
  existing.count += 1
  return null
}

/** Test helper — clear isolate buckets. */
export function resetRateLimitBucketsForTests(): void {
  rateBuckets.clear()
}

export type AiRouteKind = 'analyze' | 'ocr' | 'probe'

export function guardAiRequest(
  request: Request,
  kind: AiRouteKind,
): Response | null {
  const originBlock = assertSameOrigin(request)
  if (originBlock) return originBlock

  const ip = clientIp(request)
  const limit =
    kind === 'ocr'
      ? RATE_LIMIT_OCR
      : kind === 'probe'
        ? RATE_LIMIT_PROBE
        : RATE_LIMIT_ANALYZE
  return checkRateLimit(`${kind}:${ip}`, limit)
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
    // Never include apiKey in any response body.
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
