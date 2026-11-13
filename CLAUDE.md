# AnimalPlanet

Realtidsstrategispel (RTS) för webbläsaren med isometrisk 2D-vy. Fraktionerna
är djurraser: talande, upprättgående djur i rustning med sköldar och vapen, i
en heroisk fantasyvärld (Klomark). MVP:n har en ras (björnar, "Järnramarna")
mot en enkel AI av samma ras.

Allt innehåll ska vara originellt. Använd inga namn, figurer, platser eller
grafik från andra verk (t.ex. Narnia eller Age of Empires).

## Läs alltid först

Innan du skriver eller ändrar kod, läs:

1. `memory-bank/game-design-document.md` – vad spelet ska vara
2. `memory-bank/architecture.md` – hur koden faktiskt är uppbyggd

Läs vid behov även:

- `memory-bank/implementation-plan.md` – faserna och deras tester
- `memory-bank/progress.md` – vilken fas som gäller och vad som är gjort
- `memory-bank/tech-stack.md` – stack, mappstruktur, test och deploy

## Stack

- TypeScript (strict) + Phaser 3, byggt med Vite
- Vitest för enhetstester, Playwright (headless Chromium) för webbläsartester
- ESLint + Prettier, npm
- GitHub Actions bygger och publicerar till GitHub Pages vid push till `main`:
  https://boulwen90-afk.github.io/animalplanet/

Lägg inte till nya körtidsberoenden utan att fråga.

## Mappstruktur

```
memory-bank/          Designdokument, plan, framsteg, arkitektur
.github/workflows/    ci.yml (test + bygge), deploy.yml (Pages)
src/main.ts           Startar Phaser, läser URL-parametrar
src/data/             Speldata: enheter, byggnader, resurser, raser, karta, AI
src/sim/              Ren spellogik – ingen Phaser, DOM eller window
src/render/           Phaser: scener, vyer, inmatning
src/testing/          window.__TEST__
tests/e2e/            Playwright-tester
docs/screenshots/     Skärmdump per fas
tools/blender/        Figurpipelinen (Blender via bpy), se architecture.md
assets/               Genererade figurer och förhandsbilder
```

Enhetstester ligger bredvid koden (`src/sim/**/*.test.ts`).

## Kommandon

```
npm run dev       Utvecklingsserver
npm run build     Typkontroll + produktionsbygge
npm run lint      ESLint + Prettier-kontroll
npm test          Vitest
npm run e2e       Playwright mot det byggda spelet
```

## Arbetsregler (följ alltid)

1. **Planera innan du kodar.** Ingen spelkod skrivs innan användaren har
   godkänt speldesigndokumentet och implementationsplanen. Ändringar i
   omfattning eller design godkänns av användaren innan de genomförs.
2. **Håll planeringen lagom.** Målet är en spelbar kärnloop så snabbt som
   möjligt, inte maximal dokumentation.
3. **Datadriven design.** Enhetsstatistik, kostnader, byggnader, raser och
   vågor ligger i `src/data/`, aldrig hårdkodade i logiken.
4. **Separera logik från rendering.** Ekonomi, strid, vägsökning och AI
   ligger i `src/sim/` utan Phaser-beroenden och enhetstestas med Vitest.
   `src/render/` läser tillståndet och ändrar det bara via kommandon.
5. **En fas i taget.** Implementera aldrig senare faser än den användaren
   bett om. Refaktorera inte omkringliggande kod utan att fråga.
6. **Stäm av mot planen.** När en fas är klar: jämför implementationen punkt
   för punkt mot planen och lista uttryckligen allt som saknas eller avviker.
   Hoppa aldrig tyst över en funktion.
7. **Grundorsak före fix.** Vid buggar: hitta och förklara grundorsaken
   innan du fixar. Lappa inte symptomet.
8. **Definition av "klart":** koden bygger, alla tester går igenom, spelet
   startar i en headless-webbläsare (Playwright) utan konsolfel, och en
   skärmdump som visar ändringen har tagits.
9. **Testbarhet.** Stöd `?seed=N` för deterministisk slump och exponera
   spelets tillstånd via `window.__TEST__` i testläge (`?test=1`).
10. **Uppdatera minnesbanken.** Uppdatera `memory-bank/progress.md` och
    `memory-bank/architecture.md` efter varje avslutad fas.
11. **Konkret spelkänsla.** Beskriv spelkänsla i mätbara termer (t.ex.
    "skärmen skakar 150 ms vid träff"), inte vaga ord.

## Kodregler

- Ingen `Math.random()` eller `Date.now()` i `src/sim/`. All slump kommer
  från den frösatta generatorn så att samma frö ger samma match.
- Simuleringen går i fast takt (20 steg/s). Renderingen interpolerar.
- Spelare och AI styr spelet genom samma kommandon.
- Kod, identifierare och kodkommentarer på engelska. Speltext och dokument
  på svenska. Speltext samlas i `src/data/strings.ts`.
- Platshållargrafik (enkla former och färger) tills spelmekaniken är klar.

## Git och leverans

- En feature-branch per fas. Öppna en pull request mot `main` när fasen är
  klar; användaren granskar och mergar.
- Användaren kodar inte lokalt. Allt ska gå att bygga, testa och speltesta
  via repot, CI och GitHub Pages.
- Pusha aldrig direkt till `main`.

## Omfattning

MVP:ns innehåll och det som uttryckligen inte ingår står i GDD:t
(avsnitt 13). Fler raser, tidsåldrar, uppgraderingar, distansenheter, riktig
grafik och ljud kommer efter MVP:n. Föreslå gärna, men bygg inte utan
godkännande.
