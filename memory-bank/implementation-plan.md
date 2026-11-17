# AnimalPlanet – implementationsplan (MVP)

Status: **Godkänd 2026-11-12.**

Regler för alla faser:
- En fas i taget, på en egen branch, avslutad med en
  pull request mot `main`.
- En fas är klar när: koden bygger, lint och alla tester går igenom, spelet
  startar i headless-webbläsare utan konsolfel, fasens test nedan är
  uppfyllt, en skärmdump finns i `docs/screenshots/`, implementationen är
  avstämd punkt för punkt mot fasens lista, och `progress.md` och
  `architecture.md` är uppdaterade.
- Siffror (kostnader, HP, tider) hämtas från `src/data/`, se GDD.

Översikt:

| Fas | Innehåll |
|---|---|
| 1 | Projektuppsättning, deploy, tom isometrisk karta som går att scrolla |
| 2 | Simuleringskärna och genererad karta med terräng |
| 3 | Enheter, markering, förflyttning med A* |
| 4 | Resurser och insamling |
| 5 | Träna arbetare (produktionskö) |
| 6 | Bygga Visthus och Krigshall |
| 7 | Soldater, strid, vinst och förlust |
| 8 | Krigsdimma |
| 9 | AI-motståndare |
| 10 | Pekstyrning, balans och MVP-avstämning |

---

## Fas 1 – Projektuppsättning, deploy och scrollbar karta

**Mål:** ett tomt men publicerat spel. Varje senare fas kan speltestas via
GitHub Pages.

Innehåll:
1. Vite + TypeScript (strict) + Phaser 3, ESLint, Prettier, Vitest, Playwright.
2. Mappstruktur enligt `tech-stack.md` (bara de mappar fasen behöver).
3. `ci.yml` (lint, typkontroll, tester, bygge, Playwright) och `deploy.yml`
   (publicerar till GitHub Pages vid push till `main`).
4. Isometrisk matematik i `src/sim/map/` (ruta ↔ skärmkoordinat).
5. En 64×64 karta av enbart gräsrutor, ritad som romber med synliga kanter.
6. Kamera: piltangenter/WASD, kantpanorering, dra med mittenknapp, dra med
   ett finger. Kameran stannar vid kartans kant.
7. `?test=1` exponerar `window.__TEST__` med `ready` och `camera`.

**Test:**
- Vitest: ruta → skärm → ruta ger tillbaka samma ruta för alla hörn och
  mittpunkten; en skärmpunkt mitt i en romb ger rätt ruta.
- Playwright: sidan laddar utan konsolfel; `__TEST__.ready` blir sant; efter
  att högerpil hållits i 500 ms har kamerans x ökat; kameran går inte
  utanför kartan efter 10 s panorering åt ett håll.
- CI är grön på pull requesten. Efter merge visar Pages-adressen kartan.
- Skärmdump av kartan.

## Fas 2 – Simuleringskärna och terräng

**Mål:** en deterministisk simulering som äger kartan, och en karta med
skog, bärsnår, hinder och två startplatser.

Innehåll:
1. `GameState`, fast tidssteg (20 steg/s) och frösatt slumpgenerator.
2. `?seed=N` styr fröet; standardfrö i `src/data/map.ts`.
3. Kartgenerering: gräs, träd, bärsnår, klippa, vatten; punktspeglad; två
   startplatser i motsatta hörn med resurser inom 8 rutor.
4. Rendering av terrängen med platshållargrafik, djupsorterad.
5. `__TEST__.getState()` och `__TEST__.advance(n)`.

**Test:**
- Vitest: samma frö ger identisk karta, olika frön ger olika kartor; kartan
  är punktspeglad; det finns en gångbar väg mellan startplatserna; varje
  startplats har minst 4 bärsnår och 10 träd inom 8 rutor; slumpgeneratorn
  ger samma talföljd för samma frö.
- Playwright: `?seed=1` och `?seed=2` ger olika kartor i `getState()`, och
  `?seed=1` ger samma karta vid två laddningar.
- Skärmdump av kartan med terräng.

## Fas 3 – Enheter, markering och förflyttning

**Mål:** spelaren kan markera sina tre Samlare och flytta dem runt hinder.

Innehåll:
1. Entiteter i simuleringen; Storide och 3 Samlare per sida placeras vid start
   (Storiden är än så länge bara ett hinder med HP).
2. A* på rutnätet: 8 riktningar, inga genvägar över hörn på blockerade rutor;
   om målet är blockerat går enheten till närmaste nåbara ruta.
3. Kommandosystem med `move`. Flera enheter sprids på rutor runt målet.
4. Markering: klick, dragruta, Shift-klick, Esc. Markeringsellips och
   orderring enligt GDD avsnitt 11.
5. Mjuk rörelse genom interpolation mellan simuleringssteg.
6. Markeringspanel i HUD:en (namn och HP).
7. `__TEST__.command()` och `__TEST__.tileToScreen()`.

