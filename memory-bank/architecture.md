# AnimalPlanet – arkitektur

Beskriver hur koden **faktiskt** är uppbyggd. Uppdateras efter varje
avslutad fas. Planerad arkitektur står i `tech-stack.md`; det här dokumentet
beskriver bara det som finns i repot.

Senast uppdaterad: fas 6.

## Översikt

Tre lager, med beroenden bara nedåt i listan:

1. `src/render/` och `src/testing/` – Phaser, inmatning, testgränssnitt.
2. `src/sim/` – ren TypeScript utan Phaser, DOM eller `window`.
3. `src/data/` – typade konstanter (spelsiffror).

ESLint stoppar import av Phaser, `render/` och `testing/` i `src/sim/`, liksom
`window`, `document`, `Math.random` och `Date.now` där.

Efter fas 6 finns enheter och byggnader i simuleringen, vägsökning,
förflyttning, resursinsamling, enhetsproduktion och byggande via kommandon,
lager per sida, samt markering, markeringspanel, resursrad, kommandopanel
och byggplacering i gränssnittet. Strid, krigsdimma och AI saknas ännu.

Allt som ändrar spelet går via `applyCommand`. Markeringen (vilka enheter
som är valda) är gränssnittstillstånd och ligger i `render/`, inte i
`GameState`.

## Filer och ansvar

