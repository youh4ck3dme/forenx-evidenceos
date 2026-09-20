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

### Exact UI clicks

1. [vercel.com](https://vercel.com) → **Add New…** → **Project** → **Import** Git repository.
2. Select the repo. If the app lives in a subfolder, set **Root Directory** → `forenx-evidence-os`.
3. Framework Preset should detect **Vite** (also defined in `vercel.json`).
4. Confirm **Build Command** `npm run build` and **Output Directory** `dist`.
5. **Environment Variables** → Add `MISTRAL_API_KEY` for Production (and Preview if needed).  
   Do **not** add `VITE_MISTRAL_API_KEY`.
6. **Deploy**.
7. Optional but recommended without auth: Project → **Settings** → **Deployment Protection** on Preview (and Production if the app must not be a public AI proxy).

### Checklist after deploy

- [ ] Welcome loads (SK default), Justicia icon + PWA installable
- [ ] `POST /api/ai/analyze` with `{ "probe": true }` → `{ ok, mode }` (no Mistral call)
- [ ] Analyze only after user click + confirm dialog
- [ ] Offline / missing key does not fake success

### What Vercel serves

| Path | Behavior |
|------|----------|
| `/` + SPA routes | Static `dist/` + rewrite to `index.html` |
| `POST /api/ai/analyze` | Edge proxy → Mistral chat |
| `POST /api/ai/ocr` | Edge proxy → Mistral OCR |
| `POST` with `{ "probe": true }` | Status only — no upstream call |

PWA caches the app shell; `/api/*` is **NetworkOnly** (no fake offline AI success).  
Security headers (incl. CSP allowing workers/fonts) are in `vercel.json`.

## Next polish passes (copy-paste prompty)

See [`docs/POLISH_PROMPTS.md`](docs/POLISH_PROMPTS.md) for:

1. **Prompt 1** — product polish (OCR wiring, i18n leftovers, empty states, regression).
2. **Prompt 2** — Vercel tip-top re-audit / hardening checklist.

## Security notes

- Evidence content is untrusted data (prompt-injection isolation in AI prompts).
- Originals are never mutated; AI output is a derived artifact.
- Without authentication, treat a public AI proxy as a paid-abuse risk.
