# AnimalPlanet – teknisk stack

Status: **Godkänd 2026-11-12.**

## Stack

| Del | Val | Kommentar |
|---|---|---|
| Språk | TypeScript 6 (`strict`) | TypeScript 7 stöds ännu inte av typescript-eslint |
| Spelmotor | Phaser 3 (senaste 3.x) | Endast rendering, inmatning och scener |
| Byggverktyg | Vite | `base: '/animalplanet/'` för GitHub Pages |
| Enhetstester | Vitest | Körs i Node, utan webbläsare |
| Webbläsartester | Playwright (Chromium, headless) | Röktest + skärmdumpar |
| Kodkvalitet | ESLint + Prettier | ESLint förbjuder Phaser-import i `src/sim/` |
| Pakethanterare | npm | `package-lock.json` checkas in |
| Körmiljö | Node LTS | Låses i `.nvmrc` och används av CI |
| CI/CD | GitHub Actions → GitHub Pages | |

Exakta versionsnummer låses i `package.json` i fas 1. Inga andra
körtidsberoenden än Phaser läggs till utan att fråga först.

## Arkitekturprinciper

1. **Simulering och rendering är åtskilda.**
   - `src/sim/` är ren TypeScript utan Phaser, DOM eller `window`. Den äger
     hela spelets tillstånd (`GameState`) och stegar fram det med `tick()`.
   - `src/render/` läser tillståndet och ritar det. Den ändrar aldrig
     tillståndet direkt.
2. **Order går via kommandon.** Spelarens inmatning och AI:n skapar samma
   slags kommandon (`move`, `attack`, `gather`, `build`, `train` …) som
   simuleringen utför. Samma väg används av testerna.
3. **Fast tidssteg.** Simuleringen går 20 steg/s oberoende av bildfrekvens.
   Renderingen interpolerar mellan stegen.
4. **Deterministisk.** All slump kommer från en frösatt generator i
   `src/sim/rng.ts`. `Math.random()` och `Date.now()` används inte i `sim/`.
   Samma frö + samma kommandon ger samma match.
5. **Datadrivet.** Enheter, byggnader, resurser, raser, kartparametrar och
   AI-vågor ligger i `src/data/` som typade TS-objekt. Logiken slår upp
   värden där och innehåller inga spelsiffror.

## Mappstruktur

```
animalplanet/
├── CLAUDE.md
├── memory-bank/              Designdokument, plan, framsteg, arkitektur
├── .github/workflows/
│   ├── ci.yml                Lint, typkontroll, tester, bygge (pull requests)
│   └── deploy.yml            Bygger och publicerar till Pages (push till main)
├── index.html
├── package.json  tsconfig.json  vite.config.ts
├── playwright.config.ts  eslint.config.js  .nvmrc
├── public/                   Statiska filer (tom tills riktig grafik finns)
├── src/
│   ├── main.ts               Startar Phaser, läser URL-parametrar
│   ├── data/                 Speldata: units, buildings, resources,
│   │                         factions, map, ai, strings
│   ├── sim/                  Ren spellogik (ingen Phaser)
│   │   ├── state.ts          GameState och entitetstyper
│   │   ├── tick.ts           Ett simuleringssteg, kör systemen i ordning
│   │   ├── commands.ts       Kommandotyper och hantering
│   │   ├── rng.ts            Frösatt slumpgenerator
│   │   ├── map/              Rutnät, kartgenerering, isometrisk matematik
│   │   ├── pathfinding/      A*
│   │   ├── systems/          movement, gathering, construction,
│   │   │                     production, combat, fog, victory
│   │   └── ai/               AI-motståndaren
│   ├── render/               Allt som rör Phaser
│   │   ├── scenes/           BootScene, GameScene, UiScene
│   │   ├── views/            Ritar karta, enheter, byggnader, dimma
│   │   └── input/            Kamera, markering, order
│   └── testing/              window.__TEST__
├── tests/e2e/                Playwright-tester
└── docs/screenshots/         Skärmdump per fas
```

Enhetstester ligger bredvid koden de testar (`src/sim/**/*.test.ts`).
Mappar och filer skapas först i den fas som behöver dem.

## npm-skript

| Skript | Gör |
|---|---|
| `npm run dev` | Vite utvecklingsserver |
| `npm run build` | Typkontroll + produktionsbygge till `dist/` |
| `npm run preview` | Serverar `dist/` lokalt (används av Playwright) |
| `npm run lint` | ESLint + Prettier-kontroll |
| `npm test` | Vitest |
| `npm run e2e` | Playwright mot det byggda spelet |

## Testupplägg

- **Enhetstester (Vitest):** all logik i `src/sim/`: ekonomi, strid, A*,
  krigsdimma, AI, kartgenerering. Hela matcher kan köras utan webbläsare
  genom att stega simuleringen.
- **Webbläsartester (Playwright):** spelet startar utan konsolfel, och varje
  fas har minst ett test som visar fasens funktion i den riktiga klienten.
  Testerna läser tillstånd via `window.__TEST__` i stället för att tolka
  pixlar. En skärmdump per fas sparas i `docs/screenshots/`.
- **URL-parametrar:**
  - `?seed=N` – frö för all slump (karta, AI).
  - `?test=1` – testläge: exponerar `window.__TEST__`.
- **`window.__TEST__` (endast i testläge):**
  - `ready` – sant när spelet har startat.
  - `getState()` – ögonblicksbild av speltillståndet.
  - `command(cmd)` – skickar ett kommando till simuleringen.
  - `advance(n)` – stegar simuleringen n steg direkt.
  - `camera` – kamerans position, storlek och vilken ruta som är i bildens mitt.
  - `tileToScreen(x, y)` – var en ruta ligger på skärmen, så att testerna
    kan klicka på rätt ställe.
  Gränssnittet byggs ut fas för fas och dokumenteras i `architecture.md`.

## Bygg- och deployflöde

1. Arbete sker på en feature-branch per fas.
2. `ci.yml` kör på varje pull request: `npm ci` → lint → Vitest →
   typkontroll + bygge → Playwright.
3. När fasen är klar öppnas en pull request mot `main`. Du granskar och mergar.
4. `deploy.yml` kör på push till `main`: lint, Vitest och bygge, och
   publicerar sedan `dist/` med `actions/upload-pages-artifact` och
   `actions/deploy-pages`. Playwright körs inte här; det har redan körts på
   pull requesten.
5. Spelet finns sedan på `https://boulwen90-afk.github.io/animalplanet/`.

Bara `main` publiceras. En feature-branch går att speltesta först när dess
pull request har mergats.

### Engångssteg som du behöver göra i GitHub
- **Settings → Pages → Source: "GitHub Actions"** (krävs för att deployen
  ska fungera).
- GitHub Pages på ett privat repo kräver en betald GitHub-plan. Är repot
  privat på gratisplan behöver det göras publikt, eller så väljer vi en
  annan värd.
- Repot saknar ännu `main`. Den skapas i samband med att planeringen godkänns.