| Fil | Ansvar | Fas |
|---|---|---|
| `index.html` | Sida med `#game`-behållare i helskärm | 1 |
| `src/main.ts` | Läser `?test=1` och `?seed=N`, startar Phaser med `GameScene` | 1, 2 |
| `src/data/map.ts` | `MAP_CONFIG` (kartstorlek, rutstorlek) och `MAP_GEN_CONFIG` (kartgenerering, standardfrö) | 1, 2 |
| `src/data/camera.ts` | `CAMERA_CONFIG`: panoreringsfart, kantmarginal, längsta bildrutetid | 1 |
| `src/data/sim.ts` | `SIM_CONFIG`: steg per sekund, flest steg per bildruta. `TICK_MS` | 2 |
| `src/data/terrain.ts` | `TERRAIN_DEFS`: terrängtyper, om de är gångbara och vilken resurs de ger. Typen `Terrain` | 2, 4 |
| `src/data/resources.ts` | `RESOURCE_DEFS` (mängd per källa), `GATHER_CONFIG` (sökradie). Typerna `ResourceType` och `Cost` | 4, 6 |
| `src/data/types.ts` | Namnen på enhets- och byggnadstyper (`UnitType`, `BuildingType`) | 6 |
| `src/data/units.ts` | `UNIT_DEFS`: enhetstyper (kostnad, träningstid, HP, fart, bärförmåga, insamlingstakt, vad de kan bygga) | 3, 4, 5, 6 |
| `src/data/buildings.ts` | `BUILDING_DEFS`: byggnadstyper (vad de tränar, HP, storlek, avlämningsplats, kostnad, byggtid). `CONSTRUCTION_CONFIG` (start-HP, extra arbetares takt) | 3, 4, 5, 6 |
| `src/data/production.ts` | `PRODUCTION_CONFIG`: längsta produktionskö | 5 |
| `src/data/setup.ts` | `START_CONFIG`: startbyggnad, startenheter, startresurser, befolkningstak | 3, 4 |
| `src/data/ui.ts` | `UI_CONFIG`: dragtröskel, orderringens livslängd och storlek, blinktid vid nekad order | 3, 5 |
| `src/data/strings.ts` | `STRINGS`: all speltext | 3 |
| `src/sim/state.ts` | Typerna `GameState`, `PlayerState`, `Unit`, `UnitTask`, `Building`, `Entity`, `PlayerId` | 2, 3, 4 |
| `src/sim/game.ts` | `createGame(seed)`: skapar ett nytt speltillstånd med karta, Storide och Samlare per sida | 2, 3 |
| `src/sim/tick.ts` | `tick(state)` och `advance(state, steps)` | 2, 3 |
| `src/sim/entities.ts` | Skapa och slå upp enheter och byggnader, byggnaders rutor och mittpunkt | 3 |
| `src/sim/commands.ts` | Typerna `Command` och `CommandResult`, och `applyCommand` | 3, 4, 5 |
| `src/sim/economy.ts` | Kostnader: vad som saknas, betala, återbetala | 5 |
| `src/sim/systems/production.ts` | `produceUnits` (träning), `queueUnit`, `cancelQueuedUnit` | 5 |
| `src/sim/systems/construction.ts` | `constructBuildings` (byggande), `canPlaceBuilding`, `placeBuilding`, `assistConstruction` | 6 |
| `src/sim/resources.ts` | Resurskällor på kartan: slå upp, ta från, startmängder | 4 |
| `src/sim/systems/gathering.ts` | `gatherResources` (insamlingsloopen) och `startGathering` | 4 |
| `src/sim/systems/movement.ts` | `moveUnits`: flyttar enheter längs deras väg | 3 |
| `src/sim/pathfinding/astar.ts` | `findPath` (A*), `nearestReachable`, `reachableTiles`, `canStep`, typen `PathGrid` | 3, 4 |
| `src/sim/pathfinding/passability.ts` | `buildPathGrid` (gångbara rutor just nu) och `nearestFreeTiles` | 3 |
| `src/sim/testUtils.ts` | Små kartor från teckenrader, för enhetstester | 3 |
| `src/sim/clock.ts` | Fast tidssteg: gör om bildrutetid till ett helt antal steg | 2 |
| `src/sim/rng.ts` | Frösatt slumpgenerator (mulberry32) och `parseSeed` | 2 |
| `src/sim/map/iso.ts` | Isometrisk matematik: ruta ↔ världspixlar, begränsning till kartan | 1 |
| `src/sim/map/grid.ts` | Typen `GameMap`, rutuppslag, gångbarhet, spegling, avstånd, `isReachable` | 2 |
| `src/sim/map/mapgen.ts` | `generateMap`: kartgenerering | 2 |
| `src/render/scenes/GameScene.ts` | Skapar spelet, vyerna och styrningen, driver simuleringen, registrerar testgränssnittet | 1, 2, 3 |
| `src/render/scenes/UiScene.ts` | Gränssnittet ovanpå spelet: resursraden, markeringspanelen och kommandopanelen | 3, 4, 5 |
| `src/render/views/MapView.ts` | Ritar mark, träd, bärsnår och klippor; tar bort tömda källor | 1, 2, 4 |
| `src/render/views/EntityView.ts` | Ritar enheter och byggnader, interpolerar rörelse, ritar markeringar | 3 |
| `src/render/views/SelectionView.ts` | Ritar dragrutan och orderringar | 3 |
| `src/render/views/PlacementView.ts` | Ritar konturen av en byggnad som placeras | 6 |
| `src/render/views/visuals.ts` | Platshållargrafikens mått och färger, delade av ritning och klickträffar | 3 |
| `src/render/input/CameraController.ts` | Kamerapanorering med tangenter, skärmkant, mittenknapp och finger | 1 |
| `src/render/input/SelectionController.ts` | Mus och tangentbord: markering, dragruta, order (flytta, samla, hjälpa till att bygga) | 3, 4, 6 |
| `src/render/input/PlacementController.ts` | Byggplacering: kontur som följer musen, klick placerar, högerklick och Esc avbryter | 6 |
| `src/render/input/selection.ts` | Markeringsregler som rena funktioner | 3 |
| `src/render/input/picking.ts` | Vilken enhet, byggnad eller resurskälla som ligger under en punkt eller i en ruta | 3, 4 |
| `src/render/ui/selectionInfo.ts` | Texten i markeringspanelen | 3 |
| `src/render/ui/layout.ts` | Var resursraden och markeringspanelen ligger på skärmen | 3, 4 |
| `src/render/ui/commandPanel.ts` | Kommandopanelens innehåll, placering och klickträffar | 5 |
| `src/testing/testHooks.ts` | Typer för och installation av `window.__TEST__` | 1, 2, 3 |
| `tests/e2e/helpers.ts` | Hjälpfunktioner för Playwright | 1, 2, 3 |
| `tests/e2e/phase1-map-camera.spec.ts` | Webbläsartester för fas 1 | 1 |
| `tests/e2e/phase2-terrain.spec.ts` | Webbläsartester för fas 2 | 2 |
| `tests/e2e/phase3-units.spec.ts` | Webbläsartester för fas 3 | 3 |
| `tests/e2e/phase4-gathering.spec.ts` | Webbläsartester för fas 4 | 4 |
| `tests/e2e/phase5-training.spec.ts` | Webbläsartester för fas 5 | 5 |
| `tests/e2e/phase6-building.spec.ts` | Webbläsartester för fas 6 | 6 |
| `.github/workflows/ci.yml` | Lint, Vitest, bygge och Playwright på pull requests | 1 |
| `.github/workflows/deploy.yml` | Lint, Vitest, bygge och publicering till GitHub Pages vid push till `main` | 1 |

## Koordinatsystem

Definieras i `src/sim/map/iso.ts`.

- **Rutkoordinater** är kontinuerliga. Ruta `(tx, ty)` täcker
  `[tx, tx+1) × [ty, ty+1)`. Heltalspunkten `(tx, ty)` är rutans övre hörn
  och `(tx+0.5, ty+0.5)` dess mitt.
- **Världspixlar:** övre hörnet av ruta `(0, 0)` ligger i origo, x växer åt
  höger och y nedåt. `x = (tx − ty) · 32`, `y = (tx + ty) · 16`.
- Rutans x-axel pekar alltså ned åt höger på skärmen och y-axeln ned åt
  vänster. Kartans hörn: `(0,0)` överst, `(64,0)` till höger, `(0,64)` till
  vänster, `(64,64)` nederst.
- Spelaren startar vid ruta `(9, 54)` (vänstra hörnet på skärmen) och
  motståndaren vid `(54, 9)` (högra hörnet).

