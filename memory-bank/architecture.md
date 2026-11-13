# AnimalPlanet – arkitektur

Beskriver hur koden **faktiskt** är uppbyggd. Uppdateras efter varje
avslutad fas. Planerad arkitektur står i `tech-stack.md`; det här dokumentet
beskriver bara det som finns i repot.

Senast uppdaterad: fas 8.

## Översikt

Tre lager, med beroenden bara nedåt i listan:

1. `src/render/` och `src/testing/` – Phaser, inmatning, testgränssnitt.
2. `src/sim/` – ren TypeScript utan Phaser, DOM eller `window`.
3. `src/data/` – typade konstanter (spelsiffror).

ESLint stoppar import av Phaser, `render/` och `testing/` i `src/sim/`, liksom
`window`, `document`, `Math.random` och `Date.now` där.

Efter fas 7 går en hel match att spela: enheter och byggnader, vägsökning,
förflyttning, resursinsamling, produktion, byggande, strid, kapitulation
till grottor samt vinst och förlust. Gränssnittet har markering, paneler,
resursrad, byggplacering, varningstext och slutskärm. Krigsdimman döljer
det spelaren inte ser. Motståndaren är passiv; AI saknas ännu.

Allt som ändrar spelet går via `applyCommand`. Markeringen (vilka enheter
som är valda) är gränssnittstillstånd och ligger i `render/`, inte i
`GameState`.

## Filer och ansvar

