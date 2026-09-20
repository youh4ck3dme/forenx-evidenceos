# ForenX EvidenceOS

Local-first AI forensic analysis PWA (MVP).

## Stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn-style primitives
- Zustand, Dexie (IndexedDB), OPFS
- vite-plugin-pwa
- WebCrypto SHA-256
- PDF.js, Mammoth, marked
- Mistral via `/api/ai/*` proxy (mock mode without API key)

## Develop

```bash
cp .env.example .env.local
# set MISTRAL_API_KEY in .env.local (server-side only)
npm install
npm run dev
```

Optional: without a key, the UI uses the mock AI provider after user-triggered refresh/action.

```bash
npm run build
npm run test:e2e
LIVE_AI=1 npm run test:e2e   # optional live probe
```

## Architecture

- `localStorage` — settings / small indexes only (incl. locale `sk`|`en`)
- IndexedDB — cases, evidence metadata, findings, entities, timeline, AI runs, audit
- OPFS — immutable originals + derived artifacts under `/forenx/cases/{caseId}/…`
- AI — **on-click only** + confirm dialog before sending evidence text

No auth. No production database.

## Deploy on Vercel (production)

1. Push repo to GitHub/GitLab and **Import** into Vercel.
2. **Root Directory**: `forenx-evidence-os` (if monorepo) or repo root if this folder is the repo.
3. Framework preset: Vite (see `vercel.json`).
4. Build: `npm run build` → Output: `dist`.
5. **Environment variables** (Project → Settings → Environment Variables):
   - `MISTRAL_API_KEY` = your secret (Production + Preview as needed)
   - Do **not** set `VITE_MISTRAL_API_KEY` — never expose the key to the browser.
6. Deploy.
7. Strongly recommended without auth: enable **Vercel Deployment Protection** on Preview (and Production if the app is not meant to be a public AI proxy). A public unprotected `/api/ai/*` can be abused on your Mistral quota.

### What Vercel serves

| Path | Behavior |
|------|----------|
| `/` + SPA routes | Static `dist/` + rewrite to `index.html` |
| `POST /api/ai/analyze` | Edge proxy → Mistral chat |
| `POST /api/ai/ocr` | Edge proxy → Mistral OCR |
| `POST` with `{ "probe": true }` | Status only — no upstream call |

PWA caches the app shell; `/api/*` is **NetworkOnly** (no fake offline AI success).

## Security notes

- Evidence content is untrusted data (prompt-injection isolation in AI prompts).
- Originals are never mutated; AI output is a derived artifact.
- Without authentication, treat a public AI proxy as a paid-abuse risk.
