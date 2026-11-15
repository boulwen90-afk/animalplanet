# AnimalPlanet – speldesigndokument (GDD)

Status: **Godkänd 2026-11-12.**

Alla siffror i detta dokument är startvärden. De ligger i datafiler (`src/data/`)
och justeras i balansfasen, inte i logiken.

## 1. Översikt

AnimalPlanet är ett realtidsstrategispel (RTS) för webbläsaren med isometrisk
2D-vy. Spelaren leder en klan av talande, upprättgående djur i rustning, bygger
upp en bas, samlar resurser, tränar krigare och krossar fiendens huvudbyggnad.

Världen heter **Klomark**: en vild kontinent av granskog, djungel, stäpp och
berg där djurklanerna en gång levde åtskilda. När de gamla gränsstenarna föll
började klanerna göra anspråk på samma marker.

Allt innehåll är originellt. Inga namn, figurer, platser eller grafik lånas
från andra verk.

## 2. Kärnloop

1. **Samla** – arbetare hämtar mat och trä och lämnar vid huvudbyggnad/förråd.
2. **Bygg ut** – resurser blir fler arbetare, förråd närmare resurserna och en kasern.
3. **Rusta** – kasernen tränar soldater.
4. **Utforska och slåss** – hitta fienden genom krigsdimman, försvara basen, anfall.
5. **Vinn** – förstör fiendens huvudbyggnad innan fienden förstör din.

En match ska ta ungefär 10–20 minuter.

## 3. Vinst och förlust

- **Vinst:** fiendens huvudbyggnad (Storide) har 0 liv.
- **Förlust:** din egen Storide har 0 liv.
- När matchen avgörs fryser simuleringen och en slutskärm visas
  ("Seger" / "Nederlag") med knappen "Spela igen".
- Storiden kan inte byggas om i MVP:n.
- Inga djur dör. En enhet vars liv tar slut kapitulerar och flyr till en
  grotta, se avsnitt 15. Byggnader rasar när deras liv tar slut.

## 4. Kontroller

### Mus och tangentbord
| Handling | Kontroll |
|---|---|
| Markera en enhet/byggnad | Vänsterklick |
| Markera flera enheter | Vänsterklick + dra (dragruta) |
| Lägg till/ta bort i markering | Shift + vänsterklick |
| Avmarkera | Vänsterklick på tom mark, eller Esc |
| Flytta | Högerklick på mark |
| Attackera | Högerklick på fiendeenhet/-byggnad |
| Samla | Högerklick på resurs (med arbetare markerade) |
| Hjälp till att bygga | Högerklick på eget bygge (med arbetare markerade) |
| Arbeta på en Odling eller fiska | Högerklick på egen färdig Odling eller Fiskehytta (med arbetare markerade) |
| Laga | Högerklick på egen skadad byggnad (med arbetare markerade), eller knappen "Laga" |
| Bygga / träna | Knappar i kommandopanelen |
| Avbryt byggplacering | Högerklick eller Esc |
| Panorera kameran | Piltangenter / WASD, muspekaren mot skärmkanten, eller dra med mittenknappen |
| Hoppa till egen bas | H |

### Pekskärm (enkel variant, se öppen fråga 1)
| Handling | Kontroll |
|---|---|
| Panorera | Dra med ett finger |
| Markera | Tryck på enhet/byggnad |
| Dragruta | Håll inne 300 ms, dra sedan |
| Kommando (flytta/attackera/samla/laga) | Tryck på mål när enheter är markerade |
| Avmarkera | Knappen "Avmarkera" i HUD:en |

### HUD
- **Överkant:** mat, trä, befolkning som nuvarande/plats (t.ex. `12/15`).
  Enheter i kö räknas med i det nuvarande talet. När en enhet inte kan
  tränas för att platsen är full blir talet rött i 2,5 sekunder och ett
  kort meddelande visas: "Ingen plats – bygg ett Ide", eller
  "Befolkningstaket 200 är nått" när det hårda taket är nått.
- **Nederkant:** markeringspanel (namn, liv, vad enheten gör) och
  kommandopanel (bygg-/träningsknappar med kostnad, produktionskö).
- Ingen minikarta i MVP:n.

## 5. Raser

### MVP: Björnarna – Järnramarna
- **Hemvist:** Granheden, de kalla barrskogarna i norra Klomark.
- **Ledare:** Hövding Halvard Stenrygg.
- **Karaktär:** tunga, tåliga och långsamma. Tjock rustning, stora sköldar,
  byggnader av timmer och sten.
