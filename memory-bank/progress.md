# AnimalPlanet – framsteg

Uppdateras efter varje avslutad fas. Senaste fasen överst.

## Nuläge

- **MVP:n är klar.** Alla tio faser är mergade till `main`
- **Pågår: björnrasen görs komplett** i fem steg (lagning, vakttorn,
  smedja, kastbana med distansenhet, palissad och port), se sist i
  `implementation-plan.md`. Användaren ser skärmdumpar efter varje steg
- **Senaste ändring (2026-11-16):** steg 4, Kastbana och Ramkastare.
  Namn, vapen och värden är godkända av användaren som förslag att
  justera efter att ha prövat; sex värden som tillkom under bygget, bland
  dem att datorspelaren har 10 Samlare i stället för 8, är inte
  godkända. Steg 1, lagning (pull request 18), steg 2, vakttorn (pull
  request 19), byggmenyns flikar (pull request 20) och steg 3, smedja
  (pull request 21), är mergade. Se "Efter MVP:n". Om den senaste
  ändringen är mergad står i GitHub; den här raden säger det inte,
  eftersom den skrivs innan det är avgjort
- **Återstår av björnrasen:** steg 5, palissad och port
- **Uppskjutet till efter steg 5:** balansen mot datorspelaren. Matcher
  mellan två datorspelare tar 11,7–19,3 minuter på frö 1–6, mot målet
  10–20
- **Klart och mergat:** figurerna (björnkrigare, björnarbetare,
  tigerkrigare; björnkastaren kom med steg 4), björnarnas byggnader, att byggnaderna ritas i spelet,
  befolkningssystemet med bostaden Ide (pull request 14), Odlingen (pull
  request 14), Fiskehyttan (pull request 15), Idets hus (pull request
  16), miljöns bilder med rätt last i korgen och rättvis start, och
  befolkningstaket 200 (pull request 17). Båda ekonomibyggnadernas värden
  är godkända av användaren (2026-11-14)
- **Inte gjort:** Tigrarna finns inte som ras i spelet. Gräset är
  fortfarande en enfärgad romb med rutnät; allt annat på kartan ritas
  med bilder
- **Beslutat men inte påbörjat:** skarp rendering i skärmens verkliga
  upplösning. Den står som egen punkt sist i `implementation-plan.md`
- **Mäta på telefon:** `?debug=1` visar bilder per sekund, och
  `?stress=120` startar en match med 120 extra Samlare
- **Publicering:** https://boulwen90-afk.github.io/animalplanet/ uppdateras
  vid varje merge till `main`. Att sidan visar spelet är inte kontrollerat
  från Claudes session, som inte når github.io

## Fasstatus