## Simulering (`src/sim/`)

### Tillstånd

`GameState` är ren data (går att kopiera med `structuredClone` och jämföra):

| Fält | Innehåll |
|---|---|
| `seed` | Fröet spelet skapades från |
| `tick` | Antal körda simuleringssteg |
| `rng` | Slumpgeneratorns tillstånd (`{ s }`) |
| `map` | `GameMap`: `width`, `height`, `terrain` (rad för rad, index `y · width + x`), `resourceAmount` (enheter kvar i varje rutas källa, samma index), `startPositions` (0 = spelaren, 1 = motståndaren) |
| `players` | En `PlayerState` per sida: `resources` (`food`, `wood`) |
| `entities` | Alla enheter och byggnader, i den ordning de skapades |
| `nextEntityId` | Id för nästa entitet. Id:n återanvänds aldrig |

`Unit`: `id`, `kind: 'unit'`, `type`, `owner`, `x`/`y` (kontinuerliga
rutkoordinater, rutans mitt är `+0.5`), `prevX`/`prevY` (läget före senaste
steget, för interpolation), `hp`, `path` (rutor kvar att gå, nästa först),
`task` (vad enheten gör utöver att gå), `carryType` och `carryAmount`
(buren resurs).

`UnitTask` är `{ kind: 'idle' }`, en `BuildTask` (`buildingId`) eller en
`GatherTask`: `resource`, `node`
(källans ruta), `phase` (`toSource`, `gathering`, `toDropoff`),
`workTicks` (steg arbetade mot nästa enhet) och `dropoffId`.

`Building`: `id`, `kind: 'building'`, `type`, `owner`, `x`/`y` (rutan i
fotavtryckets hörn med lägst x och y), `hp`, `complete` (falskt medan
byggnaden byggs), `buildProgress` (utfört arbete i arbetarsteg), `queue` (enhetstyper som
väntar på träning, den första tränas just nu; alla är redan betalda) och
`trainTicks` (steg nedlagda på den första). Storleken står i
`BUILDING_DEFS`. Storiden är 3×3 och centrerad på sidans startposition.
Visthuset är 2×2 och Krigshallen 3×3. En ofärdig byggnad har ingen funktion
men blockerar sina rutor. Under bygget är `hp` ett decimaltal; det avrundas
när byggnaden blir klar och när det visas.

Terrängtyper: `grass` (gångbar), `tree`, `berries`, `rock`, `water` (blockerar).

### Tidssteg

- `tick(state)` kör ett steg: `produceUnits`, `constructBuildings`,
  `gatherResources`, `moveUnits`, och sedan ökas `state.tick`. System för
  strid m.m. läggs till här i fast ordning.
- `consumeSteps(clock, elapsedMs, stepMs, maxSteps)` samlar bildrutetid och
  ger antalet steg som ska köras. Resten sparas till nästa bildruta. Fler än
  `maxTicksPerFrame` (5) steg per bildruta körs aldrig; överskjutande tid
  kastas.
- 20 steg/s, alltså 50 ms per steg (`TICK_MS`).

### Kommandon

`applyCommand(state, command)` är den enda vägen in i simuleringen för
spelare, AI och tester. Kommandon utförs direkt, mellan två steg.

Svaret är en `CommandResult`: `{ ok: true }`, eller `{ ok: false, reason }`
där `reason` är `insufficientResources` (med `missing`, listan över resurser
som fattas), `populationCap`, `queueFull`, `invalidPlacement` eller
`invalid`. En nekad order
ändrar ingenting i tillståndet.

| Kommando | Fält | Verkan |
|---|---|---|
| `move` | `player`, `unitIds`, `x`, `y` (målruta) | Spelarens egna enheter i listan får en väg till målet. Avbryter pågående insamling; lasten behålls |
| `gather` | `player`, `unitIds`, `x`, `y` (källans ruta) | Spelarens egna enheter i listan börjar samla från källan. Ingen verkan om rutan saknar resurs |
| `train` | `player`, `buildingId`, `unit` | Lägger enheten i byggnadens kö och drar kostnaden direkt |
| `cancelTrain` | `player`, `buildingId`, `index` (plats i kön) | Tar bort enheten ur kön och återbetalar hela kostnaden |
| `build` | `player`, `unitIds`, `building`, `x`, `y` (fotavtryckets lägsta hörn) | Placerar ett bygge, drar kostnaden och skickar enheterna att bygga |
| `construct` | `player`, `unitIds`, `buildingId` | Skickar enheterna att hjälpa till med ett pågående bygge |

Så fördelas en grupp vid `move`:
1. Målrutan begränsas till kartan. Är den ett hinder blir samlingspunkten
   den nåbara ruta som ligger närmast (`nearestReachable`, räknat från
   enheten med lägst id).
2. `nearestFreeTiles` ger en ruta per enhet kring samlingspunkten. Rutor där
   andra enheter står eller är på väg hoppas över.
3. Varje enhet tar den lediga ruta som ligger närmast den själv och får sin
   väg med `findPath`.

### Vägsökning

