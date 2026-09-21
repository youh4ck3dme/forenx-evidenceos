/**
 * ForenX PWA shared helpers (manifest + head tags).
 * Keeps install branding on ForenX — never "Grok App".
 */

export const DEFAULT_APP_NAME = 'ForenX EvidenceOS'
export const DEFAULT_SHORT_NAME = 'EvidenceOS'
export const THEME_COLOR = '#0b0d10'
export const BACKGROUND_COLOR = '#0b0d10'

/**
 * Always return ForenX branding regardless of host (vercel.app / custom).
 * @param {string} [_host]
 */
export function appNameFromHost(_host) {
  return DEFAULT_APP_NAME
}

/**
 * @param {{ appName?: string, shortName?: string }} [opts]
 */
export function renderWebManifest(opts = {}) {
  const name = opts.appName ?? DEFAULT_APP_NAME
  const short_name = opts.shortName ?? DEFAULT_SHORT_NAME
  return {
    id: '/',
    name,
    short_name,
    description: 'Local-first AI Forensic Workspace',
    lang: 'sk',
    dir: 'ltr',
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui', 'browser'],
    orientation: 'any',
    start_url: '/',
    scope: '/',
    categories: ['productivity', 'utilities'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}

/**
 * HTML head link/meta tags for PWA install (apple-touch + theme-color).
 * @param {{ appName?: string }} [opts]
 */
export function forenxPwaHeadTags(opts = {}) {
  const title = opts.appName ?? DEFAULT_APP_NAME
  return [
    `<link rel="manifest" href="/manifest.webmanifest" />`,
    `<link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />`,
    `<meta name="theme-color" content="${THEME_COLOR}" />`,
    `<meta name="apple-mobile-web-app-title" content="${title}" />`,
    `<meta name="mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
  ].join('\n')
}

/** @deprecated alias kept for tests migrating from grokPwaHeadTags */
export const grokPwaHeadTags = forenxPwaHeadTags
