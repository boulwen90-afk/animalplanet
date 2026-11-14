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
| Kommando (flytta/attackera/samla) | Tryck på mål när enheter är markerade |
| Avmarkera | Knappen "Avmarkera" i HUD:en |

### HUD
- **Överkant:** mat, trä, befolkning (t.ex. `12/30`).
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
| Trä | Träd | 100 | Byggnader, soldater |

- Källor är ändliga och försvinner när de är tömda. Tömda träd blir gångbar mark.
- **Arbetsplatser:** varje källa har upp till 4 fasta arbetsplatser, på de
  öppna rutorna runt den. En arbetare tar en ledig plats och behåller den
  medan den bär hem lasten. Är alla platser tagna går arbetaren till
  närmaste källa av samma slag som har en ledig.
- Arbetare bär högst 10 enheter åt gången, samlar 1 enhet/s och måste lämna
  lasten vid Storide eller Visthus innan resursen räknas.
- Startresurser: 200 mat, 100 trä.
- Befolkningstak: fast 30 i MVP:n (inga bostadshus). Efter MVP:n höjs taket
  med bostadshus, upp till ett maxtak på omkring 250.

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

| | Storide (huvudbyggnad) | Visthus (förråd) | Krigshall (kasern) |
|---|---|---|---|
| Funktion | Tränar Samlare, avlämningsplats | Avlämningsplats nära resurser | Tränar Ramkrigare |
| Kostnad | – (finns från start) | 80 trä | 150 trä |
| Byggtid (1 arbetare) | – | 20 s | 35 s |
| Liv | 1500 | 400 | 700 |
| Storlek | 3×3 rutor | 2×2 rutor | 3×3 rutor |
| Synfält | 9 rutor | 5 rutor | 6 rutor |

Byggregler:
- Spelaren väljer byggnad i kommandopanelen och placerar en "spökbild" på
  kartan: grön om platsen är giltig, röd annars. Giltigt = alla rutor
  gångbara, utforskade och fria från enheter/byggnader/resurser.
- Kostnaden dras när bygget placeras. Bygget börjar på 10 % av sitt liv och växer
  medan arbetare bygger. Fler arbetare bygger snabbare (varje extra arbetare
  ger +50 % av en arbetares takt).
- En ofärdig byggnad har ingen funktion.
- Produktionskö: högst 5 enheter per byggnad. Kostnaden dras när enheten
  köas och återbetalas om den avbryts.
- Nya enheter dyker upp på närmaste lediga ruta intill byggnaden.
- Byggnader anfaller inte.

## 9. Karta och krigsdimma

- Fast storlek: 64×64 rutor, isometrisk (romb), ruta 64×32 px.
- Terräng: gräs (gångbar), träd (blockerar, resurs), bärsnår (blockerar,
  resurs), klippa och vatten (blockerar).
- Kartan genereras från ett frö (`?seed=N`) och är punktspeglad kring mitten
  så att båda sidor får likvärdiga förutsättningar. Utan `seed` används ett
  fast standardfrö i MVP:n, så alla spelar samma karta.
- Spelaren börjar i ena hörnet, AI:n i det motsatta. Varje startplats har
  1 Storide, 3 Samlare, bärsnår och skog inom 8 rutor.
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
2. Bygger en Krigshall när den har råd, och ett Visthus vid skogen.
3. Tränar Ramkrigare kontinuerligt.
4. Skickar anfallsvågor mot spelarens Storide. Vågornas storlek och tidpunkt
   ligger i en datafil (t.ex. våg 1: 4 krigare tidigast vid 4 min, därefter
   större vågor).
5. Hemmavarande krigare försvarar basen om den anfalls.

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
- Speltext på svenska, samlad i en strängfil så att den kan översättas senare.

## 13. Ingår INTE i MVP:n

- Fler raser än björnar, rasunika enheter eller bonusar
- Tidsåldrar, uppgraderingar, forskning
- Distansenheter, belägringsvapen, hjältar/ledare som enheter
- Torn, murar, fler byggnadstyper
- Bostadshus som höjer befolkningstaket (planerat efter MVP, maxtak ca 250)
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
   så att det kan ändras utan kodändring.
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