- `findPath(grid, from, to)`: A* i åtta riktningar. Raka steg kostar 10 och
  diagonala 14. Ett diagonalt steg kräver att båda rutorna det passerar
  mellan är fria, så enheter skär aldrig ett hinders hörn. Lika bra vägar
  avgörs av ordningen de hittades i, så resultatet är alltid detsamma.
- Resultatet är rutorna att gå igenom, utan startrutan och med målet sist.
  Tom lista betyder "redan framme" eller "går inte att nå".
- Är målet ett hinder eller utanför kartan går vägen till närmaste nåbara
  ruta. Bland rutor lika nära målet väljs den med färst steg från starten,
  så en enhet som skickas mot ett träd stannar på sin egen sida av det.
- Är målet fri mark som inte går att nå blir vägen tom och enheten står kvar.
- `buildPathGrid(state)` räknar ut hindren: icke gångbar terräng och
  byggnaders fotavtryck. Enheter blockerar inte (GDD avsnitt 10). Rutnätet
  byggs om vid varje kommando och sparas inte.
- Vägar räknas inte om när kartan ändras. Ett träd som försvinner gör bara
  fler rutor gångbara, så befintliga vägar förblir giltiga. Nya byggnader
  kan däremot blockera en väg; då räknas berörda enheters vägar om (se
  Byggande).

### Förflyttning

`moveUnits` flyttar varje enhet `fart / 20` rutor per steg mot mitten av
nästa ruta i vägen. Sträcka som blir över när en ruta nås används mot nästa,
så farten är jämn genom hörn. Diagonala steg är √2 rutor långa och tar
motsvarande längre tid.

### Produktion

- `queueUnit` nekar i den här ordningen: fel byggnad eller enhetstyp
  (`invalid`), full kö (`queueFull`, högst 5), fullt befolkningstak
  (`populationCap`), för lite resurser (`insufficientResources`).
- Befolkningstaket (30) räknar både befintliga enheter och enheter i kö
  (`reservedPopulation`), så befolkningen kan aldrig gå över taket.
- `produceUnits` ökar `trainTicks` med 1 per steg för den första i kön. En
  Samlare tar 240 steg (12 s). Den färdiga enheten ställs på den lediga ruta
  som ligger närmast byggnadens framsida (`buildingFrontTile`), där ingen
  annan enhet står eller är på väg. Finns ingen ledig ruta väntar enheten
  färdigtränad.
- Att avbryta den enhet som tränas nollställer `trainTicks`; nästa i kön
  börjar från början.

### Byggande

- `canPlaceBuilding(state, type, x, y)`: alla rutor i fotavtrycket ska
  ligga på kartan, vara gångbar mark (alltså inte träd, bär, klippa eller
  vatten) och vara fria från byggnader och enheter. Kravet på utforskad mark
  kommer med krigsdimman i fas 8.
- `placeBuilding` nekar i den här ordningen: ingen i listan kan bygga typen
  (`invalid`), ogiltig plats (`invalidPlacement`), för lite resurser
  (`insufficientResources`). Annars dras kostnaden och ett bygge skapas med
  `complete: false` och 10 % av sina HP.
- Bygget blockerar sina rutor direkt. Alla enheter vars väg inte längre går
  att gå får en ny väg till samma mål (`rerouteBlockedUnits`).
- `constructBuildings` räknar för varje bygge de arbetare som har
  bygguppgiften, står stilla och står intill. Takten är `1 + 0,5 · (n − 1)`
  arbetarsteg per steg. Ett Visthus kräver 400 arbetarsteg (20 s för en
  arbetare, 267 steg för två, 200 för tre). HP växer i samma takt från 10 %
  till 100 %.
- När bygget är klart blir arbetarna sysslolösa. En arbetare som inte kan
  ta sig intill bygget ger upp och blir sysslolös.
- Utan arbetare står ett bygge kvar ofärdigt. Det går inte att riva eller
  avbryta.
- Bara färdiga byggnader tar emot resurser och tränar enheter.

### Resurser och insamling

- Träd ger trä (100 per källa) och bärsnår ger mat (150 per källa).
  `takeFromSource` minskar källan; vid 0 blir rutan gräs och därmed gångbar.
- Lagret (`players[i].resources`) ökar först när lasten lämnas av.
- `gatherResources` kör varje samlande enhet genom tre faser:
  1. `toSource`: gå till en ruta intill källan. Väl framme börjar arbetet.
  2. `gathering`: en enhet resurs var 20:e steg (1 per sekund) tills
     enheten bär 10.
  3. `toDropoff`: gå till sidans närmaste avlämningsbyggnad (räknat i
     rutor fågelvägen) och lämna av intill den. Sedan tillbaka till källan.
- En enhet kan byta fas flera gånger i samma steg. Står den intill både
  källa och Storide tar ett varv därför exakt 200 steg.
- **När källan tar slut:** enheten söker närmaste källa av samma slag inom
  8 rutor från sig själv, bland dem den kan gå fram till. Finns ingen
  lämnar den av det den bär och blir sedan sysslolös.