- **Spelidentitet (blir relevant först när fler raser finns):** mest liv,
  lägst fart, dyrare enheter, starkast byggnader.

I MVP:n spelar både spelaren och AI:n Järnramarna. Lagen skiljs åt med färg
(spelare blå, fiende röd).

### Efter MVP (endast riktning, inget implementeras nu)
| Ras | Klan | Ledare | Hemvist | Spelidentitet |
|---|---|---|---|---|
| Tigrar | Glödklorna | Kejsarinnan Zharra Glödöga | Bärnstensdjungeln | Snabba, hög skada, sköra. Bakhåll: svårupptäckta i skog. |
| Apor | Lianbrödraskapet | Mäster Okobo Silverhand | Trädstaden Tusengren | Billiga och många, distansvapen (slungor), bygger snabbt. |
| Vargar | Månflocken | Flockmoder Ylva Frostnos | Vindstäppen | Flockbonus: starkare nära varandra. Rörliga räder, svaga byggnader. |

## 6. Resurser

| Resurs | Källa | Mängd per källa | Används till |
|---|---|---|---|
| Mat | Bärsnår | 150 | Arbetare, soldater |
| Mat | Odling (byggnad, se avsnitt 8) | tar aldrig slut | Arbetare, soldater |
| Mat | Fiske vid en Fiskehytta (byggnad, se avsnitt 8) | tar aldrig slut | Arbetare, soldater |
| Trä | Träd | 100 | Byggnader, soldater |

- Källor på kartan är ändliga och försvinner när de är tömda. Tömda träd blir
  gångbar mark.
- **Odling** (tillagt 2026-11-14 på användarens begäran, eftersom maten tog
  slut när bärsnåren var tömda): en byggnad som ger mat i oändlighet, men
  tydligt långsammare än bär. **En Samlare per Odling.** Samlaren hackar
  fram 1 mat var 2,5 s (24 mat/min utan gångväg, mot 60 för ett bärsnår),
  bär 10 åt gången och lämnar lasten i närmaste Visthus eller Storide,
  precis som bär. Uppmätt med en Odling intill Storidet: 20–22 mat/min per
  Samlare, mot 45–55 för bärsnår 4–6 rutor från Storidet. Värdena ligger i
  `BUILDING_DEFS.odling` (`cost`, `buildTime`, `work`). Startvärdena
  godkändes av användaren 2026-11-14.
- **Fiske** (tillagt 2026-11-14 på användarens begäran): Samlare fiskar
  från fasta platser på stranden nära en Fiskehytta och bär fångsten till
  hyttan. Fisken tar aldrig slut. Fiske ger mat **snabbare än en Odling
  men långsammare än bär**: 1 mat var 1,6 s (37,5 mat/min utan gångväg).
  Uppmätt på sex kartor: 33–38 mat/min per Samlare. En hytta har högst 3
  fiskeplatser. Inga båtar, och ingen går på vatten. Värdena ligger i
  `BUILDING_DEFS.fiskehytta`. Värdena godkändes av användaren 2026-11-14.
- **Arbetsplatser:** varje källa har upp till 4 fasta arbetsplatser, på de
  öppna rutorna runt den. En arbetare tar en ledig plats och behåller den
  medan den bär hem lasten. Är alla platser tagna går arbetaren till
  närmaste källa av samma slag som har en ledig.
- Arbetare bär högst 10 enheter åt gången, samlar 1 enhet/s och måste lämna
  lasten vid Storide eller Visthus innan resursen räknas.
- Startresurser: 200 mat, 100 trä.
- **Befolkning** (ändrat 2026-11-14 på användarens begäran; tidigare ett
  fast tak på 30):
  - En sida har **plats** för så många enheter som dess färdiga byggnader
    ger: Storiden ger 5 och varje Ide (bostad) ger 5 till. En byggnad under
    uppförande ger ingenting än.
  - **Hårt tak: 200 per sida**, hur många bostäder man än bygger. Det
    motsvarar Storidet och 39 Iden. (Höjt från 50 den 2026-11-14 på
    användarens begäran. Den första skissen talade om ett maxtak på
    omkring 250.)
  - Varje enhetstyp har en **befolkningskostnad**; i dag kostar alla 1.
  - **Träning blockeras när platsen är full.** Enheter i produktionsköer
    räknas som upptagen plats, eftersom de behöver plats när de är klara.
  - **Förlorad bostad:** om en bostad förstörs och befolkningen överstiger
    platsen dör inga enheter, men ingen ny kan tränas förrän det finns
    plats igen. En enhet som redan står i kö tränas klart.
  - Alla värden ligger i datafilerna: `housing` per byggnad, `population`
    per enhet och `POPULATION_CONFIG.hardCap`.

