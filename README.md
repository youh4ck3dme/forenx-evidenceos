# ForenX EvidenceOS

Lokálne forenzné pracovisko. Originály ostávajú v prehliadači (OPFS + IndexedDB). Pri vložení sa spočíta SHA-256. Na AI ide len zapečatený excerpt. Skóre počíta kód, nie model.

## Forenzný pipeline

1. **Custody** — magic-byte detekcia, karanténa pri mismatch, SHA-256 pred spracovaním. `npm run test:custody`
2. **Prompt boundary** — značky, jailbreak frázy a IBAN/karta/e-mail/telefón sa pred Mistral redigujú. `npm run test:boundary`
3. **Scoring** — deterministické `confidence` + vyšetrovací index (nie verdikt viny). `npm run test:scoring`

Export Markdown/JSON obsahuje index, verziu engine a disclaimer.

## Čo je v tejto verzii

- uvítacia stránka a sandbox (3 stĺpce), iOS safe-area / 100svh
- vloženie dôkazov, hash, náhľad, karanténa
- 20 forenzných úkonov (Mistral) cez prompt boundary
- svetlá / tmavá téma, slovensky
- príkazová paleta, audit, export JSON / Markdown

## Spustenie

```bash
npm install
cp .env.example .env
# doplň MISTRAL_API_KEY, ak chceš živú AI
npm run dev
```

Aplikácia beží na `http://127.0.0.1:8080`.

```bash
npm run test:custody
npm run test:boundary
npm run test:scoring
npm run typecheck
npm run build
```

## Údaje

Žiadny účet, žiadna produkčná databáza. Dôkazy ostávajú v tomto prehliadači. `MISTRAL_API_KEY` ostáva na serveri. Vyšetrovací index nie je posudok viny ani právny záver.

## Stack

TanStack Start · React · Tailwind v4 · Dexie · OPFS · Mistral
