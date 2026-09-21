# ForenX EvidenceOS

Lokálne forenzné pracovisko. Originály ostávajú v prehliadači (OPFS + IndexedDB), pri vložení sa spočíta SHA-256 a AI pracuje len s extrahovaným textom.

## Čo je v tejto verzii

- uvítacia stránka a sandbox (3 stĺpce)
- vloženie dôkazov, hash, náhľad, karanténa spustiteľných súborov
- 20 forenzných úkonov (Mistral)
- svetlá / tmavá téma
- slovenské rozhranie
- príkazová paleta, záznam udalostí, export JSON / Markdown

## Spustenie

```bash
npm install
cp .env.example .env
# doplň MISTRAL_API_KEY, ak chceš živú AI
npm run dev
```

Aplikácia beží na `http://127.0.0.1:8080`.

```bash
npm run typecheck
npm run build
```

## Poznámka k údajom

Žiadny účet, žiadna produkčná databáza. Dôkazy sa ukladajú len v tomto prehliadači. Kľúč `MISTRAL_API_KEY` ostáva na serveri.

## Stack

TanStack Start · React · Tailwind v4 · Dexie · OPFS · Mistral