**Test:**
- Vitest: A* hittar kortaste vägen på öppen mark; går runt en mur; skär inte
  hörn; ger närmaste nåbara ruta för blockerat mål; ger tom väg när målet är
  helt avskuret. En enhet med `move`-order står på målrutan efter förväntat
  antal steg.
- Playwright: klick på en Samlare markerar den; dragruta över alla tre
  markerar tre; högerklick på en ruta får dem att stå intill den rutan efter
  att simuleringen stegats fram.
- Skärmdump med markerade enheter.

## Fas 4 – Resurser och insamling

**Mål:** arbetare samlar mat och trä, och lagret syns i HUD:en.

Innehåll:
1. Resurskällor med ändlig mängd; tömda källor försvinner och träd blir
   gångbar mark.
2. `gather`-kommando: gå till källa → samla (1 enhet/s, högst 10) → gå till
   närmaste avlämningsplats → lämna → upprepa. När källan tar slut väljs
   närmaste källa av samma typ inom 8 rutor, annars blir arbetaren sysslolös.
3. Spelarens lager (mat, trä) i simuleringen; startresurser enligt GDD.
4. HUD-överkant: mat, trä, befolkning.
5. Högerklick på resurs med Samlare markerade ger `gather`.

**Test:**
- Vitest: en Samlare intill en källa och Storiden levererar exakt 10 enheter
  efter beräknat antal steg; källan minskar lika mycket som lagret ökar; en
  tömd källa tas bort och arbetaren byter till nästa; utan källor i närheten
  blir arbetaren sysslolös.
- Playwright: efter gather-order och framstegad simulering visar HUD:en mer
  mat än vid start.
- Skärmdump med arbetare som samlar och HUD.

## Fas 5 – Träna arbetare

**Mål:** Storiden tränar Samlare för mat, med kö och befolkningstak.

Innehåll:
1. Produktionssystem: kö (högst 5), träningstid, kostnad dras vid köning och
   återbetalas vid avbrott.
2. Befolkningstak (30). Köning nekas vid fullt tak eller för lite resurser.
3. Ny enhet dyker upp på närmaste lediga ruta intill byggnaden.
4. Kommandopanel: byggnad kan markeras; träningsknapp med kostnad; kö med
   förloppsstapel; klick på köad enhet avbryter.
5. Återkoppling vid för lite resurser enligt GDD avsnitt 11.

**Test:**
- Vitest: träning drar 50 mat och ger en Samlare efter 12 s simulerad tid;
  avbrott återbetalar; den sjätte köningen nekas; köning nekas vid för lite
  mat och vid fullt befolkningstak, utan att resurser dras.
- Playwright: markera Storiden, klicka "Träna Samlare", stega fram; antalet
  egna Samlare är 4 och maten har minskat med 50.
- Skärmdump med kommandopanel och kö.

## Fas 6 – Bygga Visthus och Krigshall

**Mål:** arbetare kan uppföra byggnader, och Visthuset fungerar som
avlämningsplats.

Innehåll:
1. Byggmeny på markerad Samlare: Visthus, Krigshall, med kostnad.
2. Placering med spökbild (grön/röd) och giltighetskontroll enligt GDD.
3. `build`-kommando: kostnaden dras, byggplats skapas på 10 % HP, arbetaren
   går dit och bygger. Fler arbetare bygger snabbare. Högerklick på eget
   bygge låter fler hjälpa till.
4. Färdiga byggnader blockerar vägsökningen; Visthus är avlämningsplats.
5. Krigshallen kan markeras men tränar ännu inget (kommer i fas 7).

**Test:**
- Vitest: giltig/ogiltig placering (på träd, på byggnad, utanför kartan,
  delvis blockerad); kostnad dras vid placering och nekas vid för lite trä;
  en arbetare färdigställer ett Visthus på 20 s; två arbetare går fortare
  enligt formeln; ofärdigt Visthus tar inte emot resurser, färdigt gör det
  och väljs när det är närmast; A* går runt den nya byggnaden.
- Playwright: välj Samlare → Visthus → klicka på giltig ruta → stega fram;
  ett färdigt Visthus finns i `getState()` och trä har minskat med 80.
- Skärmdump med spökbild och färdig byggnad.

## Fas 7 – Soldater, strid, vinst och förlust

Omarbetad 2026-11-12 efter beslutet att inga djur dör (GDD avsnitt 15).

**Mål:** en komplett match går att vinna och förlora (mot en passiv fiende),
och besegrade enheter kapitulerar och flyr till sin sidas grottor.

Innehåll:
1. Krigshallen tränar Ramkrigare.
2. `attack`-kommando mot enheter och byggnader; förföljelse; skadeformel
   och anfallstakt enligt GDD.
3. Automatiskt anfall för stillastående Ramkrigare (inom 6 rutor).
4. Grottor: kartgenereringen placerar 2 grottor per sida med 12 platser var,
   speglade mellan sidorna och nåbara från startplatsen. En grotta blockerar
   sin ruta, kan inte anfallas, och ingenting får byggas på eller intill den.