## 7. Enheter (MVP)

| | Samlare (arbetare) | Ramkrigare (soldat) |
|---|---|---|
| Beskrivning | Björn i läderförkläde med korg och yxa | Björn i järnrustning med svärd och rundsköld |
| Tränas i | Storide | Krigshall |
| Kostnad | 50 mat | 60 mat, 25 trä |
| Träningstid | 12 s | 18 s |
| Liv | 40 | 100 |
| Skada / träff | 3 | 10 |
| Rustning | 0 | 1 |
| Tid mellan slag | 1,5 s | 1,2 s |
| Räckvidd | Närstrid (angränsande ruta) | Närstrid (angränsande ruta) |
| Fart | 2,5 rutor/s | 2,2 rutor/s |
| Synfält | 6 rutor | 7 rutor |
| Kan | Samla, bygga, slåss på order | Slåss |
| Befolkningskostnad | 1 | 1 |

Stridsregler:
- Skada = anfallarens skada − målets rustning, minst 1.
- Ramkrigare som står stilla anfaller automatiskt fiender inom 6 rutor.
  Samlare anfaller bara på order.
- En enhet som fått attackorder följer efter målet tills det kapitulerar
  eller försvinner in i krigsdimman.
- En enhet vars liv når 0 kapitulerar (avsnitt 15). Den slåss inte längre
  och kan inte anfallas.
- **Kollisionsradie (tillagt 2026-11-13):** varje enhet tar plats på marken:
  Ramkrigare 0,45 rutor i radie, Samlare 0,36. Två enheter håller sina
  mittpunkter minst summan av sina radier isär när de står still och när de
  slåss. Kollisionen är mjuk: en enhet som går knuffas undan långsammare än
  den går, så ingen fastnar i trängsel, men två enheter som möts kan
  passera genom varandra under ett ögonblick.
- En grupp som flyttas ställer upp sig på varannan ruta runt målpunkten.
- Runt ett mål finns bara plats för så många anfallare som det finns rutor
  intill. Övriga väntar på närmaste lediga ruta och går in när en plats
  blir ledig.

## 8. Byggnader (MVP)

| | Storide (huvudbyggnad) | Visthus (förråd) | Krigshall (kasern) | Ide (bostad) | Odling (åker) | Fiskehytta | Vakttorn |
|---|---|---|---|---|---|---|---|
| Funktion | Tränar Samlare, avlämningsplats | Avlämningsplats nära resurser | Tränar Ramkrigare | Ger befolkningsplats | Ger mat utan slut, 1 Samlare | Fiske vid vatten, upp till 3 Samlare; avlämningsplats för fisk | Skjuter på fiender, ser långt |
| Kostnad | – (finns från start) | 80 trä | 150 trä | 30 trä | 60 trä | 100 trä | 120 trä |
| Byggtid (1 arbetare) | – | 20 s | 35 s | 15 s | 20 s | 25 s | 30 s |
| Liv | 1500 | 400 | 700 | 300 | 200 | 350 | 500 |
| Storlek | 3×3 rutor | 2×2 rutor | 3×3 rutor | 2×2 rutor | 2×2 rutor | 2×2 rutor | 1×1 ruta |
| Synfält | 9 rutor | 5 rutor | 6 rutor | 4 rutor | 3 rutor | 5 rutor | 8 rutor |
| Befolkningsplats | 5 | 0 | 0 | 5 | 0 | 0 | 0 |

Bostaden heter olika för varje ras; björnarnas är Idet. Det byggs av
Samlare. Det är en låg timmerstuga under ett djupt halmtak, med ljus i
fönstren, skorsten, vedtrave och en bikupa på gården (bild sedan
2026-11-14; dessförinnan ett block med bokstaven I).

**Odlingen** (tillagt 2026-11-14) byggs av Samlare och är en åker, inte ett
hus:
- Enheter **går över den**; den spärrar ingen väg. Den kan anfallas och
  rivas som andra byggnader.
- **En Samlare åt gången** arbetar där, på åkerns bortre hörnruta, med
  ansiktet mot grödan. Den som byggde åkern börjar arbeta på den när den
  är klar. Högerklick på en färdig Odling skickar dit en markerad Samlare.
  Är åkern upptagen går Samlaren till närmaste egna lediga Odling inom
  sökradien; finns ingen behåller den sin uppgift.
