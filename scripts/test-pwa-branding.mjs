/**
 * Smoke / unit checks for ForenX PWA branding helpers.
 * Run: node scripts/test-pwa-branding.mjs
 */
import assert from 'node:assert/strict'
import {
  DEFAULT_APP_NAME,
  appNameFromHost,
  renderWebManifest,
  forenxPwaHeadTags,
} from './forenx-pwa-shared.mjs'

assert.equal(DEFAULT_APP_NAME, 'ForenX EvidenceOS')
assert.equal(appNameFromHost('forenx-evidence-os.vercel.app'), 'ForenX EvidenceOS')
assert.equal(appNameFromHost('app.example.com'), 'ForenX EvidenceOS')
assert.notEqual(appNameFromHost('anything'), 'Grok App')

const manifest = renderWebManifest()
assert.equal(manifest.name, 'ForenX EvidenceOS')
assert.equal(manifest.short_name, 'EvidenceOS')
assert.equal(manifest.theme_color, '#0b0d10')
assert.equal(manifest.background_color, '#0b0d10')
assert.ok(manifest.icons.every((i) => i.src.startsWith('/icons/')))
assert.ok(!manifest.icons.some((i) => i.src.includes('__grok')))
assert.ok(!manifest.icons.some((i) => i.src.includes('icon-180.png') && i.src.includes('__grok')))

const head = forenxPwaHeadTags()
assert.match(head, /apple-touch-icon\.png/)
assert.match(head, /theme-color" content="#0b0d10"/)
assert.doesNotMatch(head, /__grok/)
assert.doesNotMatch(head, /Grok App/)

console.log('PWA_BRANDING_OK')