5. Kapitulation: en enhet vars liv når 0 kapitulerar. Den kan inte längre
   anfallas eller ges order, räknas inte i befolkningen, och går till
   närmaste egna grotta med ledig plats, där den försvinner in. Platsen
   reserveras vid kapitulationen. Finns ingen ledig eller nåbar grotta
   försvinner enheten direkt.
6. Byggnader rasar när deras liv når 0 och frigör sina rutor.
7. Fiendesidan finns på kartan men är passiv (försvarar sig bara genom
   automatiskt anfall) tills AI:n kommer i fas 9.
8. Vinst/förlust när en Storide rasar; slutskärm med "Spela igen".
9. Livstaplar, träffblink, utfall, vit flagga, bortoning, skärmskakning och
   larmtext enligt GDD avsnitt 11.
10. Gränssnittet säger "Liv" i stället för "HP".

**Test:**
- Vitest, strid: skada = skada − rustning, minst 1; slag sker med rätt
  intervall; en Ramkrigare får en Samlare att kapitulera på förväntat antal
  steg; anfallare följer efter ett flyende mål; stillastående Ramkrigare
  anfaller fiende inom 6 rutor men inte utanför; en raserad byggnad frigör
  sina rutor; en raserad Storide sätter rätt vinnare och stoppar
  simuleringen.
- Vitest, kapitulation: en kapitulerad enhet tar ingen mer skada och väljs
  inte som mål; den går till närmaste egna grotta och tas bort vid
  ankomsten, och grottans antal ökar med 1; befolkningen minskar redan vid
  kapitulationen; den trettonde enheten går till den andra grottan; när
  alla 24 platser är tagna försvinner nästa enhet direkt; en enhet går
  aldrig till motståndarens grotta.
- Vitest, grottor: varje sida har 2 grottor; de är speglade; varje grotta
  går att nå från sidans startplats; byggplacering på eller intill en
  grotta nekas.
- Playwright: i testläge ges spelaren soldater via `__TEST__`, de beordras
  anfalla fiendens Storide, simuleringen stegas fram och skärmen "Seger"
  visas. Motsvarande test för "Nederlag". Ett test där en besegrad enhet
  hamnar i sin sidas grotta enligt `getState()`.
- Skärmdump av strid, av en kapitulerad enhet på väg till en grotta och av
  slutskärmen.

## Fas 8 – Krigsdimma

**Mål:** spelaren ser bara det egna enheter och byggnader ser.

Innehåll:
1. Synlighetsrutnät per spelare i simuleringen: outforskad, utforskad, synlig.
2. Uppdatering från alla egna enheters och byggnaders synfält.
3. Rendering: svart, nedtonad terräng respektive full sikt. Fiendens enheter
   och byggnader döljs utanför synliga rutor.
4. Byggplacering kräver utforskade rutor. Order mot ett mål som försvinner
   ur sikte avbryts enligt GDD.
5. `?fog=0` i testläge stänger av dimman (för äldre tester och felsökning).

**Test:**
- Vitest: en enhet med synfält 6 gör rätt rutor synliga; när den går vidare
  blir rutorna utforskade, inte outforskade; en fiende utanför synfältet
  finns inte i spelarens synliga entiteter; byggplacering på outforskad ruta
  nekas.
- Playwright: vid start är fiendens bas inte synlig för spelaren enligt
  `getState()`; efter att en enhet gått dit är den det.
- Skärmdump som visar alla tre dimlägen.

## Fas 9 – AI-motståndare

**Mål:** fienden bygger upp en ekonomi, tränar soldater och anfaller.

Innehåll:
1. AI i `src/sim/ai/` som bara agerar via samma kommandon som spelaren och
   betalar samma kostnader.
2. Beteende enligt GDD avsnitt 10: arbetare till 8, Krigshall, Visthus,
   kontinuerlig soldatträning, anfallsvågor, basförsvar.
3. Vågornas storlek och tidpunkter i `src/data/ai.ts`.
4. AI:n fattar beslut en gång per sekund, inte varje steg.

**Test:**
- Vitest (hela matcher utan webbläsare): efter 3 min simulerad tid har AI:n
  minst 6 Samlare och en Krigshall; första vågen skickas inom tidsfönstret i
  datafilen; AI:ns lager blir aldrig negativt; mot en spelare som inte gör
  något vinner AI:n inom 15 min simulerad tid; AI mot AI med samma frö ger
  samma vinnare och samma slutsteg två körningar i rad.
- Playwright: spelet startar med AI utan konsolfel och AI:n har fler Samlare
  efter 2 min framstegad tid.
- Skärmdump av en AI-våg som anfaller.

## Fas 10 – Pekstyrning, balans och MVP-avstämning

**Mål:** MVP:n är spelbar från start till slut på dator och pekskärm, och
allt i GDD:t är avstämt.

