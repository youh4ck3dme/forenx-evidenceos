/**
 * Vercel Edge proxy → Mistral OCR / Document AI.
 */
import {
  handleProbe,
  jsonResponse,
  MAX_OCR_BYTES,
  methodNotAllowed,
  missingKey,
  MISTRAL_OCR_URL,
  proxyMistral,
  readJsonBody,
} from './_shared'

export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true }, 204)
  }
  if (request.method !== 'POST') return methodNotAllowed()

  const apiKey = process.env.MISTRAL_API_KEY
  const parsed = await readJsonBody(request, MAX_OCR_BYTES)
  if (!parsed.ok) return parsed.response

  const probe = handleProbe(parsed.body, apiKey)
  if (probe) return probe

  if (!apiKey) return missingKey()

  const upstreamBody = { ...parsed.body }
  delete upstreamBody.probe
  return proxyMistral(MISTRAL_OCR_URL, apiKey, upstreamBody)
}
