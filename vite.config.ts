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
        const isOcr = req.url.includes('/ocr')
        const maxBytes = isOcr ? 4_000_000 : 1_500_000

        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(Buffer.from(chunk))
          }
          const bodyText = Buffer.concat(chunks).toString('utf8')
          if (bodyText.length > maxBytes) {
            res.statusCode = 413
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Payload too large' }))
            return
          }
          const body = JSON.parse(bodyText || '{}') as {
            probe?: boolean
          }

          if (body.probe) {
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(
              JSON.stringify(
                apiKey
                  ? { ok: true, mode: 'live' }
                  : { ok: false, mode: 'unavailable' },
              ),
            )
            return
          }

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
      injectRegister: false,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'forenx-icon.png',
        'forenx-icon-16.png',
        'forenx-icon-32.png',
        'forenx-icon-180.png',
        'forenx-icon-192.png',
        'forenx-icon-512.png',
        'forenx-icon-maskable-512.png',
      ],
      manifest: {
        id: '/',
        name: 'ForenX EvidenceOS',
        short_name: 'ForenX',
        description: 'Local-first AI Forensic Workspace',
        lang: 'sk',
        dir: 'ltr',
        theme_color: '#0a0b0d',
        background_color: '#0a0b0d',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'utilities'],
        icons: [
          {
            src: '/forenx-icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/forenx-icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/forenx-icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
        // Keep the installable shell lean — large lazy parsers are fetched on demand.
        globIgnores: ['**/heic2any*', '**/pdf.worker*'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            method: 'POST',
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
            method: 'GET',
          },
          {
            urlPattern: ({ request, url }) =>
              request.destination === 'image' ||
              /\.(?:png|svg|ico|jpg|jpeg|webp)$/i.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'forenx-images',
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: false,
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