Innehåll:
1. Pekstyrning enligt GDD avsnitt 4: tryck för markering och order, håll +
   dra för dragruta, knappen "Avmarkera". HUD-knappar minst 44×44 px.
2. Startskärm med titel, kort kontrollbeskrivning och "Starta".
3. Tangenten H / knapp för att hoppa till egen bas.
4. Balanspass: enbart ändringar i `src/data/`, med målet att en match mot
   AI:n tar 10–20 min och att AI:ns första våg (4 krigare) slås tillbaka av
   6 Ramkrigare vid basen.
5. Avstämning av hela MVP:n mot GDD:t, punkt för punkt, med en lista över
   allt som saknas eller avviker.

**Test:**
- Playwright med pekskärmsemulering: tryck markerar, tryck på mark flyttar,
  håll + dra markerar flera, ett finger panorerar kameran.
- Playwright: fullt flöde startskärm → match → slutskärm → "Spela igen".
- Vitest: balansmålen ovan som tester (matchlängd AI mot AI inom
  intervallet; 6 Ramkrigare vid basen slår tillbaka första vågen).
- Avstämningslistan finns i `progress.md`.
- Skärmdumpar från dator- och mobilvy.

# Efter MVP:n

Punkter som är beslutade men inte påbörjade. De genomförs en i taget, när
användaren ber om det.

## Skarp rendering i skärmens verkliga upplösning

**Mål:** spelet är lika skarpt på en telefon som på en vanlig datorskärm.

**Bakgrund:** spelet ritar i dag på en yta med en bildpunkt per CSS-pixel.
På en telefon, där varje CSS-pixel är två till tre fysiska pixlar,
förstorar webbläsaren hela bilden, och allt blir suddigt. Figurerna kan
redan renderas i dubbel upplösning (`atlas_scale` i `tools/blender/game.toml`),
men det syns inte förrän spelet ritar i skärmens upplösning.

Innehåll:
1. Spelytan får lika många bildpunkter som skärmen har fysiska pixlar
   (`devicePixelRatio`, högst 3), och visas i samma storlek som nu.
2. Världens kamera zoomas med samma faktor, så att lika mycket av kartan
   syns som i dag. Gränssnittet ritas i samma storlek som i dag.
3. All inmatning räknas om: klick, dragrutor, pekgester, kantpanorering och
   träffytor i gränssnittet ska fungera i CSS-pixlar oavsett skärm.
4. Text och paneler ritas i skärmens upplösning.
5. Figurernas atlas byggs om med `atlas_scale = 2`. Väg samtidigt
   filstorleken (cirka 8 MB i stället för 2 MB) mot ett mindre format,
   färre bildrutor eller en laddningsindikator.
6. Testgränssnittet (`tileToScreen`, `camera`) fortsätter att ge
   CSS-pixlar, så att befintliga tester gäller oförändrade.

**Test:**
- Hela Playwright-sviten går igenom oförändrad med `deviceScaleFactor` 1,
  2 och 3.
- Ett nytt test jämför spelytans storlek i bildpunkter med fönstrets
  storlek gånger `devicePixelRatio`.
- Skärmdumpar i telefonstorlek före och efter, i fysisk upplösning.
- Prestanda mäts igen med 120 enheter, eftersom fler bildpunkter ritas.

## Efter MVP:n: björnrasen komplett (beslutat av användaren 2026-11-15)

Björnarna görs färdiga innan nästa ras påbörjas. Ett steg i taget, med
stopp och skärmdumpar efter varje. Alla värden i datafilerna; grafik via
figurpipelinen enligt skalstandarden. I varje steg: byggmenyn visar
kostnad och beskrivning, tester gröna, inga konsolfel, skärmdumpar, och
`progress.md` och GDD:t uppdaterade.

| Steg | Innehåll | Status |
|---|---|---|
| 1 | **Lagning.** Samlare lagar skadade egna byggnader för trä; rök under 50 % liv, eld under 25 %; datorspelaren lagar när basen är i fred | Klart 2026-11-15, se `progress.md` |
| 2 | **Vakttorn.** Skjuter på närmaste fiende inom räckvidd, ger sikt, synlig projektil med träffeffekt, kan lagas; datorspelaren bygger torn vid basen | Klart 2026-11-15, se `progress.md` |
| 3 | **Smedja.** Uppgraderingar som köps en gång och gäller alla enheter: vapen, rustning, snabbare samlande, två nivåer var; kö och förlopp på byggnaden; datorspelaren forskar | Klart 2026-11-15, se `progress.md` |
| 4 | **Skyttebana och distansenhet.** Ny byggnad och ny figur med egna animationer; svag i närstrid, stark på avstånd; sten-sax-påse mot Ramkrigaren och tornet. Blev **Kastbana** och **Ramkastare** | Klart 2026-11-16, se `progress.md` |
| 5 | **Palissad och port.** Dras ut i linje; egna enheter går genom porten; vägsökningen klarar murar som byggs och rivs under förflyttning; datorspelaren anfaller murar | Klart 2026-11-16, se `progress.md` |