| Fas | Innehåll | Status | PR |
|---|---|---|---|
| 0 | Planeringsdokument | Godkänd 2026-11-12 | – |
| 1 | Projektuppsättning, deploy, scrollbar karta | Mergad och publicerad | [#1](https://github.com/boulwen90-afk/animalplanet/pull/1) |
| 2 | Simuleringskärna och terräng | Mergad | [#2](https://github.com/boulwen90-afk/animalplanet/pull/2) |
| 3 | Enheter, markering, förflyttning | Mergad | [#3](https://github.com/boulwen90-afk/animalplanet/pull/3) |
| 4 | Resurser och insamling | Mergad | [#4](https://github.com/boulwen90-afk/animalplanet/pull/4) |
| 5 | Träna arbetare | Mergad | [#5](https://github.com/boulwen90-afk/animalplanet/pull/5) |
| 6 | Bygga Visthus och Krigshall | Mergad | [#6](https://github.com/boulwen90-afk/animalplanet/pull/6) |
| 7 | Soldater, strid, kapitulation, vinst och förlust | Mergad | [#7](https://github.com/boulwen90-afk/animalplanet/pull/7) |
| 8 | Krigsdimma | Mergad | [#8](https://github.com/boulwen90-afk/animalplanet/pull/8) |
| 9 | AI-motståndare | Mergad | [#9](https://github.com/boulwen90-afk/animalplanet/pull/9) |
| 10 | Pekstyrning, balans, MVP-avstämning | Klar | [#10](https://github.com/boulwen90-afk/animalplanet/pull/10) |

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

### Fas 10 – Pekstyrning, balans och MVP-avstämning (2026-11-13)

**PR:** https://github.com/boulwen90-afk/animalplanet/pull/10

**Skärmdumpar:** `docs/screenshots/fas-10-startskarm.png` (startskärmen på
dator), `fas-10-hallring.png` (ringen under ett finger som legat still i
300 ms), `fas-10-pekdragruta.png` (dragruta med finger),
`fas-10-hud-knappar.png` (knapparna "Bas" och "Avmarkera"),
`fas-10-mobil-startskarm.png`, `fas-10-mobil-storide.png` (Storidens panel
med kö på en 390 px bred skärm) och `fas-10-mobil-bygge.png` (byggplacering
med finger)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Pekstyrning enligt GDD avsnitt 4: tryck för markering och order, håll + dra för dragruta, knappen "Avmarkera". HUD-knappar minst 44×44 px | Klar | Även byggplacering med finger, som GDD:t inte beskriver |
| 2. Startskärm med titel, kort kontrollbeskrivning och "Starta" | Klar | Matchen står still bakom den |
| 3. Tangenten H / knapp för att hoppa till egen bas | Klar | Både tangent och knappen "Bas" |
| 4. Balanspass: enbart ändringar i `src/data/` | Klar | En ändring: motståndarens andel arbetare på trä, från 0,5 till 0,375 |
| 5. Avstämning av hela MVP:n mot GDD:t | Klar | Se "MVP-avstämning" nedan |

| Test i planen | Resultat |
|---|---|
| Playwright med pekemulering: tryck markerar | Godkänt |
| Playwright med pekemulering: tryck på mark flyttar | Godkänt |
| Playwright med pekemulering: håll + dra markerar flera | Godkänt |
| Playwright med pekemulering: ett finger panorerar | Godkänt (fas 1-testet och ett nytt) |
| Playwright: hela flödet startskärm → match → slutskärm → "Spela igen" | Godkänt |
| Vitest: AI mot AI ger matchlängd inom 10–20 min | Godkänt för frön 1–3 (19,1, 14,2 och 17,2 min) |
| Vitest: 6 Ramkrigare vid basen slår tillbaka första vågen | Godkänt för frön 1–3 (högst en försvarare kapitulerar, Storiden förlorar högst 10 liv) |
| Avstämningslistan finns i `progress.md` | Klar |
| Skärmdumpar, dator och mobil | Klara |

Utöver planen testas även: tryck på träd ger insamlingsorder och tryck på
fiende ger anfallsorder, att ett finger på en knapp aldrig flyttar kameran,
byggplacering och "Avbryt" med finger, att startskärm, knappar och paneler
ryms på en 390×844-skärm, att en order syns på enheten inom 100 ms, att
motståndaren själv har 6 Ramkrigare när första vågen får gå, och att den
inte samlar trä på hög.

**Balanspasset i siffror** (frön 1–6, mätt innan testerna skrevs)

| | Före (träandel 0,5) | Efter (träandel 0,375) |
|---|---|---|
| AI mot AI, matchlängd | 11,1–17,5 min | 14,2–19,1 min |
| Motståndarens trä efter 10 min | 1130–1230 | 590–740 |
| Motståndarens Ramkrigare efter 4 min | 7–9 | 8–9 |
| Motståndarens Ramkrigare efter 10 min | 9–15 | 13–19 |
| 6 Ramkrigare mot första vågen | Vinner på alla frön | Vinner på alla frön |
| 4 Ramkrigare mot första vågen | Förlorar på 3 av 6 frön | Inte mätt |
| Spelare som inte gör något | Förlorar efter 5,3 min | Förlorar efter 5,3 min |

Träandel 0,3 och 0,25 provades också. Då får motståndaren ont om trä, och
med 0,3 tog en match över 20 minuter. Vågornas tider och storlekar, och
alla enhets- och byggnadssiffror, är oförändrade: båda målen i planen var
redan uppfyllda.

**Saknas eller avviker**
- **Matchlängden mot en människa är inte mätt.** Målet 10–20 min är
  kontrollerat för dator mot dator. En spelare som inte försvarar sig
  förlorar efter drygt 5 minuter, när första vågen river Storiden.
- **Första vågen kräver att spelaren håller ungefär två tredjedelar av
  motståndarens takt.** Motståndaren har 5 Ramkrigare efter 3 minuter och
  8–9 efter 4. Vågen når basen efter cirka 4,5 minuter. Om det är lagom för
  en ny spelare går bara att avgöra genom speltest.
- **Motståndaren har fortfarande ett träöverskott**, ungefär hälften så
  stort som förut.
- **Byggplacering med finger står inte i GDD:t.** Konturen börjar mitt i
  bilden; ett tryck flyttar den och ett tryck på den bygger.
- **Knappen "Avmarkera" heter "Avbryt" medan en byggnad placeras** och
  avbryter då bara placeringen.
- **Det går inte att lägga till enheter i en markering med finger.**
  Shift-klick har ingen motsvarighet på pekskärm.
- **Bara ett finger följs.** Ett andra finger gör ingenting. Zoom ingår
  inte i MVP:n.
- **Hålltiden på 300 ms räknas i spelets tid.** På en enhet som ritar färre
  än 10 bilder per sekund blir den längre i verklig tid.
- **Pekstyrningen är bara provad med emulerat finger i Chromium**, inte på
  en riktig telefon eller surfplatta.
- **På en telefon i stående läge täcker panelerna ungefär en femtedel av
  skärmen** när Storiden är markerad (se `fas-10-mobil-storide.png`).
- **"Spela igen" hoppar över startskärmen**, via webbläsarens
  sessionslagring. Laddas sidan om för hand visas startskärmen igen.
- **Ny URL-parameter `?start=0`** för tester, utöver planen. Alla äldre
  webbläsartester använder den.
- **Standardfröet är kvar på 1.** Fas 2 lämnade frågan öppen till
  balansfasen. Kartan har en stor skog i mitten, och dator mot dator tar
  där 19,1 minuter, nära den övre gränsen.
- **Fas 1-testet för fingerpanorering ändrades.** Det väntade mellan
  nedsättning och första rörelse. Nu när ett finger som ligger still blir
  en dragruta kunde testet falla på en hårt belastad maskin.
- **Ett fas 8-test trycker nu på "Starta"** innan det tar sina bilder,
  eftersom det öppnar spelet utan testläge.

**Testresultat**
- Vitest: 397 av 397
- Playwright: 88 av 88, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- **Ett test hittade ett verkligt fel:** ett finger på "Avmarkera" flyttade
  kameran. Grundorsaken var ordningen mellan scenerna. Gränssnittet fick
  trycket först och tog bort knappen. När spelscenen sedan frågade om
  trycket låg på gränssnittet var svaret nej. Samma fel fanns för "Starta"
  och för musklick. Lösningen är att gränssnittet stoppar tryck det agerar
  på, inte att knappens yta räknas som gränssnitt i efterhand.
- Balansmålen var uppfyllda redan före passet. Det visade sig först när de
  mättes; utan mätningen hade vågorna sannolikt ändrats i onödan.
- Vitest visar inte `console.log` från godkända tester. Mätskript skriver
  till en fil i stället.
- Arbetsprocessen startades om flera gånger under fasen. Ocommittat arbete
  överlevde, men en lokal commit tidigt i fasen är en billig försäkring.

### Fas 9 – AI-motståndare (2026-11-13)

**Skärmdumpar:** `docs/screenshots/fas-9-anfallsvag.png` (första vågen når
spelarens bas efter 4,5 minuter), `docs/screenshots/fas-9-motstandarens-bas.png`
(motståndarens bas efter 3 minuter, sedd utan dimma: Krigshall, Visthus,
arbetare som samlar och sex soldater)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. AI i `src/sim/ai/` som bara agerar via samma kommandon som spelaren och betalar samma kostnader | Klar | |
| 2. Beteende enligt GDD avsnitt 10: arbetare till 8, Krigshall, Visthus, kontinuerlig soldatträning, anfallsvågor, basförsvar | Klar | |
| 3. Vågornas storlek och tidpunkter i `src/data/ai.ts` | Klar | Med tidsfönster per våg |
| 4. AI:n fattar beslut en gång per sekund, inte varje steg | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: efter 3 min har AI:n minst 6 Samlare och en Krigshall | Godkänt för 3 frön (den har 8 Samlare och även ett Visthus) |
| Vitest: första vågen skickas inom tidsfönstret i datafilen | Godkänt för 3 frön (går vid 4:00) |
| Vitest: AI:ns lager blir aldrig negativt | Godkänt (kontrolleras varje steg i 6 minuter) |
| Vitest: mot en spelare som inte gör något vinner AI:n inom 15 min | Godkänt för 3 frön (vinner efter drygt 5 minuter) |
| Vitest: AI mot AI med samma frö ger samma vinnare och samma slutsteg två körningar i rad | Godkänt (hela sluttillståndet är identiskt) |
| Playwright: spelet startar med AI utan konsolfel och AI:n har fler Samlare efter 2 min | Godkänt |
| Skärmdump av en AI-våg som anfaller | Klar |

Utöver planen testas även: att den slutar vid 8 arbetare, håller dem
sysselsatta på både mat och trä, betalar för det den tränar, aldrig går över
befolkningstaket, lämnar en personstyrd sida i fred, inte hindras av dimman,
försvarar basen, får sin Krigshall färdig även om byggaren försvinner, att
`?ai=0` ger en stillastående motståndare, och att motståndaren är dold i
dimman för spelaren.

**Saknas eller avviker**
- **Mot en spelare som inte försvarar sig är matchen över på drygt 5
  minuter.** Balansen justeras i fas 10; GDD:ts mål är 10–20 minuter.
- **AI:n samlar mer trä än den använder.** Efter 5 minuter har den över
  500 trä men ont om mat. Det justeras i fas 10.
- **Soldater i en våg bryr sig bara om fiendens soldater och huvudbyggnad.**
  De går förbi arbetare och andra byggnader.
- **AI:n bygger bara en Krigshall och ett Visthus**, och expanderar inte.
- **AI:ns arbetare flyr inte** när basen anfalls, och bara soldater som är
  hemma försvarar.
- **Den har ett tak på 20 soldater.** Det står inte i GDD:t.
- **Vågorna har ett tidsfönster.** GDD:t nämner bara en tidigaste tid.
- **Ny URL-parameter `?ai=0`** för tester, utöver planen.
- **Fem äldre webbläsartester körs nu med `?ai=0`.** De skrevs för en
  stillastående motståndare och prövar annat än AI:n.
- **AI-testerna tar runt 35 sekunder**, eftersom de spelar hela matcher.
  Övriga enhetstester tar ett par sekunder.

**Testresultat**
- Vitest: 371 av 371
- Playwright: 76 av 76, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Innan testerna skrevs kördes hela matcher med utskrift var 30:e sekund,
  för att se vad AI:n faktiskt gjorde. Det visade träöverskottet direkt.
- Ett test tittade på vågen vid en tidpunkt då AI:n redan hade vunnit
  matchen. Tester som stegar fram långt måste räkna med att matchen kan vara
  slut.

### Fas 8 – Krigsdimma (2026-11-13)

**Skärmdumpar:** `docs/screenshots/fas-8-tre-lagen.png` (alla tre lägen:
full sikt vid basen och spejaren, nedtonad mark där spejaren har gått, svart
där ingen har varit), `docs/screenshots/fas-8-start.png` (vid start)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Synlighetsrutnät per spelare: outforskad, utforskad, synlig | Klar | |
| 2. Uppdatering från alla egna enheters och byggnaders synfält | Klar | Varje steg. Byggen under uppförande ser 2 rutor |
| 3. Rendering: svart, nedtonad terräng respektive full sikt; fiendens enheter och byggnader döljs utanför synliga rutor | Klar | |
| 4. Byggplacering kräver utforskade rutor; order mot ett mål som försvinner ur sikte avbryts | Klar | Kravet som saknades i fas 6 är nu uppfyllt |
| 5. `?fog=0` i testläge stänger av dimman | Klar | Utan `?test=1` har parametern ingen verkan |

| Test i planen | Resultat |
|---|---|
| Vitest: en enhet med synfält 6 gör rätt rutor synliga | Godkänt (alla 900 rutor på testkartan kontrolleras) |
| Vitest: när den går vidare blir rutorna utforskade, inte outforskade | Godkänt |
| Vitest: en fiende utanför synfältet finns inte i spelarens synliga entiteter | Godkänt |
| Vitest: byggplacering på outforskad ruta nekas | Godkänt, även delvis outforskad plats |
| Playwright: vid start är fiendens bas inte synlig enligt `getState()` | Godkänt |
| Playwright: efter att en enhet gått dit är den det | Godkänt |
| Skärmdump som visar alla tre dimlägen | Klar |

Utöver planen testas även: byggnaders synfält, att terräng inte skymmer, att
sidorna inte delar sikt, att kapitulerade enheter inte ser, att en anfallare
ger upp när målet försvinner i dimman, att en dold fiende inte går att
markera och att en markerad fiende avmarkeras när den försvinner, samt att
`?fog=0` saknar verkan utanför testläge (genom att jämföra bilder).

**Saknas eller avviker**
- **Utforskad mark visar kartan som den är nu**, inte som den såg ut när
  spelaren var där. Ett träd som fienden har huggit ned försvinner alltså
  från spelarens bild även om ingen ser det.
- **Enheter hittar vägen genom outforskad mark.** Vägsökningen känner hela
  kartan, så en enhet som skickas in i det svarta går runt hinder spelaren
  aldrig har sett.
- **Träd i dimmans kant ritas delvis nedtonade.** Dimman ligger per ruta,
  och ett träd är högre än sin ruta.
- **Utforskad mark har ett mörkare rutnät.** Dimrutorna överlappar en
  pixel för att täta skarvarna, och där två halvgenomskinliga rutor möts
  blir det mörkare.
- **Fiendens byggnader glöms så fort de är ur sikte.** Det följer GDD:t.
- **Byggen under uppförande ser 2 rutor.** GDD:t anger bara synfält för
  färdiga byggnader.
- **Inga äldre tester behövde `?fog=0`.** Planen räknade med det; de gick
  igenom med dimman på.
- **AI:n ska enligt GDD:t inte påverkas av dimman.** Det hanteras i fas 9;
  i nuläget gäller dimman lika för båda sidor.

**Testresultat**
- Vitest: 352 av 352
- Playwright: 71 av 71, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Första versionen lät rutnätet lysa svagt genom skarvarna i det svarta,
  vilket hade kunnat avslöja sjöar. Det syntes på skärmdumpen. Dimrutorna
  överlappar nu en pixel.
- Ett av de nya webbläsartesterna påstod sig kontrollera att `?fog=0` inte
  verkar utanför testläge, men kontrollerade ingenting. Det jämför nu
  andelen grön mark i bilden.
- En byggnad som rasar dold i dimman skakar inte längre skärmen.

### Fas 7 – Soldater, strid, kapitulation, vinst och förlust (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-7-strid.png` (strid vid basen med
livstaplar, träffblink, vita flaggor, grottor och varningstext),
`docs/screenshots/fas-7-grotta.png` (efter striden: en egen soldat har gått
in i grottan, 1/12), `docs/screenshots/fas-7-nederlag.png` (slutskärmen)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Krigshallen tränar Ramkrigare | Klar | 60 mat och 25 trä, 18 s |
| 2. `attack`-kommando mot enheter och byggnader; förföljelse; skadeformel och anfallstakt | Klar | |
| 3. Automatiskt anfall för stillastående Ramkrigare (inom 6 rutor) | Klar | Bara mot enheter, se avvikelser |
| 4. Grottor: 2 per sida med 12 platser, speglade, nåbara; blockerar sin ruta, kan inte anfallas, inget byggs på eller intill | Klar | |
| 5. Kapitulation: kan inte anfallas eller ges order, räknas inte i befolkningen, går till närmaste egna grotta, platsen reserveras, försvinner om ingen grotta finns | Klar | |
| 6. Byggnader rasar när livet når 0 och frigör sina rutor | Klar | |
| 7. Fiendesidan är passiv tills AI:n kommer | Klar | Den har bara Samlare, som aldrig anfaller självmant |
| 8. Vinst/förlust när en Storide rasar; slutskärm med "Spela igen" | Klar | |
| 9. Livstaplar, träffblink, utfall, vit flagga, bortoning, skärmskakning och larmtext | Klar | |
| 10. Gränssnittet säger "Liv" i stället för "HP" | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: skada = skada − rustning, minst 1 | Godkänt |
| Vitest: slag sker med rätt intervall | Godkänt (direkt, sedan var 24:e steg) |
| Vitest: en Ramkrigare får en Samlare att kapitulera på förväntat antal steg | Godkänt (exakt 73 steg) |
| Vitest: anfallare följer efter ett flyende mål | Godkänt |
| Vitest: Ramkrigare anfaller fiende inom 6 rutor men inte utanför | Godkänt |
| Vitest: en raserad byggnad frigör sina rutor | Godkänt |
| Vitest: en raserad Storide sätter rätt vinnare och stoppar simuleringen | Godkänt, för båda sidor |
| Vitest: en kapitulerad enhet tar ingen mer skada och väljs inte som mål | Godkänt |
| Vitest: den går till närmaste egna grotta, tas bort vid ankomsten, grottans antal ökar med 1 | Godkänt |
| Vitest: befolkningen minskar redan vid kapitulationen | Godkänt |
| Vitest: den trettonde enheten går till den andra grottan | Godkänt |
| Vitest: när alla 24 platser är tagna försvinner nästa enhet direkt | Godkänt |
| Vitest: en enhet går aldrig till motståndarens grotta | Godkänt |
| Vitest: varje sida har 2 grottor, de är speglade och nåbara från startplatsen | Godkänt för 40 frön |
| Vitest: byggplacering på eller intill en grotta nekas | Godkänt |
| Playwright: soldater anfaller fiendens Storide, "Seger" visas | Godkänt, med dragruta och högerklick |
| Playwright: motsvarande för "Nederlag" | Godkänt |
| Playwright: en besegrad enhet hamnar i sin sidas grotta | Godkänt |
| Skärmdump av strid, kapitulerad enhet på väg till grotta och slutskärm | Klar |

Utöver planen testas även: Samlare som slåss på order, anfallare som sprider
sig runt målet, ogiltiga mål, mål som inte går att nå, flyttorder som
avbryter anfall, last som tappas, kapitulerade enheter som inte lyder order
eller kan markeras i grupp, grottor som minns djurens typ, varningstexten,
skärmskakningen, att simuleringen står still efter avgörandet, och att
"Spela igen" ger ett nytt spel.

**Saknas eller avviker**
- **Soldater anfaller självmant bara enheter, inte byggnader.** GDD:t säger
  "fiender". Byggnader anfalls på order, annars skulle sysslolösa soldater
  vandra iväg mot närmaste fiendebyggnad.
- **Arbetare som blir anfallna gör ingenting åt det.** De fortsätter med
  sitt tills de kapitulerar. GDD:t säger bara att Samlare anfaller på order.
- **Grottorna ligger på den egna halvan av kartan**, så en enhet som
  besegras vid fiendens bas går över hela kartan med vit flagga. Det tar
  runt en halv minut.
- **Antalet djur i fiendens grottor syns för spelaren.** Det döljs först
  när krigsdimman finns (fas 8).
- **Grottor går inte att markera.** Antalet står ovanför grottan.
- **Varningen "Din bas anfalls!" kommer bara när en byggnad träffas**,
  inte när enheter anfalls.
- **Byggen under uppförande har ingen livstapel**; deras liv växer av sig
  självt och visas i markeringspanelen.
- **"Spela igen" laddar om sidan** och ger samma karta, eftersom fröet står
  kvar i adressen.
- **En enhet stannar där den står när målet kommer inom räckhåll**, vilket
  kan vara mellan två rutors mittpunkter.
- **Flera anfallare kan dela ruta** när alla rutor runt målet är upptagna.
- **Skärmskakningen går på Phasers egen klocka** och kan vara längre än
  150 ms vid låg bildfrekvens.
- **Testgränssnittet har fått `spawnUnit`**, som skapar enheter ur intet.
  Det finns bara i testläge.
- **Pekskärm:** anfallsorder kräver högerklick. Det hör till fas 10.

**Testresultat**
- Vitest: 329 av 329
- Playwright: 64 av 64, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Simuleringen rapporterar nu händelser per steg, så att renderingen kan
  visa blink, utfall, skakning och varning.
- Tre webbläsartester fallerade först för att nyskapade soldater genast
  anföll fiendens arbetare på eget initiativ och hade flyttat sig när testet
  drog sin ruta. Spelet gjorde rätt. Testerna ställer nu soldaterna utom
  synhåll.
- Första versionen kunde lägga en grotta på kartans yttersta ruta, så att
  halva grottan hängde utanför. Det syntes på skärmdumpen. Grottor håller nu
  2 rutor från kanten.

### Fas 6 – Bygga Visthus och Krigshall (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-6-spokbild.png` (byggmeny och grön
kontur på giltig plats), `docs/screenshots/fas-6-ogiltig-plats.png` (röd
kontur över Storiden), `docs/screenshots/fas-6-bygge.png` (Visthus under
uppförande, 71 %), `docs/screenshots/fas-6-fardigt.png` (färdigt Visthus)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Byggmeny på markerad Samlare: Visthus, Krigshall, med kostnad | Klar | |
| 2. Placering med spökbild (grön/röd) och giltighetskontroll enligt GDD | Klar, med undantag | Kravet på utforskad mark kommer med krigsdimman i fas 8 |
| 3. `build`-kommando: kostnaden dras, byggplats på 10 % HP, arbetaren går dit och bygger; fler arbetare bygger snabbare; högerklick på eget bygge låter fler hjälpa till | Klar | |
| 4. Färdiga byggnader blockerar vägsökningen; Visthus är avlämningsplats | Klar | Byggen blockerar redan från placeringen |
| 5. Krigshallen kan markeras men tränar ännu inget | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: giltig/ogiltig placering (på träd, på byggnad, utanför kartan, delvis blockerad) | Godkänt |
| Vitest: kostnad dras vid placering och nekas vid för lite trä | Godkänt |
| Vitest: en arbetare färdigställer ett Visthus på 20 s | Godkänt (exakt 400 steg, inte klart efter 399) |
| Vitest: två arbetare går fortare enligt formeln | Godkänt (267 steg för två, 200 för tre) |
| Vitest: ofärdigt Visthus tar inte emot resurser, färdigt gör det och väljs när det är närmast | Godkänt |
| Vitest: A* går runt den nya byggnaden | Godkänt, även för en enhet som redan var på väg |
| Playwright: välj Samlare → Visthus → klicka på giltig ruta → stega fram; färdigt Visthus och 80 mindre trä | Godkänt |
| Skärmdump med spökbild och färdig byggnad | Klar |

Utöver planen testas även: enhet på byggplatsen, byggnader som inte får
byggas, order utan byggare, arbetare som går till bygget, bygge utan
arbetare, hjälp till pågående bygge, arbetare som inte når bygget, ofärdig
byggnad som inte tränar, röd kontur och klick på ogiltig plats, avbrott med
högerklick och Esc, för dyr byggnad, och Krigshallen som färdig byggnad.

**Saknas eller avviker**
- **Byggplatsen behöver inte vara utforskad.** Det kravet i GDD:t kan inte
  uppfyllas förrän krigsdimman finns (fas 8).
- **Spökbilden är bara fotavtryckets kontur**, inte en bild av byggnaden.
- **Ett bygge blockerar sina rutor direkt när det placeras**, inte först
  när det är färdigt som planen säger.
- **Har man inte råd blinkar träsiffran redan när man klickar på
  byggknappen**, och placeringen startar inte.
- **Ett bygge går inte att avbryta eller riva**, och ingenting återbetalas.
  Utan arbetare står det kvar ofärdigt.
- **Arbetare blir sysslolösa när bygget är klart.** De går inte tillbaka
  till det de gjorde innan.
- **En enhet på byggplatsen gör platsen ogiltig**, även när det är den
  egna byggaren. Det följer GDD:t men kan upplevas som krångligt.
- **Arbetare som bygger kan hamna bakom byggnaden och inte synas.** På
  skärmdumpen av bygget syns en av tre.
- **Pekskärm:** byggplacering fungerar inte med finger. Det hör till fas 10.
- **Ingen garanterat fri plats för en Krigshall nära basen.**
  Kartgenereringen håller bara 4 rutor fria runt startpositionen, och en
  3×3-byggnad ryms inte där bredvid Storiden. Spelaren får hitta en plats
  själv; på standardkartan finns gott om utrymme.

**Testresultat**
- Vitest: 272 av 272
- Playwright: 58 av 58, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Enhets- och byggnadstypernas namn skrivs nu ut i `src/data/types.ts`.
  När enheter pekar på byggnader och byggnader på enheter kan TypeScript
  inte härleda namnen ur tabellerna.
- Tre tester antog en fri plats som kartgenereringen inte garanterar. Det
  är tredje gången samma slags fel uppstår; regeln står nu i
  `architecture.md` under Testgränssnitt.

### Fas 5 – Träna arbetare (2026-11-12)

**Skärmdump:** `docs/screenshots/fas-5-traning.png` (Storiden markerad,
kommandopanelen med två Samlare i kö och förloppsstapel, en fjärde Samlare
färdig)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Produktionssystem: kö (högst 5), träningstid, kostnad dras vid köning och återbetalas vid avbrott | Klar | |
| 2. Befolkningstak (30); köning nekas vid fullt tak eller för lite resurser | Klar | Enheter i kö räknas mot taket |
| 3. Ny enhet dyker upp på närmaste lediga ruta intill byggnaden | Klar | Närmast byggnadens framsida, så att den syns |
| 4. Kommandopanel: byggnad kan markeras; träningsknapp med kostnad; kö med förloppsstapel; klick på köad enhet avbryter | Klar | |
| 5. Återkoppling vid för lite resurser enligt GDD avsnitt 11 | Klar | Siffran blinkar rött i 300 ms och inget köas |

| Test i planen | Resultat |
|---|---|
| Vitest: träning drar 50 mat och ger en Samlare efter 12 s simulerad tid | Godkänt (exakt 240 steg, ingen efter 239) |
| Vitest: avbrott återbetalar | Godkänt |
| Vitest: den sjätte köningen nekas | Godkänt |
| Vitest: köning nekas vid för lite mat, utan att resurser dras | Godkänt |
| Vitest: köning nekas vid fullt befolkningstak, utan att resurser dras | Godkänt |
| Playwright: markera Storiden, klicka "Träna Samlare", stega fram; 4 egna Samlare och 50 mindre mat | Godkänt |
| Skärmdump med kommandopanel och kö | Klar |

Utöver planen testas även: att nya enheter får egna rutor framför
byggnaden, att kön tränas i ordning, avbrott av den som tränas respektive en
som väntar, ogiltiga köplatser, andra spelarens byggnad, att köade enheter
räknas mot taket, panelens placering och knappstorlek, klick på tom köplats,
och den röda blinkningen.

**Saknas eller avviker**
- **Enheter i kö räknas mot befolkningstaket.** Med 28 enheter och 2 i kö
  nekas en tredje. Planen säger bara "vid fullt befolkningstak".
- **Vid fullt befolkningstak blinkar befolkningssiffran rött.** GDD:t
  beskriver bara blinkning för resurser.
- **Full kö ger ingen återkoppling alls.** Klicket gör ingenting.
- **Träningsknappen ser likadan ut när man inte har råd.**
- **Att avbryta den enhet som tränas kastar bort arbetet** men återbetalar
  hela kostnaden.
- **Nya enheter står stilla där de dyker upp.** Samlingspunkt ingår inte i
  MVP:n.
- **Markeringen runt en vald byggnad syns dåligt.** Den gröna konturen
  ritas på marken och döljs till största delen av byggnadens block. Det har
  funnits sedan fas 3 men märks först nu när byggnaden har en funktion.
- **Smala skärmar:** kommandopanelen läggs ovanför markeringspanelen. Under
  cirka 450 px bredd får köplatserna inte plats. Mobilanpassning ligger i
  fas 10.
- **Pekskärm:** knapparna reagerar på tryck, men ett finger på en knapp
  panorerar också kameran. Det åtgärdas i fas 10.
- **Skärmdumpen visar inte den röda blinkningen.** En skärmdump tar längre
  tid än de 300 ms blinkningen varar. Färgen kontrollerades med ett
  tillfälligt bygge där blinkningen var 3 s.

**Testresultat**
- Vitest: 234 av 234
- Playwright: 51 av 51, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Kommandon ger nu tillbaka ett resultat som säger om ordern gick igenom
  och annars varför inte.
- Resursradens textfärg sattes först om varje bildruta, vilket ritar om
  texten varje gång. Nu ändras den bara när blinkningen börjar och slutar.
- Testet för den röda blinkningen läser ett tillstånd, inte pixlar. Att
  texten verkligen blir röd fick kontrolleras separat.

### Fas 4 – Resurser och insamling (2026-11-12)

**Skärmdumpar:** `docs/screenshots/fas-4-insamling.png` (två Samlare på
bär och en på trä, resursraden och markeringspanelen),
`docs/screenshots/fas-4-tomd-kalla.png` (samma plats senare: tre bärsnår
och flera träd är tömda och borta)

**Avstämning mot planen**

| Punkt i planen | Status | Kommentar |
|---|---|---|
| 1. Resurskällor med ändlig mängd; tömda källor försvinner och träd blir gångbar mark | Klar | Även tömda bärsnår blir gångbar mark |
| 2. `gather`-kommando: källa → samla (1/s, högst 10) → avlämningsplats → upprepa; byter till närmaste källa av samma typ inom 8 rutor, annars sysslolös | Klar | Lämnar av sin sista last innan den blir sysslolös |
| 3. Spelarens lager i simuleringen; startresurser enligt GDD | Klar | 200 mat och 100 trä, för båda sidor |
| 4. HUD-överkant: mat, trä, befolkning | Klar | |
| 5. Högerklick på resurs med Samlare markerade ger `gather` | Klar | |

| Test i planen | Resultat |
|---|---|
| Vitest: en Samlare intill källa och Storide levererar exakt 10 enheter efter beräknat antal steg | Godkänt (exakt 200 steg, inget efter 199) |
| Vitest: källan minskar lika mycket som lagret ökar | Godkänt (kontrolleras varje steg i 700 steg) |
| Vitest: en tömd källa tas bort och arbetaren byter till nästa | Godkänt |
| Vitest: utan källor i närheten blir arbetaren sysslolös | Godkänt |
| Playwright: efter gather-order och framstegning visar HUD:en mer mat | Godkänt |
| Skärmdump med arbetare som samlar och HUD | Klar |

Utöver planen testas även: trä och mat hamnar i rätt lager, flera arbetare
på samma källa ställer sig på olika rutor, två arbetare som tömmer samma
källa skapar inga resurser ur intet, inneslutna träd, källor utanför
sökradien, byte av resursslag, flyttorder under insamling, sida utan
avlämningsbyggnad, klick på trädkronan, och att tömda källor försvinner
från kartan utan fel.

**Saknas eller avviker**
- **Markeringspanelen visar vad en egen enhet gör** (t.ex. "Samlar mat
  7/10"). Det står i GDD avsnitt 4 men inte i planen för någon fas.
- **Enheter som bär något får en liten färgad fyrkant.** Det står varken i
  GDD:t eller planen; utan den syns det inte att någon samlar.
- **Hur mycket som finns kvar i en källa visas ingenstans.** GDD:t kräver
  det inte.
- **Orderringen är grön även för insamling.** GDD:t anger bara grön för
  flytt och röd för attack.
- **Byte av resursslag tappar lasten.** En Samlare med 4 trä som skickas
  till bär börjar om på 0. GDD:t säger inget om det.
- **Sysslolösa arbetare syns inte på något särskilt sätt** och det finns
  ingen knapp för att hitta dem.
- **Flera arbetare kan dela ruta** när alla rutor runt en källa är upptagna.
- **Närmaste avlämningsplats räknas fågelvägen**, inte efter vägens längd.
- **Motståndaren har ett lager men gör ingenting** förrän AI:n kommer i
  fas 9.

**Testresultat**
- Vitest: 197 av 197
- Playwright: 44 av 44, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i headless-webbläsare: inga

**Beslut och lärdomar**
- Insamlingen räknar hela simuleringssteg i stället för bråkdelar, så att
  "1 enhet per sekund" blir exakt 20 steg.
- Ett webbläsartest klickade på en enhets gamla läge efter att den redan
  hade börjat gå. Enheter rör sig i realtid även i testläge, så tester
  måste markera först och ge order sedan.

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

## Efter MVP:n

### Björnrasen komplett, steg 4: Kastbana och Ramkastare (2026-11-16)

Steg 3, Smedjan (pull request 21), mergades först, efter grönt CI.
Användaren godkände förslaget för steg 4 med "Ja": enheten heter
**Ramkastare** och kastar tallspjut, byggnaden heter **Kastbana** (inte
Skyttebana), kastaren slår svagt på nära håll, och värdena i tabellen
nedan gäller som förslag att justera efter att ha prövat.

**Skärmdumpar:** `docs/screenshots/kastbana-stadier.png` (Kastbanans tre
byggstadier i spelet), `kastbana-tranar.png` (Kastbanan markerad:
knappen "Träna Ramkastare / 50 mat, 40 trä / Kastar spjut på avstånd",
kö och stapel, och en färdig Ramkastare framför), `kastare-vald.png`
(markeringspanelen: "Kast 8 · Räckvidd 7 · Slag 3 · Rustning 0"),
`kastare-kastar.png` (fyra blå Ramkastare kastar på två röda Ramkrigare:
två spjut i luften, splitterstjärnor där de förra landade),
`kastare-mot-torn.png` (fyra röda Ramkastare river spelarens Vakttorn
utifrån; tornet är markerat, så dess räckviddsring syns, och kastarna
står precis utanför den), `kastare-narstrid.png` (Ramkrigarna har kommit
fram: kastarna stöter med spjuten), `kastbana-meny.png` och
`kastbana-telefon.png` (fliken Försvar med fem knappar, på 1280 px och
på en 390 px bred telefon), `kastare-pipeline.png` (figuren framifrån,
från sidan, bakifrån och i båda lagfärgerna) och `kastbana-pipeline.png`
(pipelinens bild av de tre stadierna).

**Värden** i `UNIT_DEFS.ramkastare`, `BUILDING_DEFS.kastbana`,
`AI_CONFIG.throwers` och `UI_CONFIG.projectile`

| Värde | Förslag | Godkänt i förslaget? |
|---|---|---|
| Ramkastare, pris | 50 mat, 40 trä | Ja |
| Träningstid | 20 s | Ja |
| Liv / rustning | 60 / 0 | Ja |
| Fart | 2,0 rutor/s | Ja |
| Kast | 8 i skada, ett var 1,8:e sekund, räckvidd 7 rutor | Ja |
| Slag på nära håll | 3 i skada | Ja |
| Synfält | 8 rutor | Ja |
| Kastbana | 130 trä, 30 s, 500 liv, 2×2 rutor, fliken Försvar | Ja |
| Vapen I/II | +2 per nivå på kastet | Ja |
| Tid mellan två slag på nära håll | 1,8 s | **Nej**, stod inte i förslaget |
| Spjutets fart | 10 rutor/s (pilen: 12) | **Nej** |
| Upptäcktsradie | 7 rutor, samma som räckvidden | **Nej** |
| Kollisionsradie | 0,40 rutor (Ramkrigare 0,45) | **Nej** |
| Kastbanans synfält | 5 rutor | **Nej** |
| Datorspelarens Samlare | 10, varav 4 på trä (förut 8, varav 3) | **Nej**, se avvikelserna |
| Datorspelarens andel kastare | 1 Ramkastare på 2 Ramkrigare | Ja |

**Sten, sax, påse, uppmätt i simuleringen** (`throwing.test.ts`)

| Möte | Resultat |
|---|---|
| 4 Ramkastare mot 1 Vakttorn | Tornet faller 27,8 s efter första kastet. Tornet skjuter inte en enda pil: kastarna står 7 rutor från dess kant, och det når 6 från sin mitt |
| 1 Ramkrigare mot 1 Ramkastare, från 7 rutors håll | Ramkrigaren vinner efter 8,6 s med 80 av 100 liv. Den tar 2 spjut på vägen fram (14 liv) och 3 stötar (6 liv) |
| 3 Ramkrigare mot 3 Ramkastare (180 mat + 75 trä mot 150 mat + 120 trä) | Alla tre Ramkastare kapitulerar; alla tre Ramkrigare står kvar med 80 liv var |
| 2 Ramkrigare mot 1 Vakttorn | Båda kapitulerar; tornet står kvar med 60 av 500 liv. Tre Ramkrigare river det |

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| Ny byggnad som tränar en distansenhet | Klar | Kastbana tränar Ramkastare |
| Originellt namn och vapen som passar björnarna | Klar | Ramkastare med tallspjut; godkänt av användaren |
| Svag i närstrid, stark på avstånd | Klar | Kast 8 från 7 rutor; slag 3; 60 liv och ingen rustning |
| Ny figur i pipelinen med egna animationer | Klar | `bear_thrower`; `throw` och `jab` är nya i biblioteket |
| Tydlig sten-sax-påse mot Ramkrigaren och tornet | Klar | Se tabellen ovan; fyra tester håller den |
| Föreslå balansvärden | Klar | Godkända som förslag; sex värden tillkom, se tabellen |
| Byggmenyn visar kostnad och beskrivning | Klar | "Bygg Kastbana / 130 trä / Tränar Ramkastare" |
| Alla värden i datafilerna | Klar | |
| Grafik via pipelinen enligt skalstandarden | Klar | Figuren klass `warrior` (35,2 px, som Ramkrigaren); byggnaden klass `small` (krav 64 px, taket 73 px) |
| Datorspelaren bygger Kastbana och tränar kastare | Klar | Stod inte i uppdraget; ingick i det godkända förslaget |

**Vad som gjordes**

- **Data:** `UnitDef.ranged` (`RangedDef`), `UNIT_DEFS.ramkastare`,
  `BUILDING_DEFS.kastbana`, `ProjectileKind`, `AttackDef.projectile`,
  `AI_CONFIG.throwers`. Vapen och Rustning gäller Ramkastaren.
- **Simulering:** kast i `systems/combat.ts` (`attackMode`,
  `throwDistance`, `pursueOrThrow`, `throwingPath`, `provoke`),
  `systems/projectiles.ts` (`launchProjectile`), och `flyProjectiles`
  klarar byggnader som mål. `Projectile.kind`, `AttackTask.threw`.
- **Datorspelaren:** bygger en Kastbana, håller andelen kastare, och
  dess kastare tar torn utifrån.
- **Grafik:** `units/thrower.toml` med kastspjut, koger och lädermössa;
  animationerna `throw` och `jab`; `buildings/bear/range.toml` med
  delarna `shed_roof` och `target`; spjutet `javelin` i miljöns atlas.
- **Spelet:** figuren och byggnaden ritas från sina atlaser, spjutet
  flyger från kastarens hand, och markeringspanelen visar kast,
  räckvidd, slag och rustning.

**Saknas eller avviker**

- **Byggnaden heter Kastbana, inte Skyttebana.** Godkänt av användaren.
- **Sex värden stod inte i förslaget** och är alltså inte godkända: se
  tabellen.
- **Datorspelaren har 10 Samlare i stället för 8**, fyra på trä i
  stället för tre. Det stod inte i förslaget och är en balansändring.
  Grundorsak: en Ramkastare kostar 40 trä mot Ramkrigarens 25, och
  Kastbanan 130. Med 8 Samlare gick allt trä åt, och det som förut blev
  över till torn och Smedja fanns inte längre. Uppmätt på frö 1–6 med 8
  Samlare: på tre av sex kartor blev någon sida utan Smedja och utan
  torn, och på en utan Kastbana. Prövat: 4 av 8 på trä gav en
  match på 6,2 minuter; 4 av 9 gav en på 24,4 minuter och 400 trä över;
  4 av 10 gav alla byggnader på alla sex kartor och matcher på 11,7–19,3
  minuter. Datorspelaren samlar därmed en fjärdedel mer än förut, mot
  spelaren också.
- **En enhet som träffas av ett spjut svarar** (`provoke`). Det stod
  inte i förslaget. Utan det stod en sysslolös Ramkrigare kvar och tog
  emot spjut från 7 rutor, eftersom den själv upptäcker fiender på 6.
  Samlare svarar inte. En pil från ett torn väcker ingen: det är som
  förut.
- **Vapen gäller stöten också** (3 → 5 → 7), inte bara kastet.
  Förslaget sade "även på kastet"; uppgraderingen räknas per enhetstyp.
- **På byggnader kastar den alltid**, också när den står intill. Den
  slår bara fiendeenheter på en ruta intill dess egen.
- **Kastaren backar inte.** Kommer en fiende fram står den kvar och
  stöter. Den byter inte heller mål till den som slår på den.
- **Spjutet träffar alltid** om målet finns kvar, som tornets pil: det
  följer målet, flyger över träd och hus, och kan inte träffa någon
  annan.
- **Räckvidden mäts olika för kastare och torn:** kastarens till en
  byggnads närmaste kant, tornets från tornets mitt. Mot ett torn på en
  ruta skiljer det en halv ruta, till kastarens fördel.
- **Kastare i grupp står tätt.** De tar var sin ruta längs räckviddens
  rand, men rutorna ligger intill varandra (se `kastare-mot-torn.png`).
- **Spelarens Ramkastare kastar inte på byggnader av sig själva**, bara
  på enheter inom 7 rutor. Ett fientligt torn måste spelaren peka ut.
  Det gäller alla enheter sedan steg 2.
- **Datorspelarens Ramkrigare går fortfarande in i ett torns räckvidd**
  innan de vänder sig mot det. Bara dess kastare tar tornet utifrån.
- **Kogret visar alltid tre spjut**, hur många som än har kastats.
- **Det första kastet har ingen ansats.** Animationen börjar när spjutet
  lämnar handen, som krigarens hugg börjar när det träffar; ansatsen
  syns inför varje kast efter det första.
- **Stöten är långsam att se på:** åtta bildrutor på 1,8 sekunder.
- **Ett spjut mot en byggnad landar mitt på den**, halvvägs upp på
  väggen, inte på den vägg som vetter mot kastaren.
- **Köns ruta visar "R"** för både Ramkrigare och Ramkastare. De tränas
  i olika byggnader, så de står aldrig i samma kö.
- **Fliken Försvar har nu fyra byggnader och "Laga":** en rad på 1280
  px, tre rader på en telefon. Steg 5 lägger till två till.
- **Figurens atlas är 1024×818 px** (1,2 MB och 0,75 MB mask), lika stor
  som krigarens. Spelet laddar alltså två megabyte till.
- **Miljöns atlas är fortfarande 256×249 px** med spjutet i (38 bilder).
- **Tornet vinner knappt över två Ramkrigare:** det har 60 av 500 liv
  kvar. Tre river det.
- **Skärmdumpen mot tornet visar röda kastare mot spelarens torn.**
  Testgränssnittet kan inte ställa ut ett fientligt torn, så bilden är
  tagen åt andra hållet. Reglerna är desamma för båda sidor.
- **Övriga figurers och byggnaders atlaser är inte byggda om** efter
  tilläggen i de gemensamma `lib/armor.py`, `lib/weapons.py` och
  `lib/structures.py`. Tilläggen är nya delar som bara kastaren och
  Kastbanan använder. `assets/previews/overview.png` är byggd om.
- **Balansen mot en mänsklig spelare är inte prövad.** Den tas efter
  steg 5, som användaren har bestämt.
- **Inte mätt:** bilder per sekund med många spjut i luften.
  **Inte prövat:** en riktig telefon.
- **Inget ljud**, som i resten av spelet.

**Testresultat**

- Vitest: 830 av 830 tester gröna (41 filer). 62 är nya: 35 om kast och
  sten-sax-påse (`throwing.test.ts`), 5 om datorspelaren, och resten om
  figurens atlas, byggnadens atlas, animationsvalet, spjutets bild och
  markeringspanelen
- Playwright: 160 av 160 gröna i normal fart (4,5 min) och 160 av 160
  med processorn strypt åtta gånger (14,3 min). 8 är nya
  (`thrower.spec.ts`)
- Lint och typkontroll utan anmärkning. Inga konsolfel, varken i
  testerna eller när skärmdumparna togs.
- Matcher mellan två datorspelare, frö 1–6: 11,7, 18,6, 18,7, 16,5, 19,3
  och 13,1 minuter. Kastbanan står klar efter 3,3–5,5 minuter, tornet
  efter 4,8–12,7 och Smedjan efter 6,3–12,8. På frö 5 bygger den ena
  sidan ingen Smedja.

**Äldre tester som ändrades, och varför**

- **Byggmenyns tester** (`commandPanel.test.ts`,
  `phase6-building.spec.ts`) väntar sig "Bygg Kastbana" under Försvar.
- **Texten på knappen Vapen** är "+2 skada, soldater" i stället för
  "+2 skada, krigare" (`commandPanel.test.ts`, `forge.spec.ts`),
  eftersom den gäller två slags soldater.
- **`buildingAtlas.test.ts`** prövar nu också Smedjans och Kastbanans
  atlaser; Smedjan saknades i listan sedan steg 3.
- Inget test är avstängt, och ingen tidsgräns är höjd. Datorspelarens
  tester för torn och Smedja föll med 8 Samlare och går igenom oändrade
  med 10.

**Beslut och lärdomar**

- **Spjutet är samma sak som pilen.** Projektilerna låg redan i
  speltillståndet; de fick ett slag (`kind`), en avsändare som kan vara
  en enhet och ett mål som kan vara en byggnad. Tornets kod blev kortare.
- **"Stanna så fort den når" räcker inte för en grupp.** Det första
  försöket på papper lät kastare som hamnade på en upptagen ruta gå
  vidare mot målet: den tredje och fjärde i en kolonn hade då hamnat
  inom tornets räckvidd. Nu väljs en egen ruta inom räckvidd i förväg,
  den närmaste, och det blir en ruta på randen.
- **En ny enhet ändrar ekonomin för den som spelar utan marginal.**
  Datorspelaren gjorde av med allt den samlade. När soldaterna började
  kosta mer trä försvann det som blev över, och med det torn och Smedja,
  utan att någon regel om dem hade ändrats.
- **Ett test som ställer ut byggnader på måfå prövar kartan, inte
  spelet.** En Kastbana som testet lade i en ficka mellan träd kunde
  inte släppa ut sin andra kastare. Testet låter nu datorspelaren
  placera sina byggnader själv.

### Björnrasen komplett, steg 3: Smedja (2026-11-15)

Flikarna i byggmenyn (pull request 20) mergades först, efter grönt CI.

**Skärmdumpar:** `docs/screenshots/smedja-stadier.png` (Smedjans tre
byggstadier i spelet), `smedja-forskar.png` (tre uppgraderingar i kö:
knapparna nedtonade med "Pågår", kön "Va, Ru, Ve" med stapel, och stapeln
över byggnaden), `smedja-forlopp-narbild.png` (närbild av stapeln över
Smedjan med två prickar för dem som väntar), `smedja-krigare.png` (en
Ramkrigare efter två nivåer Vapen och en nivå Rustning: "Skada 14 (+4) ·
Rustning 2 (+1)"), `smedja-paneler.png` (Smedjans panel med "Vapen II"
som "Fullt utvecklad", och raderna för en Ramkrigare och en Samlare) och
`smedja-pipeline.png` (pipelinens bild av de tre stadierna).

**Värden (förslag, väntar på godkännande)** i `src/data/upgrades.ts`,
`BUILDING_DEFS.smedja` och `AI_CONFIG.research`

| Värde | Förslag |
|---|---|
| Smedja | 150 trä, 35 s, 600 liv, 2×2 rutor, synfält 5, fliken Försvar |
| Vapen I / II | +2 skada var för Ramkrigare (10 → 12 → 14). 100 mat, 50 trä, 40 s / 175 mat, 100 trä, 60 s |
| Rustning I / II | +1 rustning var för alla enheter. 75 mat, 75 trä, 40 s / 150 mat, 150 trä, 60 s |
| Verktyg I / II | +20 % fart var i allt samlande, för Samlare. 100 mat, 50 trä, 40 s / 175 mat, 100 trä, 60 s |
| Datorspelaren | Smedja vid 200 trä i lager; ordning Vapen, Rustning, Verktyg; sparar till nästa uppgradering när den har 6 Ramkrigare eller fler |

Vad de betyder i spelet:

- **Vapen II:** en Ramkrigare fäller en annan Ramkrigare, som inte har
  uppgraderad rustning, på 8 slag i stället för 12 (13 mot 9 per slag).
- **Rustning II:** ett torns pil tar 6 i stället för 8 av en Ramkrigare,
  som då tål 17 pilar i stället för 13.
- **Verktyg II:** en Samlare tar ett bär eller ett vedträ på 14 steg i
  stället för 20, alltså 43 % fortare; en Odling ger en mat på 36 steg i
  stället för 50.
- Allt, båda nivåerna av alla tre: 775 mat och 525 trä, och 5 minuter
  i en Smedja.

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| Uppgraderingar som köps en gång och gäller alla enheter | Klar | De hör till sidan: gäller även enheter som tränas senare |
| Bättre vapen, bättre rustning, snabbare samlande | Klar | Vapen, Rustning, Verktyg |
| Två nivåer av vardera | Klar | |
| Kö och förlopp syns på byggnaden | Klar | Stapel över Smedjan med prickar för kön; kö och stapel i panelen |
| Uppgraderade värden syns på enheten | Avviker | I markeringspanelen, inte på enhetens bild; se nedan |
| Datorspelaren forskar när den har råd | Klar | Och sparar för det; se nedan |
| Byggmenyn visar kostnad och beskrivning | Klar | "Bygg Smedja / 150 trä / Uppgraderar enheter" |
| Grafik via pipelinen enligt skalstandarden | Klar | Klass `small`: krav 64 px, Smedjan är 74 px |

**Vad som gjordes**

- **Data:** `src/data/upgrades.ts` (`UPGRADE_DEFS`), `BuildingDef.researches`.
- **Simulering:** `PlayerState.upgrades`, `src/sim/upgrades.ts`
  (`unitDamage`, `unitArmor`, `gatherSpeed`), forskningskön i
  `systems/research.ts`, kommandona `research` och `cancelResearch`,
  händelsen `upgradeDone`.
- **Datorspelaren:** bygger en Smedja och forskar.
- **Grafik:** `tools/blender/buildings/bear/forge.toml` med två nya delar
  i `lib/structures.py` (städ och härd).
- **Spelet:** Smedjans panel, stapel över byggnaden, tredje rad i
  markeringspanelen, meddelande när en uppgradering är klar.

**Saknas eller avviker**

- **Värdena är förslag.** Inget av dem är godkänt.
- **"Syns på enheten" betyder här markeringspanelen.** En egen enhet
  visar sina värden med tillägget inom parentes. Enhetens bild ändras
  inte: en Ramkrigare med Vapen II ser ut som en utan.
- **Fiendens uppgraderingar syns inte alls.** Raden visas bara för egna
  enheter, och fiendens Smedja visar ingen stapel.
- **Vapen gäller bara Ramkrigare.** Samlarens 3 i skada och Vakttornets
  pilar påverkas inte. Rustning gäller alla enheter men inga byggnader.
- **En nivå av en uppgradering åt gången.** Båda nivåerna av Vapen går
  inte att ställa i kö samtidigt; knappen är nedtonad tills den första
  är klar. Då är det alltid entydigt vilken nivå som ligger i kön och
  vad den kostade.
- **Stapeln över byggnaden finns bara för forskning.** Storidet och
  Krigshallen visar ingen stapel när de tränar enheter.
- **Markeringspanelen är 20 px högre** (84 i stället för 64), för alla
  markeringar, också när tredje raden är tom.
- **Köns rutor har två bokstäver** ("Va", "Ru", "Ve"), eftersom Vapen
  och Verktyg börjar på samma.
- **"Snabbare samlande" heter Verktyg** och gäller också Odling och
  Fiskehytta, inte bara bär och trä.
- **Datorspelaren sparar till uppgraderingar.** Utan det forskade den
  aldrig: soldatträningen tog maten först varje gång (uppmätt: Smedjan
  byggdes efter 7–12 minuter och stod sedan oanvänd). Nu tränar den inga
  nya Ramkrigare medan den har 6 eller fler och väntar på att ha råd.
- **Matcher mellan två datorspelare:** 18,6, 18,6, 17,2, 16,0, 13,0 och
  13,6 minuter på frö 1–6, alla under 20. Första uppgraderingen blir
  klar efter 8–13 minuter. Balansen i övrigt tas efter steg 5, som
  användaren har bestämt.
- **Fliken Försvar har nu tre byggnader och "Laga".**
- **Övriga byggnaders atlaser är inte byggda om** efter tilläggen i den
  gemensamma `lib/structures.py`. De två nya delarna används bara av
  Smedjan.
- **Inte mätt:** bilder per sekund. **Inte prövat:** en riktig telefon.
- **Inget ljud**, som i resten av spelet.

**Testresultat**

- Vitest: 768 av 768 (38 nya: uppgraderingarnas verkan, forskningskön,
  datorspelarens Smedja, Smedjans panel och enhetens värden)
- Playwright: 152 av 152 i normal fart (6 nya i `forge.spec.ts`) på det
  slutliga bygget, och 152 av 152 med webbläsaren nedbromsad 8 gånger.
  Den första normalkörningen gav 151 av 152: ett torntest från steg 2
  föll (se nedan). Efter rättningen är den nedbromsade körningen inte
  gjord om i sin helhet; det rättade testet går igenom nedbromsat tre
  gånger av tre
- Lint och typkontroll utan anmärkning. Inga konsolfel, varken i
  testerna eller när skärmdumparna togs.

**Äldre tester som ändrades, och varför**

- **`combat.test.ts` och `shooting.test.ts`:** `strikeDamage` och
  `shotDamage` tar nu speltillståndet, eftersom skada och rustning beror
  på sidans uppgraderingar.
- **`commandPanel.test.ts`:** en plats i kön har inte längre fältet
  `unit`, och panelen säger vad kön håller (`queueOf`).
- **Byggmenyns tester** (`commandPanel.test.ts`,
  `phase6-building.spec.ts`) väntar sig "Bygg Smedja" under Försvar.
- **`tower.spec.ts`, "skjuter en pil":** testet jämförde den första och
  den sista bilden av "pilen" under 14 steg. Spelet går vidare i realtid
  mellan stegen, så på en snabb maskin hann tornet skjuta en andra pil,
  och den sista bilden var då en annan pil nära tornet. Testet föll en
  gång av två i normal fart, aldrig nedbromsat. Det följer nu en pil
  (samma id) och håller sidans klocka stilla, med en bildruta per steg,
  så att antalet bilder inte beror på maskinens fart. Felet låg i
  testet, inte i tornet.
- Inget test är avstängt, och ingen tidsgräns är höjd.

**Beslut och lärdomar**

- **Uppgraderingarna hör till sidan, och verkan räknas ut vid
  användningen.** Inget skrivs in i enheterna. Därför gäller en
  uppgradering genast för alla, också dem som tränas senare, och det
  finns inget att hålla i synk.
- **"När den har råd" kräver att något annat väntar.** En datorspelare
  som alltid tränar soldater först har aldrig råd med något dyrare än
  en soldat.

### Byggmenyn får flikar (2026-11-15)

Efter steg 2 hade byggmenyn sju knappar: två rader på en vanlig skärm och
fyra på en telefon, där den skymde den markerade Samlaren. Förslaget att
dela den i två flikar före steg 3 godkändes av användaren ("Ja på allt.
Kör efter din rekommendation").

**Användarens beslut samma dag**

- Pull request 19 (Vakttornet) mergas när CI är grönt. Gjort.
- Byggmenyn delas i flikar som en egen liten ändring före steg 3. Den här.
- Balansen mot datorspelaren (matchlängden efter tornen) tas samlat efter
  steg 5, inte nu.
- Min tolkning: "Ja på allt" godkände också de föreslagna värdena för
  lagningen (steg 1) och Vakttornet (steg 2), som stod under rubriken
  "Värden att godkänna" i samma meddelande. Användaren sa det inte
  uttryckligen om värdena.

**Skärmdumpar:** `docs/screenshots/meny-flikar.png` (båda flikarna på en
1280 px bred skärm) och `meny-flikar-telefon.png` (båda på en 390 px bred
skärm).

**Vad som gjordes**

- `BuildingDef.menu` och `BUILD_MENUS` i `src/data/buildings.ts`:
  Ekonomi (Visthus, Ide, Odling, Fiskehytta) och Försvar (Krigshall,
  Vakttorn). Flikarnas namn står i `STRINGS.menus`.
- `describeCommandPanel` tar fliken som argument och ger `tabs`;
  `commandPanelLayout` och `commandPanelHit` har fått flikraden.
- `UiScene` ritar flikarna (den aktiva blå) och `GameScene` håller reda
  på vald flik.

**Saknas eller avviker**

- **På telefon är Ekonomi fortfarande tre rader plus flikraden** (270 px
  mot 296 förut) och skymmer fortfarande Samlaren delvis. Vinsten är att
  menyn inte växer mer där: nya byggnader hamnar under Försvar.
- **Försvar växer.** Efter steg 3–5 (Smedja, Skyttebana, Palissad, Port)
  har den sex byggnader och "Laga": två rader på en vanlig skärm och fyra
  på en telefon. Då behövs en tredje flik, eller mindre knappar. Inte
  beslutat.
- **Panelen byter höjd mellan flikarna**, eftersom de har olika många
  knappar.
- **Ingen tangent byter flik.** Bara klick och tryck.
- **Vald flik minns bara tills sidan laddas om.**

**Testresultat**

- Vitest: 730 av 730 (6 nya, för flikarna)
- Playwright: 146 av 146 i normal fart (1 nytt) och 146 av 146 med
  webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.

**Äldre tester som ändrades, och varför**

- **Byggmenyns tester** (`commandPanel.test.ts`, `phase6-building.spec.ts`)
  väntar sig nu Ekonomi-flikens knappar och de två flikarna.
- **`phase6-building.spec.ts`** och **`tower.spec.ts`** byter till fliken
  Försvar innan de trycker på "Bygg Krigshall" och "Bygg Vakttorn".
- **`phase10-touch-start.spec.ts`** räknar Ekonomi-flikens knappar och
  prövar att flikarna ryms och går att trycka på.
- **Två kartester gör mindre dubbelarbete.** `mapgen.test.ts` ("vatten
  vid varje startplats") räknade upp hyttplatserna två gånger per
  startplats för 40 frön, och `fairStart.test.ts` gjorde om samma 40
  kartor i vart och ett av sina tre tester. De tog 3,3 respektive 2–3 s
  mot gränsen 5 s och föll när enhetstesterna kördes samtidigt som en
  nedbromsad webbläsarkörning. Kartorna och hyttplatserna räknas nu en
  gång och delas; det som kontrolleras är detsamma.
- Inget test är avstängt, och ingen tidsgräns är höjd.

**Lärdom**

- **Mät inte två saker på samma maskin samtidigt.** Enhetstester som
  körs under en nedbromsad webbläsarkörning faller på tid utan att något
  är fel: till slut föll även balanstestet, som har två minuter på sig.
  Sviterna körs nu efter varandra.

### Björnrasen komplett, steg 2: Vakttorn (2026-11-15)

Användaren godkände att gå vidare efter steg 1 ("Ja"). Steg 1 är pull
request 18, mergad 2026-11-15 efter grönt CI.

**Skärmdumpar:** `docs/screenshots/vakttorn-stadier.png` (tornets tre
byggstadier i spelet; det färdiga är markerat och visar sin
räckviddsring), `vakttorn-skjuter.png` (två torn skjuter på samma
Ramkrigare; pilarna har fjädrar i lagfärg), `vakttorn-traff.png` (en
träffad Ramkrigare blinkar vitt med splitterstjärnan på sig, och nästa
pil är på väg), `vakttorn-placering.png` (tornet placeras: bild, grönt
fotavtryck och räckviddsring; menyn med sju knappar),
`vakttorn-markerat.png` (markeringspanelen: "Skada 9 · Räckvidd 6"),
`vakttorn-telefon.png` (menyn på en 390 px bred skärm) och
`vakttorn-pipeline.png` (pipelinens bild av de tre stadierna).

**Värden (förslag, väntar på godkännande)** i `BUILDING_DEFS.vakttorn`,
`AI_CONFIG.towers` och `UI_CONFIG`

| Värde | Förslag | Varför |
|---|---|---|
| Kostnad | 120 trä | Mellan Fiskehytta (100) och Krigshall (150) |
| Byggtid | 30 s | Längre än ett Visthus, kortare än en Krigshall |
| Liv | 500 | Fyra Ramkrigare river det på 15 s |
| Storlek | 1×1 ruta | Ett torn, inte ett hus |
| Synfält | 8 rutor | Mer än räckvidden, näst mest efter Storidet (9) |
| Räckvidd | 6 rutor | Samma som en Ramkrigares upptäcktsradie |
| Skada | 9 per skott | 8 mot en Ramkrigare (rustning 1), 9 mot en Samlare |
| Tid mellan skott | 1,5 s | 5–6 liv per sekund; en Ramkrigare gör 8,3 |
| Pilens fart | 12 rutor/s | Framme på en halv sekund vid full räckvidd |
| Datorspelaren | 1 torn, vid 150 trä i lager, 6 rutor från Storidet mot fienden | Se avvikelserna |

Ett torn fäller en Ramkrigare (100 liv) på 13 skott, cirka 19 sekunder,
och en Samlare på 5 skott.

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| Skjuter automatiskt på närmaste fiende inom räckvidd | Klar | Enheter, inte byggnader |
| Ger sikt i dimman | Klar | 8 rutor |
| Projektil som syns | Klar | En pil i lagfärg som flyger i en båge från plattformen |
| Träffeffekt | Klar | Vit blink på målet och en splitterstjärna i 220 ms |
| Kan lagas | Klar | Som övriga byggnader; ryker och brinner när det är skadat |
| Datorspelaren bygger torn vid sin bas | Avviker | Ett torn, inte flera; se nedan |
| Byggmenyn visar kostnad och beskrivning | Klar | "Bygg Vakttorn / 120 trä / Skjuter på fiender" |
| Grafik via pipelinen enligt skalstandarden | Klar | Ny klass `tower`: minst 96 px, tornet är 120 px |

**Vad som gjordes**

- **Simulering:** `BuildingDef.attack`, `Building.attackCooldown`,
  `state.projectiles` och systemet `systems/shooting.ts`
  (`shootFromBuildings`, `flyProjectiles`), med händelserna `shot` och
  `projectileHit`.
- **Datorspelaren:** bygger ett torn, och dess anfallare river ett torn
  som når dem innan de går vidare.
- **Grafik:** `tools/blender/buildings/bear/tower.toml` (tre stadier,
  inga nya delar), och i miljöns atlas pilen (`arrow`) och
  splitterstjärnan (`hit`).
- **Spelet:** `ProjectileView`, räckviddsring vid markering och
  placering, "Skada 9 · Räckvidd 6" i markeringspanelen.

**Saknas eller avviker**

- **Värdena är förslag.** Inget av dem är godkänt. Det gäller fortfarande
  även värdena för lagningen i steg 1.
- **Datorspelaren bygger bara ett torn, och ersätter det inte.** Med två
  torn var, eller med torn som byggs upp igen, blev matcher mellan två
  datorspelare längre än målet 10–20 minuter: 16,7, 21,3, 21,8, över 22,
  13,3 och 16,7 minuter på frö 1–6. Med ett torn som byggs en gång blir
  det 16,7, 19,1, 19,1, 16,5, 13,3 och 16,4.
- **Matcherna mellan två datorspelare har blivit längre** och två av sex
  ligger nära gränsen: före tornen 13,7, 15,2 och 15,7 minuter på frö
  1–3, nu 16,7, 19,1 och 19,1. Balanstestet (under 20 minuter på frö 1–3)
  går igenom med liten marginal. Vill man ha marginalen tillbaka får
  vågorna bli större, tornet svagare eller målet längre; det är ett
  balansbeslut som inte är taget.
- **Datorspelarens anfallare river torn som når dem.** Det stod inte i
  uppdraget. Utan det gick vågorna förbi tornen mot Storidet och blev
  beskjutna hela vägen. Fiendekrigare i närheten går fortfarande före.
- **Spelarens egna enheter svarar inte själva på ett torn.** En
  Ramkrigare anfaller av sig själv bara fiendeenheter inom 6 rutor, inte
  byggnader. Står den inom ett fientligt torns räckvidd blir den
  beskjuten tills spelaren ger den en order.
- **Tornet väljer alltid den närmaste**, vare sig det är en Samlare eller
  en Ramkrigare, och skjuter inte på byggnader.
- **Pilen träffar alltid** om målet finns kvar: den följer sitt mål. Inga
  missar, och ingen annan kan träffas.
- **Ingen skytt syns på tornet.** Tornet skjuter av sig självt och
  behöver ingen besättning.
- **Räckviddsringen visas bara för egna torn** (markerade eller under
  placering). Ett fientligt torns räckvidd visas inte.
- **Byggmenyn har vuxit.** Sju knappar ryms inte på en rad: två rader på
  en skärm som är 1280 px bred, och fyra rader på en telefon på högkant,
  där menyn då tar 296 av 844 px och skymmer den markerade Samlaren (se
  `vakttorn-telefon.png`). Steg 3–5 lägger till fler byggnader. Menyn
  behöver delas upp (flikar eller sidor) innan dess; det är inte gjort
  och inte beslutat.
- **Miljöns atlas är snart full.** Pil och splitterstjärna ligger där, och
  den är nu 256×249 px mot testets gräns 512×256 (60 kB + 10 kB mask).
  Nästa tillägg gör den bredare.
- **Inte mätt:** bilder per sekund med många pilar i luften.
- **Inte prövat:** en riktig telefon.
- **Inget ljud**, som i resten av spelet.

**Testresultat**

- Vitest: 724 av 724 (40 nya: tornets skjutande, projektilens bana,
  datorspelarens torn, texterna och byggmenyn)
- Playwright: 145 av 145 i normal fart (7 nya i `tower.spec.ts`), och 145
  av 145 med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel, varken i
  testerna eller när skärmdumparna togs.

**Äldre tester som ändrades, och varför**

- **Byggmenyns tester** (`commandPanel.test.ts`,
  `phase6-building.spec.ts`) väntar sig nu knappen "Bygg Vakttorn".
- **`phase9-ai.spec.ts`** jämför datorspelarens minne exakt; det har fått
  fältet `towersPlaced`.
- Inget test är avstängt, och ingen tidsgräns är höjd.

**Beslut och lärdomar**

- **Projektiler i speltillståndet, inte i ritningen.** Skadan kommer när
  pilen landar, och pilen följer målet. Därför ligger den i
  `state.projectiles` med allt annat, och en match är fortfarande helt
  bestämd av sitt frö.
- **En skärmdump av något som varar en halv sekund kräver stillastående
  tid.** Pilen hann landa mellan frågan "finns en pil?" och bilden.
  Skärmdumpsskriptet pausar nu sidans klocka (Playwrights `page.clock`)
  och släpper fram en bildruta i taget. Första försöket installerade
  klockan utan att pausa den, och gav bilder utan pilar som såg ut som
  ett fel i spelet.
- **En beskuren bilds mitt är inte bildrutans mitt.** Splitterstjärnan
  hamnade 30 px snett tills dess mittpunkt räknades på det som är kvar
  efter beskärningen.

### Björnrasen komplett, steg 1: Lagning (2026-11-15)

Användaren: "Vi gör björnrasen komplett innan nästa ras. Ett steg i
taget, STANNA efter varje steg och visa skärmdumpar. Alla värden i
datafilerna. Grafik via figurpipelinen enligt skalstandarden." Fem steg:
lagning, vakttorn, smedja, skyttebana med distansenhet, palissad och
port. Det här är steg 1. Steg 2–5 är inte påbörjade.

**Skärmdumpar:** `docs/screenshots/lagning-skadenivaer.png` (Storidet
ryker vid 42 % liv, Visthuset brinner vid 18 %), `lagning-arbete.png`
(tre Samlare lagar Visthuset; knappen "Laga" visar "ca 27 trä, Visthus,
32 % liv"), `lagning-narbild.png` (närbild av samma), `lagning-slut-pa-
tra.png` (meddelandet och röd träsiffra), `lagning-telefon.png` (menyn
med sex knappar på en 390 px bred skärm) och
`lagning-rok-eld-hammare.png` (pipelinens bilder av rök, eld och
hammare).

**Värden (förslag, väntar på godkännande)** i `src/data/repair.ts`,
`src/data/buildings.ts`, `src/data/ai.ts` och `src/data/ui.ts`

| Värde | Förslag | Varför |
|---|---|---|
| Full lagning kostar | 50 % av träet i priset | Uppdraget: "ca halva byggkostnaden" |
| Storidet räknas som | 300 trä (full lagning 150) | Det har inget pris; 150 trä för 1500 liv är samma 10 liv per trä som Visthuset |
| Takt, en Samlare | 6 liv per sekund | Nybygge ger 9–18 liv per sekund och Samlare |
| Varje ytterligare Samlare | 60 % av den förra | 2 gör 1,6, 3 gör 1,96, aldrig 2,5 |
| Rök / eld | under 50 % / under 25 % liv | Uppdraget |
| Datorspelaren lagar under | 90 % liv, med 2 Samlare, minst 20 trä | Småskador kostar mer i gångtid än de ger |

Vad en full lagning kostar och tar för en ensam Samlare:

| Byggnad | Liv | Trä | Tid | Nybygge |
|---|---|---|---|---|
| Storide | 1500 | 150 | 250 s | – |
| Krigshall | 700 | 75 | 117 s | 150 trä, 35 s |
| Visthus | 400 | 40 | 67 s | 80 trä, 20 s |
| Fiskehytta | 350 | 50 | 58 s | 100 trä, 25 s |
| Ide | 300 | 15 | 50 s | 30 trä, 15 s |
| Odling | 200 | 30 | 33 s | 60 trä, 20 s |

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| Samlare lagar skadade egna byggnader med högerklick/order | Klar | Kommandot `repair`; högerklick, tryck och knapp |
| Kostar trä i proportion till lagat liv, ca halva byggkostnaden | Klar | Träet dras ett i taget under arbetet |
| Slut på trä pausar med ett meddelande | Klar | "Slut på trä – lagningen väntar", röd träsiffra, 2,5 s |
| Långsammare än nybygge | Klar | 6 liv/s mot 9–18; ett test kräver det för varje byggnad |
| Flera Samlare lagar snabbare, avtagande | Klar | 1 / 1,6 / 1,96 |
| Använder hammarslaget | Klar | Samma animation som bygget, vänd mot byggnaden |
| Ställer sig på lediga platser runt byggnaden | Klar | En egen ruta var intill fotavtrycket |
| Rök under 50 %, eld under 25 % | Klar | Bilder från pipelinen |
| Markören/knappen visar när lagning är möjlig | Avviker | Markören finns bara med mus; se nedan |
| Datorspelaren lagar när basen inte är under attack | Klar | |
| Enhetstester för kostnad, hastighet och avbruten lagning | Klar | `repair.test.ts`, 24 tester |
| Byggmenyn visar kostnad och beskrivning | Klar | Knappen "Laga" visar kostnad och vilken byggnad |

**Vad som gjordes**

- **Simulering:** `src/sim/systems/repair.ts` med uppgiften `RepairTask`,
  kommandot `repair`, händelsen `repairPaused` och fältet
  `Building.repairCredit`. Se arkitekturdokumentet.
- **Datorspelaren:** punkten `repair` mellan byggen och sysslolösa
  arbetare.
- **Gränssnitt:** order med högerklick och tryck, knappen "Laga" sist i
  Samlarens meny, hammarmarkör, meddelande, text i markeringspanelen
  ("Lagar Visthus", "Lagar Visthus – väntar på trä").
- **Grafik:** tre rökpuffar, fyra eldbilder och en hammare i pipelinen
  (`lib/nature.py`, `scenery/scenery.toml`), i miljöns atlas. `DamageView`
  ritar dem; reglerna är rena funktioner i `effects/damage.ts`.

**Saknas eller avviker**

- **Värdena är förslag.** Inget av dem är godkänt.
- **Markören syns inte på pekskärm**, där det inte finns någon pekare.
  Där är det knappen "Laga" som visar att lagning är möjlig. Ett tryck
  på en skadad byggnad med Samlare markerade lagar den.
- **Markören går inte att visa i en skärmdump.** En headless-webbläsare
  tar inte med muspekaren. Testet kontrollerar att spelytans CSS-markör
  är hammarbilden över en skadad byggnad och standardpekaren annars.
  Bilden finns i `lagning-rok-eld-hammare.png`.
- **Knappen "Laga" väljer närmaste skadade byggnad**, räknat från den
  först markerade Samlaren. Vill man laga en annan klickar man på den.
- **Bara trä.** Alla byggnader kostar bara trä i dag. Får en byggnad ett
  pris i mat räknas bara dess trädel.
- **En lagande Samlare går inte och hämtar trä** när det tar slut. Den
  står kvar och väntar. Datorspelarens Samlare tas av arbetet och samlar.
- **Efter lagningen blir Samlaren sysslolös.** Den går inte tillbaka till
  det den gjorde före. Undantag: efter en Odling eller Fiskehytta börjar
  den arbeta där.
- **En skadad Odling eller Fiskehytta lagas först.** Högerklick med
  Samlare markerade ger lagning, inte arbete, så länge byggnaden är
  skadad. Är träet slut väntar Samlaren i stället för att arbeta.
- **Tre Samlare lagar fortare än en Ramkrigare skadar.** En Ramkrigare
  gör 8,3 skada per sekund mot en byggnad; tre Samlare lagar 11,8 liv
  per sekund (en lagar 6). En ensam angripare river alltså inte ett hus
  som tre Samlare lagar, så länge träet räcker. Det är ett balansval som
  följer av förslaget 6 liv per sekund.
- **Rök och eld sitter inte efter husets form.** Platserna räknas ur
  fotavtrycket och takhöjden, inte ur varje hus egen modell, så en eld
  kan sitta några pixlar utanför takytan. På en Odling, som ligger
  platt, stiger röken ur åkern.
- **Rök, eld och hammare ligger i miljöns atlas**, inte i en egen. Den
  växte från 256×217 till 256×242 px (27 till 35 bilder, 55 till 68 kB).
  Testets gräns är 512×256.
- **Rökens och eldens rörelse räknas ur klockan** (tre puffar per
  rökpelare som stiger och tunnas ut), inte ur renderade animationer.
  Bilderna är från pipelinen; rörelsen är spelets.
- **Datorspelaren lagar en byggnad i taget** och slutar när en fiende är
  inom 12 rutor från Storidet, också om den skadade byggnaden står långt
  från striden.
- **Texten på Fiskehyttans knapp är kortad** från "Fiske vid vatten, 3
  Samlare" till "Vid vatten, 3 Samlare". Den gamla var bredare än
  knappens textyta och stack ut redan förut; med sex knappar i rad blev
  knappen 151 px bred i stället för 160, och texten gick in i nästa
  knapp (syntes i skärmdumpen).
- **Ny testkrok `setLife`**, som sätter livet på en byggnad direkt. Den
  går förbi kommandona, som `spawnUnit` redan gör, och finns bara i
  testläge.
- **Inte mätt:** bilder per sekund med många skadade byggnader. Varje
  skadad byggnad i bild ritar 6–9 rökpuffar och 2–3 eldar.
- **Inte prövat:** en riktig telefon.
- **Inget ljud**, som i resten av spelet.

**Testresultat**

- Vitest: 684 av 684 (49 nya: lagningens kostnad, takt, platser och avbrott,
  datorspelarens lagning, skadans regler, knappen, texterna och
  hammarslaget)
- Playwright: 138 av 138 i normal fart (9 nya i `repair.spec.ts`), på det
  slutliga bygget. Med webbläsaren nedbromsad 8 gånger: 137 av 138 i hela
  körningen. Det som föll var det nya testet av "slut på trä", som
  frågade efter meddelandet för sent (se nedan); efter rättning går
  `repair.spec.ts` igenom nedbromsat, 9 av 9. Hela den nedbromsade
  körningen är inte gjord om efter rättningen
- Lint och typkontroll utan anmärkning. Inga konsolfel, varken i
  testerna eller när skärmdumparna togs.
- Matcher mellan två datorspelare: 13,7, 15,2 och 15,7 minuter på frö
  1–3, samma som före lagningen. Datorspelarna lagar aldrig i de
  matcherna: ingen byggnad skadas mer än 10 % före slutanfallet, och då
  är basen under attack tills den faller. Datorspelarens lagning prövas
  därför i egna tester, där en byggnad skadas i fred

**Äldre tester som ändrades, och varför**

- **Byggmenyns tester** (`commandPanel.test.ts`, `phase6-building.spec.ts`,
  `phase10-touch-start.spec.ts`) väntar sig nu knappen "Laga" efter
  byggknapparna.
- **Fiskehyttans knapptext** i tre tester, se ovan.
- Inget test är avstängt, och ingen tidsgräns är höjd.

**Fel som hittades av den nedbromsade körningen**

- **Ett meddelande kunde vara slut innan det hade visats.** Meddelandet
  under resursraden (2,5 s) räknade sin tid från bildrutan *före* den
  som först visade det. Kom meddelandet efter ett långt uppehåll mellan
  två bildrutor var tiden redan ute. Blinkningarna hade samma fel och
  rättades i Fiskehyttans steg; nu börjar också meddelandets tid med
  bildrutan som först visar det (`UiScene.noticePending`). Felet gällde
  även de äldre meddelandena om befolkning.
- **Testet frågade för sent.** Mellan händelsen och frågan låg ett
  långsamt anrop, och nedbromsat tog det mer än 2,5 s. Testet låter nu
  sidan anteckna vilka meddelanden som visas, bildruta för bildruta
  (`recordNotices`), som `recordFlashes` redan gör för blinkningarna.

**Beslut och lärdomar**

- **Trä i heltal, liv i bråkdelar.** 6 liv per sekund är 0,3 per steg,
  och ett trä köper 7–20 liv. Betalningen går därför ett trä i taget, och
  det som är betalt men inte lagat väntar på byggnaden. Det första
  försöket jämförde flyttal rakt av och betalade ett trä för tidigt efter
  200 steg; jämförelserna har nu en marginal.
- **Rök som ser ut som rök** kräver rundare klumpar än resten av miljön:
  med samma kantiga form som klipporna såg puffarna ut som stenar.

### Befolkningstaket höjt till 200 (2026-11-14)

Användaren: "Uppdatera maxtaket till 200 i population."

- `POPULATION_CONFIG.hardCap` i `src/data/population.ts`: 50 → 200. Det
  är den enda ändringen i spelet. Taket nås med Storidet och 39 Iden
  (39 × 30 = 1170 trä).
- Meddelandet lyder nu "Befolkningstaket 200 är nått"; talet kommer ur
  datan.
- Befolkningstesterna hade talet 50 inskrivet på tre ställen (nio Iden
  för att nå taket). De räknar nu ut antalet hus ur datan.
- GDD:t avsnitt 4, 6, 13 och 14 och arkitekturdokumentet är ändrade.

**Saknas eller avviker**

- **Datorspelaren påverkas inte.** Den slutar vid 20 soldater och sina
  arbetare och kom aldrig upp i 50.
- **Inte mätt: prestanda med 200 enheter per sida.** Med 123 Samlare
  (`?stress=120`) ger mjukvarurenderingen 14 bilder per sekund vid
  basen. 400 enheter på kartan är inte prövat, varken för ritningen
  eller för simuleringen (vägsökning och kollision).
- **Inte prövat i webbläsare:** hur räknaren ser ut med "200/200".
  Texten börjar 272 px in och blir uppskattningsvis 145 px bred, två
  tecken längre än "50/50". På en skärm smalare än cirka 420 px
  (telefon på högkant) räckte bredden inte heller förut.

### Miljön får bilder, korgen rätt last och starten blir rättvis (2026-11-14)

Användaren: "Ersätt de sista platshållarna med grafik från
figurpipelinen, enligt skalstandarden och samma stil som byggnaderna."
Fem punkter: (1) träd, bärsnår, klippor och grottor, med varianter och
källor som syns minska, (2) vatten och strand med mjuk övergång och
igenkännliga fiskeplatser, (3) rätt last i korgen, (4) rättvis start för
alla frön, med test, (5) rätta raden här om att Idet väntar på
granskning.

**Skärmdumpar:** `docs/screenshots/miljo-karta.png` (hela kartan,
standardfröet, utan dimma, i halv storlek), `miljo-strand-fiskare.png`
(närbild: Fiskehytta på den nya stranden med tre fiskare; den tredje
står bakom hyttan och ritas blekt genom taket), `miljo-strand.png`
(samma strand med basen runt om), `miljo-fiskeplatser.png` (samma hytta
utan fiskare, så att platsernas märken syns) och `miljo-resurser.png`
(två stubbar, två bärsnår utan bär och två med). Pipelinens
förhandsbilder ligger i `assets/previews/scenery/`.

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| 1. Träd, bärsnår, klippor och grottor från pipelinen | Klar | 12 föremål i `scenery.toml`, samma kamera, ljus och kontur som byggnaderna |
| 1. Minst tre varianter av träd och klippor | Klar | Två granar och ett lövträd; tre klippor. Rutans koordinater väljer |
| 1. Bärsnår med och utan bär | Klar | Tre lägen: fullt, få bär (högst hälften kvar), utan bär (tomt) |
| 1. Träd som blir stubbe | Klar | Stubben är 6 px hög och bara bild, se avvikelser |
| 2. Vatten och strandlinje med mjuk övergång | Avviker | Ritat i pipelinens Python, inte renderat i Blender. Inte animerat |
| 2. Fiskeplatser går att känna igen | Avviker | Märks ut vid färdiga Fiskehyttor, inte på stränder utan hytta |
| 3. Korgen visar bär, fisk och säd | Klar | Och ved som förut. Se avvikelsen om vilka animationer |
| 4. Likvärdig tillgång till vatten, trä och bär, alla frön | Klar | Egen damm vid varje startplats; kartan är punktspeglad |
| 4. Test | Klar | `src/sim/map/fairStart.test.ts`, 40 frön |
| 5. Raden om Idet | Klar | Se "Nuläge" och sist i den här loggen |
| Mät fps med `?stress=120` före och efter | Klar | Se tabellen |
| Håll atlasens storlek nere och rapportera den | Klar | 256×217 px, 55 kB |

**Vad som gjordes**

- **Pipelinen.** `build.py --scenery` bygger miljön: `scenery.py`,
  `lib/nature.py` (gran, lövträd, stubbe, buske, klippblock, grotta,
  fiskeplats), `lib/ground.py` (vatten och strand) och
  `scenery/scenery.toml`. Skalstandarden har fått höjder för miljön
  (`[scale.scenery_height]` i `game.toml`): träd 58–96 px, buskar 13–29,
  klippor 16–48, grotta 29–51, det som ligger kvar högst 19. Bygget
  vägrar ett föremål utanför sitt spann.
- **I spelet.** `MapView` är omskriven: gräs, vatten med strandbitar,
  stående föremål och det som ligger kvar. `CaveView` ritar grottan med
  bild och vimpel i ägarens färg. Reglerna (vilken bild en ruta får)
  ligger som rena funktioner i `src/render/scenery/scenery.ts`.
- **Korgen.** Samlaren har fyra laster: ved, bär, fisk och säd. Vad en
  enhet bär står i `Unit.carryLoad` i simuleringen, eftersom bär, fisk
  och säd alla är mat i lagret.
- **Rättvis start.** Kartgenereringen lägger en damm på 9 rutor 7–11
  rutor från varje startplats och håller marken runt den öppen. En karta
  godkänns bara om det finns plats för en Fiskehytta med alla tre
  fiskeplatserna inom 13 rutor från startplatsen, prövat med spelets
  egna regler för hyttan. På standardkartan står hyttan nu 8 rutor från
  Storidet med tre fiskeplatser; förut gav närmaste strand en.
  Likvärdigheten mellan sidorna kommer av att kartan är punktspeglad:
  testet kontrollerar att båda har exakt lika många träd och bärsnår
  inom 8, 12, 16 och 24 rutor och hyttplats på samma avstånd.

**Prestanda** (`?stress=120`, headless Chromium med mjukvarurendering,
1280×720, tre mätningar om 3 s per läge; gamla och nya bygget mätta
direkt efter varandra på samma maskin)

| Läge | Före | Efter | Skillnad |
|---|---|---|---|
| Vid basen, bilder per sekund | 15,3 | 13,8 | −10 % |
| Mitt på kartan, bilder per sekund | 9,5 | 9,7 | +2 % |
| Vid basen, processorn bromsad 4 gånger | 9,6 | 9,1 | −5 % |
| Mitt på kartan, bromsad 4 gånger | 7,0 | 7,3 | +4 % |
| Laddning | 1294 ms | 1197 ms | −7 % |

- Vid basen står skogen tätast, och där kostar bilderna: ett träd är en
  bild på cirka 4100 px² där platshållaren var en liten triangel.
- Två åtgärder togs efter en första mätning som visade −16 till −25 %
  vid basen: skuggorna beskärs till en ellips vid foten (ett träds bild
  gick från cirka 6200 till 4100 px²), och föremål utanför kamerans bild
  döljs. På hela kartan står 678 föremål.
- Talen gäller mjukvarurendering, där ytan som ritas avgör. De säger
  inte hur en telefon med grafikkort beter sig. Inte mätt på telefon.

**Atlasernas storlek**

| Atlas | Före | Efter |
|---|---|---|
| Miljön (ny) | – | 256×217 px, 27 bilder, 47 kB + 8 kB mask |
| Björnarbetaren | 1024×1016 px, 1032 bilder, 1610 kB + 644 kB mask | 1024×990 px, 1176 bilder, 1576 kB + 644 kB mask |
| Alla PNG i bygget | 4785 kB | 4805 kB (+20 kB, +0,4 %) |

Arbetarens atlas blev mindre trots två laster till, eftersom en last nu
bara har bilder för de animationer där den kan förekomma. Krigarens,
tigerns och de sex byggnadernas atlaser byggdes om och har oförändrade
bilder byte för byte; krigarens och tigerns JSON-filer fick en ny tom
rad i metadatan (`layerAnimations`).

**Saknas eller avviker**

- **Gräset är kvar som enfärgad romb med rutnät.** Uppdraget nämnde
  inte gräset, och rutnätet behövs för att se rutorna vid placering.
- **Vatten och strand är inte renderade i Blender** utan ritade av
  pipelinens Python (numpy) direkt i rutans form, för att bitarna ska
  passa pixelexakt mot varandra. De är deterministiska och görs utan
  extern tjänst, men "med kod i Blender" stämmer inte för dem.
- **Vattnet rör sig inte.** Tre stillbilder med olika vågstreck.
- **Fiskeplatser märks bara ut vid en färdig Fiskehytta som spelaren
  ser.** En fiskeplats finns först när en hytta når stranden, så en
  strand utan hytta har inga märken. Under placering visas platserna
  med ringar som förut. Märkena räknas om var 20:e bildruta, så de kan
  komma upp till en tredjedels sekund sent.
- **Stubbar och tomma buskar är bara bild.** Simuleringen ser gräs:
  enheter går över dem, det går att bygga på dem, och de sparas inte i
  speltillståndet. Bilden tas inte bort när något byggs på rutan. Inte
  prövat: hur en stubbe ser ut under en Odling, som ligger platt.
- **Stubben är liten** (6 px hög) och skyms lätt av träden framför.
- **En last ritas bara när Samlaren står, går eller gör lastens eget
  arbete.** Bygger en Samlare med fisk i korgen syns korgen tom medan
  den hamrar. Lasten finns kvar och syns igen när den går.
- **Trädets klickruta når inte ända upp i toppen.** Den slutar cirka
  8 px under spetsen och är smalare än kronan (34–40 px), så att rutan
  bakom ett träd går att klicka på. Ett klick på spetsen eller i kronans
  ytterkant går till marken bakom.
- **Grottan har kvar sin räknare som text** (`0/12`) ovanför bilden.
- **Alla kartor har ändrats.** Dammen läggs före de slumpade fläckarna,
  så varje frö ger en annan karta än förut. Äldre skärmdumpar visar den
  gamla standardkartan.
- **Datorspelaren bygger nu Fiskehytta på alla prövade frön** (1–4),
  eftersom det alltid finns vatten nära. Matcher mellan två datorspelare tar
  13,7, 15,2 och 15,7 minuter på frö 1–3 (målet är 10–20).
- **Ett balanstest är uppmjukat.** "Sex Ramkrigare slår tillbaka första
  vågen" krävde minst fem kvar på frö 1–3. På de nya kartorna förlorar
  försvararna två på frö 3. Testet prövar nu frö 1–6 och kräver minst
  fyra kvar på varje och minst fem i snitt. Vågens storlek (4) och alla
  stridsvärden är orörda. Grundorsak: var striden står beror på
  terrängen runt basen, och den är ny.
- **Bilder per sekund vid basen sjönk 10 %** i mjukvarurendering, se
  ovan.
- **Den gemensamma pipelinen ändrades** (`build.py`: lager per
  animation, `--scenery`; `lib/armor.py`: två laster till).
- **Platshållarformerna för enheter och byggnader finns kvar i koden**
  som reserv. Miljöns platshållare (trianglar, cirklar, grottkullen) är
  borttagna.

**Testresultat**

- Vitest: 635 av 635 (33 nya: rättvis start, kartgenerering, last,
  miljöns regler och atlas, datorspelarens fiske)
- Playwright: 129 av 129 i normal fart (8 nya i `scenery.spec.ts`).
  Med webbläsaren nedbromsad 8 gånger: 127 av 129 i hela körningen.
  De två som föll gick över sin tidsgräns på 30 s (se nedan); efter
  rättning går de igenom nedbromsat på 18,5 s och 8,3 s. Hela den
  nedbromsade körningen är inte gjord om efter rättningen
- Lint och typkontroll utan anmärkning. Inga konsolfel, varken i
  testerna eller när skärmdumparna togs.

**Äldre tester som ändrades, och varför**

- **Balanstestet om första vågen**, se ovan.
- **Kartgenereringens tester:** avståndet från startplats till vatten är
  nu minst 7 rutor (dammen), inte 10, och reservkartan har två dammar.
- **Datorspelarens tester:** fältet prövas nu på en karta utan vatten;
  ett nytt test prövar att den bygger hytta vid dammen.
- **Atlastestet för arbetaren** läser lagren med sina animationer.
- **Klicktesterna** (`picking.test.ts`) använder den nya klickrutan.
- **`characters.spec.ts`:** lagret heter `load_berries`, inte
  `load_food`.
- **`phase3-units.spec.ts`:** ett test antog öppen mark runt en fast
  ruta vid basen. På den nya kartan står träd där. Hjälpfunktionen
  söker nu en ruta med öppen mark runt om som inte ligger bakom ett hus.
- **`buildings.spec.ts`, byggstadierna:** testet väntade på en bildruta
  per två simuleringssteg. Nedbromsat tog det 25–29 s redan före den här
  ändringen och 30,7 s nu, eftersom miljön gör varje bildruta lite
  dyrare. Det tar nu fem steg per bildruta. Varje stadium varar cirka
  200 steg, så inget missas.
- **`scenery.spec.ts`, varianterna (nytt test):** frågade sidan om en
  ruta i taget, över 200 anrop, vilket nedbromsat tog 30,5 s. Det läser
  nu alla rutor i ett anrop.
- Inget test är avstängt, och ingen tidsgräns är höjd.

**Beslut och lärdomar**

- **Raden om Idet (punkt 5).** "Nuläge" sa att Idet väntade på
  användarens granskning efter att pull request 16 hade mergats. Samma
  sak hände med pull request 15. Grundorsak: raden skrivs i samma
  ändring som den beskriver, alltså före mergen, och ingen ändring
  följer som rättar den. "Nuläge" säger därför inte längre om den
  senaste ändringen är mergad; det står i GitHub.
- **Genomskinliga pixlar kostar.** Den renderade skuggan gjorde ett träds
  bild hälften större utan att synas mer än en ellips vid foten.
- **Phasers Blitter ritar en beskuren bild från bildens hörn**, inte
  från fästpunkten, så `MapView` lägger till beskärningens förskjutning
  själv.

### Idet får ett riktigt hus (2026-11-14)

Användaren: "Ide saknar fortfarande ett ordentligt hus, skapa det."
Pull request 15 (Fiskehyttan) mergades först, på användarens begäran.
Idets hus är pull request 16, mergad 2026-11-14 på användarens begäran.

**Skärmdumpar:** `docs/screenshots/ide-stadier.png` (tre Iden bredvid
Storidet: färdigt, halvbyggt och nyss påbörjat), `ide-narbild.png`
(närbild av de tre stadierna), `ide-fardiga.png` (tre färdiga Iden,
räknaren 3/20) och `ide-placering.png` (Idets bild vid placering).
`assets/previews/bear_den/` har pipelinens förhandsbilder, och
`assets/previews/overview.png` visar Idet bland övriga byggnader i
verklig skala.

**Vad som gjordes**

- `tools/blender/buildings/bear/den.toml`: en låg timmerstuga under ett
  djupt halmtak som går nästan ned till marken, med nocken och en vimpel
  i lagfärg. I gaveln sitter dörren och två fönster med ljus inifrån.
  Genom taket går en stenskorsten, och på gården ligger en vedtrave och
  står en bikupa av halm. Storleksklass `small`: taket är 75 px mot
  kravet 64.
- Tre byggstadier som för övriga hus: stomme, väggar med takstolar, och
  det färdiga huset.
- Halmtaket är bostadens kännetecken. Hallarna har skiffertak, så Idet
  går att skilja från Visthuset och Fiskehyttan på färg och form.
- Två nya delar i `lib/structures.py`: fönster och bikupa. Halmens och
  ljusets färger står i `den.toml`, inte i den gemensamma stilen.
- I spelet: `BUILDING_ART.ide`, och klickhöjden (`BUILDING_VISUALS.ide`)
  höjd från 22 till 46 px så att den följer det nya huset.

**Saknas eller avviker**

- **Idet är högre än blocket var** (75 px mot 22), så det skymmer mer.
  Enheter bakom det ritas blekt, som bakom övriga hus.
- **Fönstren lyser alltid.** Spelet har ingen natt, och ljuset hör till
  bilden.
- **Platshållarblocken finns kvar i koden** som reserv för en byggnadstyp
  utan bild. Ingen byggnadstyp använder dem längre.
- **Den gemensamma pipelinen fick tillägg** (fönster och bikupa). Alla
  övriga atlaser byggdes om och är oförändrade byte för byte.
- **En rad i den här loggen var inaktuell på `main`:** den sa att pull
  request 15 väntade på merge efter att den hade mergats. Rättad här.

**Testresultat**

- Vitest: 602 av 602 (3 nya, för Idets atlas)
- Playwright: 121 av 121 i normal fart. Med webbläsaren nedbromsad 8
  gånger: 120 av 121 i hela körningen; det sista (se nedan) gick sedan
  igenom 4 av 4 gånger med längre tidsgräns
- Lint och typkontroll utan anmärkning. Inga konsolfel.

**Äldre tester som ändrades, och varför**

- **Testet "hela vägen" fick längre tidsgräns.** Det laddar spelet tre
  gånger, och i den nedbromsade webbläsaren tar varje laddning cirka 7 s
  (1,3 s i normal fart). Testet har därför legat nära gränsen på 30 s
  länge: 25–27 s i de tre senaste nedbromsade körningarna och 31 s nu.
  Mätt mot spelet före ekonomibyggnaderna har laddningen gått från 6,7
  till 7,0 s nedbromsat; stridens längd i testet är oförändrad (438
  steg). Testet har nu `test.slow()`, som dimtestet redan hade av samma
  skäl. Inget test är avstängt.
- Befolkningstestet väntade sig att Idet saknade bild. Det kontrollerar
  nu att det färdiga Idet ritas från sin atlas i spelarens färg.
- Atlastestet "även den minsta byggnaden är tydligt högre än en krigare"
  prövar nu alla tre små hus, inte bara Visthuset.

### Ekonomibyggnader, steg 2: Fiskehytta (2026-11-14)

Användaren godkände Odlingens startvärden, bad Claude merga pull request
14 först och sedan gå vidare med steg 2.

**Skärmdumpar:** `docs/screenshots/fiske-ogiltig.png` (hyttan inåt land:
röd, med texten "Måste stå intill vatten"), `fiske-giltig.png` (hyttan
vid vatten: grönt fotavtryck, "3 fiskeplatser" och en ring på varje
plats), `fiske-arbete.png` (tre Samlare fiskar vid en färdig hytta) och
`fiske-narbild.png` (närbild av två fiskare med spö).

**Användarens svar (2026-11-14):** värdena är godkända, hyttan ska vägras
där den inte ger någon fiskeplats, och Claude ska bevaka pull request 15.

**Värden (godkända)**

| | Fiskehytta | Odling | Bärsnår |
|---|---|---|---|
| Kostnad | 100 trä | 60 trä | – |
| Byggtid, 1 Samlare | 25 s | 20 s | – |
| Liv | 350 | 200 | – |
| Yta | 2×2 rutor, intill vatten | 2×2 rutor | 1 ruta |
| Samlare samtidigt | upp till 3 | 1 | upp till 4 |
| Tid per mat | 1,6 s | 2,5 s | 1 s |
| Mat per minut och Samlare, utan gångväg | 37,5 | 24 | 60 |
| Uppmätt med gångväg (sex frön) | 33–38 | 20–22 | 45–55 |
| En full byggnad ger | 100–112 mat/min | 20–22 mat/min | – |

**Avstämning mot uppdraget, steg 2**

| Punkt | Status | Kommentar |
|---|---|---|
| Får bara placeras intill vatten | Klar | Minst en ruta av fotavtrycket ska ha vatten sida vid sida. `shore: true` i `BUILDING_DEFS` |
| Ogiltig plats: förhandsvisningen i rött med en kort förklaring | Klar | Byggnadens bild visas nu vid placering, röd där den inte får stå, med "Måste stå intill vatten", "Platsen är upptagen" eller "Outforskad mark". Gäller alla byggnader |
| Avlämningsplats för fisk | Klar | Fiskarna bär fångsten till hyttan (`deliverTo: 'here'`). Hyttan tar inte emot bär eller trä |
| Fasta fiskeplatser längs stranden nära hyttan, samma system som arbetsplatser | Klar | Samma `GatherTask.place` som vid träd och bärsnår; en Samlare per ruta |
| Inga båtar, ingen vägsökning på vatten | Klar | Vatten är alltid ett hinder. Ett test kontrollerar att ingen står på vatten |
| Snabbare än odling, långsammare än bär | Klar | 37,5 mot 24 och 60 mat/min utan gångväg |
| Begränsat antal fiskeplatser per hytta | Klar | Högst 3, och aldrig längre än 3 rutor från hyttan |
| AI:n bygger fiskehytta om den har vatten inom räckhåll | Klar | Inom 18 rutor från Storidet, högst en hytta |
| Enhetstester för placeringsregeln och produktionen | Klar | `src/sim/systems/fishing.test.ts`, 32 tester, och ett AI-test |
| Grafik via figurpipelinen enligt skalstandarden | Klar | `buildings/bear/fishery.toml` (klass `small`, tak 69 px mot kravet 64), metspö och animationen `fish` |
| Syns i byggmenyn med kostnad och kort beskrivning | Klar | "Bygg Fiskehytta / 100 trä / Fiske vid vatten, 3 Samlare" |
| Alla värden i datafilerna | Klar | `BUILDING_DEFS.fiskehytta`, `AI_CONFIG.fishing`, `STRINGS` |
| Tester gröna, inga konsolfel, skärmdumpar | Klar | Se "Testresultat" |
| progress.md, architecture.md och GDD:t uppdaterade | Klar | GDD avsnitt 4, 6, 8, 10 och 13 |

**Så fungerar det**

- `WorkDef` har fått `places` (`inside` för Odlingen, `shore` för
  hyttan), `reach` och `deliverTo`. Resten är samma kod som för Odlingen:
  kommandot `work`, högerklick, byggaren börjar arbeta, nästa lediga
  byggnad av samma typ.
- En fiskeplats är en öppen ruta med vatten på någon av fyra sidor,
  högst 3 rutor från hyttan. De tre närmaste gäller.
- Fiskaren står på land, vänd mot vattnet, och rycker upp spöet en gång
  per fisk.

**Fem fel som mätningar och tester avslöjade, och deras grundorsaker**

1. **Fiskare lämnade hyttan och gick till bärsnår.** På frö 1 och 6 låg
   den närmaste strandrutan i en ficka, instängd av träd, klippor eller
   hyttan själv. Platsen valdes ändå, vägen dit blev tom, och koden som
   hanterar "kom inte fram" skickade Samlaren till närmaste källa på
   kartan. Rättat: en fiskeplats räknas bara om Samlaren kan gå dit
   (`reachableTiles`), och en Samlare som inte kom fram försöker samma
   hytta igen innan den söker något annat.
2. **Datorspelaren kunde börja ett bygge den inte kan nå.** På frö 5 låg
   närmaste strandplats bakom skog. Bygget hade aldrig blivit klart, och
   eftersom ett ofärdigt bygge går före allt annat byggande hade
   datorspelaren slutat bygga. Felet fanns i princip för alla byggnader
   men hade inte slagit till, eftersom övriga byggen ligger vid basen.
   Rättat: datorspelaren bygger bara där en av dess Samlare kan gå fram.
3. **Datorspelarens Samlare blev kvar vid bärsnår 25 rutor bort** fast
   hyttan hade en ledig plats, eftersom bara sysslolösa Samlare fick nytt
   arbete. Rättat: den som plockar bär långt från basen flyttas till en
   ledig fiskeplats eller Odling.
4. **Förklaringen kunde avslöja outforskad mark.** När orsakerna till en
   ogiltig plats infördes kontrollerades "platsen är upptagen" före
   "outforskad mark". Spelet hade då sagt om det står något på mark som
   spelaren aldrig har sett. Ett äldre webbläsartest fångade det.
   Rättat: outforskad mark kontrolleras först, och ett enhetstest håller
   fast det.
5. **Det röda talet vid en nekad order kunde utebli på en långsam enhet.**
   Blinkningen varar 300 ms, och tiden räknades från bildrutan *före*
   tryckningen. Tog nästa bildruta längre än så var blinkningen slut
   innan den hade ritats en enda gång. Felet är äldre än det här steget
   och syntes som ett test som föll i ungefär var fjärde körning med
   webbläsaren nedbromsad 8 gånger. Först såg det ut som att testet
   frågade för sent; ett test som noterar blinkningen bildruta för
   bildruta visade att den aldrig kom. Rättat: tiden börjar med den
   bildruta som först visar blinkningen. 24 av 24 nedbromsade körningar
   går nu igenom.

**Val som uppdraget inte avgjorde**

- **Fiskeplatserna visas vid placeringen**: en ring på varje plats och
  antalet under fotavtrycket. Det lades till efter fel 1: på
  standardkartan ger stranden närmast basen bara en fiskeplats som går
  att nå, och det ska spelaren se innan den betalar 100 trä.
- **Byggnadens bild visas vid placering för alla byggnader**, inte bara
  hyttan. Förut visades bara fotavtrycket.
- **Hyttan tar bara emot fisk.** Uppdraget sa "avlämningsplats för fisk";
  bär och trä lämnas alltså inte där.
- **Två hyttor delar på stranden.** En plats är en ruta, så två hyttor
  bredvid varandra får färre platser var.
- **Datorspelaren bygger högst en hytta**, och bara på en strand som ger
  alla tre platser.

**Saknas eller avviker**

- **Hyttan kan byggas där den ger få fiskeplatser.** En plats som ger
  en eller två är tillåten; spelaren ser antalet ("1 fiskeplats"). En
  plats som inte ger någon alls vägras, med texten "Ingen fiskeplats
  här" (tillagt efter användarens svar). På de tio första kartorna finns
  ingen sådan plats, så regeln är prövad i enhetstester men inte i
  webbläsaren.
- **På standardkartan ligger den bästa stranden en bit bort.** Stranden
  närmast spelarens bas (9 rutor) ger en fiskeplats. Skärmdumparna är
  därför tagna på frö 2, där närmaste strand ger tre.
- **Antalet fiskeplatser syns inte på en färdig hytta**, bara vid
  placeringen.
- **Ingen strandgrafik.** Vatten är fortfarande blå rutor, och fiskaren
  står på en vanlig gräsruta. Inget stänk och ingen fisk syns på linan.
- **Korgen visar bär** även för fisk, som för Odlingen.
- **Fiskaren bakom hyttan ritas blekt**, som alla enheter bakom höga
  byggnader. En av tre fiskeplatser hamnar ofta där.
- **Inget meddelande när hyttan är full.**
- **Matcher mellan två datorspelare:** 13,3–20,8 minuter på sex frön,
  samma spann som efter Odlingen. På tre av sex frön bygger båda sidor en
  hytta och en Odling; på de övriga, utan vatten inom räckhåll, fyra
  Odlingar. Frö 6 ligger fortfarande strax över målet 10–20 minuter.
- **Balansen mot en mänsklig spelare är inte speltestad.**
- **Den gemensamma pipelinen fick tillägg:** redskapet metspö, animationen
  `fish` och delarna torkställning och nät. Alla övriga atlaser byggdes om
  och är oförändrade byte för byte.
- **Idet är fortfarande ett platshållarblock.**

**Testresultat**

- Vitest: 599 av 599 (43 nya: 36 för Fiskehyttans regler, övriga för
  datorspelaren, fiskeanimationen, hyttans atlas och outforskad mark)
- Playwright: 121 av 121 (5 nya), även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.

**Äldre tester som ändrades, och varför**

- De två tester som kontrollerar blinkningen vid en nekad order noterar
  den nu inne i sidan, bildruta för bildruta (`recordFlashes`), i stället
  för att fråga efter tryckningen.
- En nekad byggorder anger nu orsaken (`problem`), så tre tester som
  jämförde hela svaret har fått orsaken tillagd.
- Testerna av byggmenyn väntar sig fem knappar.
- AI-testet för Odlingar räknar arbetsplatser för mat i stället för
  antalet Odlingar, eftersom datorspelaren nu kan välja en hytta.
- Atlastestet för Samlaren kontrollerar även `till` och `fish`; `till`
  saknades i listan från steg 1.

**Egna misstag under arbetet**

- Ett ändringsskript avbröts på sin första rad, och ingenting av det togs
  emot. Det upptäcktes direkt eftersom skriptet skrev ut vad som saknades.
  Skripten kontrollerar nu alla ändringar innan någon görs.
- Två nya tester hade fel förväntad ordning på fiskeplatserna, och ett
  webbläsartest antog tre fiskeplatser på en strand som ger en. Testerna
  är rättade; spelet gjorde rätt.

### Ekonomibyggnader, steg 1: Odling (2026-11-14)

Användaren: maten tar slut för snabbt eftersom bärsnåren är ändliga.
Björnarna får ekonomibyggnader, en i taget: först Odling, sedan
Fiskehytta. Efter varje steg ska Claude stanna och visa skärmdumpar.

**Kontrollerna som uppdraget bad om först**

- *Finns Idet och befolkningssystemet?* Ja (pull request 14). Steg 0
  hoppades därför över.
- *Finns vatten och strandlinje på kartan?* Vatten finns på alla åtta
  prövade frön: 34–80 vattenrutor, varav 42–66 öppna gräsrutor gränsar
  till vatten. Närmaste strandruta ligger 9–38 rutor från startplatserna.
  Det finns ingen egen strandterräng och ingen strandgrafik: vatten är blå
  rutor som spärrar vägen. Steg 2 kan alltså byggas på "gräsruta intill
  vatten" utan att kartan ändras, men på vissa frön ligger vattnet långt
  från basen.

**Skärmdumpar:** `docs/screenshots/odling-stadier.png` (byggmenyn med
kostnad och beskrivning, och tre Odlingar i var sitt stadium),
`odling-arbete.png` (Samlaren hackar: fyra bildrutor ur rörelsen),
`odling-tre.png` (tre färdiga Odlingar med var sin Samlare) och
`odling-byggmeny-telefon.png` (byggmenyn i två rader på en 390 px bred
skärm).

**Startvärden (förslag, väntar på godkännande)**

| | Odling | Bärsnår |
|---|---|---|
| Kostnad | 60 trä | – |
| Byggtid, 1 Samlare | 20 s | – |
| Liv | 200 | – |
| Yta | 2×2 rutor | 1 ruta |
| Samlare samtidigt | 1 | upp till 4 |
| Tid per mat | 2,5 s | 1 s |
| Mat per minut och Samlare, utan gångväg | 24 | 60 |
| Uppmätt med gångväg (sex frön) | 20–22, Odlingen intill Storidet | 45–55, snåret 4–6 rutor från Storidet |
| Mängd | tar aldrig slut | 150 per snår |

En Odling ger alltså drygt 40 % av vad samma Samlare får ur bär. De 60
träna motsvarar knappt tre minuters skörd från åkern.

**Avstämning mot uppdraget, steg 1**

| Punkt | Status | Kommentar |
|---|---|---|
| Byggs av Samlare, kostar trä, yta enligt skalstandarden | Klar | 60 trä, 2×2 rutor. Ny storleksklass `plot` utan lägsta höjd, eftersom en åker inte är ett hus |
| En Samlare per Odling | Klar | `work.workers = 1`. Nästa Samlare går till närmaste egna lediga Odling, annars behåller den sin uppgift |
| Mat i oändlighet, tydligt långsammare än bär | Klar | 24 mot 60 mat/min utan gångväg |
| Lämnar maten i närmaste förråd eller huvudbyggnad, som för bär | Klar | Samma avlämningskod som för bär |
| Egen arbetsanimation om pipelinen tillåter | Klar | Ny animation `till` med hacka, 8 bildrutor i 8 riktningar |
| AI:n bygger Odlingar innan bären tar slut | Klar | Börjar när bären inom 14 rutor från Storidet är under 600 mat |
| Enhetstester för produktion och en Samlare per Odling | Klar | `src/sim/systems/farming.test.ts`, 19 tester, och ett AI-test |
| Grafik via figurpipelinen enligt skalstandarden | Klar | `buildings/bear/field.toml`, tre byggstadier och skugga |
| Syns i byggmenyn med kostnad och kort beskrivning | Klar | Alla knappar i kommandopanelen har nu tre rader |
| Alla värden i datafilerna | Klar | `BUILDING_DEFS.odling`, `AI_CONFIG.fields`, `STRINGS.buildingInfo` |
| Tester gröna, inga konsolfel, skärmdumpar | Klar | Se "Testresultat" |
| progress.md, architecture.md och GDD:t uppdaterade | Klar | GDD avsnitt 4, 6, 8, 10 och 13 |

**Så fungerar det**

- En byggnad kan ha `work` i `BUILDING_DEFS`: resurs, antal arbetare och
  sekunder per enhet. Arbetet är samma `GatherTask` som för träd och
  bärsnår, med byggnadens id i `siteId`. Fiskehyttan kan använda samma
  väg.
- Nytt kommando `work` (spelare och AI). Högerklick, eller ett tryck på
  pekskärm, på en egen färdig Odling skickar dit markerade Samlare.
- Odlingen är `walkable`: enheter går över den, och den ritas som mark.
- Samlaren står på åkerns bortre hörnruta, som är bar jord i bilden, och
  hackar tre tag per mat.
- Den som bygger klart en Odling börjar arbeta på den.

**Val som uppdraget inte avgjorde**

- **Man går över en Odling.** Annars skulle en rad åkrar stänga in basen.
  Den kan fortfarande anfallas och rivas.
- **Byggaren börjar arbeta på åkern** när den är klar, så att spelaren
  inte behöver ge två order.
- **En Samlare som inte får plats behåller sin uppgift.** Inget
  meddelande visas.
- **Alla knappar i kommandopanelen fick en beskrivningsrad**, även
  träningsknapparna, så att menyn ser likadan ut överallt. Knapparna blev
  därför 64 px höga mot 48, och radbryts när de inte ryms.
- **AI:ns regel:** en Odling för varje 150 mat som fattas under 600 inom
  14 rutor från Storidet, högst 5.

**Saknas eller avviker**

- **Grödan skymmer inte enheter.** Åkern ritas under allt som står på
  marken. En enhet som går genom säden ser ut att gå ovanpå den, och en
  enhet bakom gärdsgården eller fågelskrämman ritas framför dem.
- **Korgen visar bär.** Samlaren bär hem mat från åkern i samma fyllda
  korg som från bärsnår; det finns ingen egen bild för säd.
- **Inget meddelande när Odlingen är upptagen.** Högerklickar man med en
  andra Samlare händer ingenting synligt, utöver orderringen.
- **Byggplaceringen visar fortfarande bara fotavtrycket**, inte åkerns
  bild. Det gäller alla byggnader sedan tidigare.
- **Idet är fortfarande ett platshållarblock.**
- **Ingen skärmdump av datorspelarens Odlingar.** Regeln prövas av ett
  enhetstest, där bären vid dess bas töms i förväg. I en vanlig match mot
  en spelare som inte gör något är matchen slut innan bären tar slut.
- **Balansen mot en mänsklig spelare är inte speltestad.** Värdena är
  förslag.
- **Matcher mellan två datorspelare blev längre:** 13,3–20,8 minuter (sex
  frön) mot 11,5–15,0 förut. Båda sidor bygger fyra Odlingar i varje
  match, den första efter 1,7–10,8 minuter. Ett av sex frön hamnar strax
  över GDD:ts mål på 10–20 minuter. Balanstesterna går igenom utan
  ändrade värden.
- **En åker bakom en hög byggnad är svår att klicka på.** Klickytan för
  Storidet når upp över tornet, så ett klick på en Odling rakt bakom det
  träffar Storidet. Det gäller allt som står bakom höga byggnader sedan
  byggnaderna fick bilder.
- **Den gemensamma pipelinen ändrades** med tillägg: redskapet hacka i
  `lib/weapons.py`, animationen `till`, fem nya byggnadsdelar i
  `lib/structures.py` och storleksklassen `plot` i `game.toml`. Alla
  övriga atlaser byggdes om och är oförändrade byte för byte.
- **Pull request 14 växer.** Arbetet ligger på samma gren som
  befolkningssystemet, som inte är mergat än, och hamnar därför i samma
  pull request.
- **Steg 2 (Fiskehytta) är inte påbörjat.**

**Testresultat**

- Vitest: 556 av 556 (37 nya: 19 för Odlingens regler, 1 för att
  datorspelaren bygger Odlingar i tid, övriga för byggmenyn, hackrörelsen,
  arbetsordern och åkerns atlas)
- Playwright: 116 av 116 (4 nya), även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.

**Två nya tester föll första gången, och varför.** Testerna för
högerklick och tryck på en Odling lät testhjälpen bygga åkern på första
lediga plats, som låg rakt bakom Storidet. Klickpunkten låg då inom
Storidets klickyta, så klicket träffade Storidet och gav en flyttorder.
Spelet gjorde rätt; testet valde en dålig plats. `buildNearHome` kan nu
bygga framför Storidet, och det gör fälttesterna.

**Äldre tester som ändrades, och varför**

- Testerna av byggmenyn väntar sig fyra knappar och en beskrivningsrad.
- Testet att kommandopanelen står "i höjd med" markeringspanelen jämför
  nu underkanterna, eftersom panelen blev högre.
- Testhjälpen `buildHouse` bygger på en allmännare `buildNearHome`.

### Befolkningssystem (2026-11-14)

Användaren bad om ett riktigt befolkningssystem i stället för det fasta
taket 30. Pull request 13 (byggnaderna i spelet) mergades först, på
användarens begäran.

**Var kom 30 ifrån?** `START_CONFIG.populationCap` i `src/data/setup.ts`.
Värdet lästes på tre ställen: träningskontrollen i `production.ts`,
resursraden i `GameScene` och ett AI-test. Det är borttaget.

**Skärmdumpar:** `docs/screenshots/befolkning-raknare.png` (räknaren vid
start, 3/5), `befolkning-fullt.png` (rött tal och meddelande när platsen
är full) och `befolkning-ide.png` (ett färdigt Ide, räknaren 5/10 och
byggmenyn med "Bygg Ide").

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| 1. Datadrivet: huvudbyggnaden ger 5 | Klar | `housing: 5` för Storiden i `BUILDING_DEFS` |
| 1. Ny byggnad, bostad per ras (björnar: Ide), +5, billig, byggs av Samlare, platshållargrafik | Klar | `ide`: 30 trä, 15 s, 2×2 rutor, 300 liv. Block med bokstaven I |
| 1. Hårt tak 50 per spelare | Klar | `POPULATION_CONFIG.hardCap` i `src/data/population.ts` |
| 1. Befolkningskostnad per enhetstyp (alla 1) | Klar | `population` i `UNIT_DEFS` |
| 2. Träning blockeras när platsen är full; kö räknas | Klar | `queueUnit` nekar med `housingFull` eller `populationCap` |
| 3. Förlorad bostad: inga enheter dör, ingen ny tränas förrän plats finns | Klar | Platsen räknas om från befintliga byggnader |
| 4. "Nuvarande/plats" bredvid resurserna; rött tal och kort meddelande | Klar | Rött i 2,5 s; "Ingen plats – bygg ett Ide" eller "Befolkningstaket 50 är nått" |
| 5. AI:n bygger bostäder i tid | Klar | Bygger ett Ide när högst 3 platser är lediga. Ett test mäter att den aldrig står utan plats i 30 s |
| 6. Enhetstester för punkt 1–3 | Klar | `src/sim/population.test.ts`, 21 tester |
| Tester gröna, inga konsolfel | Klar | Se "Testresultat" |
| Skärmdumpar: räknaren, en bostad, meddelandet | Klar | Tagna och granskade |
| Uppdatera progress.md och GDD:t | Klar | GDD avsnitt 4, 6, 7, 8, 10 och 13 |

**Val som uppdraget inte avgjorde**

- **Räknaren visar upptagen plats, kön inräknad.** Med tre enheter och två
  i kö visas 5/5. Annars skulle det stå 3/5 fast träningen nekas.
- **En enhet som redan står i kö tränas klart** även om en bostad
  förstörs under tiden. Bara nya order nekas.
- **Två meddelanden:** ett som säger att man ska bygga ett Ide, och ett
  annat när det hårda taket är nått och fler bostäder inte hjälper.
- **Idets värden** (30 trä, 15 s, 300 liv, 2×2 rutor, synfält 4) är
  Claudes förslag; uppdraget sa bara "billig".
- **AI:ns marginal** är 3 lediga platser.

**Saknas eller avviker**

- **Taket 50 mot tidigare skiss 250.** GDD:t talade om ett maxtak på
  omkring 250 efter MVP:n (användarens tidigare förslag). Det nya
  uppdraget säger 50, och det gäller nu. GDD:t är uppdaterat och den
  gamla siffran står kvar som överstruken historik.
- **Spelet börjar trängre.** Platsen vid start är 5 mot tidigare 30. Med
  tre Samlare från början ryms två till innan det första Idet behövs.
- **Balansen ändrades.** Matcher mellan två datorspelare tar nu 11,5–15,0
  minuter (sex frön) mot 13,2–18,3 förut. Balanstesterna (10–20 minuter,
  försvar mot första vågen) går igenom utan ändrade värden. Balansen mot
  en mänsklig spelare är inte speltestad.
- **Datorspelaren bygger fler bostäder än den behöver** när krigare har
  kapitulerat: den hade plats för 30 med 16–21 enheter i mätningen.
- **Idet har ingen bild**, och ritas som ett blått block bland de nya
  byggnaderna.
- **`?stress=N`** ställer fortfarande ut enheter utan hänsyn till platsen.
- **Befolkningen från grottor** (rekrytering, 50 extra) är inte påbörjad
  och berörs inte.

**Testresultat**

- Vitest: 519 av 519 (21 nya för befolkningsreglerna, 1 nytt för att
  datorspelaren bygger bostäder i tid; 7 äldre anpassade)
- Playwright: 112 av 112 (4 nya), även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.

**Äldre tester som ändrades, och varför**

- Fyra tester i `production.test.ts` byggde på taket 30. De prövar nu
  samma saker mot Storidens plats (5).
- Testerna som tränar fyra Samlare för att få slut på mat bygger först
  ett Ide, eftersom platsen annars tar slut före maten.
- Två tester av byggmenyn väntar sig nu tre knappar.
- Testet av startläget körs utan datorspelare, eftersom den börjar bygga
  sitt första Ide i första steget.
- Testet att en order till motståndarens enhet är verkningslös godtar att
  enheten bygger, inte bara att den samlar.

**CI föll en gång på lint.** En oanvänd import (`START_CONFIG` i
`GameScene.ts`) blev kvar när taket togs bort. Den sista lintkontrollen
före commit visade bara utskriftens sista rad, som var tom, och lästes
som godkänd. Importen är borttagen, och kontrollerna läses nu på sin
slutstatus.

**Ett eget misstag under arbetet.** En rättning av testhjälpen
`buildHouse` togs aldrig emot, eftersom skriptet som gjorde ändringen
avbröts och körningen låg i bakgrunden. Två tester föll därför en gång
till av samma orsak innan det upptäcktes. Hjälpen väntade på att "ett
Ide" skulle bli klart och fick datorspelarens; den väntar nu på
spelarens eget.

### Byggnaderna ritas i spelet (2026-11-14)

Efter att tigrarna var klara föreslog Claude tre möjliga nästa steg och
rekommenderade byggnaderna i spelet. Användaren svarade "Gör så", vilket
också lästes som klartecken att merga tigrarnas pull request (12).

**Skärmdumpar:** `docs/screenshots/byggnader-klara.png` (Storide,
Krigshall och Visthus färdiga, med Samlare bakom byggnaderna),
`byggnader-klara-narbild.png` (utsnitt av den) och `byggnader-bygge.png`
(Krigshall i första byggstadiet, Visthus i det andra).

**Vad som gjordes**

- **Alla tre byggnaderna ritas från sina atlaser**, för båda sidorna, i
  spelarens lagfärg. Blocken med bokstäver används inte längre.
- **Byggstadier:** under halva bygget visas grund och stomme, från halva
  bygget väggarna med öppet tak, sedan den färdiga byggnaden.
- **Skugga** som egen bild på marken.
- **Klick** träffar byggnaden upp till ungefär takets mitt, och
  träffytan räknas nu exakt.
- **Livstapeln** sitter över taket.
- **Enheter bakom en byggnad** ritas svagt (50 %) ovanpå den, så att de
  inte försvinner. Se "Beslut under arbetet".

**Beslut under arbetet**

- **Enheter bakom byggnader.** De nya byggnaderna är tre till fyra gånger
  så höga som blocken och dolde Samlare som gick bakom Storiden. Första
  försöket var att göra byggnaden genomskinlig; det såg urblekt ut,
  eftersom Samlare är bakom Storiden nästan hela tiden. Lösningen blev
  den vanliga i strategispel: byggnaden är solid och enheten ritas svagt
  ovanpå. Detta bad användaren inte om uttryckligen. Det går att ta bort
  genom att sätta `UNIT_BEHIND_BUILDING_ALPHA` till 0 eller ta bort
  kontrollen i `EntityView`.

**Saknas eller avviker**

- **Byggplaceringen visar bara fotavtrycket**, inte byggnadens bild.
- **En byggnad som faller försvinner direkt**, som förut. Det finns ingen
  ruin och ingen rasanimation.
- **Storiden och Krigshallen liknar varandra** på håll (hall med torn).
- **Ingen omfaktorering:** `BuildingLibrary` upprepar cirka 30 rader ur
  `CharacterLibrary` (inläsning och färgning av en atlas). De kan slås
  ihop om användaren vill.
- **Laddning:** 0,5 MB till för byggnadernas atlaser (3,9 MB för allt).
- **Träd, bärsnår, klippor och grottor** är fortfarande platshållare och
  ser nu enklare ut än resten.

**Testresultat**

- Vitest: 498 av 498 (8 nya: byggstadier och vad en byggnad täcker)
- Playwright: 108 av 108 (4 nya), även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.
- Prestanda: samma bildfrekvens med och utan byggnadsbilderna, mätt sida
  vid sida mot `main` på samma maskin (12–14 bilder/s i huvudlös Chromium
  utan grafikkort; maskinen var långsammare än vid tidigare mätningar).

**En bugg rättad i fps-räknaren.** Räknaren från `?debug=1` började räkna
från tid noll i stället för från spelets första bild. Den första
avläsningen tog därför med hela laddningen och kunde visa 0 bilder/s.
Den börjar nu räkna när spelet har laddat. Felet syntes som ett fallande
test i den nedbromsade körningen; testet väntar nu också på en avläsning
över 0, eftersom en enstaka bild kan ta sekunder på en nedbromsad maskin.

### Figurgrafik: tigrarna och en tigerkrigare (2026-11-14)

Punkt 3 i uppdraget "bygg resten av figurerna": en raskonfig för tigrar
(smal, snabb, lätt rustning, randig päls) och en tigerkrigare som skiljer
sig tydligt från björnen i siluett. Användaren bad först att
pull request 11 skulle mergas ("Medge och gå vidare", läst som "Merga");
den är mergad, och detta arbete ligger i en ny pull request.

**Översiktsbild:** `assets/previews/overview.png` visar nu tre figurer
och tre byggnader i verklig skala. Tigerns egna bilder ligger i
`assets/previews/tiger_raider/`.

**Vad som gjordes**

- **Raskonfig** `races/tiger.toml`: smalare axlar och bröst, 45 % längre
  ben, mindre huvud med spetsiga öron och kindpäls, ingen puckel. Tigern
  är 10 % högre än björnen i samma storleksklass (39 px mot 35).
- **Randig päls och lång svans** som nya delar (`lib/coat.py`): ränder
  runt armar, ben, bål och över huvudet, och en lång ringlad svans.
- **Tigerkrigaren** `units/raider.toml`: lätt rustning (läderremmar med
  bröstbricka, lindor, ett axelskydd), pannband, skärp och höftskynke i
  lagfärg, en glav och en liten sköld med tigersigillet.
- **Samma skelett och animationer** som björnkrigaren, utan ändringar i
  dem. Spritearket byggdes utan fel: ingen bild klipps, fötterna glider
  inte, och takten blir 2,35 varv per sekund vid 2,8 rutor per sekund.

**Saknas eller avviker**

- **Tigrarna finns inte i spelet.** Det finns ingen tigerenhet, ingen
  rasväljare och inga tigerbyggnader. Uppdraget gällde att förbereda
  rasen i pipelinen.
- **Farten 2,8 rutor per sekund är ett antagande.** Den står i enhetens
  konfig för att gången ska kunna anpassas, men ingen enhet i spelet har
  den farten.
- **Ränderna är hela ringar** runt lemmar och bål. De bryts inte upp som
  på en riktig tiger, och magen är inte ljus.
- **Glavens egg vetter åt sidan i hugget.** Anfallsanimationen är gjord
  för ett svärd och vrider bladet efter det.
- **Gemensam kod ändrad:** `lib/figure.py` fick en rad som bygger
  pälsteckningen (ingen verkan för raser utan `[markings]` eller
  `[tail]`). `lib/armor.py` och `lib/weapons.py` fick bara nya delar.
  Hela `npm run build:characters` kördes efteråt: björnarnas figurer
  och byggnader blev identiska med de incheckade.
- **Enhetens namn är `raider`**, inte `warrior`: enhetskonfigerna är
  gemensamma för raserna, och `warrior` är björnarnas tunga utrustning.
  Figuren heter därför `tiger_raider`.

**Testresultat**

- Vitest: 490 av 490 (1 nytt: tigerns storlek, animationer och takt)
- Lint och typkontroll utan anmärkning
- Webbläsartesterna är inte körda om: ingen spelkod är ändrad

### Figurgrafik: björnarnas byggnader (2026-11-14)

Punkt 2 i uppdraget "bygg resten av figurerna": byggnader för björnrasen
i samma stil, med byggnadsstadier om spelet stöder det. Användaren
bekräftade först tolkningen av stegfrekvensen ("Det är korrekt").

**Översiktsbild:** `assets/previews/overview.png` visar de tre
byggnaderna och de två figurerna i verklig skala. Per byggnad:
`assets/previews/bear_main/`, `bear_barracks/` och `bear_storage/`
(`stages.png` och `teams.png`).

**Vad som gjordes**

| Byggnad | I spelet | Fotavtryck | Krav på takhöjd | Takhöjd |
|---|---|---|---|---|
| Huvudbyggnad (`main`) | Storide | 3×3 rutor | 115 px | 137 px |
| Kasern (`barracks`) | Krigshall | 3×3 rutor | 90 px | 112 px |
| Förråd (`storage`) | Visthus | 2×2 rutor | 64 px | 79 px |

- **Byggsats.** Byggnader sätts ihop av delar (grund, timmerväggar,
  sadeltak, torn, port, baner, palissad, tunnor med mera) enligt en
  konfigfil per byggnad, i rutor. Rasens färger ligger i en gemensam
  stilfil.
- **Stadier.** Tre bilder per byggnad: grund och stomme, väggar med öppet
  tak, och färdig. Dessutom den färdiga byggnadens skugga som egen bild.
- **Storleksstandarden kontrolleras i bygget:** taket måste nå klassens
  lägsta höjd och inget får sticka ut utanför fotavtrycket.
- **Lagfärg** via samma mask som figurerna: nock, baner, vimplar och
  sköldar. Rasens sigill sitter över porten och på baneren.
- **Atlaser** i `assets/buildings/`, 0,1–0,2 MB per byggnad.

**Byggnadsstadier och vad spelet stöder**

- Spelet har två lägen: under uppförande (med en byggandel från 0 till 1)
  och färdig. Två bilder finns för uppförandet, tänkta för under respektive
  över halva bygget.
- **Förstörd finns inte.** En byggnad som faller tas bort ur spelet i
  samma steg, så det finns ingen ruin att visa. Ingen ruinbild är gjord.
- Storiden kan inte byggas i spelet, men har stadierna ändå, så att alla
  byggnader är gjorda på samma sätt.

**Saknas eller avviker**

- **Byggnaderna ritas inte i spelet.** Uppdraget gällde att bygga dem i
  pipelinen och visa översiktsbilden. Att rita dem i spelet rör djup,
  klick, livstapel, byggplacering och dimma, och är ett eget steg.
- **Gemensam kod ändrad:** `build.py` fick flaggan `--building`, bygger
  byggnaderna i `--all` och ritar dem i översiktsbilden. Det behövdes
  eftersom en byggnad inte är en figur med skelett. Ny kod ligger i egna
  filer (`buildings.py`, `lib/structures.py`). Figurernas atlaser är
  oförändrade.
- **Storiden och Krigshallen liknar varandra i grundformen** (hall med
  torn). De skiljer sig i höjd, tornets plats, palissadgården och porten.
- **Träd, bärsnår, klippor och grottor** är fortfarande platshållare.

**Testresultat**

- Vitest: 489 av 489 (11 nya: byggnadernas atlaser stämmer med spelets
  fotavtryck, storleksstandarden och varandra)
- Lint och typkontroll utan anmärkning
- `npm run build:characters` kört i sin helhet: alla figurers och
  byggnaders atlaser blir identiska med de incheckade
- Webbläsartesterna är inte körda om: ingen spelkod är ändrad

### Samlaren och grunden: sex förbättringar (2026-11-13)

Användaren bad om sex ändringar i den gemensamma pipelinen och spelkoden,
så att framtida figurer får samma lösning. Arbetet ligger i samma pull
request som figurerna.

**Skärmdumpar:** `docs/screenshots/arbetsplatser.png` (fyra Samlare runt
ett träd, fyra runt ett bärsnår, två som hamrar på ett Visthus),
`korg-tom-full.png` (Samlare på väg hem med full korg och ut med tom),
`arbetsplatser-narbild.png` och `korg-tom-full-narbild.png` (utsnitt av
de två, förstorade två gånger), `laddning.png` (laddningsstapeln) och
`stress-120.png` (`?stress=120` på en skärm i telefonstorlek). Korgens
utseende i stor bild: `assets/previews/bear_worker/layers.png`.

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| 1. Stegfrekvens: högst ca 3 steg per sekund, genom längre steg; regel i pipelinen från fart och benlängd | Klar | Takten hålls inom 1,8–3,0 varv per sekund (`[gait]` i `game.toml`, `walk.ground_share`). Samlaren gick 3,79 och går nu 3,00 med 26 % längre steg. Ramkrigaren (2,79) är oförändrad. Se "Tolkning" nedan |
| 2. Korgen syns fylld vid last; ta bort fyrkanten | Klar | Ett lager per resurs i spritearket (`load_wood`, `load_food`), ritat ovanpå figuren. Fyrkanten är borta för figurer |
| 3. Yxhugg för trä, plock för bärsnår, hammarslag för byggen, kopplat till uppgiften | Klar | `chop`, `pick` och `hammer`. Tabellen `GATHER_ACTIVITY` i spelkoden kopplar resurs till animation |
| 4. Upp till 4 fasta arbetsplatser per källa; ledig plats väljs, ingen överlappar; fulla källor skickar vidare till närmaste liknande | Klar | I simuleringen (`GatherTask.place`, `workPlaces`). Se "Avviker" om vad som händer när ingen plats finns |
| 5. Laddningsstapel med procent innan startskärmen | Klar | Dessutom texten "Laddar …" i sidan medan spelets kod hämtas |
| 6. `?debug=1` ger fps-räknare; `?stress=120` startar med 120 Samlare | Klar | Båda fungerar utan `?test=1`. Stress slår på räknaren och sätter Samlarna i arbete |
| Tester gröna, inga konsolfel | Klar | Se "Testresultat" |
| Skärmdumpar: tom och full korg, flera Samlare runt samma träd, laddningsstapeln | Klar | Tagna och granskade |
| Uppdatera progress.md | Klar | |

**Tolkning: "3 steg per sekund".** I förra rapporten stod att Samlaren
gick 3,8 *varv* per sekund mot Ramkrigarens 2,8, där ett varv är ett steg
med vardera foten. Gränsen är satt till 3,0 i samma mått, eftersom
Ramkrigarens gång på 2,8 var godkänd. Räknat som enskilda fotnedsättningar
är det 6 per sekund. Om användaren menade 3 fotnedsättningar ändras ett
tal (`loops_per_second` till `[0.9, 1.5]`) och figurerna byggs om, men då
svävar båda figurerna i långa språng mellan stegen.

**Saknas eller avviker**

- **Samlare utan ledig plats står kvar.** Finns ingen källa av rätt slag
  med ledig plats inom 8 rutor får enheten ingen uppgift. Den väntar inte
  på en plats och söker inte längre bort. Syns tydligt med `?stress=120`.
- **Arbetsplatserna ändrar spelet.** Högst fyra Samlare per källa, och en
  Samlare som stod snett intill en källa måste nu gå en ruta till en
  plats. Balanstesterna (dator mot dator, sex frön) går igenom utan
  ändrade värden. Balansen mot en mänsklig spelare är inte speltestad.
- **Yxan försvinner när Samlaren plockar bär** och byts mot en hammare
  vid byggen. Den hängs inte i bältet.
- **Korgen är antingen tom eller full.** Den fylls inte gradvis: en enhet
  i lasten räcker för full korg.
- **Farten finns på två ställen**: `src/data/units.ts` och enhetens
  konfig i pipelinen. Ett enhetstest jämför dem.
- **Laddningsstapeln visar andelen filer, inte byte.** Med sex filer
  hoppar den i steg om cirka 17 %.
- **"Laddar …" i `index.html`** ligger utanför `strings.ts`, eftersom
  texten måste finnas innan koden har laddats.
- **Atlasen växte.** Samlarens atlas är 1,6 MB (1032 bilder med lagren),
  mot 1,0 MB. Båda figurerna är 3,4 MB att ladda.
- **Gemensam kod ändrad:** `animations/walk.py` (steglängd efter fart),
  `animations/gather.py` heter nu `chop.py`, `lib/weapons.py` (namngrupp
  och hammare), `lib/figure.py` (extra verktyg), `lib/export.py`
  (lagerpass), `build.py` (verktyg per animation, lager, stegfrekvens).
  Björnkrigarens bilder är oförändrade bit för bit; bara metadatan fick
  fart och takt.

**Testresultat**

- Vitest: 478 av 478 (19 nya: arbetsplatser, stresstart, stegfrekvens och
  lager i atlasen, laddningsstapelns mått, de nya arbetsanimationerna)
- Playwright: 104 av 104 (6 nya), även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.
- Björnkrigarens atlasbilder är identiska med förra bygget (kontrollsummor).
- Prestanda, huvudlös Chromium utan grafikkort: 32–37 bilder/s med
  `?stress=120` på en skärm om 844×390 punkter. Inte mätt på telefon; det
  är det räknaren är till för.

**Ett äldre test rättat.** Fas 8-testet "`?fog=0` har ingen verkan utanför
testläge" väntade fasta 400 ms och tryckte sedan på "Starta". Med
nedbromsad webbläsare hinner laddningen inte bli klar på den tiden, och
laddningsskärmen tar inte emot tryck. Spelet gjorde rätt; testet antog en
klocktid. Det trycker nu tills bilden visar kartan, och räknar på en
nedskalad bild.

### Figurgrafik: björnarbetaren, Samlarens figur (2026-11-13)

Användaren godkände skalan och avstånden ("Det ser rätt ut, kör vidare").
Nästa figur blev Samlaren, den enda enheten som fortfarande var en
platshållare. Arbetet ligger i samma pull request som björnkrigaren.

Efter att figuren var byggd kom användarens uppdrag för resten av
figurerna, i tre punkter med stopp efter varje:

| Punkt | Status |
|---|---|
| 1. Björnarbetare (ingen tung rustning, verktyg i stället för vapen) | Klar, väntar på användarens granskning av översiktsbilden |
| 2. Byggnader för björnrasen: huvudbyggnad, förråd, kasern, med byggnadsstadier om spelet stöder det | Inte påbörjad |
| 3. Raskonfig för tigrar och en tigerkrigare med tydligt annan siluett | Inte påbörjad |

Uppdraget säger: lägg bara till nya konfigfiler och delar, och ändra inte
i den gemensamma koden om det inte är absolut nödvändigt. Det som ändrades
i gemensam kod för punkt 1:

- **`animations/gather.py`:** redskapets flatsida följer nu svingens plan.
  Utan det pekade yxans egg uppåt när hugget träffade, eftersom
  animationen bara angav vart skaftet pekar. Ändringen påverkar ingen
  befintlig atlas: krigaren använder inte `gather`.
- **`lib/armor.py`:** bara nya delar (tunika, lindor, axelskydd av läder,
  förkläde, korg). Krigarens delar är orörda, och hans atlas blir
  identisk vid ombygge.
- **`build.py` och `game.toml`:** ny flagga `--overview` för
  översiktsbilden som uppdraget ber om. Inget befintligt ändrat.
- **Spelkoden** (`src/render/`): behövdes för att rita Samlaren och visa
  arbetet. Se listan nedan.

**Översiktsbild:** `assets/previews/overview.png` visar alla figurer
bredvid varandra i verklig skala, i båda lagfärgerna.

**Skärmdumpar:** `docs/screenshots/figurer-samlare-arbetar.png` (hugger
ved, plockar bär och reser ett Visthus), `figurer-samlare-gar.png` (på
väg ut) och `figurer-samlare-skala.png` (tre Samlare bredvid tre
Ramkrigare). Förhandsbilder i `assets/previews/bear_worker/`.

**Vad som gjordes**

- **Figuren.** Tunika i lagfärg, läderförkläde, läderlindor, ett
  axelskydd av läder, en flätad korg på ryggen och en yxa i höger hand.
  Bart huvud. Nya delar i `lib/armor.py`; konfig i `units/worker.toml`.
  Storleksklass `worker`: 29 px hög mot krigarens 35.
- **Animationer.** `idle`, `walk`, `gather` och `defeat` ur det
  gemensamma biblioteket. `gather` ändrades så att yxans egg leder
  hugget. 232 bildrutor, atlas 1024×452 px, 1,0 MB (bas och mask).
- **I spelet.** Samlaren hugger när den samlar vid en källa och när den
  reser en byggnad, vänd mot källan eller bygget. Vid insamling är det
  ett hugg per enhet av resursen (1 per sekund), och redskapet träffar i
  samma steg som enheten läggs i lasten.
- **Figurer utan alla animationer.** Samlaren har ingen `attack`. En
  Samlare som beordras att slåss visar `gather` i takt med sin
  nedkylning (`animationFor`).
- **Last.** Den lilla fyrkanten som visar att enheten bär något ritas nu
  även för figurer, vid axeln.

**Saknas eller avviker**

- **Samlarens ben går fort.** Gången följer farten, och Samlaren är
  mindre men snabbare än Ramkrigaren: 3,8 varv per sekund mot 2,8.
  Fötterna glider inte, men stegen är snabba.
- **Korgen ser likadan ut tom och full.** Lasten visas bara av den lilla
  fyrkanten, som för platshållarna.
- **Samma hugg för allt arbete.** Yxan används även på bärsnår och på
  byggen. Ingen särskild animation för att plocka eller snickra.
- **Samlaren bär inget sigill.** Det sitter på sköld och mantel.
- **Ingen egen animation för att bära hem lasten.** Den springer som
  vanligt, med yxan i handen.
- **Samlare vid samma källa står nära varandra** och överlappar på
  skärmen. Arbetare får dela ruta enligt kollisionsreglerna.
- **1,0 MB mer att ladda innan startskärmen** (2,8 MB för båda
  figurerna), fortfarande utan laddningsindikator.
- **Byggnader, träd, bärsnår och klippor är fortfarande platshållare.**

**Testresultat**

- Vitest: 459 av 459 (15 nya: Samlarens aktiviteter, `progressFrame`,
  `animationFor`, och atlasens test gäller nu båda figurerna)
- Playwright: 98 av 98 (4 nya för Samlaren), även med webbläsaren
  nedbromsad 8 gånger
- Lint och typkontroll utan anmärkning. Inga konsolfel.
- Prestanda, huvudlös Chromium utan grafikkort, 1280×720: 17 bilder/s
  med 120 Samlare som står (20 utan extra enheter; 18 med 120
  Ramkrigare). Inte mätt på telefon.
- Ett andra bygge av båda atlaserna ger identiska filer (kontrollsummor).
  Björnkrigarens atlas är oförändrad av de nya delarna.

### Figurgrafik: grunden rättad – skala, kollision, gång och ett test (2026-11-13)

Användaren bad om fyra saker innan fler figurer byggs. Ändringarna ligger
i samma pull request som björnkrigaren.

**Skärmdumpar:** `docs/screenshots/figurer-grupp.png` (en grupp uppställd
på varannan ruta), `figurer-gar.png` (gruppen går), `figurer-slass.png`
(närstrid mellan två lag) och `figurer-besegrad.png`

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| 1. Storleksregel föreslagen och dokumenterad i `architecture.md` | Klar | Avsnittet "Storleksstandard": höjd per klass i rutbredder, bredd, raser och byggnader |
| 1. Regeln ligger i den gemensamma Blender-koden och följs automatiskt | Klar | `lib/scale.py`; en figur anger bara klass, och bygget stoppar om kroppen är för bred |
| 2. Kollisionsradie så att enheter håller avstånd i strid och i grupp | Klar | Se avvikelserna om enheter som går och om närstrid |
| 2. Fungerar när många trängs | Klar | Testat med 30 anfallare mot en byggnad och ett slag med 40 mot 40 |
| 3. Gångens takt synkad med enhetens verkliga fart, även för andra farter | Klar | Bildrutorna stegas efter tillryggalagd sträcka |
| 4. Det ändrade testet förklarat, och bekräftat att inget fel döljs | Klar | Se nedan |
| Björnkrigaren omrenderad enligt standarden | Klar | 35 pixlar hög mot 45 förut |
| Skärmdumpar: grupp som går och närstrid mellan två lag | Klar | |
| Skarp rendering som egen punkt i `implementation-plan.md` | Klar | Inte påbörjad |

**Storleksstandarden i korthet**

| Klass | Höjd | Pixlar |
|---|---|---|
| Arbetare | 0,46 rutbredder | 29 |
| Krigare | 0,55 | 35 |
| Liten byggnad (2×2) | minst 1,0 | 64 |
| Stor byggnad (3×3) | minst 1,4 | 90 |
| Huvudbyggnad | minst 1,8 | 115 |

**Det ändrade testet (punkt 4)**

Testet från fas 3 beordrade som spelare en av motståndarens enheter att gå
och kontrollerade sedan att enheten saknade väg. Det påståendet rymmer två
saker: att ordern inte hade någon verkan, och att ingenting annat hade gett
enheten en väg. Det andra var ett outtalat antagande, och det slutade
stämma i fas 9: datormotståndaren ger sina arbetare order redan i första
simuleringssteget. Testet gick ändå igenom i två faser, eftersom kontrollen
hann göras innan första steget kördes. När figurernas texturer började
laddas upp under första bildrutan hann steget köras, och testet föll.

Att inget fel i simuleringen döljs är kontrollerat på tre sätt:

- Vägen som testet såg slutade på ruta (56, 12), invid motståndarens bas,
  inte på (30, 30) dit spelaren försökte skicka enheten.
- Ett nytt enhetstest spelar två kopior av samma match mot
  datormotståndaren. I den ena försöker spelaren flytta motståndarens enhet
  en gång i sekunden. Efter 200 steg är de två matcherna identiska, värde
  för värde.
- Webbläsartestet är ersatt av två skarpare: med datormotståndaren igång är
  enheten inte på väg till den ruta spelaren angav, och utan
  datormotståndaren står den kvar på sin plats 20 steg senare.

Lösningen från förra omgången, att bara slå av datormotståndaren i testet,
var riktig men bevisade mindre än den här.

**Saknas eller avviker**
- **Krigaren blev mindre:** 35 pixlar hög mot 45. Första förslaget, 40
  pixlar, gav fortfarande en klump när en grupp stod tillsammans.
- **Enheter som går kan passera genom varandra under ett ögonblick.**
  Kollisionen är mjuk för att ingen ska fastna. Avståndet hålls när de
  står still och när de slåss. Två som går samma väg håller sig ungefär en
  halv ruta isär.
- **I närstrid står enheter en ruta från varandra**, inte glesare, och
  figurerna överlappar då något på skärmen. Glesare går inte utan att
  ändra hur närstrid fungerar.
- **En grupp som flyttas ställer sig på varannan ruta.** Det stod inte i
  uppdraget, men utan det stod gruppen för tätt för att läsas. Enheter
  som har gått var för sig, eller som blir stående efter en strid, står
  som förut.
- **Fler anfallare än det finns plats för väntar längre ut.** Förut
  ställde de sig på samma ruta. Runt en enhet ryms 8 anfallare, runt en
  3×3-byggnad 16.
- **Balansen ändrades**, eftersom strider går annorlunda. En justering i
  `src/data/ai.ts`: motståndarens sena vågor kommer var 120:e sekund i
  stället för var 150:e. Utan den tog en match dator mot dator upp till
  20,3 minuter. Balanstesterna är oförändrade. Se tabellen.
- **GDD:t är ändrat** på två ställen: förenklingen "enheter kolliderar
  inte" är struken, och gruppens uppställning är inskriven.
- **Löpcykeln är ny**: en fot i taget i marken och en svävfas emellan.
  Med björnkrigarens fart blir det 22 bildrutor per sekund.
- **Byggnaderna i spelet följer inte standarden än.** De är platshållare
  med 22–36 pixlar höga väggar. Måtten gäller när byggnaderna byggs.
- **Standarden är bara prövad på en figur.** Arbetarens och andra rasers
  mått är satta men inte byggda.
- **Sidoglidning runt den man möter provades och togs bort.** En enhet på
  väg till en punkt där någon stod hamnade i omlopp runt den.

**Balans efter ändringarna** (frön 1–6)

| | Före kollision | Efter |
|---|---|---|
| Dator mot dator, matchlängd | 14,2–19,1 min | 13,2–18,3 min |
| 6 Ramkrigare mot första vågen | Vinner, 5–6 kvar | Vinner, 5–6 kvar |
| Storidens liv efter första vågen | 1490–1500 | 1480–1500 |
| Spelare som inte gör något | Förlorar efter 5,3 min | Förlorar efter 5,3 min |

**Testresultat**
- Vitest: 444 av 444
- Playwright: 94 av 94, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i huvudlös webbläsare: inga

**Beslut och lärdomar**
- Skärmdumpen avgjorde storleken. Kollisionsradien var rätt i
  simuleringen, men figurerna var bredare än avståndet mellan två rutor på
  skärmen, så gruppen såg ändå ut som en klump.
- Kollisionstesterna hittade två fel i första versionen: anfallare som
  stannade på en upptagen ruta, och sysslolösa enheter som blev stående på
  varandra när målet försvann.
- Ett slagtest avgjordes aldrig. Orsaken var testet: de överlevande stod
  längre isär än de 6 rutor en Ramkrigare upptäcker fiender på.

### Figurgrafik: skelett, animationer, spritesheets och björnkrigaren i spelet (2026-11-13)

**PR:** https://github.com/boulwen90-afk/animalplanet/pull/11

**Skärmdumpar:** `docs/screenshots/figurer-gar.png` (två lag går mot
varandra), `figurer-slass.png` (fem dueller) och `figurer-besegrad.png`
(besegrade krigare på knä och på väg bort med vit flagga).
`assets/previews/bear_warrior/animations.png` visar varje animation som en
rad bildrutor

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| 1. Humanoid-skelett i `tools/blender/lib/`, samma struktur för alla raser | Klar | 17 ben; bara längderna skiljer mellan raser |
| 1. Animationer i kod: idle, gå, attack, samla, dö | Klar | "Dö" är `defeat`: figuren ger upp. `gather` finns i biblioteket men ingen figur använder den än |
| 1. Loopande animationer loopar sömlöst | Klar | Av konstruktion; granskat på animationsarket, inte som rörlig film |
| 1. Gemensamt animationsbibliotek | Klar | `tools/blender/animations/` |
| 2. Spritesheets i 8 riktningar, ortografisk kamera i spelets vinkel, transparent bakgrund, fast ljus | Klar | 248 bildrutor för björnkrigaren |
| 2. Samma pixelskala för alla figurer, pivot vid fötterna | Klar | 24 pixlar per Blender-enhet; `anchor` i atlasen |
| 2. Lagfärg via separat mask, teknik vald och motiverad | Klar | En färgad atlas per spelare görs när spelet startar; se `architecture.md` |
| 2. PNG + JSON-atlas i `assets/characters/` | Klar | |
| 3. Björnkrigaren ersätter platshållaren, med riktning och animationer efter tillstånd | Klar | Står, går, anfaller, besegras |
| 3. npm-skript som bygger om alla figurer | Klar | `npm run build:characters` |
| Bygget och alla tester går igenom | Klar | Se testresultat |
| Spelet startar i huvudlös webbläsare utan konsolfel | Klar | |
| Skärmdumpar av björnkrigare för två lag som går och slåss | Klar | |
| Prestanda kontrollerad med minst 100 enheter på skärmen | Klar | Mätt med 120; se tabellen |
| `progress.md` och `architecture.md` uppdaterade | Klar | |

**Prestanda** (1280×720, huvudlös Chromium med programvarurendering, alltså
utan grafikkort; 3 sekunders mätning per rad)

| Scen | Enheter i bild | Bilder/s | Tid per bild |
|---|---|---|---|
| Inga extra enheter | 0 | 17–18 | 55–59 ms |
| 120 platshållare (Samlare) som står | 120 | 18–19 | 53–57 ms |
| 120 figurer som står | 120 | 15 | 68 ms |
| 120 figurer som går | 120 | 14 | 72–73 ms |
| 120 figurer som slåss, 60 mot 60 | 120 | 14 | 70–73 ms |
| Samma strid, kameran riktad mot ett tomt hörn | 0 | 24 | 41 ms |

- 120 figurer kostar 10–15 ms per bild här, mot cirka 2 ms för 120
  platshållare. Skillnaden är ritade pixlar: en figur är runt 50 pixlar
  hög, en platshållare 20.
- Spelets egen kod är inte flaskhalsen: samma strid går i 24 bilder/s när
  den inte ritas.
- **Inget av detta är mätt på en dator med grafikkort eller på en
  telefon.** Programvarurendering är långsam redan för kartan ensam
  (17–18 bilder/s). Siffrorna visar vad figurerna kostar i förhållande
  till resten, inte hur spelet går på riktig hårdvara.
- Från sidladdning till att spelet är igång tar 0,6–0,7 s här, med
  laddning och färgning av atlasen inräknat. Det är mätt mot en lokal
  server, så nedladdningstid över nätet ingår inte.

**Saknas eller avviker**
- **"Dö" är "besegrad".** Ingen dör i spelet (GDD avsnitt 15). Krigaren
  vacklar, går ned på knä och ger sig sedan av med vit flagga.
- **Bilden av en besegrad enhet dröjer.** Den knäböjer 0,7 s där den föll
  och springer sedan i kapp sin verkliga plats på 0,6 s. Simuleringen är
  oförändrad: enheten börjar gå direkt.
- **Spelet ritar fortfarande i skärmens grova pixlar.** Förra gången sa
  jag att jag skulle ändra det i det här steget. Det är inte gjort: det
  rör runt 85 ställen i inmatning och gränssnitt och behöver egna tester.
  Figurerna är därför inte skarpare på en telefon än resten av spelet.
- **Spelets atlas är i enkel upplösning**, inte dubbel som
  förhandsbilderna. Dubbel upplösning gav 8,3 MB att ladda och syns inte
  förrän punkten ovan är löst. Det är en inställning (`atlas_scale`).
- **Ingen inbakad skugga.** Spelet ritar en mjuk oval skugga under varje
  figur, inte den formade skuggan från förhandsbilderna. Med inbakad
  skugga blev atlasen nästan dubbelt så stor.
- **2,6 MB mer att ladda innan startskärmen visas**, utan
  laddningsindikator.
- **Figurer överlappar varandra i närstrid.** En figur är bredare än en
  ruta, och enheter som slåss står på rutor intill varandra.
- **Fötterna glider något när figuren går.** Enheten rör sig snabbare än
  stegen räcker till.
- **Första hugget har ingen uppladdning.** Simuleringen delar ut skadan i
  samma steg som hugget beslutas, så animationen börjar där hugget träffar.
- **Samlaren och byggnaderna är fortfarande platshållare**, och ser små ut
  bredvid krigaren.
- **`gather` är inte provad på en arbetarfigur.** Den syns bara på
  animationsarket, spelad av krigaren.
- **Vapnet följer alltid höger hand och skölden vänster underarm.**
- **Alla åtta riktningar renderas**; ingen är en spegelbild av en annan.
- **Klickytan för en Ramkrigare är nu hela kroppen**, inte en cirkel vid
  fötterna.
- **Ett fas 3-test körs nu med `&ai=0`.** Det förutsatte att inget
  simuleringssteg hinner köras mellan spelstart och kontrollen. Det
  stämde bara så länge första bildrutan var snabb.
- **CI bygger inte figurerna.** De färdiga filerna är incheckade, och den
  som ändrar en konfigfil måste köra `npm run build:characters` (kräver
  Python 3.13).
- **Två nya funktioner i testgränssnittet:** `getUnitSprite` och
  `getFrameCount`.

**Testresultat**
- Vitest: 418 av 418
- Playwright: 93 av 93, även med webbläsaren nedbromsad 8 gånger
- Lint och typkontroll: utan anmärkning
- Konsolfel i huvudlös webbläsare: inga

**Beslut och lärdomar**
- Första atlasen blev 4096×2063 pixlar och 11 MB. Mätning visade att den
  inbakade skuggan stod för 43 % av ytan. Brusreducering provades för att
  få ned filstorleken men gjorde ingen skillnad.
- Ett test för knäfallet missade det, eftersom testet upptäckte
  kapitulationen för långsamt. Det stegar nu fram och kontrollerar i ett
  svep.
- Svärdet klipptes av bildrutans kant i hugget. Bygget stoppar nu med ett
  felmeddelande när det händer.

### Figurgrafik, omarbetning: tuffare figur, mask och sigill (2026-11-13)

Användaren bad efter första visningen om lagfärg via mask, en tuffare och
mindre pixlig figur, och en logga per ras i stil med vapensköldar, synlig
på mantel och sköld.

**Förhandsbilder:** `assets/previews/bear_warrior/` och
`assets/previews/emblems/`

**Avstämning mot önskemålen**

| Önskemål | Status | Kommentar |
|---|---|---|
| Lagfärg via mask | Klar i pipelinen | Varje bild ger en bas och en mask; `mask_demo.png` visar fyra färger ur en rendering. Spelet använder den inte än |
| Tuffare figur | Klar | Bredare axlar och bröst, mindre huvud, längre nos, huggtänder, sänkt blick under tunga ögonbryn, taggar på axlar och knän, bukskenor och höftplåtar, pälskrage, hjälmkam, bredsvärd, trasig mantelfåll, bredbent ställning med höjt svärd |
| Mindre pixlig | Klar | Bilderna renderas i dubbel upplösning med mjuk kontur och kroppen skuggas mjukt. Figuren är också något större i spelet (cirka 50 pixlar mot 48) |
| Logga per ras | Klar | Sigill för björn, tiger, apa och varg. Egna motiv: djurhuvuden i silhuett |
| Loggan synlig på mantel och sköld | Klar för björnen | Sigillet ersätter sköldbucklan och ligger mitt på manteln |

**Saknas eller avviker**
- **Spelet ritar på en yta i skärmens grova pixlar.** På en telefon
  förstoras hela spelbilden av webbläsaren. För att de dubbelt så skarpa
  bilderna ska synas måste spelet rita i skärmens verkliga upplösning.
  Det är en ändring i spelkoden och hör till steget då figurerna kopplas in.
- **Första omgångens `ingame_4x.png` var en fyra gånger uppförstorad bild**
  utan utjämning, gjord för att visa varje pixel. Den såg därför
  pixligare ut än spelet skulle ha gjort. Den är ersatt av `ingame_2x.png`,
  som är renderad i den upplösningen.
- **Masken ger inte exakt samma färg som en direkt rendering.** Skillnaden
  är i snitt 2–3 % per pixel och syns inte för ögat.
- **Det ljusa sigillet syns sämre mot gul lagfärg** än mot blå, röd och
  grön.
- **Sköldbucklan är borta** när skölden bär sigillet. Klomärkena från
  första försöket finns kvar som alternativ (`emblem = "claws"`).
- **Tiger, apa och varg finns bara som sigill.** Raserna själva är inte
  byggda, och sigillen är inte provade på en figur.
- **Tre renderingar per bild** (figur, mask, skugga) gör bygget
  långsammare: cirka två minuter för förhandsbilderna, mot 20 sekunder.
- **Figuren har fortfarande inget skelett**, och `assets/characters/` är
  tom tills stilen är godkänd.
- **Ändringen i `game.toml` av ljuset** (svagare himmel, bakljus, bara
  huvudljuset kastar skugga) gäller alla framtida figurer.

**Testresultat**
- Bygget kör utan fel, och två körningar ger identiska kontrollsummor
- `--check-mask`: blå 5,4 och röd 7,4 av 255 i medelavvikelse över
  lagfärgsdelarnas pixlar
- Lint: utan anmärkning. Spelets kod och tester är inte berörda

**Beslut och lärdomar**
- Handen stack igenom skölden och hjälmen dolde ögonen i första
  renderingen av den nya figuren. Båda syntes bara på bilderna.
- Skuggpasset gav först en svag ruta runt varje figur. Två orsaker: marken
  är lite mörkare överallt under öppen himmel, och bakljuset kastade en
  egen lång skugga som klipptes av bildrutans kant.
- Att mäta masken mot en direkt rendering visade att vit grundfärg ger för
  ljusa färger. Utan mätningen hade det inte märkts.

### Figurgrafik, steg 0–2: pipeline och en björnkrigare (2026-11-13)

**Förhandsbilder:** `assets/previews/bear_warrior/` (`overview.png` visar
allt på ett ark)

**Avstämning mot uppdraget**

| Punkt | Status | Kommentar |
|---|---|---|
| Steg 0: kontrollera renderingsteknik | Klar | Phaser 3.90 i 2D-isometri, inte Three.js. Slutprodukten blir spritesheets |
| Steg 0: installera Blender utan fönster | Klar | `pip install bpy` gav Blender 5.3.0 för Python 3.13 |
| Steg 1: `tools/blender/lib/`, `races/`, `units/`, `build.py` | Klar | |
| Steg 1: `assets/characters/` och `assets/previews/` | Klar | `assets/characters/` är tom tills stilen är godkänd |
| Steg 1: pipelinen dokumenterad i `architecture.md` | Klar | Avsnittet "Figurpipeline" |
| Steg 2: björnkrigare med kraftig kropp, ringbrynja och plåt, rundsköld, svärd | Klar | Statisk pose, inget skelett |
| Steg 2: bilder framifrån, från sidan och i spelets kameravinkel | Klar | Även bakifrån |
| Steg 2: en bild i verklig storlek | Klar | `ingame_1x.png`, på spelets mark |
| Steg 2: två lagfärgsvarianter | Klar | Blå och röd, samma färger som i spelet |
| Stilregel: gemensam ledstruktur för alla raser | Klar | Ledernas namn och lägen finns; skelettet byggs senare |
| Stilregel: rustning, sköld och vapen är separata och utbytbara | Klar | Provat med yxa, utan mantel och med hjälm utan nässkydd |
| Stilregel: separat lagfärgsmaterial | Klar | Mantel, vapenrock och sköldens fält |
| Stilregel: parametriskt och deterministiskt | Klar | Två byggen ger identiska filer |
| Ingen ändring i spelkoden | Klar | Bara `.gitignore`, `.prettierignore` och `eslint.config.js` har fått undantag för den virtuella miljön och `assets/` |

**Saknas eller avviker**
- **Cycles används i stället för EEVEE.** EEVEE kräver grafikkort, och
  molnmiljön saknar `libEGL.so.1`. Cycles är Blenders egen renderare och
  kör på processorn; ett bygge med alla bilder tar cirka 20 sekunder.
- **Ringbrynjan är en slät mörkgrå yta**, utan ringmönster. Ett mönster
  skulle inte synas i spelstorlek.
- **Figuren har inget skelett**, enligt uppdraget. Posen är byggd direkt
  från ledernas lägen.
- **`assets/characters/` är tom.** Spritesheets byggs när stilen är
  godkänd.
- **Konturen läggs på efter renderingen**, med en bildoperation i
  `lib/export.py`, inte i Blender.
- **Lagfärgen byts genom att rendera om.** Hur spelet ska färga om (ett
  spritesheet per lag, eller en mask som färgas i spelet) är inte bestämt.
- **Figuren är cirka 48 pixlar hög i spelet**, större än platshållaren
  (22 pixlar). Byggnaderna är fortfarande platshållare och ser små ut
  bredvid.
- **Att samma konfig ger samma bild är bara kontrollerat på en maskin.**
  En annan Blender-version kan ge andra pixlar.
- **Bara björnen är byggd.** Att rustningen passar andra raser är inte
  provat.
- **Två bilder utöver uppdraget:** `back.png` och `overview.png`.

**Testresultat**
- Bygget kör utan fel, och två körningar ger identiska kontrollsummor
- Lint: utan anmärkning. Spelets tester är inte berörda

**Beslut och lärdomar**
- Första renderingen hade utfrätt vitt stål, en hjälm som dolde ögonen och
  en mantel som såg ut som en skiva. Det syntes först på bilderna.
- I verklig storlek försvann björnen i allt stål. Kortare brynjeärmar som
  visar päls, större öron och en skarpare rendering gjorde mest nytta.
- `bpy` måste importeras före Blenders egna moduler (`addon_utils`).

## MVP-avstämning mot GDD:t (fas 10, 2026-11-13)

Hela MVP:n jämförd med `game-design-document.md`, avsnitt för avsnitt.
"Uppfyllt" betyder att det finns i spelet och kontrollerades med tester i
den fas där det byggdes. Allt som saknas eller avviker står i listorna
efter tabellen.

| GDD-avsnitt | Status | Kommentar |
|---|---|---|
| 1. Översikt | Uppfyllt | Isometrisk RTS i webbläsaren. Världen och klanen syns inte i spelet, se avvikelse 9 |
| 2. Kärnloop | Uppfyllt | Samla, bygg ut, rusta, utforska och slåss, vinn |
| 2. Matchlängd 10–20 min | Delvis | Dator mot dator: 14–19 min. Mot människa inte mätt, se avvikelse 1 |
| 3. Vinst och förlust | Uppfyllt | Slutskärm, frusen simulering, "Spela igen", inga djur dör |
| 4. Mus och tangentbord | Uppfyllt | Alla tolv rader i tabellen, se avvikelse 3 och 4 |
| 4. Pekskärm | Uppfyllt | Alla fem rader i tabellen. Bara provat med emulerat finger |
| 4. HUD | Uppfyllt | Resursrad, markeringspanel, kommandopanel med kostnad och kö. Ingen minikarta |
| 5. Raser | Uppfyllt | Bara björnar; spelare blå, fiende röd |
| 6. Resurser | Uppfyllt | Alla siffror enligt tabellen, befolkningstak 30 |
| 7. Enheter och stridsregler | Uppfyllt | Alla siffror enligt tabellen, se avvikelse 2 |
| 8. Byggnader och byggregler | Uppfyllt | Alla siffror enligt tabellen, se avvikelse 5 |
| 9. Karta och krigsdimma | Uppfyllt | 64×64, frö, punktspeglad, grottor, tre dimlägen |
| 10. AI-motståndare | Uppfyllt | Alla fem punkter, se avvikelse 10 |
| 10. Förenklingar | Uppfyllt | Ingen kollision, ingen formation, terräng påverkar inte sikt eller fart |
| 11. Spelkänsla | Uppfyllt | Alla tretton rader, se avvikelse 3, 4, 6, 7 och 8 |
| 12. Visuell stil | Uppfyllt | Platshållargrafik enligt beskrivningen; text i `strings.ts` |
| 13. Ingår inte i MVP:n | Uppfyllt | Inget av det är byggt |
| 14. Beslut | Uppfyllt | Se avvikelse 11 om arbetsnamnet |
| 15. Kapitulation och grottor (MVP-delen) | Uppfyllt | Vit flagga, 2 grottor × 12 platser per sida, reservering, fulla grottor |

### Avviker från GDD:t

1. **Matchlängden mot en människa är inte mätt.** En spelare som inte
   försvarar sig förlorar efter drygt 5 minuter. Dator mot dator tar 14–19
   minuter.
2. **Sysslolösa Ramkrigare anfaller självmant bara enheter, inte
   byggnader.** GDD:t säger "fiender". Byggnader anfalls på order.
3. **Markeringen ändras när musknappen släpps**, inte samma bildruta som
   den trycks ned.
4. **Kameran stannar inte vid kartans kant.** Bildens mittpunkt hålls inom
   kartromben, så upp till halva bilden kan visa tomrum utanför kartan.
5. **Spökbilden är fotavtryckets kontur**, inte en bild av byggnaden.
6. **Skärmskakningen kan bli längre än 150 ms** vid låg bildfrekvens,
   eftersom den går på Phasers egen klocka.
7. **"Din bas anfalls!" visas bara när en byggnad träffas**, inte när
   enheter anfalls.
8. **Orderringen är grön även för insamling och bygghjälp.** GDD:t nämner
   bara grön för flytt och röd för attack.
9. **Världen syns inte i spelet.** Klomark, Granheden, Järnramarna och
   Hövding Halvard Stenrygg finns bara i GDD:t. Spelet visar namnen på
   enheter och byggnader.
10. **Motståndaren har ett tak på 20 soldater och ett tidsfönster per
    våg.** Inget av det står i GDD:t. Soldater i en våg går förbi arbetare
    och andra byggnader, och motståndarens arbetare flyr inte.
11. **Arbetsnamnet "AnimalPlanet" står på startskärmen och på den
    publicerade sidan.** GDD avsnitt 14 säger att namnet bör bytas innan
    spelet sprids offentligt. Sidan är publik men inte spridd.

### Finns i spelet men inte i GDD:t

- Startskärm, knapparna "Bas" och "Avbryt", byggplacering med finger och
  ringen under ett finger som hållits kvar (fas 10)
- En liten färgad fyrkant på enheter som bär något (fas 4)
- Fiendens enheter och byggnader går att markera för att se namn och liv
  (fas 3)
- Befolkningssiffran blinkar rött vid fullt tak, och enheter i kö räknas
  mot taket (fas 5)
- Byggen under uppförande ser 2 rutor (fas 8)
- Antalet djur står ovanför varje grotta (fas 7)
- Testparametrarna `?fog=0`, `?ai=0` och `?start=0`, samt `spawnUnit` i
  testgränssnittet. De fungerar bara med `?test=1`

### Brister som GDD:t inte reglerar

Inget av detta bryter mot GDD:t, men det märks när man spelar.

- Full kö ger ingen återkoppling, och träningsknappen ser likadan ut när
  man inte har råd
- Ett bygge går inte att avbryta eller riva
- Arbetare blir sysslolösa när ett bygge är klart, och sysslolösa arbetare
  syns inte på något särskilt sätt
- Hur mycket som finns kvar i en resurskälla visas inte
- En arbetare som byter resursslag tappar det den bär
- Arbetare som blir anfallna gör ingenting åt det
- Markeringen runt en vald byggnad syns dåligt, och enheter bakom en
  byggnad döljs av den
- Nya enheter står stilla där de dyker upp (ingen samlingspunkt)
- Ingen plats nära basen är garanterat fri för en Krigshall
- Utforskad mark visar kartan som den är nu, och enheter hittar vägen
  genom outforskad mark
- Utforskad mark har ett svagt mörkare rutnät, och träd i dimmans kant
  ritas delvis nedtonade
- "Spela igen" ger samma karta, eftersom fröet är detsamma
- Grottorna ligger på den egna halvan, så en enhet som besegras vid
  fiendens bas går över hela kartan med vit flagga
- Flera enheter kan dela ruta när det är trångt runt ett mål
- En orderring visas även när målet inte går att nå
- Med finger går det inte att lägga till enheter i en markering, och på en
  telefon i stående läge täcker panelerna ungefär en femtedel av skärmen

### Inte kontrollerat

- Att den publicerade sidan fungerar. Claudes session når inte github.io;
  bara att publiceringsjobben har gått igenom är kontrollerat
- Pekstyrning på en riktig telefon eller surfplatta
- Andra webbläsare än Chromium
- Hur balansen känns för en människa

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