- **Vilken källa:** en källa räknas som nåbar om enheten kan stå på någon
  av de åtta rutorna runt den. Är den valda källan innesluten (ett träd mitt
  i en skog) väljs närmaste nåbara källa av samma slag inom 8 rutor.
- **Var enheten ställer sig:** på den närmaste rutan intill källan, helst
  en där ingen annan enhet står eller är på väg, så att arbetare sprider sig.
- Byter enheten resursslag tappas den gamla lasten. Saknar sidan
  avlämningsbyggnad blir enheten sysslolös med lasten kvar.
- Vägrutnätet byggs högst en gång per steg och byggs om när en källa töms.

### Slump

`rng.ts` är mulberry32 med hela tillståndet i ett tal i `GameState`.
`nextFloat`, `nextInt` och `pick` tar generatorn som argument. All slump i
`sim/` ska gå den vägen.

### Kartgenerering (`generateMap`)

1. Startplatserna kontrolleras: exakt två, punktspeglade, minst
   `startResourceRadius` från kartkanten.
2. Garanterade startresurser läggs i ringen mellan `startClearRadius` (4)
   och `startResourceRadius` (8) runt startplatsen: 6 bärsnår och 14 träd.
3. Slumpade sjöar, klippor, skogar och bärsnår växer fram som oregelbundna
   fläckar, en kantgranne i taget. Sjöar och klippor håller minst 10 rutor
   från startplatserna, skog och bär minst 4.
4. Varje ruta som sätts speglas genom kartans mitt, så kartan blir
   punktsymmetrisk.
5. Om startplatserna inte är förbundna med gångbar mark (`isReachable`,
   kantgrannar) görs ett nytt försök, högst 20. Därefter används en karta
   med enbart startresurserna.

Alla tal ligger i `MAP_GEN_CONFIG`. Antal fläckar anges per karthalva.

## Rendering (`src/render/`)

- **`GameScene`** äger speltillståndet. `create()` skapar spelet med
  `createGame(seed)`, bygger vyerna och styrningen och centrerar kameran på
  spelarens Storide. `update()` gör i tur och ordning: mäter verklig tid
  sedan förra bildrutan (högst 100 ms), kör de simuleringssteg som tiden
  räcker till, uppdaterar kameran, rensar markeringen från borttagna
  entiteter och ritar om enheter och markeringar.
- **`UiScene`** ligger ovanpå `GameScene` med egen kamera, så att
  gränssnittet står still när kartan rullar. Den hämtar sitt innehåll från
  `GameScene` via gränssnittet `HudSource`.
  - Resursraden längs överkanten visar mat, trä och befolkning (`3/30`).
  - Markeringspanelen ligger nere till vänster och syns bara när något är
    markerat. För en egen enhet visas även vad den gör, t.ex.
    `HP 40/40 · Samlar mat 7/10` eller `HP 40/40 · Bygger Visthus`. Ett
    bygge visar `HP 130/400 · Byggs 25 %`.
  - Kommandopanelen ligger bredvid markeringspanelen, eller ovanför den på
    smala skärmar. Den har två lägen:
    - En färdig egen byggnad som kan träna enheter: en träningsknapp per
      enhetstyp (namn och kostnad), fem köplatser och en förloppsstapel för
      den första i kön. Klick på en fylld köplats avbryter den enheten.
    - Egna enheter som kan bygga: en byggknapp per byggnadstyp (namn och
      kostnad), utan kö.
  - Panelens innehåll (`describeCommandPanel`), placering
    (`commandPanelLayout`) och klickträffar (`commandPanelHit`) är rena
    funktioner. `UiScene` lyssnar själv på klick och jämför mot placeringen;
    den har inga interaktiva Phaser-objekt.
  - Nekas en träningsorder blinkar den siffra i resursraden som förklarar
    varför rött i 300 ms: resursen som saknas, eller befolkningen vid fullt
    tak. Blinkningen räknas i verklig tid.
  - Knapptryckningar går via `HudSource.activateButton` och
    `HudSource.cancelQueuedUnit`. `GameScene` gör om en träningsknapp till
    ett kommando. En byggknapp startar byggplaceringen, om spelaren har råd;
    annars blinkar resurssiffran.
  - Klick på resursraden eller en panel når inte kartan.
- **`EntityView`** håller en bild per entitet och synkar mot
  `state.entities` varje bildruta (skapar nya, tar bort försvunna).
  - Enheter ritas mellan `prev` och aktuellt läge med
    `alpha = ackumulerad tid / steglängd`, så rörelsen blir mjuk i alla
    bildfrekvenser.
  - Samlare är en cirkel i lagfärg, Storiden ett block med bokstaven S.
    Spelaren är blå, motståndaren röd.
  - Djup = skärmhöjden för enhetens markpunkt respektive byggnadens mitt,
    samma regel som träden i `MapView`.
  - Markerade enheter får en grön ellips på marken, markerade byggnader en
    grön kontur runt fotavtrycket.
  - En byggnad under uppförande är genomskinlig (35 %) och blir solid i takt
    med bygget. Visthuset har bokstaven V, Krigshallen K.
  - En enhet som bär något får en liten fyrkant uppe till höger: röd för
    mat, brun för trä.