### Balansen mot datorspelaren (beslutat av användaren 2026-11-16)

Uppskjuten till efter steg 5. Användarens beställning, efter mätningarna:

| Punkt | Innehåll | Status |
|---|---|---|
| 1 | **Ramkastaren:** 45 mat och 25 trä i stället för 50 och 40; 1,4 s mellan kasten i stället för 1,8 | Klart 2026-11-16 |
| 2 | **Datorspelaren ska inte mattas av.** Den var lagom i början, blev sedan lättare och lättare och slutade till slut anfalla | Klart 2026-11-16: grundorsaken (matekonomin) rättad, och den växer under matchen |
| 3 | **Tre svårighetsgrader:** Nybörjare, Medel och Proffs, där Medel är den dåvarande datorspelaren | Klart 2026-11-16; värdena godkända samma dag |
| 4 | Långa matcher ska **inte** kortas | Inget gjort, som beställt |

**Test:** enhetstester för nivåerna och för att vågorna växer mot en sida
som håller ut (`levels.test.ts`, `balance.test.ts`), webbläsartester för
valet på startskärmen (`difficulty.spec.ts`), och matcher utan webbläsare
där nivåerna möter varandra. Se `progress.md`.

## Multiplayer för två spelare via lockstep (godkänd av användaren 2026-11-17)

Användaren bad om en undersökning och en plan, och godkände planen med
"Ja på allt" på tre frågor: att merga undersökningen, att godkänna planen
och börja med fas M0, och om förbindelsen. Den sista frågan var "Supabase
Realtime eller PeerJS, eller vill du pröva båda först som jag föreslår?";
min tolkning av svaret är att **båda prövas först**, i fas M3, innan
valet blir slutgiltigt. Planen genomförs en fas i taget.

| Fas | Innehåll | Status |
|---|---|---|
| M0 | Samma resultat i alla webbläsare | Klar 2026-11-17, se `progress.md` |
| M1 | Orderkö och turer, utan nätverk | Klar 2026-11-17, se `progress.md` |
| M2 | Kontrollsummor som upptäcker att spelen glider isär | Klar 2026-11-17, se `progress.md` |
| P | Prestanda med 400 enheter (P1–P4), efter användarens mätning | Inte påbörjad |
| M3 | Förbindelse och lobby med rumskod | Inte påbörjad |
| M4 | Väntan, paus, återanslutning och vinst när någon försvinner | Inte påbörjad |
| M5 | Avslutning | Inte påbörjad |

Principen: båda spelarna kör samma simulering, och **bara order skickas**
mellan dem. Då måste samma frö och samma order ge samma spel, steg för
steg, på båda enheterna.

### Vad undersökningen visade

