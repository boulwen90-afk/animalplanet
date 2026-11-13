# AnimalPlanet – framsteg

Uppdateras efter varje avslutad fas. Senaste fasen överst.

## Nuläge

- **MVP:n är klar.** Alla tio faser är mergade till `main`
- **Pågår:** riktig figurgrafik, byggd med kod i Blender. Steg 0–2 är
  gjorda och figuren är omgjord en gång efter användarens synpunkter
  (tuffare, skarpare, sigill, lagfärg via mask). Arbetet väntar på att
  användaren godkänner stilen. Se "Efter MVP:n" nedan
- **Nästa steg efter godkännande:** skelett, animationer och spritesheets,
  och därefter att spelet ritar figurerna i stället för platshållarna
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