- **`PlacementController`** styr byggplaceringen. Medan den är aktiv följer
  en kontur av fotavtrycket musen, med byggnadens mitt under pekaren: grön
  där byggnaden får stå, röd annars. Vänsterklick på giltig plats skickar
  `build` med de markerade byggarna och avslutar läget. Klick på ogiltig
  plats gör ingenting. Högerklick och Esc avbryter. Läget avbryts också om
  ingen markerad enhet längre kan bygga typen.
  - Den måste skapas **efter** `SelectionController`. Phaser anropar
    lyssnare i den ordning de registrerades, och markeringslogiken ska hinna
    se att placering pågår och strunta i klicket, innan placeringen avslutas.
- **`SelectionView`** ritar dragrutan (grön kontur 1 px, 20 % fyllning, i
  världskoordinater) och orderringar (krymper och tonas bort på 400 ms av
  spelets tid).
- **`SelectionController`** hanterar mus och tangentbord:
  - vänsterklick markerar det som klickas, eller avmarkerar på tom mark
  - vänsterknapp + dra minst 4 px ger en dragruta som markerar egna enheter
  - Shift lägger till eller tar bort egna enheter
  - Esc avmarkerar
  - högerklick på ett eget ofärdigt bygge skickar markerade Samlare att
    hjälpa till
  - högerklick på ett träd eller bärsnår ger egna markerade Samlare en
    insamlingsorder; annars en flyttorder. Båda visar en ring. Träd är
    högre än en ruta, så `pickResourceTile` räknar på trädets ritade yta.
  - Markeringen ändras när knappen släpps. Pekskärm hanteras inte här än.
  - Medan en byggnad placeras hör musen och Esc till placeringen.
  - Reglerna ligger som rena funktioner i `selection.ts` och `picking.ts`.
    En markering är antingen ett antal egna enheter, eller en enda annan
    sak (byggnad eller fiendeenhet) som bara kan betraktas.
  - Klickträffar räknas på simuleringens läge, inte det interpolerade.
    Enheter går före byggnader, även när de står dolda bakom en byggnad.
- **`MapView`** ritar kartan en gång, från `state.map`:
  - Marken: en Blitter per marktextur (gräs, vatten), ett ritanrop var,
    på djup −1.
  - Träd, bärsnår och klippor: en `Image` per ruta med djup = skärmhöjden
    för rutans mitt, så att föremål längre ned täcker dem bakom. Enheter
    och byggnader ska använda samma djupregel.
  - `update(map)` körs varje bildruta och tar bort bilden för rutor vars
    terräng har ändrats (tömda källor). Marken under dem är redan gräs.
- **`CameraController`** flyttar huvudkameran:
  - piltangenter och WASD, 900 px/s
  - muspekaren inom 20 px från skärmkanten, 900 px/s. Aktiveras först när
    musen har rörts, så att det aldrig sker på pekskärm, och bara när
    pekaren är över spelytan.
  - dra med mittenknappen eller ett finger: kartan följer pekaren 1:1
  - vänsterknappen flyttar inte kameran (reserverad för markering i fas 3)
  - **Begränsning:** bildens mittpunkt hålls inom kartromben
    (`clampWorldToMap`). Vid en kant glider kameran längs kanten.
- Phaser-inställningar: `Scale.RESIZE` (spelytan följer fönstret),
  `AUTO`-renderare, ljud avstängt.

## Data (`src/data/`)

| Fil | Styr |
|---|---|
| `map.ts` | Kartans storlek, rutans storlek, standardfrö, startplatser, startresurser, antal och storlek på skogar, bärsnår, klippor och sjöar |
| `camera.ts` | Panoreringsfart (tangenter, kant), kantmarginal, längsta bildrutetid |
| `sim.ts` | Simuleringssteg per sekund, flest steg per bildruta |
| `terrain.ts` | Terrängtyper, gångbarhet och vilken resurs de ger |
| `types.ts` | Vilka enhets- och byggnadstyper som finns |
| `units.ts` | Enheters kostnad, träningstid, HP, fart, bärförmåga, insamlingstakt och vad de kan bygga |
| `buildings.ts` | Vilka enheter en byggnad tränar, dess HP, storlek, kostnad, byggtid och om den är avlämningsplats. Start-HP för byggen och extra arbetares takt |
| `resources.ts` | Mängd per källa, sökradie när en källa tar slut |
| `setup.ts` | Startbyggnad, startenheter, startresurser och befolkningstak |
| `ui.ts` | Dragtröskel, orderringens livslängd och storlek, blinktid vid nekad order |
| `production.ts` | Längsta produktionskö |
| `strings.ts` | All speltext (svenska) |

## Testgränssnitt

URL-parametrar:
- `?test=1` – exponerar `window.__TEST__`. Utan parametern finns det inte.
- `?seed=N` – frö för all slump, heltal 0–4294967295. Saknas det eller är
  ogiltigt används `MAP_GEN_CONFIG.defaultSeed` (1).

