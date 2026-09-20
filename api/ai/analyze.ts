/**
 * Vercel serverless handler placeholder for production deployment.
 * Local development uses the Vite middleware in vite.config.ts.
 *
 * Never expose MISTRAL_API_KEY to the browser.
 */
export const config = {
  runtime: 'edge',
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const apiKey = process.env.MISTRAL_API_KEY
  if (!apiKey) {
    return Response.json(
      { error: 'MISTRAL_API_KEY not configured', mode: 'unavailable' },
      { status: 503 },
    )
  }

  const body = await request.json()
  const upstream = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  })
}
