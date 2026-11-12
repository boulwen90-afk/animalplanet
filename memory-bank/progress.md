# AnimalPlanet – framsteg

Uppdateras efter varje avslutad fas. Senaste fasen överst.

## Nuläge

- **Aktuell fas:** Fas 3 – klar i kod, pull request öppen mot `main`
- **Nästa steg:** merge av fas 3, därefter fas 4 (resurser och insamling)
  när den beställs
- **Publicering:** https://boulwen90-afk.github.io/animalplanet/ uppdateras
  vid varje merge till `main`. Att sidan visar spelet är inte kontrollerat
  från Claudes session, som inte når github.io

## Fasstatus

| Fas | Innehåll | Status | PR |
|---|---|---|---|
| 0 | Planeringsdokument | Godkänd 2026-11-12 | – |
| 1 | Projektuppsättning, deploy, scrollbar karta | Mergad och publicerad | [#1](https://github.com/boulwen90-afk/animalplanet/pull/1) |
| 2 | Simuleringskärna och terräng | Mergad | [#2](https://github.com/boulwen90-afk/animalplanet/pull/2) |
| 3 | Enheter, markering, förflyttning | Klar, väntar på merge | [#3](https://github.com/boulwen90-afk/animalplanet/pull/3) |
| 4 | Resurser och insamling | Ej påbörjad | – |
| 5 | Träna arbetare | Ej påbörjad | – |
| 6 | Bygga Visthus och Krigshall | Ej påbörjad | – |
| 7 | Soldater, strid, vinst och förlust | Ej påbörjad | – |
| 8 | Krigsdimma | Ej påbörjad | – |
| 9 | AI-motståndare | Ej påbörjad | – |
| 10 | Pekstyrning, balans, MVP-avstämning | Ej påbörjad | – |

## Fasloggar

<!--
Mall – kopiera för varje avslutad fas:

### Fas N – namn (ÅÅÅÅ-MM-DD)
**PR:** länk
**Skärmdump:** docs/screenshots/fas-N.png

**Avstämning mot planen**
| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. … | Klar / Avviker / Saknas | |

**Saknas eller avviker**
- …

**Testresultat**
- Vitest: X av X
- Playwright: X av X
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- …
-->

### Fas 3 – Enheter, markering och förflyttning (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-3-markerade.png` (tre markerade
Samlare och markeringspanelen), `docs/screenshots/fas-3-dragruta.png`
(dragrutan), `docs/screenshots/fas-3-flyttorder.png` (enheter på väg)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Entiteter i simuleringen; Storide och 3 Samlare per sida vid start | Klar | Storiden är ett hinder med HP |
| 2. A* i 8 riktningar, inga genvägar över hörn, närmaste nåbara ruta vid blockerat mål | Klar | |
| 3. Kommandosystem med `move`; flera enheter sprids runt målet | Klar | |
| 4. Markering: klick, dragruta, Shift-klick, Esc; markeringsellips och orderring | Klar | |
| 5. Mjuk rörelse genom interpolation | Klar | Ingår nu, stod som saknad i fas 2 |
| 6. Markeringspanel i HUD:en (namn och HP) | Klar | |
| 7. `__TEST__.command()` och `__TEST__.tileToScreen()` | Klar | Dessutom `getSelection`, `getHud`, `getOrderMarkerCount`, `centerCameraOnTile` |

| Test i planen | Resultat |
|---|---|
| Vitest: A* hittar kortaste vägen på öppen mark | Godkänt |
| Vitest: A* går runt en mur | Godkänt |
| Vitest: A* skär inte hörn | Godkänt |
| Vitest: närmaste nåbara ruta för blockerat mål | Godkänt |
| Vitest: tom väg när målet är helt avskuret | Godkänt |
| Vitest: enhet med `move`-order står på målrutan efter förväntat antal steg | Godkänt (10 rutor = exakt 80 steg) |
| Playwright: klick på en Samlare markerar den | Godkänt |
| Playwright: dragruta över alla tre markerar tre | Godkänt |
| Playwright: högerklick får dem att stå intill rutan efter framstegning | Godkänt |
| Skärmdump med markerade enheter | Klar |

Utöver planen testas även: markeringsreglerna (Shift, byggnader,
fiendeenheter), klickträffar på enheter och byggnader, texten i
markeringspanelen, att enheter går runt byggnader och aldrig hamnar på
samma ruta, att motståndarens enheter inte lyder spelarens order, att
orderringen försvinner efter 400 ms, och att enheter rör sig i realtid.

**Saknas eller avviker**
- **Pekskärm:** markering och order fungerar inte med finger än. På mobil
  går det bara att panorera. Det står i planen för fas 10.
- **Kameran startar nu vid spelarens bas** i stället för kartans mitt. Det
  stod inte i planen för fas 3, men utan det syns inte de egna enheterna
  vid start.
- **Startenheterna är inte spegelvända mellan sidorna.** Båda sidors
  Samlare står framför sin Storide. Skillnaden är högst ett par rutor.
- **Markeringen ändras när musknappen släpps**, inte när den trycks ned.
  GDD:t säger "samma bildruta som klicket".
- **Fiendens enheter och byggnader går att markera** för att se namn och
  HP. GDD:t säger inget om det. De går inte att ge order.
- **Enheter bakom en byggnad döljs av den** men går fortfarande att klicka
  på och dra en ruta runt.
- **En orderring visas även när enheterna inte kan nå målet** och därför
  står kvar.
- **Enheter kan passera genom varandra** under förflyttning. Det är en
  uttalad förenkling i GDD:t. De stannar aldrig på samma ruta.
- **Vägar räknas inte om när kartan ändras.** Inget ändrar kartan än; det
  behövs i fas 4 och 6.
- **Skärmdumpen av flyttordern visar inte orderringen.** Den hinner tonas
  bort innan bilden tas. Ringen kontrolleras av ett webbläsartest.

**Testresultat**
- Vitest: 159 av 159
- Playwright: 37 av 37, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Första versionen placerade Samlarna bakom Storiden, där de inte syntes.
  Alla tester gick igenom ändå, eftersom testerna klickar på uträknade
  koordinater. Det upptäcktes först på skärmdumpen. Skärmdumpar ska
  granskas, inte bara sparas.
- Två webbläsartester antog att en ruta 4,1 rutor från startpositionen var
  fri. Kartgenereringen garanterar bara 4 rutor. Testerna använder nu en
  ruta som garanterat är fri.
- När målet är ett hinder valdes först den närmaste rutan med lägst index,
  så en enhet kunde gå runt till trädets baksida. Nu väljs den ruta som
  ligger närmast enheten.

### Fas 2 – Simuleringskärna och terräng (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-2.png` (kartans mitt, frö 1),
`docs/screenshots/fas-2-startplats.png` (spelarens startplats, frö 1),
`docs/screenshots/fas-2-seed-2.png` (kartans mitt, frö 2)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. `GameState`, fast tidssteg (20 steg/s) och frösatt slumpgenerator | Klar | |
| 2. `?seed=N` styr fröet; standardfrö i `src/data/map.ts` | Klar | Ogiltigt frö ger standardfröet |
| 3. Kartgenerering: gräs, träd, bärsnår, klippa, vatten; punktspeglad; två startplatser i motsatta hörn med resurser inom 8 rutor | Klar | Spelaren i vänstra hörnet, motståndaren i högra |
| 4. Rendering av terrängen med platshållargrafik, djupsorterad | Klar | |
| 5. `__TEST__.getState()` och `__TEST__.advance(n)` | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: samma frö ger identisk karta, olika frön olika kartor | Godkänt (40 frön ger 40 olika kartor) |
| Vitest: kartan är punktspeglad | Godkänt för 40 frön |
| Vitest: gångbar väg mellan startplatserna | Godkänt för 40 frön |
| Vitest: minst 4 bärsnår och 10 träd inom 8 rutor från varje startplats | Godkänt för 40 frön |
| Vitest: slumpgeneratorn ger samma talföljd för samma frö | Godkänt |
| Playwright: `?seed=1` och `?seed=2` ger olika kartor | Godkänt |
| Playwright: `?seed=1` ger samma karta vid två laddningar | Godkänt |
| Skärmdump av kartan med terräng | Klar |

Utöver planen testas även: fritt område runt startplatserna, att sjöar och
klippor håller avstånd till dem, reservkartan när alla försök blir avskurna,
felaktiga startplatser, tidsstegets takt vid olika bildfrekvenser, att
`advance(n)` kör exakt n steg, och att `getState()` ger en kopia.

**Saknas eller avviker**
- **Interpolation mellan simuleringssteg finns inte än.** Ingenting rör sig
  i fas 2, så den byggs i fas 3 tillsammans med enheterna (står i planen
  för fas 3).
- **Resursmängder per källa (150 mat, 100 trä) finns inte i tillståndet.**
  Kartan vet bara var träd och bärsnår står. Mängderna hör till fas 4.
- **Kameran startar fortfarande på kartans mitt**, inte vid spelarens
  startplats. Planen för fas 2 säger inget om det; det passar i fas 3 när
  Storiden finns.
- **Simuleringen går i realtid även i testläge.** `advance(n)` läggs
  ovanpå. Planen säger bara att `advance` stegar direkt.
- **Standardkartan (frö 1) har en stor skog mitt på kartan**, där två
  skogsfläckar har vuxit ihop med sina spegelbilder. Vägen mellan baserna
  går runt den. Frö 2 har ingen sådan skog. Vilket frö som ska vara
  standard kan avgöras i balansfasen.

**Testresultat**
- Vitest: 66 av 66
- Playwright: 26 av 26
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Slumpgeneratorns tillstånd ligger i `GameState`, så att ett tillstånd är
  ren data som kan kopieras och jämföras.
- Träd, bärsnår och klippor ritas som enskilda bilder med djup efter
  skärmhöjd, så att enheter i fas 3 kan gå bakom och framför dem.

### Fas 1 – Projektuppsättning, deploy och scrollbar karta (2026-11-12)

**PR:** https://github.com/boulwen90-afk/animalplanet/pull/1

**Skärmdumpar:** `docs/screenshots/fas-1.png` (kartans mitt),
`docs/screenshots/fas-1-kartkant.png` (kameran stannad vid kartans övre hörn)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Vite + TypeScript (strict) + Phaser 3, ESLint, Prettier, Vitest, Playwright | Klar | TypeScript 6.0.3 i stället för senaste 7.x, se avvikelser |
| 2. Mappstruktur enligt `tech-stack.md` | Klar | Bara mappar som fasen behöver. `public/`, `src/sim/systems/` m.fl. finns inte än |
| 3. `ci.yml` och `deploy.yml` | Delvis verifierad | `ci.yml` är grön på pull requesten. `deploy.yml` kan verifieras först efter merge och kräver att Pages är påslaget |
| 4. Isometrisk matematik i `src/sim/map/` | Klar | |
| 5. 64×64 gräsrutor som romber med synliga kanter | Klar | |
| 6. Kamera: piltangenter/WASD, kantpanorering, mittenknapp, ett finger, stannar vid kartans kant | Klar | Se avvikelse om hur "kartans kant" tolkats |
| 7. `?test=1` exponerar `window.__TEST__` med `ready` och `camera` | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: ruta → skärm → ruta för alla hörn och mittpunkten | Godkänt (testar dessutom alla 4096 rutor) |
| Vitest: skärmpunkt mitt i en romb ger rätt ruta | Godkänt |
| Playwright: laddar utan konsolfel, `ready` blir sant | Godkänt |
| Playwright: högerpil i 500 ms ökar kamerans x | Godkänt. Farten (900 px/s) testas separat för varje tangent mot spelets egen tid |
| Playwright: kameran lämnar inte kartan efter 10 s panorering | Godkänt, i alla fyra riktningar |
| CI grön på pull requesten | Godkänt (lint, Vitest, bygge och Playwright på GitHub Actions) |
| Pages-adressen visar kartan efter merge | Deploy-jobbet godkänt efter att Pages-miljön tillåtit `main`. Själva sidan kontrolleras av användaren; Claudes session når inte github.io |
| Skärmdump av kartan | Klar |

Utöver planen testas även: WASD, kantpanorering, drag med mittenknapp, att
vänsterknappen inte flyttar kameran, drag med ett finger, och att
`window.__TEST__` saknas utan `?test=1`.

**Saknas eller avviker**
- **Publiceringen är inte verifierad.** Den går inte att testa förrän
  pull requesten är mergad och GitHub Pages är påslaget (Settings → Pages →
  Source: "GitHub Actions").
- **Kamerans gräns.** Planen säger att kameran stannar vid kartans kant.
  Implementationen håller bildens mittpunkt inom kartromben, så upp till
  halva bilden (tre fjärdedelar i ett hörn) kan visa tomrum utanför kartan.
  Skäl: kartan är en romb, och en rektangulär gräns visade nästan bara tomrum
  i hörnen.
- **TypeScript 6.0.3** i stället för 7.x, eftersom typescript-eslint inte
  stöder 7 ännu.
- **Branchnamn.** Fasen ligger på `claude/compassionate-archimedes-ztanms`
  (namnet tilldelas av Claude Code-sessionen), inte på en branch med fasnamn.
- **`deploy.yml` kör inte Playwright**, bara lint, Vitest och bygge.
  Playwright körs på pull requesten.
- `npm audit` rapporterar en sårbarhet av måttlig grad i `minimatch`, som
  dras in av ESLint-verktygen. Den finns bara i utvecklingsverktygen och
  följer inte med i det publicerade spelet.

**Testresultat**
- Vitest: 20 av 20
- Playwright: 19 av 19, även med webbläsaren nedbromsad 8 och 16 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga (WebGL-renderare)

**Beslut och lärdomar**
- Phaser begränsar sitt `delta` till 1/60 s under de första 120 bildrutorna
  och när sidan saknar fokus. I headless-webbläsaren (ca 20 bilder/s) gick
  kameran därför med 300 px/s i stället för 900. Kameran räknar nu på verklig
  tid mellan bildrutor. Simuleringens tidssteg i fas 2 måste göra likadant.
- Kartrutorna ritas med en Blitter: 4096 rutor i ett ritanrop.
- CI gick igenom en gång och fallerade nästa, utan kodändring emellan. Två
  tester mätte kamerans fart mot väggklockan. GitHub-maskinerna ritar
  långsammare än 10 bilder/s, och eftersom varje bildruta räknas som högst
  100 ms gick kameran då långsammare i verklig tid (180 och 270 px på 500 ms
  i stället för 450). Felet återskapades lokalt med nedbromsad webbläsare.
  Testerna mäter nu fart mot spelets egen tid (`__TEST__.elapsedMs`).
  Tester i kommande faser ska stega simuleringen i stället för att vänta
  på verklig tid.

## Kända problem

_Inga öppna._

### Lösta

- **Publiceringen till GitHub Pages avvisades (fas 1, löst 2026-11-12).**
  Deploy-jobbet på `main` stoppades inom två sekunder, innan någon maskin
  tilldelats och utan loggar. Repots första push gjorde sessionsbranchen
  till standardbranch, och miljön `github-pages` tillåter som standard bara
  den branch som var standard när Pages slogs på. Regeln följer inte med
  när standardbranchen byts. Lösning: `main` lades till under Settings →
  Environments → `github-pages` → Deployment branches and tags. Därefter
  gick publiceringen igenom.