| Fil | Ansvar | Fas |
|---|---|---|
| `index.html` | Sida med `#game`-behållare i helskärm | 1 |
| `src/main.ts` | Läser `?test=1` och `?seed=N`, startar Phaser med `GameScene` | 1, 2 |
| `src/data/map.ts` | `MAP_CONFIG` (kartstorlek, rutstorlek), `MAP_GEN_CONFIG` (kartgenerering, standardfrö, grottornas placering) och `CAVE_CONFIG` (platser per grotta, byggförbud) | 1, 2, 7 |
| `src/data/camera.ts` | `CAMERA_CONFIG`: panoreringsfart, kantmarginal, längsta bildrutetid | 1 |
| `src/data/sim.ts` | `SIM_CONFIG`: steg per sekund, flest steg per bildruta. `TICK_MS` | 2 |
| `src/data/terrain.ts` | `TERRAIN_DEFS`: terrängtyper, om de är gångbara och vilken resurs de ger. Typen `Terrain` | 2, 4 |
| `src/data/resources.ts` | `RESOURCE_DEFS` (mängd per källa), `GATHER_CONFIG` (sökradie). Typerna `ResourceType` och `Cost` | 4, 6 |
| `src/data/types.ts` | Namnen på enhets- och byggnadstyper (`UnitType`, `BuildingType`) | 6 |
| `src/data/units.ts` | `UNIT_DEFS`: enhetstyper (kostnad, träningstid, liv, fart, bärförmåga, insamlingstakt, vad de kan bygga, skada, rustning, slagtakt, upptäcktsradie). `COMBAT_CONFIG` | 3, 4, 5, 6, 7 |
| `src/data/buildings.ts` | `BUILDING_DEFS`: byggnadstyper (vad de tränar, HP, storlek, avlämningsplats, kostnad, byggtid). `CONSTRUCTION_CONFIG` (start-HP, extra arbetares takt) | 3, 4, 5, 6 |
| `src/data/production.ts` | `PRODUCTION_CONFIG`: längsta produktionskö | 5 |
| `src/data/setup.ts` | `START_CONFIG`: startbyggnad, startenheter, startresurser, befolkningstak | 3, 4 |
| `src/data/ui.ts` | `UI_CONFIG`: dragtröskel, orderring, blinktid vid nekad order, träffblink, utfall, bortoning, skärmskakning, varningstid | 3, 5, 7 |
| `src/data/strings.ts` | `STRINGS`: all speltext | 3 |
| `src/sim/state.ts` | Typerna `GameState`, `PlayerState`, `Unit`, `UnitTask`, `Building`, `Entity`, `PlayerId`, `SimEvent` | 2, 3, 4, 7 |
| `src/sim/game.ts` | `createGame(seed)`: skapar ett nytt speltillstånd med karta, Storide och Samlare per sida | 2, 3 |
| `src/sim/tick.ts` | `tick(state)` och `advance(state, steps)` | 2, 3 |
| `src/sim/entities.ts` | Skapa och slå upp enheter och byggnader, byggnaders rutor och mittpunkt | 3 |
| `src/sim/commands.ts` | Typerna `Command` och `CommandResult`, och `applyCommand` | 3, 4, 5 |
| `src/sim/economy.ts` | Kostnader: vad som saknas, betala, återbetala | 5 |
| `src/sim/systems/production.ts` | `produceUnits` (träning), `queueUnit`, `cancelQueuedUnit` | 5 |
| `src/sim/systems/construction.ts` | `constructBuildings` (byggande), `canPlaceBuilding`, `placeBuilding`, `assistConstruction` | 6, 7 |
| `src/sim/systems/combat.ts` | `resolveCombat` (upptäcka, förfölja, slå), `orderAttack`, skadeformeln, raserade byggnader och vinnare | 7 |
| `src/sim/systems/surrender.ts` | `surrender` (kapitulation och val av grotta) och `resolveSurrenders` (gå in i grottan) | 7 |
| `src/sim/systems/visibility.ts` | `updateVisibility` (synfält per sida) och frågor om vad en sida ser | 8 |
| `src/sim/pathfinding/approach.ts` | `approachPath`: väg till en ruta intill ett mål, spridd mellan flera enheter | 7 |
| `src/sim/resources.ts` | Resurskällor på kartan: slå upp, ta från, startmängder | 4 |
| `src/sim/systems/gathering.ts` | `gatherResources` (insamlingsloopen) och `startGathering` | 4 |
| `src/sim/systems/movement.ts` | `moveUnits`: flyttar enheter längs deras väg | 3 |
| `src/sim/pathfinding/astar.ts` | `findPath` (A*), `nearestReachable`, `reachableTiles`, `canStep`, typen `PathGrid` | 3, 4 |
| `src/sim/pathfinding/passability.ts` | `buildPathGrid` (gångbara rutor just nu) och `nearestFreeTiles` | 3 |
| `src/sim/testUtils.ts` | Små kartor från teckenrader, för enhetstester | 3 |
| `src/sim/clock.ts` | Fast tidssteg: gör om bildrutetid till ett helt antal steg | 2 |
| `src/sim/rng.ts` | Frösatt slumpgenerator (mulberry32) och `parseSeed` | 2 |
| `src/sim/map/iso.ts` | Isometrisk matematik: ruta ↔ världspixlar, begränsning till kartan | 1 |
| `src/sim/map/grid.ts` | Typerna `GameMap` och `Cave`, rutuppslag, gångbarhet, spegling, avstånd, `isReachable` | 2, 7 |
| `src/sim/map/mapgen.ts` | `generateMap`: kartgenerering, inklusive grottor | 2, 7 |
| `src/render/scenes/GameScene.ts` | Skapar spelet, vyerna och styrningen, driver simuleringen, registrerar testgränssnittet | 1, 2, 3 |
| `src/render/scenes/UiScene.ts` | Gränssnittet ovanpå spelet: resursraden, markeringspanelen och kommandopanelen | 3, 4, 5 |
| `src/render/views/MapView.ts` | Ritar mark, träd, bärsnår och klippor; tar bort tömda källor | 1, 2, 4 |
| `src/render/views/EntityView.ts` | Ritar enheter och byggnader, interpolerar rörelse, ritar markeringar, livstaplar, vita flaggor och stridseffekter | 3, 4, 6, 7 |
| `src/render/views/SelectionView.ts` | Ritar dragrutan och orderringar | 3 |
| `src/render/views/PlacementView.ts` | Ritar konturen av en byggnad som placeras | 6 |
| `src/render/views/CaveView.ts` | Ritar grottorna och antalet djur i dem | 7, 8 |
| `src/render/views/FogView.ts` | Ritar krigsdimman | 8 |
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
| `tests/e2e/phase7-combat.spec.ts` | Webbläsartester för fas 7 | 7 |
| `tests/e2e/phase8-fog.spec.ts` | Webbläsartester för fas 8 | 8 |
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
| `players` | En `PlayerState` per sida: `resources` (`food`, `wood`) och `visibility` (vad sidan vet om varje ruta, samma index som `terrain`) |
| `fogEnabled` | Om krigsdimman är på. Av betyder att alla ser allt |
| `entities` | Alla enheter och byggnader, i den ordning de skapades |
| `nextEntityId` | Id för nästa entitet. Id:n återanvänds aldrig |
| `winner` | Sidan som har vunnit, eller `null`. När den är satt står simuleringen still |
| `events` | Vad som hände under det senaste steget (`SimEvent`). Byts ut varje steg |

`map.caves` är en lista av `Cave`: `id`, `owner`, `x`, `y`, `occupants`
(typerna på djuren i grottan) och `reserved` (platser hållna åt djur som är
på väg dit). Varje grotta har dessutom terrängen `cave` på sin ruta.

