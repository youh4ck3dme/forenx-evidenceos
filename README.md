# ForenX EvidenceOS

Local-first AI forensic analysis PWA (MVP 0.1).

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
npm install
npm run dev
```

Optional: set `MISTRAL_API_KEY` in `.env.local` for live analysis. Without it, the UI uses the mock AI provider.

## Architecture

- `localStorage` — settings / small indexes only
- IndexedDB — cases, evidence metadata, findings, entities, timeline, AI runs, audit
- OPFS — immutable originals + derived artifacts under `/forenx/cases/{caseId}/…`

No auth. No production database.
