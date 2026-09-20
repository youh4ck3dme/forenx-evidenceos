# ForenX — copy-paste polish prompty

Použi tieto prompty v ďalšom agente (Cursor / Grok). **Nekopíruj secrets** do chatu.

---

## Prompt 1 — Polish / opravy zvyšku produktu

```text
You are polishing ForenX EvidenceOS (React + Vite + TS + Tailwind + Dexie + OPFS + PWA).

CONTEXT
- Local-first forensic PWA. No auth, no production DB.
- SK default UI + EN switcher already exists (src/lib/i18n).
- AI must remain ON-CLICK ONLY — no automatic /api/ai traffic on mount/interval.
- Mistral key is server-side only (.env.local / Vercel env). Never put the key in the client bundle.
- Branch/worktree: forenx-evidence-os.

GOAL
Ship a product polish pass for everything still incomplete or rough. Do not reinvent architecture.

MUST FIX / COMPLETE
1) Icon: finalize selected B+Justicia brand mark (scales of justice + elegant single wing, B&W #0a0b0d / white-gray). Update public/favicon.svg, forenx-icon.png, 192, 512, Welcome mark, PWA manifest.
2) Confirm dialog before any AI analyze that sends evidence text (SK/EN). Cancel = no network call.
3) Wire real OCR path for images/PDF-without-text via POST /api/ai/ocr (Mistral Document AI / OCR). Keep mock/offline failure honest. Originals stay immutable; OCR is derived.
4) i18n completeness: translate remaining user-visible EN strings (audit messages, case default names, status toasts, quarantine reasons) via sk/en dictionaries — not hardcoded.
5) Empty/loading/error/offline states polish across Sandbox, AI panel, viewer.
6) Command palette + Audit drawer reliability (Esc/overlay close, focus).
7) Storage warning UX when approaching quota.
8) Regression: extend scripts/regression.mjs — no auto AI; AI only after click; confirm cancel blocks request; locale SK/EN; import+hash; export audit.

QUALITY BAR
- Strict TypeScript, no fake successful AI while offline.
- Evidence content remains untrusted; keep prompt-injection isolation.
- Desktop-first forensic workstation aesthetic (existing dark Swiss look). Do not purple-ify or add dashboard card clutter.
- Commit with clear messages. Do not commit secrets.

OUT OF SCOPE
Auth, Supabase/Firebase, Wave 2/3 formats (pptx/xlsx/eml/zip), legal conclusions engine.
```

---

## Prompt 2 — Vercel produkcia tip-top (best practices)

```text
Prepare ForenX EvidenceOS for production deployment on Vercel. Repo app root: forenx-evidence-os (Vite + React + TS PWA).

HARD REQUIREMENTS
1) Add vercel.json for Vite:
   - build: npm run build
   - output: dist
   - SPA fallback rewrite to /index.html for non-file non-api routes
   - Keep /api/ai/* as serverless/edge functions
2) Harden api/ai/analyze and api/ai/ocr:
   - POST only
   - probe requests return 200 {ok, mode} without calling Mistral
   - require MISTRAL_API_KEY server-side; 503 if missing
   - proxy only to https://api.mistral.ai
   - sensible body size limit + timeouts
   - never echo secrets; minimal CORS (same-origin)
3) PWA production:
   - correct start_url, icons 192/512 + favicon.svg (Justicia B mark)
   - do NOT cache /api/* AI responses as successful offline results
4) Security headers in vercel.json (X-Content-Type-Options, Referrer-Policy, Permissions-Policy; careful CSP that still allows PWA workers and app assets)
5) Env documentation:
   - Update .env.example and README with Vercel steps
   - Document: set MISTRAL_API_KEY in Vercel Project Settings
   - Warn: without auth, protect Preview/Production (Deployment Protection) or accept abuse risk on public AI proxy
6) Client must stay AI-on-click-only; verify no mount/interval probes remain
7) npm run build must pass; fix any Vercel path/runtime incompatibilities in api/*.ts
8) Optional: vercel.json regions, function memory if needed for OCR payloads

DELIVERABLES
- Working vercel.json + hardened API + README deploy checklist
- Short note: exact clicks in Vercel UI (Import Git → Root Directory → Env → Deploy)
- No secrets in git
- Commit on feature branch

DO NOT
- Add auth/DB in this pass
- Put MISTRAL_API_KEY in VITE_* vars
- Pretend offline AI succeeded
```