`window.__TEST__`:
| Fält | Innehåll |
|---|---|
| `ready` | `true` när scenen är skapad och första bildrutan har körts |
| `camera.x`, `camera.y` | Världskoordinat för bildens övre vänstra hörn |
| `camera.width`, `camera.height` | Bildens storlek i pixlar |
| `camera.centerTile` | Rutkoordinat (decimal) för punkten mitt i bilden |
| `elapsedMs` | Summan av all bildrutetid spelet har bearbetat (varje bildruta högst 100 ms). Går långsammare än väggklockan på en långsam maskin |
| `getState()` | En kopia av hela `GameState` |
| `advance(n)` | Kör `n` simuleringssteg direkt |
| `command(cmd)` | Skickar ett kommando till simuleringen och ger tillbaka dess `CommandResult` |
| `getSelection()` | Id för markerade entiteter |
| `getHud()` | Vad markeringspanelen visar: `visible`, `title`, `detail` |
| `getResourceBar()` | Texterna i resursraden: `food`, `wood`, `population` |
| `getFlashing()` | Vilka av resursradens texter som blinkar rött just nu |
| `getCommandPanel()` | Kommandopanelen: `visible`, `buttons` (`label`, `cost`, mittpunkt `x`/`y`), `queue` (`label`, mittpunkt `x`/`y`), `progress` |
| `getPlacement()` | Byggnaden som placeras: `building`, `x`, `y`, `valid`; `null` när ingen placering pågår |
| `getOrderMarkerCount()` | Antal synliga orderringar |
| `tileToScreen(x, y)` | Skärmposition för en punkt i rutkoordinater. Heltal är ruthörn; lägg till 0,5 för rutans mitt. Enheters `x`/`y` kan skickas som de är |
| `centerCameraOnTile(x, y)` | Centrerar kameran på en punkt i rutkoordinater |

Simuleringen går i realtid även i testläge; `advance(n)` läggs ovanpå. Läs
därför `tick` före och efter `advance` i samma `page.evaluate` om det exakta
antalet spelar roll.

Spelet startar med kameran vid spelarens bas, nära kartans hörn. Tester som
behöver utrymme att panorera anropar först `centerCameraOnMapMiddle`.

Enheter rör sig i realtid även i testläge. Ett test som ska klicka på en
enhet måste läsa dess läge precis innan, eller klicka innan enheten får en
order.

Gränssnittet ritas om en bildruta efter att tillståndet har ändrats. Tester
som läser `getHud`, `getResourceBar` eller `getCommandPanel` efter en
ändring ska använda `expect.poll`.

En skärmdump tar runt 400 ms att ta. Effekter som är kortare än så (300 ms
blinkning, 400 ms orderring) går inte att fånga på bild; de kontrolleras via
testgränssnittet.

Rutor inom 4 rutor från en startposition är alltid fria från terränghinder.
Tester som behöver en garanterat fri ruta ska välja en sådan och inte anta
något om rutor längre bort (`openTileNearBase` i fas 3-testerna). En 2×2-plats
ryms inom det området bredvid Storiden (`freeVisthusOrigin`), men ingen
3×3-plats gör det. Tester som behöver en större plats letar upp en i det
aktuella tillståndet (`freeOriginNear` i fas 6-testerna).

Webbläsartester som mäter fart jämför mot `elapsedMs`, inte mot verklig tid
(`measurePanSpeed` i `tests/e2e/helpers.ts`). Då beror resultatet inte på
maskinens bildfrekvens.

`E2E_CPU_THROTTLE=8 npm run e2e` bromsar webbläsaren åtta gånger, för att
återskapa de låga bildfrekvenserna på CI-maskiner.

Enhetstester ligger bredvid koden som `*.test.ts` under `src/` och körs med
Vitest i Node. Playwright kör mot produktionsbygget via `vite preview`.

## Viktiga beslut