`Unit`: `id`, `kind: 'unit'`, `type`, `owner`, `x`/`y` (kontinuerliga
rutkoordinater, rutans mitt är `+0.5`), `prevX`/`prevY` (läget före senaste
steget, för interpolation), `hp`, `path` (rutor kvar att gå, nästa först),
`task` (vad enheten gör utöver att gå), `carryType` och `carryAmount`
(buren resurs) och `attackCooldown` (steg tills nästa slag).

`UnitTask` är `{ kind: 'idle' }`, en `BuildTask` (`buildingId`), en
`AttackTask` (`targetId`, `repathTicks`), en `FleeTask` (`caveId`; enheten
har kapitulerat) eller en `GatherTask`: `resource`, `node`
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

- `tick(state)` kör ett steg: tömmer `events`, sedan `produceUnits`,
  `constructBuildings`, `gatherResources`, `resolveCombat`,
  `resolveSurrenders`, `moveUnits`, `updateVisibility`, och till sist ökas
  `state.tick`. När `winner` är satt gör `tick` ingenting.
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
| `attack` | `player`, `unitIds`, `targetId` | Enheterna anfaller en fientlig enhet eller byggnad tills den är besegrad |

Enheter som har kapitulerat lyder inga kommandon.

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

### Strid

- Skada per slag = anfallarens `damage` − målets `armor`, minst 1.
  Ramkrigare: skada 10, rustning 1, ett slag var 24:e steg (1,2 s). Samlare:
  skada 3, rustning 0, ett slag var 30:e steg.
- Räckvidd: närstrid. Enhetens ruta ska ligga intill målets ruta (även
  diagonalt), eller intill en byggnads fotavtryck.
- `resolveCombat` gör för varje enhet som inte har kapitulerat: räknar ned
  `attackCooldown`; låter en sysslolös, stillastående enhet med
  `aggroRadius` välja närmaste fientliga **enhet** inom radien (6 rutor för
  Ramkrigare; byggnader väljs aldrig självmant); och låter en enhet med
  anfallsuppgift slå om målet är inom räckhåll, annars gå mot det.
- Förföljelse: vägen räknas om var 10:e steg (0,5 s) eller när den tar slut.
  `approachPath` väljer en ruta intill målet, helst en där ingen annan står
  eller är på väg, så att anfallare sprider sig runt målet.
- Målet blir ogiltigt när det är borta, har kapitulerat eller inte går att
  nå. Enheten blir då sysslolös, och en Ramkrigare letar nästa fiende själv.
- En byggnad vars liv når 0 rasar: den tas bort och rutorna blir fria. Är
  det huvudbyggnaden (`START_CONFIG.building`) sätts `winner` till andra
  sidan.

### Kapitulation och grottor

- En enhet vars liv når 0 kapitulerar (`surrender`): liv 0, lasten tappas,
  uppgiften blir `flee`. Den väljer närmaste egna grotta som har en ledig
  plats och som den kan gå fram till, och platsen reserveras direkt
  (`cave.reserved`). Finns ingen sådan grotta tas enheten bort på en gång.
- En kapitulerad enhet kan inte anfallas, väljs inte som mål, lyder inga
  kommandon och räknas inte i befolkningen (`populationOf`).
- `resolveSurrenders`: när enheten står stilla intill sin grotta tas den
  bort, reservationen släpps och dess typ läggs i `cave.occupants`. Kom den
  inte fram (vägen blev avskuren) försvinner den i stället.
- Varje grotta rymmer 12 (`CAVE_CONFIG.capacity`); platser = i grottan +
  reserverade.
- Kartgenereringen lägger grottorna sist: 2 per sida, 7–13 rutor från
  sidans startposition, på sidans egen halva, minst 6 rutor isär och 2
  rutor från kartkanten, speglade mellan sidorna. En grotta godkänns bara
  om startplatserna fortfarande är förbundna och grottan går att gå fram
  till från sin sidas start. Terrängen i övrigt är oförändrad för ett givet
  frö jämfört med före fas 7.
- Ingenting får byggas på en grotta eller på rutorna intill
  (`CAVE_CONFIG.noBuildDistance`).

### Krigsdimma

- Varje ruta har för varje sida ett av tre lägen: `UNEXPLORED` (0),
  `EXPLORED` (1) eller `VISIBLE` (2).
- `updateVisibility` körs sist i varje steg och när spelet skapas: alla
  synliga rutor blir utforskade, och sedan blir varje ruta synlig vars
  mittpunkt ligger inom synfältet för någon av sidans enheter eller
  byggnader. Terräng skymmer inte.
