/**
 * Vercel Edge proxy → Mistral OCR / Document AI.
 */
import {
  assertSameOrigin,
  checkRateLimit,
  clientIp,
  handleProbe,
  MAX_OCR_BYTES,
  methodNotAllowed,
  missingKey,
  MISTRAL_OCR_URL,
  proxyMistral,
  RATE_LIMIT_OCR,
  RATE_LIMIT_PROBE,
  readJsonBody,
} from './_shared.js'

export const config = {
  runtime: 'edge',
  regions: ['fra1'],
  // Edge has no memory knob; body ceiling is MAX_OCR_BYTES in _shared.
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        Allow: 'POST',
        'Cache-Control': 'no-store',
      },
    })
  }
  if (request.method !== 'POST') return methodNotAllowed()

  const originBlock = assertSameOrigin(request)
  if (originBlock) return originBlock

  const apiKey = process.env.MISTRAL_API_KEY
  const parsed = await readJsonBody(request, MAX_OCR_BYTES)
  if (parsed.ok === false) return parsed.response

  const isProbe = parsed.body.probe === true
  const ip = clientIp(request)
  const limited = checkRateLimit(
    `${isProbe ? 'probe' : 'ocr'}:${ip}`,
    isProbe ? RATE_LIMIT_PROBE : RATE_LIMIT_OCR,
  )
  if (limited) return limited

  const probe = handleProbe(parsed.body, apiKey)
  if (probe) return probe

  if (!apiKey) return missingKey()

  const upstreamBody = { ...parsed.body }
  delete upstreamBody.probe
  return proxyMistral(MISTRAL_OCR_URL, apiKey, upstreamBody)
}