| Fas | Beslut | Skäl |
|---|---|---|
| 1 | Använd verklig tid mellan bildrutor, inte Phasers `delta` | Phaser begränsar `delta` till 1/60 s under de första 120 bildrutorna och när sidan saknar fokus. Vid låg bildfrekvens gick kameran då för långsamt (300 i stället för 900 px/s vid 20 bilder/s). Simuleringens tidssteg använder samma mätning. |
| 1 | Webbläsartester mäter fart mot spelets egen tid (`elapsedMs`) | Varje bildruta begränsas till 100 ms. På GitHub-maskinerna tar en bildruta 100–250 ms, så mätt mot väggklockan gick kameran långsammare än 900 px/s och testerna fallerade ibland. |
| 1 | Kameran begränsas via bildens mittpunkt, inte via kartans omslutande rektangel | Kartan är en romb. Med en rektangel som gräns visade hörnen nästan bara tomrum. |
| 1 | TypeScript 6.0 i stället för 7 | typescript-eslint kräver TypeScript < 6.1. |
| 1 | `@playwright/test` låst till 1.63.0 | Samma version som den förinstallerade webbläsaren i Claudes molnmiljö. CI installerar matchande Chromium själv. |
| 1 | Speldata som typade TS-objekt (`as const`), inte JSON | Typkontroll av datat utan extra verktyg. |
| 1 | Namngivna importer från Phaser (`import { Scene } from 'phaser'`) | Fungerar med Phasers ESM-bygge i Vite. |
| 2 | Slumpgeneratorns tillstånd ligger i `GameState`, inte i en klass | Tillståndet ska gå att kopiera och jämföra som ren data, och två spel med samma frö ska förbli identiska. |
| 2 | Terräng lagras som textsträngar (`'grass'`, `'tree'` …) | Läsbart i tester och i `getState()`. 4096 rutor är för få för att packning ska löna sig. |
| 2 | Träd, bärsnår och klippor är enskilda bilder, inte en Blitter | De måste kunna djupsorteras mot enheter som går mellan dem, och tas bort en och en när resurser tar slut. |
| 2 | Nytt försök i stället för att gräva en väg när kartan blir avskuren | En grävd korridor syns som en rak linje. Efter 20 försök används en karta med bara startresurser, som alltid är sammanhängande. |
| 2 | `isReachable` räknar bara kantgrannar | Det är ett strängare krav än enheternas rörelse i åtta riktningar, så en godkänd karta är alltid framkomlig. |
| 3 | Markeringen ligger i `render/`, inte i `GameState` | Den är gränssnittstillstånd för en spelare och påverkar inte simuleringen. AI:n har ingen markering. |
| 3 | Kommandon utförs direkt, inte i en kö till nästa steg | Enklast, och fortfarande deterministiskt eftersom inget kan hända mitt i ett steg. Behövs inspelning eller nätverk senare får en kö läggas till. |
| 3 | `prevX`/`prevY` ligger i simuleringens tillstånd | Renderingen behöver läget före senaste steget för att interpolera. Att låta simuleringen spara det är enklare och säkrare än att renderingen gissar när ett steg har körts. |
| 3 | Vägsökningens kostnader är heltal (10 och 14) | Jämförelser mellan vägar blir exakta, utan avrundningsfel. |
| 3 | Startenheterna står framför Storiden och speglas inte mellan sidorna | Enheter bakom en byggnad döljs av den; i första versionen syntes spelarens Samlare inte alls vid start. Skillnaden mellan sidorna är högst ett par rutor. |
| 3 | Gränssnittet är en egen scen (`UiScene`) | Egen kamera gör att det står still när kartan rullar, och det följer den planerade strukturen i `tech-stack.md`. |
| 4 | Resursmängder ligger i `map.resourceAmount`, parallellt med `terrain` | Källor är rutor, inte entiteter. En lista per ruta är enklast att slå upp i och följer med när tillståndet kopieras. |
| 4 | Insamlingen räknar hela steg (`workTicks`), inte bråkdelar | 1 enhet per sekund blir exakt 20 steg, utan avrundningsfel som kan ge en enhet för mycket eller för lite. |
| 4 | En enhet kan byta fas flera gånger i samma steg | Annars går ett steg förlorat vid varje fasbyte, och tiderna i GDD:t stämmer inte exakt. |
| 4 | Närmaste avlämningsplats räknas fågelvägen, inte efter vägens längd | Billigt och nästan alltid samma svar. Kan bytas om kartor med långa omvägar visar sig ge fel val. |
| 5 | Kommandon ger tillbaka ett resultat (`CommandResult`) | Gränssnittet behöver veta varför en order nekades för att kunna blinka rätt siffra, och AI:n behöver veta om ordern gick igenom. |
| 5 | Enheter i kö räknas mot befolkningstaket | Annars kan flera byggnader köa förbi taket, och färdiga enheter måste då vänta eller taket brytas. |
| 5 | Kommandopanelen har inga interaktiva Phaser-objekt | Placering och klickträffar blir rena funktioner som kan enhetstestas, och testerna kan fråga var knapparna ligger. |
| 5 | Textfärg ändras bara när blinkningen börjar eller slutar | `Text.setColor` ritar om hela texten. Första versionen satte färgen varje bildruta. |
| 6 | Typnamnen `UnitType` och `BuildingType` skrivs ut i `types.ts` | Enheter pekar på byggnader (vad de bygger) och byggnader på enheter (vad de tränar). Att härleda namnen ur tabellerna gav en cirkel som TypeScript inte kunde lösa. |
| 6 | Ett bygge blockerar sina rutor från att det placeras | Annars kan enheter stå inuti byggnaden när den blir klar. Enheter på väg igenom får ny väg direkt. |
| 6 | Byggarbete räknas i arbetarsteg, inte i tid | Takten 1, 1,5, 2 … per steg är exakt i flyttal, så byggtiderna blir exakta. |
| 6 | Byggplaceringen är en egen styrklass som tar över musen | Markering och placering tolkar samma klick olika. Ett tydligt läge är enklare att resonera om än villkor utspridda i markeringslogiken. |