Hela underlaget står i `progress.md` (2026-11-16, "Undersökning inför
multiplayer").

**Håller redan**

- Samma frö och samma inspelade order ger samma spel: 16 matcher på
  sammanlagt 636 957 steg jämförda steg för steg med en kontrollsumma av
  hela spelläget, utan en enda skillnad (`src/sim/determinism.test.ts`).
- Simuleringen använder ingen slump efter att kartan är skapad, ingen
  klocka och inget globalt tillstånd utanför spelläget.
- All spelarpåverkan under en match går genom `applyCommand` med ett
  enda orderformat, som är ren data och tål att skickas som JSON.
- Spelläget går att spara som JSON och ladda igen mitt i en match utan
  att spelet ändras (184 KB med 400 enheter, 21 KB komprimerat).
- Simuleringen går i fasta steg om 50 ms, oberoende av bildfrekvensen,
  och grafiken ändrar aldrig spelläget.

**Måste ändras**

- `Math.hypot`, `Math.sin`, `Math.cos` och `Math.atan2` i simuleringen.
  Deras sista decimal får skilja mellan webbläsarmotorer, och då glider
  spelen isär mellan t.ex. Chrome och Safari. Inte kunnat prövas här,
  där bara Chromium finns.
  **Åtgärdat i fas M0.**
- Order utförs i dag i samma ögonblick som spelaren ger dem. De måste
  gå genom en kö och utföras i ett bestämt steg hos båda.
- Gränssnittet väntar sig svaret på en order direkt (t.ex. "för lite
  mat"). Med en kö kommer svaret senare.
- Vilken sida som är "jag" är hårdkodad till sida 0 i `GameScene`.
- Prestandan i värsta fall: när 400 enheter söker ny väg i samma steg
  tar steget 163 ms på testmaskinen, mot en budget på 50 ms.

### Förbindelsen: två alternativ

Båda är nya körtidsberoenden och kräver användarens godkännande
(CLAUDE.md). Sidan ligger på GitHub Pages, så ingen egen server finns.
Uppgifterna kommer från bibliotekens källkod och Supabases dokumentation,
lästa 2026-11-16; det som inte gick att bekräfta står sist.

| | A. WebRTC med PeerJS | B. Supabase Realtime (Broadcast) |
|---|---|---|
| Väg | Direkt mellan spelarna när det går | Via Supabases servrar |
| Fördröjning | Lägst: bara nätet mellan spelarna | Två hopp. Supabases egen mätning: 6 ms i median inne i tjänsten, plus spelarnas nät |
| Leverans | Säker och i ordning, om kanalen öppnas med `reliable: true` (förvalet är oordnat) | Inte garanterad, ingen uttalad ordning: vi får själva numrera och skicka om |
| Brandväggar och mobilnät | Omkring en femtedel av alla par behöver en relä (TURN). PeerJS har en gratis relä förinställd, utan utfästelser | Fungerar där WebSocket fungerar |
| Tjänster vi blir beroende av | PeerJS gratis signalserver och relä, utan utfästelser om drift. Egen server kräver Node, alltså inte GitHub Pages | Ett Supabase-projekt. Gratisnivån pausas efter 7 dagar utan databasaktivitet och måste då startas för hand |
| Kvoter | Inga | Gratis: 100 meddelanden/s och 2 miljoner/månad för hela projektet. Ett meddelande räknas en gång när det skickas och en gång per mottagare |
| Vad kvoten räcker till | – | Med en tur var 200:e ms: 20 räknade meddelanden/s per match, alltså 5 matcher samtidigt och omkring 27 matchtimmar i månaden |
| Återanslutning | Biblioteket återansluter bara till signalservern; förbindelsen mellan spelarna får vi bygga upp på nytt själva | Klienten ansluter och går in i kanalen igen av sig själv. Det som skickades under tiden är borta |
| Lobby | Rumskoden blir den ena spelarens id hos signalservern | Rumskoden blir kanalens namn; närvaro (Presence) visar vem som är där |
| Storlek | 24 KB komprimerat | 17 KB med bara `@supabase/realtime-js` (59 KB med hela klienten) |
| Underhåll | Senaste version juni 2025, nästan bara beroendeuppdateringar, 184 öppna ärenden | Aktivt, del av en betaltjänst |
| Säkerhet | Den som kan rumskoden kan ansluta | Den som kan rumskoden och den publika nyckeln kan skicka i kanalen |

**Rekommendation: B, Supabase Realtime, bakom ett eget gränssnitt så att
A kan läggas till senare.** Skälen:

1. Att få kontakt är det som oftast går fel i ett spel mellan två
   personer, och där är B förutsägbart: det är en vanlig WebSocket till
   en känd adress. A beror på båda spelarnas nätverk och på en gratis
   relä som ingen lovar något om.
2. Lobby, närvaro och återanslutning blir enklare: båda går in i samma
   kanal med samma rumskod, också efter ett avbrott.
3. Det som B saknar, säker leverans i ordning, måste lockstep ändå
   hantera: varje tur numreras, och varje meddelande bär också de
   senaste turernas order, så att ett tappat meddelande inte stoppar
   spelet.

Vad B kostar: fördröjningen genom en server, kvoterna, och att
gratisprojektet pausas om ingen använder databasen på en vecka. Det
sista behöver en lösning innan spelet lämnas åt sig självt: ett
schemalagt jobb som rör databasen, eller betalnivån.

**Innan valet är slutgiltigt** bör båda prövas en kväll från två riktiga
enheter, varav en telefon på mobilnät (fas M3). Faserna M0–M2 är
desamma vilket som väljs.

### Faser

Varje fas är en egen pull request och avslutas som vanligt: tester
gröna, inga konsolfel, skärmdump, uppdaterad minnesbank, och en lista
över det som saknas eller avviker. Storleken är en uppskattning i
arbetspass av den längd som stegen i "björnrasen komplett" tog.

**M0 – Samma resultat i alla webbläsare** (litet, ett halvt pass)

1. Byt `Math.hypot(a, b)` mot `Math.sqrt(a * a + b * b)` i simuleringen
   (sex ställen, bl.a. `tileDistance` och `moveUnit`). Kvadratroten och
   de fyra räknesätten är exakt bestämda av standarden; `hypot` är det
   inte.
2. Byt `Math.sin` och `Math.cos` i `separateUnits` (riktningen för två
   enheter på exakt samma punkt) mot en tabell med fasta riktningar, och
   `atan2`, `sin` och `cos` i datorspelarens `towerSpot` mot räkning med
   vektorer.
3. En ESLint-regel som förbjuder `Math.hypot`, `sin`, `cos`, `tan`,
   `atan2`, `pow`, `exp`, `log`, `Math.random` och `Date` i `src/sim/`.
4. Flytta kontrollsumman från testet till `src/sim/checksum.ts`.
5. Kör determinismtestet i Firefox och WebKit i CI och jämför
   kontrollsummorna med Chromiums.

**Test:** determinismtestet grönt; samma kontrollsummor i tre motorer;
balanstesterna körs om, eftersom sista decimalen i avstånd ändras och
matcherna därmed kan gå annorlunda.

**M1 – Orderkö och turer, utan nätverk** (medel, ett till två pass)

1. `src/sim/lockstep.ts`, ren logik: spelet delas i turer om 4 steg
   (200 ms). En order som ges under tur T utförs i början av tur T + 2
   (400 ms senare). En tur körs först när båda spelarnas order för den
   har kommit. Order utförs i fast ordning: sida 0 före sida 1, och
   varje sidas i den ordning de gavs. Värdena läggs i `src/data/`.
2. All inmatning går genom en enda `issue(order)` i stället för de sex
   ställen som i dag anropar `applyCommand`. Spel mot datorn går genom
   samma kö med fördröjningen 0, så att det finns en väg, inte två.
3. Gränssnittet får svar på två sätt: en förhandskontroll direkt
   (`checkCommand`, som inte ändrar något) och det verkliga utfallet som
   en händelse när ordern utförs.
4. Vilken sida spelaren har blir en inställning i stället för en
   konstant.

**Test:** två spel i samma process, kopplade med en förbindelse i minnet
som fördröjer, kastar om och tappar meddelanden, håller samma
kontrollsumma i varje tur. Alla befintliga tester gröna utan ändring i
spel mot datorn. Mätbart: en order syns hos båda 400 ms efter att den
gavs, ±50 ms.

**M2 – Kontrollsummor som upptäcker att spelen glider isär** (litet, ett
halvt pass)

1. Var 20:e steg (en gång i sekunden) skickar varje spelare
   kontrollsumman för sitt spelläge med turens meddelande. En
   kontrollsumma tar 0,4 ms med 400 enheter.
2. Skiljer de sig stannar båda spelen och visar "Spelen har glidit
   isär". Rummets värd skickar sitt spelläge (21 KB komprimerat med 400
   enheter), gästen laddar det, och spelet fortsätter.
3. I utvecklingsläge skrivs var lägena först skiljer sig.

**Test:** ett fel som läggs in med flit hos den ena spelaren upptäcks
inom en sekund; efter omsynkningen är kontrollsummorna lika igen.

**M3 – Förbindelse och lobby med rumskod** (medel, ett till två pass)

1. Ett gränssnitt `Transport` (skicka, ta emot, motspelaren kom eller
   försvann) med tre utföranden: i minnet för enhetstester, mellan två
   flikar i samma webbläsare för webbläsartester, och den valda tjänsten.
2. Startskärmen får "Spela mot datorn", "Skapa rum" och "Gå med i rum".
   Rumskoden är fem tecken ur ett alfabet utan förväxlingsbara tecken
   (inget 0, O, 1 eller I) och går också att dela som länk (`?room=`).
3. Värden bestämmer fröet och skickar det tillsammans med spelets
   version. Har spelarna olika version startar inte matchen. Värden är
   sida 0 och gästen sida 1. Ingen datorspelare.
4. Fördröjningen mäts när spelarna har fått kontakt, och antalet turers
   fördröjning väljs efter den.
5. Spelläget som skickas vid en omsynkning (fas M2) komprimeras eller
   delas upp: det är upp till 184 KB, och Supabase tar högst 256 KB per
   meddelande på gratisnivån. (Tillagt efter M2.)

**Test:** två flikar i Playwright skapar och går med i ett rum och
spelar en match i takt. Den riktiga tjänsten prövas av användaren på två
enheter, och här om nätverket tillåter det.

**M4 – Väntan, paus, återanslutning och vinst när någon försvinner**
(medel, ett till två pass)

1. Saknas motspelarens order när en tur ska köras väntar simuleringen.
   Efter 0,5 s visas "Väntar på motspelaren…". Bilden fortsätter ritas.
2. Efter 10 s utan livstecken: "Motspelaren har tappat förbindelsen" med
   en nedräkning från 60 s. När den är slut kan den som är kvar ta
   segern eller vänta vidare.
3. Paus är en order som alla andra och gäller därför i samma tur hos
   båda. Varje spelare får pausa tre gånger per match, högst 60 s åt
   gången.
4. Den som lämnar (knapp, eller stänger fliken) skickar ett avsked, och
   motspelaren vinner direkt. Kommer inget avsked gäller punkt 2.
5. Återanslutning: samma rumskod och ett id som sparas i fliken. Den som
   är kvar skickar sitt spelläge och de order som kommit sedan dess; den
   som återvänder spelar ikapp utan att rita och är sedan med igen. Att
   ladda om sidan går samma väg.

**Test:** förbindelsen i minnet bryts i 5 s och båda fortsätter i takt;
den bryts i 70 s och den som är kvar kan ta segern; den ena spelaren
stängs och återvänder, och kontrollsummorna är lika efteråt.

**M5 – Avslutning** (litet, ett halvt pass)

Returmatch från slutskärmen, den långsammaste enhetens takt visas när
den håller tillbaka spelet, och avstämning mot den här planen.

### Prestanda med 400 enheter

Mätt på testmaskinen (en kärna, Intel Xeon 2,3 GHz), utan ritning. Ett
steg har 50 ms på sig.

| Läge | 100 enheter | 200 | 400 | Dyrast |
|---|---|---|---|---|
| Stillastående | 0,5 ms (1 %) | 0,9 ms (2 %) | 1,9 ms (4 %) | Sikten, 83 % |
| Samlande | 0,8 ms (2 %) | 1,5 ms (3 %) | 2,6 ms (5 %) | Sikten 61 %, samlandet 22 % |
| Strid, arméerna möts på mitten | 1,6 ms (3 %), längst 4 | 2,2 ms (4 %), längst 9 | 4,1 ms (8 %), längst 19 | Striden 69 %, sikten 24 % |
| Strid, alla får var sitt mål i samma steg | 3,9 ms (8 %), längst 42 | 8,4 ms (17 %), längst 88 | 17,4 ms (35 %), längst 163 | Striden 84 %: vägsökning |

Dessutom, per order: en förflyttningsorder för 200 enheter tvärs över
kartan tar 16 ms, och hundra små samlarorder i samma steg 208 ms (2 ms
styck, det mesta för att kartans hinder räknas ut på nytt för varje
order).

**Slutsats.** Vanligt spel ryms med god marginal också på en enhet som
är flera gånger långsammare. Det som inte håller är när många enheter
söker väg i samma steg: redan på testmaskinen tar ett sådant steg tre
gånger budgeten, och det upprepas var tionde steg så länge de jagar sina
mål. Hur mycket långsammare en telefon eller en Raspberry Pi är har jag
inte kunnat mäta; `?stress=400` visar det.

**Åtgärder**, i den ordning de ger mest för minst arbete. Alla är rena
ändringar i `src/sim/` och ändrar inte reglerna, men P1 och P2 ändrar
vilket steg en enhet söker väg i, och därmed hur en match utvecklar sig.

| | Åtgärd | Väntad verkan | Arbete |
|---|---|---|---|
| P1 | Sprid ut omsökningen: enheter söker ny väg i olika steg (efter sitt id), och högst ett bestämt antal sökningar görs per steg; resten väntar i en kö i id-ordning | Det längsta steget från 163 ms till omkring 20 ms | Litet |
| P2 | Sök inte om när målet står kvar på samma ruta och vägen fortfarande är fri | Medelsteget under jakt från 17 ms till några få | Litet |
| P3 | Räkna om sikten bara för enheter som har bytt ruta, eller vartannat steg | Stillastående och samlande: från 1,9–2,6 ms till under 1 ms | Litet till medel |
| P4 | Räkna ut kartans hinder en gång per steg i stället för en gång per order och system; kasta bort uträkningen när en byggnad kommer eller försvinner | En order från 2 ms till en bråkdel; hundra order i ett steg från 208 ms till omkring 20 | Litet till medel; risken är en uträkning som inte kastas bort i tid |
| P5 | Slå upp enheter på id i en tabell som görs en gång per steg, i stället för att leta i listan för varje enhet | Några procent av striden | Litet |
| P6 | Leta närmaste fiende bland enheterna på rutorna intill, som kollisionen redan gör, i stället för bland alla | Märks först med många stillastående soldater | Litet till medel |
| P7 | Gruppförflyttning: en väg för hela gruppen i stället för en per enhet | 16 ms per order blir någon ms. Behövs inte om P1 och P4 räcker | Medel till stort |

Rumslig indelning för kollisioner, som nämndes i uppdraget, finns redan:
`separateUnits` jämför bara enheter på samma och angränsande rutor, och
kollisionen är 3–8 % av ett steg i strid och högst 19 % när
en hel armé marscherar.

Förslag: P1–P4 görs som en egen fas mellan M1 och M3, efter att
användaren har mätt med `?stress=400` på telefon och Raspberry Pi.
Tillsammans ungefär ett arbetspass. P5–P7 bara om mätningen visar att
det behövs.

### Inte kontrollerat

- Att spelet ger samma resultat i Safari och Firefox som i Chromium. Här
  finns bara Chromium.
- Hur lång tid ett steg tar på en telefon och på en Raspberry Pi.
- Att PeerJS gratis signalserver och relä fungerar i dag, och hur ofta
  två spelare behöver relän.
- Om Supabase Broadcast levererar i ordning, hur snabbt närvaron märker
  en tappad spelare, och om trafik i enbart Realtime hindrar att ett
  gratisprojekt pausas.
- Hur någon av tjänsterna beter sig när en telefon lägger fliken i
  bakgrunden.
- Ingen av tjänsterna har anropats från den här miljön; uppgifterna om
  dem är lästa, inte prövade. Flera av PeerJS och Cloudflares sidor gick
  inte att öppna härifrån, och de uppgifterna kommer från bibliotekets
  källkod och från sökresultat.
