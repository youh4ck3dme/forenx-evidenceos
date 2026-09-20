import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

function mistralApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'forenx-mistral-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/ai/')) return next()

        const apiKey = env.MISTRAL_API_KEY || process.env.MISTRAL_API_KEY
        if (!apiKey) {
          res.statusCode = 503
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: 'MISTRAL_API_KEY not configured',
              mode: 'unavailable',
            }),
          )
          return
        }

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk))
          }
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const isOcr = req.url.includes('/ocr')

          const mistralUrl = isOcr
            ? 'https://api.mistral.ai/v1/ocr'
            : 'https://api.mistral.ai/v1/chat/completions'

          const upstream = await fetch(mistralUrl, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          })

          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          res.end(text)
        } catch (error) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : 'Proxy failure',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, '')
  return {
  plugins: [
    react(),
    tailwindcss(),
    mistralApiPlugin(env),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ForenX EvidenceOS',
        short_name: 'ForenX',
        description: 'Local-first AI Forensic Workspace',
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, './src'),
    },
  },
  worker: {
    format: 'es',
  },
}
})
