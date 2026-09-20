/**
 * Vercel Edge proxy → Mistral Chat Completions.
 * Local dev uses Vite middleware in vite.config.ts (same contract).
 */
import {
  handleProbe,
  jsonResponse,
  MAX_ANALYZE_BYTES,
  methodNotAllowed,
  missingKey,
  MISTRAL_CHAT_URL,
  proxyMistral,
  readJsonBody,
} from './_shared'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  // Same-origin SPA only — no CORS ACAO headers (browser cross-origin blocked).
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

  const apiKey = process.env.MISTRAL_API_KEY
  const parsed = await readJsonBody(request, MAX_ANALYZE_BYTES)
  if (!parsed.ok) return parsed.response

  const probe = handleProbe(parsed.body, apiKey)
  if (probe) return probe

  if (!apiKey) return missingKey()

  // Strip client probe flag if present
  const upstreamBody = { ...parsed.body }
  delete upstreamBody.probe
  return proxyMistral(MISTRAL_CHAT_URL, apiKey, upstreamBody)
}
