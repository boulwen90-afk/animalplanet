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