- Synfält: Samlare 6, Ramkrigare 7, Storide 9, Visthus 5, Krigshall 6, bygge
  under uppförande 2. Enheter mäter från sin rutas mitt, byggnader från
  fotavtryckets mitt. En kapitulerad enhet ser inte åt sin sida.
- `isEntityVisibleTo(state, player, entity)`: egna alltid; andras enheter
  när deras ruta är synlig; andras byggnader när någon av deras rutor är
  synlig. `visibleEntities` ger alla sådana.
- Dimman påverkar spelreglerna på två ställen: ett mål som inte syns kan
  inte anfallas (`isAttackable`), så en anfallare ger upp när målet
  försvinner ur sikte; och `canPlaceBuilding` kräver att sidan har utforskat
  alla rutor i fotavtrycket.
- Vägsökningen bryr sig inte om dimman. Enheter hittar runt hinder som
  spelaren aldrig har sett.
- Med `fogEnabled: false` räknas allt som synligt. Testkartor från
  `testUtils` har dimman av; `createGame` har den på om inget annat sägs.

### Händelser

`state.events` talar om för renderingen vad som hände i det senaste steget:
`hit`, `surrender`, `enterCave`, `vanish`, `buildingCollapsed` och
`buildingAttacked`. `GameScene` kör därför ett steg i taget och läser
händelserna efter varje steg. Simuleringen själv använder dem inte.

### Byggande

- `canPlaceBuilding(state, type, x, y)`: alla rutor i fotavtrycket ska
  ligga på kartan, vara gångbar mark (alltså inte träd, bär, klippa, vatten
  eller grotta), vara fria från byggnader och enheter och inte ligga intill
  en grotta. Kravet på utforskad mark kommer med krigsdimman i fas 8.
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
  - Stegen körs ett i taget (`runSteps`), och efter varje steg hanteras
    simuleringens händelser: träff → blink och utfall, anfallen egen byggnad
    → varningstext (3 s, högst en gång per 10 s speltid), raserad byggnad i
    bild → skärmskakning (150 ms, 4 px).
  - När någon har vunnit visas slutskärmen och alla klick på kartan
    blockeras. "Spela igen" laddar om sidan, med samma frö.
- **`UiScene`** ligger ovanpå `GameScene` med egen kamera, så att
  gränssnittet står still när kartan rullar. Den hämtar sitt innehåll från
  `GameScene` via gränssnittet `HudSource`.
  - Resursraden längs överkanten visar mat, trä och befolkning (`3/30`).
  - Markeringspanelen ligger nere till vänster och syns bara när något är
    markerat. För en egen enhet visas även vad den gör, t.ex.
    `Liv 40/40 · Samlar mat 7/10`, `Liv 40/40 · Bygger Visthus` eller
    `Liv 100/100 · Anfaller`. Ett bygge visar `Liv 130/400 · Byggs 25 %`,
    och en kapitulerad enhet `Liv 0/40 · Har kapitulerat`.
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
  - Varningstexten ("Din bas anfalls!") visas mitt under resursraden.
  - Slutskärmen tonar ned spelet och visar "Seger" eller "Nederlag" och
    knappen "Spela igen". Medan den visas reagerar bara den knappen.
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
  - Ramkrigare är en fyrkant, större än Samlarens cirkel.
  - Livstapel ovanför skadade enheter och färdiga byggnader: grön över
    50 %, gul över 25 %, röd annars.
  - Träff: målet ritas helvitt i 80 ms, och anfallaren gör ett utfall på
    4 px mot målet i 100 ms.
  - En kapitulerad enhet bär en vit flagga och har ingen livstapel.
  - En enhet som lämnar kartan (går in i en grotta eller försvinner) tonas
    bort på 300 ms där den stod. En raserad byggnad tas bort direkt.
- **`CaveView`** ritar varje grotta som en kulle med mörk öppning och en
  kant i sidans färg, med antalet djur ovanför, t.ex. `3/12`. Grottan ritas
  när spelaren har utforskat dess ruta. Antalet visas alltid för egna
  grottor, och för andras bara medan de är i sikte.
- **`FogView`** ritar dimman som en mörk romb per ruta, på djup över allt på
  kartan men under livstaplar och andra markeringar: heltäckande över
  outforskade rutor, 50 % genomskinlig över utforskade, ingenting över
  synliga. Bara rutor som har ändrats ritas om. Romberna överlappar en pixel
  så att rutnätet inte lyser igenom i skarvarna. Vyn skapas inte när dimman
  är av.
