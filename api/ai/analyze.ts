/**
 * Vercel Edge proxy → Mistral Chat Completions.
 * Local dev uses Vite middleware in vite.config.ts (same contract).
 */
import {
  assertSameOrigin,
  checkRateLimit,
  clientIp,
  handleProbe,
  MAX_ANALYZE_BYTES,
  methodNotAllowed,
  missingKey,
  MISTRAL_CHAT_URL,
  proxyMistral,
  RATE_LIMIT_ANALYZE,
  RATE_LIMIT_PROBE,
  readJsonBody,
} from './_shared'

export const config = {
  runtime: 'edge',
  regions: ['fra1'],
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
  const parsed = await readJsonBody(request, MAX_ANALYZE_BYTES)
  if (!parsed.ok) return parsed.response

  const isProbe = parsed.body.probe === true
  const ip = clientIp(request)
  const limited = checkRateLimit(
    `${isProbe ? 'probe' : 'analyze'}:${ip}`,
    isProbe ? RATE_LIMIT_PROBE : RATE_LIMIT_ANALYZE,
  )
  if (limited) return limited

  const probe = handleProbe(parsed.body, apiKey)
  if (probe) return probe

  if (!apiKey) return missingKey()

  const upstreamBody = { ...parsed.body }
  delete upstreamBody.probe
  return proxyMistral(MISTRAL_CHAT_URL, apiKey, upstreamBody)
}