- Rivs åkern söker Samlaren upp en annan ledig Odling, annars närmaste
  bärsnår.
- Kommandopanelens knappar visar tre rader: vad knappen gör, kostnaden och
  en kort beskrivning (t.ex. "Bygg Odling / 60 trä / Oändlig mat, 1
  Samlare"). Knappar som inte ryms på en rad fortsätter på nästa.

**Fiskehyttan** (tillagt 2026-11-14) byggs av Samlare:
- Den **får bara stå intill vatten**: minst en ruta av fotavtrycket ska ha
  vatten sida vid sida med sig (hörn mot hörn räcker inte). Hyttan står på
  land.
- **Den får inte stå där den inte ger någon fiskeplats** (beslutat av
  användaren 2026-11-14): finns ingen strandruta som byggaren kan gå till
  inom hyttans räckvidd nekas platsen, med texten "Ingen fiskeplats här".
  En plats som ger en eller två fiskeplatser är tillåten.
- **Fiskeplatser:** de öppna strandrutorna (gräs med vatten på någon av
  fyra sidor) närmast hyttan, högst 3 rutor från den och **högst 3
  stycken**. En plats räknas bara om Samlaren kan gå dit; en strandremsa
  som är instängd av träd, klippor eller hyttan själv är ingen fiskeplats.
  En plats är en ruta: två hyttor som når samma strand delar på platserna.
- **En Samlare per plats.** Den står på land, vänd mot vattnet, och fiskar
  med spö. Den bär 10 åt gången till **hyttan**, inte till närmaste förråd.
  Hyttan tar bara emot fisk; bär och trä lämnas inte där.
- Den som byggde hyttan börjar fiska när den är klar. Högerklick på en
  färdig hytta skickar dit markerade Samlare. Är hyttan full går Samlaren
  till närmaste egna hytta med ledig plats inom sökradien; finns ingen
  behåller den sin uppgift.
- Rivs hyttan söker fiskarna upp en annan hytta, och blir annars
  sysslolösa eller går till närmaste bärsnår.
- Inga båtar, och ingen vägsökning på vatten.

**Vakttornet** (infört 2026-11-15 på användarens begäran; värdena är
förslag som väntar på godkännande och ligger i `BUILDING_DEFS.vakttorn`)
byggs av Samlare:
- Ett högt, smalt timmertorn på stenfot, med en plattform under ett
  spetsigt skiffertak och vimpel i lagfärg. Det står på **en ruta**.
- **Det skjuter av sig självt** på den närmaste fiendeenhet som dess sida
  ser inom **6 rutor** från tornets mitt. Det skjuter inte på byggnader,
  inte på enheter som har kapitulerat och inte medan det byggs.
- **Ett skott var 1,5:e sekund, 9 i skada** minus målets rustning (8 mot
  en Ramkrigare, 9 mot en Samlare), alltså 5–6 liv per sekund. En
  Ramkrigare gör 8,3 per sekund mot tornet, som har 500 liv: fyra
  Ramkrigare river det på 15 sekunder.
- **Pilen** flyger 12 rutor per sekund och följer sitt mål, så den träffar
  alltid om målet finns kvar. Kapitulerar målet eller lämnar det spelet
  innan pilen är framme försvinner pilen utan att skada någon.
- **Barnvänligt som resten:** ett djur som tappar allt sitt liv
  kapitulerar och går till sin grotta. Tornet skjuter inte på det sedan.
- **Synfält 8 rutor**, mer än räckvidden, så det skjuter aldrig på något
  det inte ser. Det lyser upp dimman som andra byggnader.
- **Det kan lagas** som andra byggnader (30 trä för halva livet) och ryker
  och brinner när det är skadat. Det skjuter också när det är skadat.
- **Räckvidden visas** som en gul ring på marken när tornet placeras och
  när ett eget färdigt torn är markerat. Markeringspanelen visar "Skada 9
  · Räckvidd 6".

Byggregler:
- Spelaren väljer byggnad i kommandopanelen och placerar en "spökbild" på
  kartan: byggnadens bild, halvgenomskinlig, på sitt fotavtryck. Där den
  får stå är fotavtrycket grönt. Där den inte får stå är bild och
  fotavtryck **röda**, och under fotavtrycket står en kort förklaring:
  "Platsen är upptagen", "Outforskad mark", "Måste stå intill vatten"
  eller "Ingen fiskeplats här". För en Fiskehytta som får stå visas i stället antalet
  fiskeplatser ("3 fiskeplatser") och en ring på varje plats. Giltigt =
  alla rutor gångbara, utforskade och fria från
  enheter/byggnader/resurser.
- Kostnaden dras när bygget placeras. Bygget börjar på 10 % av sitt liv och växer
  medan arbetare bygger. Fler arbetare bygger snabbare (varje extra arbetare
  ger +50 % av en arbetares takt).
- En ofärdig byggnad har ingen funktion.
- Produktionskö: högst 5 enheter per byggnad. Kostnaden dras när enheten
  köas och återbetalas om den avbryts.
- Nya enheter dyker upp på närmaste lediga ruta intill byggnaden.
- Byggnader anfaller inte.

**Lagning** (infört 2026-11-15 på användarens begäran; värdena är förslag
som väntar på godkännande och ligger i `src/data/repair.ts`):
- **Vem:** Samlare lagar egna färdiga byggnader som har förlorat liv. Ett
  bygge under uppförande byggs, det lagas inte.
- **Order:** högerklick (eller tryck) på den skadade byggnaden med Samlare
  markerade, eller knappen "Laga" sist i Samlarens meny. Knappen skickar
  de markerade till den skadade byggnad som ligger närmast och visar vad
  det kostar och vilken byggnad det gäller ("ca 75 trä", "Storide, 50 %
  liv"). Är inget skadat är knappen nedtonad med texten "Inget är skadat".
- **Markören** blir en hammare över en skadad egen byggnad när Samlare är
  markerade, alltså precis när ett högerklick skulle ge en lagning.
- **Kostnad:** trä, i proportion till det liv som lagas. En full lagning,
  från inget liv till allt, kostar **halva byggnadens pris**: Visthus 40,
  Krigshall 75, Ide 15, Odling 30, Fiskehytta 50. Storidet har inget pris
  och räknas som 300 trä: 150 för en full lagning. Träet dras ett i taget
  medan arbetet pågår, inte i förskott. Det ger 7–20 liv per trä.
- **Slut på trä:** arbetet står still, Samlarna står kvar med hammaren
  nere, och meddelandet "Slut på trä – lagningen väntar" visas i 2,5 s
  medan träsiffran är röd. När trä kommer in fortsätter de utan ny order.
- **Takt:** en Samlare lagar **6 liv per sekund**. Det är långsammare än
  att bygga nytt, där en Samlare ger 9–18 liv per sekund. Varje
  ytterligare Samlare ger 60 % av vad den förra gav: två gör 1,6 Samlares
  arbete, tre 1,96, och hur många de än är blir det aldrig 2,5.
- **Platser:** varje Samlare tar en egen ledig ruta intill byggnaden (också
  i hörnen), den närmaste den kan gå till. De som inte får plats fortsätter
  med det de gjorde.
- **Avbrott:** en ny order avbryter lagningen. Det liv som har lagats
  finns kvar och inget betalas tillbaka. Lagningen kan tas upp igen av
  vem som helst och kostar då bara det som återstår.
- **Efteråt** blir Samlarna sysslolösa. Lagade de en Odling eller en
  Fiskehytta börjar de arbeta där.
- **Skadan syns:** under 50 % liv ryker byggnaden, under 25 % brinner den
  också. Se avsnitt 11.

## 9. Karta och krigsdimma

- Fast storlek: 64×64 rutor, isometrisk (romb), ruta 64×32 px.
- Terräng: gräs (gångbar), träd (blockerar, resurs), bärsnår (blockerar,
  resurs), klippa och vatten (blockerar).
- Kartan genereras från ett frö (`?seed=N`) och är punktspeglad kring mitten
  så att båda sidor får likvärdiga förutsättningar. Utan `seed` används ett
  fast standardfrö i MVP:n, så alla spelar samma karta.
- Spelaren börjar i ena hörnet, AI:n i det motsatta. Varje startplats har
  1 Storide, 3 Samlare, bärsnår och skog inom 8 rutor.
- **Rättvis start (beslutat av användaren 2026-11-14):** båda sidor har
  likvärdig tillgång till vatten, trä och bär, för alla frön. Varje
  startplats har därför en egen damm 7–11 rutor bort, med plats för en
  Fiskehytta med alla tre fiskeplatserna inom 13 rutor från Storidet.
  Marken närmast dammen hålls fri från skog, klippor och grottor. Eftersom
  kartan är punktspeglad har motståndaren exakt samma sak på samma
  avstånd. Ett test prövar det över 40 frön.
- Varje sida har 2 grottor på sin halva av kartan (avsnitt 15).
- **Krigsdimma, tre lägen per ruta:**
  - *Outforskad:* helt svart.
  - *Utforskad:* terrängen syns nedtonad (50 % mörkare). Fiendens enheter
    och byggnader syns inte.
  - *Synlig:* inom synfältet för någon egen enhet/byggnad. Allt syns.
- Synfält räknas som cirkulärt avstånd i rutor. Terräng skymmer inte sikten.

## 10. AI-motståndare (MVP)

En enkel, regelstyrd motståndare som spelar med samma regler och kostnader
som spelaren (inget fusk med resurser):

1. Tränar Samlare upp till 8 och fördelar dem på mat och trä.
2. Bygger ett Ide när den har högst 3 lediga platser kvar (enheter i kö
   inräknade), så att träningen inte behöver vänta på en bostad. Bostäder
   går före allt annat byggande.
3. Bygger en Krigshall när den har råd, och ett Visthus vid skogen.
4. Bygger Odlingar **innan bären tar slut**: när bärsnåren inom 14 rutor
   från Storidet har mindre än 600 mat kvar bygger den en Odling för varje
   150 mat som fattas, högst 5, och ställer en ledig Samlare på varje.
   Lediga Samlare tar i första hand bär nära basen, sedan en ledig Odling
   och först därefter bär längre bort. Värdena ligger i `AI_CONFIG.fields`.
   **Har den vatten inom räckhåll** (en plats vid vatten högst 18 rutor
   från Storidet, som dess Samlare kan gå till och som ger alla tre
   fiskeplatser) bygger den först en Fiskehytta, högst en, och räknar
   den som tre Odlingar. Samlare som plockar bär långt från basen flyttas
   till en ledig fiskeplats eller Odling. Värdena ligger i
   `AI_CONFIG.fishing`.
   **Lagar** när basen är i fred: finns ingen fiende inom 12 rutor från
   Storidet lagar den sina färdiga byggnader som har under 90 % liv, den
   värst skadade först och en i taget, med 2 Samlare, tills byggnaden är
   hel. Den börjar inte med mindre än 20 trä. Kommer en fiende nära, eller
   tar träet slut, går Samlarna tillbaka till att samla. Värdena ligger i
   `AI_CONFIG.repair`.
   **Bygger ett Vakttorn** när den har en Krigshall och minst 150 trä i
   lager: 6 rutor från Storidets mitt, på sidan mot fienden. Högst ett
   torn per match; ett torn som faller ersätts inte. Värdena ligger i
   `AI_CONFIG.towers`.
5. Tränar Ramkrigare kontinuerligt.
6. Skickar anfallsvågor mot spelarens Storide. Vågornas storlek och tidpunkt
   ligger i en datafil (t.ex. våg 1: 4 krigare tidigast vid 4 min, därefter
   större vågor).
   Krigare i en våg **river först ett torn som når dem**: står en krigare
   inom ett fientligt torns räckvidd anfaller den tornet innan den går
   vidare mot Storidet. Fientliga krigare i närheten går fortfarande före.
7. Hemmavarande krigare försvarar basen om den anfalls.

Förenkling: AI:n känner till spelarens startposition och påverkas inte av
krigsdimman. En svårighetsgrad.

### Uttryckliga förenklingar i MVP:n
- **Ändrat 2026-11-13 på användarens begäran:** enheter har en
  kollisionsradie och håller avstånd till varandra, se avsnitt 7. Den
  ursprungliga förenklingen löd:
- ~~Enheter kolliderar inte med varandra. De kan stå på samma ruta, men sprids
  ut till närliggande lediga rutor när de stannar.~~
- Ingen formation: en grupp som flyttas går till rutor runt målpunkten.
  (Ändrat 2026-11-13: gruppen ställer sig på varannan ruta, så att det är
  luft mellan enheterna.)
- Terräng påverkar varken sikt eller fart.

## 11. Spelkänsla (konkreta mål)

| Händelse | Återkoppling |
|---|---|
| Enhet markeras | Grön ellips under enheten, syns samma bildruta som klicket |
| Dragruta | Grön kontur 1 px med 20 % fyllning, följer pekaren utan fördröjning |
| Flytt-/attackorder | Ring vid målet (grön = flytta, röd = attack) som krymper och tonas bort på 400 ms |
| Träff | Målet blinkar vitt i 80 ms; anfallaren gör ett utfall på 4 px mot målet under 100 ms |
| Skadad enhet/byggnad | Livstapel visas ovanför (grön > 50 %, gul > 25 %, röd annars) |
| Enhet kapitulerar | En vit flagga visas på enheten medan den går till grottan |
| Enhet går in i en grotta, eller försvinner för att grottorna är fulla | Tonas bort på 300 ms |
| Färdig byggnad under 50 % liv | Rök: en pelare per ruta av byggnadens sida (2 eller 3), med 3 puffar var. En puff stiger 44 px på 2,2 s, växer från 70 % till 150 % av sin storlek och tunnas ut till ingenting |
| Färdig byggnad under 25 % liv | Eld under varje rökpelare: fyra bilder som växlar var 110:e ms, ritade i 130 % storlek |
| Lagning | Samlarna slår med hammaren (samma slag som vid bygge); livstapeln växer; ring vid byggnaden när ordern ges |
| Lagning möjlig | Muspekaren blir en hammare över byggnaden; knappen "Laga" är tänd och visar kostnaden |
| Slut på trä under lagning | "Slut på trä – lagningen väntar" i 2,5 s, träsiffran röd lika länge, Samlarna står still |
| Torn skjuter | En pil med fjädrar i lagfärg lämnar tornets plattform (72 px över marken), flyger i en båge som är 4 px högre per ruta den ska flyga, pekar åt det håll den flyger, och landar i brösthöjd (14 px) på målet |
| Pil träffar | Målet blinkar vitt i 80 ms; en splitterstjärna visas på målet i 220 ms medan den växer från 70 % till 160 % och tonas bort |
| Torn markerat eller placeras | Gul ring på marken med tornets räckvidd (6 rutor) |
| Byggnad förstörs | Skärmen skakar 150 ms med 4 px amplitud om byggnaden är i bild |
| Egen bas anfalls | Texten "Din bas anfalls!" i överkant i 3 s, högst en gång per 10 s |
| Ogiltig byggplats | Spökbilden är röd; klick gör ingenting |
| För lite resurser | Resurssiffran som saknas blinkar rött i 300 ms; inget köas |
| Kamera | Tangentpanorering 900 px/s; kantpanorering inom 20 px från skärmkanten; stannar vid kartans kant |
| Orderrespons | En order syns på enheten (den börjar röra sig) inom 100 ms |

Simuleringen går i fast takt, 20 steg per sekund. Renderingen interpolerar
positioner så att rörelsen ser mjuk ut i 60 bilder/s.

## 12. Visuell stil

- **Mål (efter MVP):** heroisk fantasy med handmålad känsla. Upprättgående
  djurkrigare i pansar, tydliga silhuetter per ras, varm och mättad palett.
- **MVP: platshållargrafik.** Rutor som färgade romber, träd som gröna
  trianglar, bärsnår som röda cirklar, Samlare som liten cirkel, Ramkrigare
  som större fyrkant, byggnader som färgade block med en bokstav (S, V, K).
  Lagfärg: spelare blå, fiende röd.
- **Efter MVP:n: miljön ritas med bilder** från figurpipelinen, i samma
  låg-poly-stil som byggnaderna och efter samma skalstandard:
  - Tre sorters träd (två granar, ett lövträd) och tre sorters klippor,
    blandade efter rutans plats så att en skog inte ser upprepad ut.
  - **Källor syns minska.** Ett bärsnår är fullt av bär tills hälften är
    plockad, har sedan få bär, och står kvar som en buske utan bär när
    det är tomt. Ett fällt träd lämnar en stubbe. Det som blir kvar är
    bara bild: enheter går över det, och det går inte att samla från.
  - Vatten med vågstreck och en mjuk övergång mot land i stället för en
    skarp kant: vattnet ljusnar de sista 0,3 rutorna (cirka 9 px) mot
    stranden, sedan en ljus bränning, 0,12 ruta sand (cirka 3 px) och
    sand som tonar ut över ytterligare 0,14 ruta (cirka 4 px) av gräset.
  - **Fiskeplatser** vid en färdig Fiskehytta är märkta på stranden med
    trampad sand och en hink.
  - Grottan är en klippa med mörk öppning och en vimpel i ägarens färg.
  - **Korgen visar vad Samlaren bär:** vedträn, bär, fiskar eller kärvar.
  - Gräset är fortfarande en enfärgad romb med rutnät.
- Speltext på svenska, samlad i en strängfil så att den kan översättas senare.

## 13. Ingår INTE i MVP:n

- Fler raser än björnar, rasunika enheter eller bonusar
- Tidsåldrar, uppgraderingar, forskning
- Distansenheter, belägringsvapen, hjältar/ledare som enheter
- Torn, murar, fler byggnadstyper (Odlingen och Fiskehyttan tillkom
  2026-11-14, se avsnitt 6 och 8)
- Båtar och allt annat på vatten
- ~~Bostadshus som höjer befolkningstaket (planerat efter MVP, maxtak ca
  250)~~ Infört 2026-11-14 med ett hårt tak på 50, samma dag höjt till
  200, se avsnitt 6 och 8.
- Fler resurser än mat och trä
- Riktig grafik, animationer, ljud och musik
- Minikarta, kontrollgrupper (Ctrl+1 …), patrull/håll position, formationer
- ~~Kollision mellan enheter~~ (tillagt 2026-11-13, se avsnitt 7)
- Rekrytering ur grottor, ledarrang och de 50 extra befolkningsplatserna
  (avsnitt 15)
- Flerspelarläge, spara/ladda, kampanj, flera kartor, kartredigerare
- Svårighetsgrader, AI som spanar eller påverkas av krigsdimma
- Zoom, inställningsmeny, översättningar

## 14. Beslut vid godkännandet (2026-11-12)

1. **Pekskärm.** Enkel pekstyrning ingår i MVP:n (panorering i fas 1,
   markering och order i fas 10). Spelet optimeras för mus och tangentbord.
2. **Språk.** Speltext och dokument på svenska, kod och kodkommentarer på
   engelska.
3. **Arbetsnamnet "AnimalPlanet".** Sammanfaller med TV-kanalen Animal
   Planets varumärke. Fungerar som arbetsnamn och reponamn, men bör bytas
   innan spelet sprids offentligt.
4. **Befolkningstak.** Fast tak på 30 i MVP:n. Senare tillkommer bostadshus
   som höjer taket, med ett maxtak på omkring 250. Taket ligger i en datafil
   så att det kan ändras utan kodändring. **Ändrat 2026-11-14:** bostäder
   finns nu, och det hårda taket är 200 per sida (först 50). Se avsnitt 6.
5. **Kartan.** Genererad från frö med ett fast standardfrö.

## 15. Kapitulation och grottor

Beslutat 2026-11-12. Spelet ska vara barnvänligt: **inga djur dör i strid.**

### I MVP:n (fas 7)

**Kapitulation**
- När en enhets liv når 0 kapitulerar den. Den slutar med det den gjorde,
  får en vit flagga och går i sin vanliga fart till närmaste egna grotta
  som har en ledig plats. Framme vid grottan går den in och är borta från
  kartan.
- En kapitulerad enhet kan inte anfallas, inte ges order och inte markeras
  med dragruta. Fiender bryr sig inte om den.
- Den räknas inte längre i befolkningen, så en ersättare kan tränas direkt.
- Platsen i grottan reserveras i samma stund som enheten kapitulerar, så
  att flera som kapitulerar samtidigt inte kan överfylla en grotta.
- Har ingen av sidans grottor en ledig plats, eller går ingen av dem att
  nå, försvinner enheten direkt. Den kan då aldrig rekryteras.

**Grottor**
- Varje **sida** har egna grottor. I MVP:n är båda sidor björnar, och med
  delade grottor skulle rekrytering ge tillbaka även fiendens djur. När fler
  raser finns blir det i praktiken en uppsättning grottor per ras.
- 2 grottor per sida, 12 platser i varje, alltså 24 platser per sida.
- Kartgenereringen placerar grottorna på sidans halva av kartan, speglade
  mellan sidorna och nåbara från startplatsen.
- En grotta upptar en ruta och går inte att gå igenom. Den kan inte
  anfallas, och ingenting får byggas på den eller på rutorna runt den.
- Grottan minns vilka slags djur som finns i den, inför rekryteringen.

**Byggnader** rasar som förut när deras liv tar slut, och vinstvillkoret är
oförändrat: förstör fiendens Storide.

**Ordval:** gränssnittet säger "Liv", inte "HP".

### Efter MVP:n

- Den som har kommit långt i spelet och räknas som en **stor/mäktig ledare**
  kan rekrytera tillbaka djur ur sina egna grottor.
- Rekrytering ger högst **50 extra i befolkning**, räknat separat från den
  vanliga befolkningen.

Öppet tills rekryteringen ska byggas:
1. Vad som räknas som en stor/mäktig ledare. Det behöver en mätbar
   definition, t.ex. en viss tidsålder. MVP:n har ingen sådan mätare.
2. Om rekrytering kostar något, hur lång tid den tar och var djuret dyker
   upp.
3. Om ett återrekryterat djur som kapitulerar igen får gå tillbaka till en
   grotta.