- **Det spelaren inte ser ritas inte:** `EntityView` döljer andras enheter
  och byggnader utanför synliga rutor, med livstaplar och flaggor.
  `MapView` döljer träd, bärsnår och klippor på outforskade rutor, eftersom
  de är högre än en ruta och annars sticker upp ur dimman.
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
  - högerklick på en fientlig enhet eller byggnad ger anfallsorder, med röd
    ring
  - högerklick på ett eget ofärdigt bygge skickar markerade Samlare att
    hjälpa till
  - högerklick på ett träd eller bärsnår ger egna markerade Samlare en
    insamlingsorder; annars en flyttorder. Båda visar en ring. Träd är
    högre än en ruta, så `pickResourceTile` räknar på trädets ritade yta.
  - Markeringen ändras när knappen släpps. Pekskärm hanteras inte här än.
  - Medan en byggnad placeras hör musen och Esc till placeringen.
  - Klick och dragruta räknar bara med det spelaren ser
    (`visibleEntities`). En markerad fiende avmarkeras när den försvinner
    in i dimman. En resurskälla på outforskad mark går inte att ge order om.
  - Reglerna ligger som rena funktioner i `selection.ts` och `picking.ts`.
    En markering är antingen ett antal egna enheter, eller en enda annan
    sak (byggnad, fiendeenhet eller kapitulerad enhet) som bara kan
    betraktas. Kapitulerade enheter kommer inte med i en dragruta.
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
- `?fog=0` – stänger av krigsdimman. Fungerar bara tillsammans med
  `?test=1`.

`window.__TEST__`:
| Fält | Innehåll |
|---|---|
| `ready` | `true` när scenen är skapad och första bildrutan har körts |
| `camera.x`, `camera.y` | Världskoordinat för bildens övre vänstra hörn |
| `camera.width`, `camera.height` | Bildens storlek i pixlar |
| `camera.centerTile` | Rutkoordinat (decimal) för punkten mitt i bilden |
| `elapsedMs` | Summan av all bildrutetid spelet har bearbetat (varje bildruta högst 100 ms). Går långsammare än väggklockan på en långsam maskin |
| `getState()` | En kopia av hela `GameState`, även det spelaren inte ser. Vad spelaren ser står i `players[0].visibility` |
| `advance(n)` | Kör `n` simuleringssteg direkt |
| `spawnUnit(type, owner, x, y)` | Skapar en enhet på en ruta och ger dess id. Genväg för tester; spelet gör aldrig så |
| `getAlert()` | Varningstexten överst; tom när ingen visas |
| `getOutcome()` | Slutskärmen: `visible`, `title`, `button` (`label`, mittpunkt `x`/`y`) |
| `getShakeCount()` | Antal skärmskakningar hittills |
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

Sysslolösa Ramkrigare anfaller fiendeenheter inom 6 rutor på eget
initiativ. Ett test som vill ha stillastående soldater måste ställa dem
längre bort än så från motståndarens enheter (`quietTiles` i fas
7-testerna).

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
| 7 | Simuleringen rapporterar händelser i `state.events`, och spelscenen kör ett steg i taget | Blink, utfall, skakning och varning hör till enstaka ögonblick som inte går att läsa ur tillståndet efteråt. Listan byts varje steg, så den växer inte i långa körningar utan rendering. |
| 7 | Grottor är terräng plus en post i `map.caves`, inte entiteter | De kan inte anfallas, markeras eller flyttas. Som terräng blockerar de vägar och byggplatser utan särskild kod. |
| 7 | Platsen i grottan reserveras när enheten kapitulerar | Annars kan flera enheter på väg mot samma grotta överfylla den. |
| 7 | Soldater anfaller självmant bara enheter, inte byggnader | Annars vandrar sysslolösa soldater iväg mot närmaste fiendebyggnad. Byggnader anfalls på order. |
| 7 | `approachPath` är en ny, delad funktion; insamlingens egen motsvarighet är orörd | Samma idé (sprid enheter runt ett mål) behövdes för strid och grottor. Att lägga om insamlingen till den vore en refaktorering utanför fasen. |
| 8 | Synligheten ligger i `GameState` och räknas om varje steg | Den styr spelregler (anfall, byggplacering), inte bara ritningen, och AI:n kommer att behöva samma frågor. Omräkningen är billig på en 64×64-karta. |
| 8 | Dimman har en av/på-flagga i tillståndet | Enhetstester av andra saker och `?fog=0` behöver ett läge där alla ser allt, utan särfall utspridda i koden. |
| 8 | Dimman ritas som en romb per ruta i en Blitter | Ett ritanrop för hela dimman, och bara ändrade rutor uppdateras. |
