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
npm run test:guards    # same-origin + rate-limit unit checks
npm run test:e2e
LIVE_AI=1 npm run test:e2e   # optional live probe (local)
```

## Architecture

- `localStorage` — settings / small indexes only (incl. locale `sk`|`en`)
- IndexedDB — cases, evidence metadata, findings, entities, timeline, AI runs, audit
- OPFS — immutable originals + derived artifacts under `/forenx/cases/{caseId}/…`
- AI — **on-click only** + confirm dialog before sending evidence text

No auth. No production database.

## Deploy on Vercel (production)

### Exact UI clicks → production URL

1. Push `forenx-evidence-os` to GitHub/GitLab.
2. [vercel.com](https://vercel.com) → **Add New…** → **Project** → **Import** the repo.
3. **Root Directory**: `forenx-evidence-os` if the app is in a monorepo subfolder; otherwise leave as repo root.
4. Framework Preset: **Vite** (`vercel.json` also sets build/output).
5. Confirm **Build Command** `npm run build`, **Output Directory** `dist`.
6. **Settings → Environment Variables** → Add `MISTRAL_API_KEY` for **Production** (and Preview if desired).  
   Never add `VITE_MISTRAL_API_KEY`.
7. **Deploy** → copy the production URL (e.g. `https://forenx-….vercel.app`).
8. **Strongly recommended** without auth: **Settings → Deployment Protection** on Preview (and Production if the app must not be a public AI proxy).

Region: `fra1` (see `vercel.json`). OCR stays on Edge with a **4 MiB** JSON body ceiling (no serverless memory knob on Edge).

### Live smoke (after deploy)

```bash
FORENX_BASE_URL=https://YOUR-APP.vercel.app npm run smoke:live
```

Checks:

- evil `Origin` → `403`
- `{ "probe": true }` on `/api/ai/analyze` and `/api/ai/ocr` → `{ ok, mode: "live" }` when key is set
- analyze proxy does not echo secrets
- UI confirm-gated analyze/OCR still need a quick manual browser pass

### Checklist after deploy

- [ ] Welcome loads (SK default), Justicia icon + PWA installable
- [ ] `npm run smoke:live` passes
- [ ] Browser: Auto Triage → confirm → result; Cancel/Esc → no network analyze
- [ ] Browser: image → OCR & Structure → confirm → OCR derived text
- [ ] Offline / missing key does not fake LIVE success
- [ ] Deployment Protection enabled (or abuse risk accepted)

### What Vercel serves

| Path | Behavior |
|------|----------|
| `/` + SPA routes | Static `dist/` + rewrite to `index.html` |
| `POST /api/ai/analyze` | Edge proxy → Mistral chat (same-origin + rate limit) |
| `POST /api/ai/ocr` | Edge proxy → Mistral OCR (same-origin + rate limit) |
| `POST` with `{ "probe": true }` | Status only — no upstream call |

**Abuse controls (Edge):**

- Same-origin: `Origin` / `Referer` must match app origin (or `Sec-Fetch-Site: same-origin`)
- Rate limits (per IP, soft / per-isolate): analyze 20/min, OCR 8/min, probe 60/min
- Body ceilings: analyze ~1.5 MiB, OCR ~4 MiB
- No CORS ACAO; secrets never echoed

PWA caches the app shell; `/api/*` is **NetworkOnly** (no fake offline AI success).  
Security headers (incl. CSP allowing workers/fonts) are in `vercel.json`.

## Next polish passes (copy-paste prompty)

See [`docs/POLISH_PROMPTS.md`](docs/POLISH_PROMPTS.md).

## Security notes

- Evidence content is untrusted data (prompt-injection isolation in AI prompts).
- Originals are never mutated; AI output is a derived artifact.
- Without authentication, treat a public AI proxy as a paid-abuse risk even with rate limits.
