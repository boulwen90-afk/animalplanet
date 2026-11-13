# AnimalPlanet – arkitektur

Beskriver hur koden **faktiskt** är uppbyggd. Uppdateras efter varje
avslutad fas. Planerad arkitektur står i `tech-stack.md`; det här dokumentet
beskriver bara det som finns i repot.

Senast uppdaterad: figurer med skelett och animationer i spelet (efter MVP:n).

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
det spelaren inte ser, och motståndaren spelas av en regelstyrd AI. Efter
fas 10 börjar spelet bakom en startskärm och går att spela med pekskärm.

Allt som ändrar spelet går via `applyCommand`. Markeringen (vilka enheter
som är valda) är gränssnittstillstånd och ligger i `render/`, inte i
`GameState`.

## Filer och ansvar

| Fil | Ansvar | Fas |
|---|---|---|
| `index.html` | Sida med `#game`-behållare i helskärm | 1 |
| `src/main.ts` | Läser URL-parametrarna, avgör om startskärmen ska visas och startar Phaser med `GameScene` och `UiScene` | 1, 2, 10 |
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
| `src/data/ai.ts` | `AI_CONFIG`: beslutstakt, antal arbetare, andel på trä, flest soldater, försvarsradie, anfallsvågor | 9 |
| `src/data/ui.ts` | `UI_CONFIG`: dragtröskel, orderring, blinktid vid nekad order, träffblink, utfall, bortoning, skärmskakning, varningstid, pekstyrningens tröskel, hålltid och ring | 3, 5, 7, 10 |
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
| `src/sim/systems/visibility.ts` | `updateVisibility` (synfält per sida) och frågor om vad en sida ser | 8, 9 |
| `src/sim/ai/ai.ts` | `runAi`: datormotståndarens beslut, en gång per sekund | 9 |
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
| `src/render/scenes/UiScene.ts` | Gränssnittet ovanpå spelet: resursraden, markeringspanelen, kommandopanelen, knapparna "Bas" och "Avmarkera", varningstext, startskärm och slutskärm | 3, 4, 5, 7, 10 |
| `src/render/session.ts` | "Spela igen": laddar om sidan och låter den nya sidan hoppa över startskärmen | 10 |
| `src/render/views/MapView.ts` | Ritar mark, träd, bärsnår och klippor; tar bort tömda källor | 1, 2, 4 |
| `src/render/views/EntityView.ts` | Ritar enheter och byggnader, interpolerar rörelse, ritar markeringar, livstaplar, vita flaggor och stridseffekter | 3, 4, 6, 7 |
| `src/render/views/SelectionView.ts` | Ritar dragrutan, orderringar och ringen under ett finger som hållits kvar | 3, 10 |
| `src/render/views/PlacementView.ts` | Ritar konturen av en byggnad som placeras | 6 |
| `src/render/views/CaveView.ts` | Ritar grottorna och antalet djur i dem | 7, 8 |
| `src/render/views/FogView.ts` | Ritar krigsdimman | 8 |
| `src/render/views/visuals.ts` | Platshållargrafikens mått och färger, delade av ritning och klickträffar | 3 |
| `src/render/input/CameraController.ts` | Kamerapanorering med tangenter, skärmkant och mittenknapp; `panBy` för fingret | 1, 10 |
| `src/render/input/SelectionController.ts` | Markering, dragruta och order (flytta, samla, anfalla, hjälpa till att bygga) med mus och tangentbord; `tapAt` och `selectBox` för fingret | 3, 4, 6, 7, 10 |
| `src/render/input/PlacementController.ts` | Byggplacering: kontur som följer musen, klick placerar, högerklick och Esc avbryter. På pekskärm: tryck flyttar konturen, tryck på konturen bygger | 6, 10 |
| `src/render/input/TouchController.ts` | Ett finger på kartan: tryck, dra (kamera) eller håll och dra (dragruta) | 10 |
| `src/render/input/touchGesture.ts` | Fingrets lägen som rena funktioner: väntar, hållet, panorerar, dragruta | 10 |
| `src/render/input/selection.ts` | Markeringsregler som rena funktioner | 3 |
| `src/render/input/picking.ts` | Vilken enhet, byggnad eller resurskälla som ligger under en punkt eller i en ruta | 3, 4 |
| `src/render/ui/selectionInfo.ts` | Texten i markeringspanelen | 3 |
| `src/render/ui/layout.ts` | Var resursraden, markeringspanelen, HUD-knapparna, varningstexten, startskärmen och slutskärmen ligger på skärmen | 3, 4, 7, 10 |
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
| `tests/e2e/phase9-ai.spec.ts` | Webbläsartester för fas 9 | 9 |
| `tests/e2e/phase10-touch-start.spec.ts` | Webbläsartester för fas 10: startskärm, hela flödet, basknapp, pekstyrning, telefonskärm | 10 |
| `src/sim/balance.test.ts` | Balansmålen som enhetstester: matchlängd AI mot AI, försvar mot första vågen | 10 |
| `src/render/characters/characters.ts` | Vilka enhetstyper som ritas som figurer, och var deras filer ligger | Efter MVP |
| `src/render/characters/CharacterLibrary.ts` | Laddar figurernas atlaser och färgar en kopia per spelare | Efter MVP |
| `src/render/characters/recolor.ts` | Lagfärgen: räknar om atlasens pixlar via masken | Efter MVP |
| `src/render/characters/animation.ts` | Väljer animation, riktning och bildruta för en enhet | Efter MVP |
| `tests/e2e/characters.spec.ts` | Webbläsartester för figurerna | Efter MVP |
| `tools/blender/` | Figurpipelinen: bygger figurer i Blender och renderar dem. Se "Figurpipeline" | Efter MVP |
| `assets/previews/` | Förhandsbilder av figurer, för granskning | Efter MVP |
| `assets/characters/` | Figurernas atlaser, som spelet laddar: `<ras>_<enhet>/<namn>.png`, `_mask.png` och `.json` | Efter MVP |
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
| `players` | En `PlayerState` per sida: `resources` (`food`, `wood`), `visibility` (vad sidan vet om varje ruta, samma index som `terrain`) och `ai` (datormotståndarens minne, eller `null` för en sida som spelas av en person) |
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

- `tick(state)` kör ett steg: tömmer `events`, sedan `runAi`, `produceUnits`,
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

### Datormotståndaren

- `createGame` tar `options.ai`, en lista över sidor som datorn spelar.
  Standard är `[1]`. En sådan sida får `players[i].ai = { attackers,
  waveTicks }`.
- `runAi` körs först i varje steg men gör bara något var 20:e steg (en gång
  per sekund). Allt den gör går via `applyCommand`, och den betalar samma
  kostnader som spelaren.
- Dess enda fördel: krigsdimman gäller inte för en sida med `ai` satt
  (`visibilityAt` och `isEntityVisibleTo` ger alltid synligt).
- Varje beslut går igenom samma lista, i den här ordningen:
  1. **Arbetare:** träna en i taget tills den har 8.
  2. **Byggen:** ett bygge utan byggare får närmaste lediga arbetare. Saknas
     kasern byggs en vid basen; därefter ett förråd vid närmaste skog.
     Platsen ska ha en ruta fri mark runt om, så att inget stängs in.
  3. **Sysslolösa arbetare** skickas att samla vid källan närmast basen.
     Tre av åtta hålls på trä och resten på mat (`woodShare` 0,375).
  4. **Soldater:** träna en i taget i varje färdig kasern, upp till 20.
  5. **Försvar:** hemmavarande soldater anfaller fiendeenheter inom 12 rutor
     från huvudbyggnaden.
  6. **Anfallsvåg:** när vågens tidigaste tid är inne och tillräckligt många
     soldater är hemma går vågen mot fiendens huvudbyggnad. Passeras den
     senaste tiden går den med de soldater som finns.
  7. **Soldater i en våg** anfaller fiendesoldater inom sin upptäcktsradie
     och annars huvudbyggnaden.
- Vågorna står i `AI_CONFIG.waves`: 4 soldater vid 4:00–5:30, 6 vid
  7:00–8:30, 8 vid 10:00–11:30, och därefter 10 soldater var 150:e sekund.
- AI:n läser vilka byggnader som är kasern och förråd ur `BUILDING_DEFS`
  (tränar soldater, respektive bara avlämningsplats), inte ur namnen.
- Uppmätt: mot en spelare som inte gör något vinner den efter drygt 5
  minuter. Två datorstyrda sidor avgör en match på 11–16 minuter.

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
    blockeras. "Spela igen" laddar om sidan, med samma frö. En markering i
    webbläsarens sessionslagring (`session.ts`) gör att den omladdade sidan
    hoppar över startskärmen.
  - Bakom startskärmen står matchen still: inga simuleringssteg körs,
    kameran går inte att flytta och alla tryck på kartan blockeras
    (`started` är falsk tills `start()` anropas).
  - Tangenten H och knappen "Bas" centrerar kameran på spelarens
    startplats (`jumpToBase`).
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
  - Under resursradens högra ände ligger en rad knappar, 110×44 px:
    "Bas" (alltid) och till vänster om den "Avmarkera" (när något är
    markerat) eller "Avbryt" (medan en byggnad placeras, och avbryter då
    bara placeringen). Vilka knappar som visas bestämmer
    `HudSource.getHudButtons`; tryck går via `pressHudButton`.
  - Varningstexten ("Din bas anfalls!") visas mitt under resursraden. På
    skärmar smalare än 700 px flyttas den ned under knapparna (`alertTop`).
  - På smala skärmar krymper kommandopanelens knappar för att dela på
    bredden (aldrig under 44 px), och kön läggs på en egen rad under
    knapparna när en rad inte räcker.
  - Startskärmen tonar ned spelet och visar titel, en kort beskrivning av
    mål och kontroller, och knappen "Starta". Texten radbryts efter
    skärmens bredd, och knappen placeras under texten hur många rader den
    än blir (`startScreenLayout`).
  - **Ett tryck som gränssnittet agerar på når aldrig kartan.** `UiScene`
    ligger överst och får trycket först. När den agerar på det anropar den
    `input.stopPropagation()`, så att `GameScene` aldrig ser det. Att bara
    fråga "ligger trycket på gränssnittet?" efteråt räcker inte: trycket
    kan ha tagit bort knappen (t.ex. "Avmarkera" eller "Starta"), och
    spelscenen skulle då ta det för ett tryck på marken.
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
  - Markeringen ändras när knappen släpps.
  - `tapAt` är fingrets motsvarighet. Med egna enheter markerade ger ett
    tryck dem samma order som ett högerklick. Undantag: ett tryck på en
    egen enhet eller byggnad markerar den i stället, utom på ett ofärdigt
    bygge när någon som kan bygga det är markerad. Utan egna enheter
    markerade fungerar trycket som ett vänsterklick.
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
- **`TouchController`** tolkar ett finger på kartan (`touchGesture.ts`):
  - Fingret börjar som *väntande*. Rör det sig minst 10 px direkt blir det
    *panorering*: kartan följer fingret 1:1.
  - Har det legat still i 300 ms blir det *hållet*, och en grön ring med
    28 px radie visas under det. Dras det sedan blir det en *dragruta*,
    som markerar egna enheter när fingret lyfts.
  - Lyfts fingret utan att ha rört sig är det ett *tryck*, oavsett hur
    länge det låg kvar. Trycket går till byggplaceringen om en byggnad
    placeras, annars till `SelectionController.tapAt`.
  - Hålltiden räknas i spelets egen tid (samma klocka som `elapsedMs`), så
    att tester kan vänta på läget i stället för på väggklockan.
  - Ett finger som sätts ned på gränssnittet hanteras inte här. Medan en
    byggnad placeras blir fingret aldrig hållet, så dragrutan är avstängd.
  - Bara ett finger följs åt gången. Nyp-zoom finns inte.
- **Byggplacering på pekskärm:** ett finger kan inte sväva över kartan
  som en muspekare. Konturen börjar därför mitt i bilden och ligger kvar på
  sina rutor när kameran flyttas. Ett tryck utanför konturen flyttar den
  dit; ett tryck på konturen bygger, om platsen är giltig. "Avbryt"
  avslutar placeringen.
- **Figurer (`render/characters/`).** Enhetstyper som finns i `CHARACTERS`
  ritas som figurer; övriga är platshållare. I dag gäller det Ramkrigaren.
  - `GameScene.preload` laddar atlasens bas, mask och JSON-fil.
    `CharacterLibrary` gör sedan **en färgad kopia av atlasen per
    spelare**: pixlarna läses ut via en canvas, `recolorPixels` räknar om
    lagfärgsdelarna (samma formel som pipelinens `recolor`), och
    resultatet läggs in som en egen textur med atlasens bildrutor. Bas-
    och masktexturerna tas sedan bort.
  - Varje enhet är därefter **en enda bild** ur sin spelares textur. Det
    kostar inget per bildruta, hur många enheter det än finns, och
    fungerar likadant i WebGL och canvas.
  - `animation.ts` väljer vad som visas, som rena funktioner:
    `activityOf` (går om enheten flyttade sig senaste steget; anfaller om
    den står still med ett mål och löpande nedkylning; annars står),
    `facingOf` (riktning ur en förflyttning i rutor), `frameAt`
    (bildruta ur tid) och `attackFrame` (bildruta ur nedkylningen, så att
    hugget träffar i samma ögonblick som skadan delas ut).
  - `EntityView.updateCharacter` ritar figuren med fötterna på enhetens
    markpunkt. Den vänder sig åt det håll den går, eller mot sitt mål när
    den slåss, och behåller riktningen när den stannar. Gång och tomgång
    går på spelets klocka, förskjutna per enhet så att inte alla rör sig
    i takt.
  - **Besegrad:** när en enhet kapitulerar spelas `defeat` en gång (0,7 s)
    på platsen där den föll. Därefter springer bilden i kapp enhetens
    verkliga läge på 0,6 s och fortsätter med gånganimationen och vit
    flagga. Det är bara bilden som dröjer; simuleringen flyttar enheten
    direkt, som förut.
  - Under varje figur ligger en mjuk skugga (en delad textur, på markens
    djup). Markering, livstapel och flagga ritas efter figurens höjd
    (`CHARACTER_VISUALS`), och ett klick träffar hela kroppen, inte bara
    en cirkel vid fötterna.
  - Träffblink och utfall fungerar som för platshållarna.
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
  - dra med mittenknappen: kartan följer pekaren 1:1. Ett finger flyttar
    kameran genom `panBy`, som `TouchController` anropar
  - vänsterknappen flyttar inte kameran (reserverad för markering i fas 3)
  - **Begränsning:** bildens mittpunkt hålls inom kartromben
    (`clampWorldToMap`). Vid en kant glider kameran längs kanten.
- Phaser-inställningar: `Scale.RESIZE` (spelytan följer fönstret),
  `AUTO`-renderare, ljud avstängt.

## Figurpipeline (`tools/blender/`)

Figurerna byggs helt med kod i Blender, utan fönster och utan externa
tjänster. Spelet ritas med Phaser i 2D, så slutprodukten blir spritesheets
(PNG + JSON-atlas). Björnkrigaren är den första figuren: den har skelett
och animationer, renderas i åtta riktningar och ritas i spelet i stället
för Ramkrigarens platshållare. Samlaren och byggnaderna är fortfarande
platshållare.

**Körning**

```
python3.13 -m venv tools/blender/.venv
tools/blender/.venv/bin/pip install -r tools/blender/requirements.txt
npm run build:characters      # alla figurer i figures.toml -> assets/characters/
tools/blender/.venv/bin/python tools/blender/build.py --race bear --unit warrior
tools/blender/.venv/bin/python tools/blender/build.py --race bear --unit warrior --sprites
tools/blender/.venv/bin/python tools/blender/build.py --race bear --unit warrior --animations
tools/blender/.venv/bin/python tools/blender/build.py --emblems
tools/blender/.venv/bin/python tools/blender/build.py --race bear --unit warrior --check-mask
```

`npm run build:characters` kör `tools/blender/build.sh`, som skapar den
virtuella miljön och installerar `bpy` första gången och sedan bygger om
alla figurer från konfigfilerna. Björnkrigarens atlas tar cirka 1,5 minut.

- Blender körs som Python-modulen `bpy` 5.3.0 (kräver Python 3.13). Den
  virtuella miljön checkas inte in.
- Renderingen görs med **Cycles på processorn**. EEVEE går inte att använda
  utan grafikkort (`libEGL.so.1` saknas i molnmiljön).
- Ett bygge av en figurs förhandsbilder tar cirka två minuter.
- Efter en ändring i en konfigfil eller animation måste atlasen byggas om
  och checkas in; spelet läser bara de färdiga filerna.
- CI kör inte pipelinen. Genererade bilder checkas in.

**Filer**

| Fil | Ansvar |
|---|---|
| `build.py` | Bygger en figur (`--race`, `--unit`) och renderar förhandsbilderna till `assets/previews/<ras>_<enhet>/`. `--sprites` renderar figurens atlas till `assets/characters/`, och `--all` gör det för alla figurer i `figures.toml`. `--animations` ritar varje animation som en rad bildrutor. `--emblems` ritar alla sigill. `--check-mask` jämför färgning via masken med direkt rendering. `--out` väljer annan mapp |
| `build.sh` | Det `npm run build:characters` kör: sätter upp Blender vid behov och bygger alla figurer |
| `figures.toml` | Listan över figurer som spelet använder |
| `animations/` | Det gemensamma animationsbiblioteket: `base.py` (byggstenar), `idle.py`, `walk.py`, `attack.py`, `gather.py`, `defeat.py` |
| `lib/atlas.py` | Packar bildrutorna till en atlas och skriver JSON-filen |
| `game.toml` | Gemensamt för alla figurer: rutstorlek, kameravinkel, skala, bildruta, kontur, skugga, kantmjukhet per delgrupp, ljus, lagfärger och sigillens färg |
| `races/<ras>.toml` | En ras: proportioner, drag (nos, kinder, ögonbryn, huggtänder, öron, puckel, svans), pälsfärger och vilket sigill den bär |
| `units/<enhet>.toml` | En enhetstyp: rustningsdelar, vapen, sköld, färger och pose |
| `emblems/<namn>.toml` | Ett sigill som platta former i lager |
| `lib/config.py` | Läser konfigfilerna |
| `lib/materials.py` | Material från hexfärger; lagfärgsmaterialet `team_color` |
| `lib/mesh.py` | `Builder` med grundformerna: `ellipsoid` (även kupol), `limb` (avsmalnande cylinder mellan två punkter), `box`, `sheet` (tyg). Sätter mjuka eller hårda kanter per delgrupp |
| `lib/skeleton.py` | Det gemensamma skelettet: benen (`BONES`), lösaren `solve` som placerar leder och ben för en pose, och `Rig` som bygger Blender-skelettet, binder delarna och bakar animationer |
| `lib/body.py` | Kroppen: bål, puckel, huvud, kinder, nos, käke, huggtänder, ögon, ögonbryn, öron, armar, ben, tassar, klor, svans |
| `lib/armor.py` | Rustningsdelar: ringbrynja, bröstplåt med bukskenor, höftplåtar, axelskydd med taggar, pälskrage, armskenor, benskenor, bälte, vapenrock, hjälm med kam, mantel |
| `lib/weapons.py` | Svärd, yxa och rundsköld |
| `lib/emblem.py` | Läser ett sigill och lägger det på en yta (sköld eller mantel); ritar det även som platt bild |
| `lib/figure.py` | Sätter ihop kropp, rustning, vapen, sköld och sigill till en figur och binder den till sitt skelett |
| `lib/camera.py` | Ortografisk kamera, ljus och den osynliga mark som fångar skuggan |
| `lib/export.py` | Cycles-inställningar, de tre renderingspassen, färgning via mask och bildoperationer (kontur, skugga, halvering, spelets mark) |

**Hur en figur byggs**

1. `solve` räknar ut ledernas och benens lägen från rasens proportioner
   och enhetens stående pose.
2. Kroppen byggs led för led av enkla former. Figuren står på z = 0 och
   tittar mot −Y; dess vänstra sida är +X.
3. Rustningen läggs utanpå och får sina mått från rasens proportioner, så
   samma enhetskonfig passar en annan ras. Varje del slås av eller på i
   enhetens konfig.
4. Vapen sätts i en hand och skölden på en underarm.
5. Varje del är ett eget objekt med namn efter grupp: `body.*`, `armor.*`,
   `weapon.*`, `shield.*`. Byggaren håller reda på vilket ben varje del
   hör till (`Builder.attach`).
6. Kroppen skuggas mjukt (kanter under 75° jämnas ut) medan rustning,
   vapen och sköld har plana, hårda ytor. Vinklarna står i `game.toml`.
7. `Rig` skapar ett Blender-skelett i samma pose och fäster varje del stelt
   vid sitt ben. Delarna böjs alltså inte; lederna täcks av kulor i
   armbågar, knän och axlar.

**Skelett.** Alla raser har samma 17 ben med samma namn och samma
föräldrar: `root` → `hips` → `chest` → `head`, `cape`, `upper_arm_l/r` →
`forearm_l/r` → `hand_l/r`, samt `hips` → `thigh_l/r` → `shin_l/r` →
`foot_l/r`. Bara längderna skiljer, och de kommer från rasens
proportioner. Vapnet följer `hand_r` och skölden `forearm_l`.

En **pose** säger åt vilket håll varje lem pekar, var fötterna står, hur
höfter, bröst och huvud är vridna, vart vapnet pekar, åt vilket håll
skölden vetter och hur långt manteln fladdrar ut. `solve` gör om det till
ett läge och en vridning per ben:

- Fötterna kan anges som mål på marken. Knät räknas då ut så att benet når
  dit (tvåledad benkinematik), vilket gör att samma gångcykel passar korta
  och långa ben.
- En lem behåller den vridning runt sin egen axel som den har i
  viloposen, så att knäskydd och axelplåtar sitter kvar på rätt sida.
- Poser anges i figurens eget rum, inte relativt en vilopose. Därför
  beror ingen animation på hur en viss figur råkar stå.

**Animationer.** Biblioteket i `animations/` är gemensamt för alla raser
och enheter. En animation är en funktion från fas (0–1) till pose. Den
utgår från enhetens egen stående pose och ändrar bara det som rör sig,
så samma gång fungerar för en krigare med svärd och sköld och för en
arbetare med fria händer. En enhets konfig listar vilka animationer den
använder (`[animations] list`).

| Animation | Bildrutor | Takt | Loop | Innehåll |
|---|---|---|---|---|
| `idle` | 6 | 4/s | Ja | Andning, vapnet vajar, huvudet vrids lite åt sidorna |
| `walk` | 8 | 16/s | Ja | Lunk: fötterna sätts i marken, höfterna gungar, armarna pendlar mot benen, manteln fladdrar |
| `attack` | 10 | 10/s | Ja | Hugg ovanifrån. Loopen börjar när hugget träffar och slutar med uppladdningen inför nästa |
| `gather` | 8 | 8/s | Ja | Arbete: ett redskap svingas ned från axeln. Används inte av krigaren |
| `defeat` | 7 | 10/s | Nej | Vacklar bakåt och går ned på knä med sänkt vapen och böjt huvud |

Loopar är sömlösa av konstruktion: periodiska rörelser använder hela
varv av sinus, och nyckelposer upprepar första posen vid fas 1. En loop
visar aldrig sin sista fas, som är lika med den första. Ingen dör i
spelet, så det som i uppdraget hette "dö" är `defeat`: figuren ger upp.

Varje animation bakas till en Blender-action med en nyckelbild per ben
och bildruta (`Rig.bake`).

**Spritesheets.** `--sprites` renderar varje animation i åtta riktningar
(`s`, `se`, `e`, `ne`, `n`, `nw`, `w`, `sw`, namngivna efter vart figuren
tittar på skärmen; `s` är mot betraktaren) med samma kamera, ljus och
skala för alla figurer. Varje bildruta renderas i två pass (figur och
mask) och får sin kontur. Björnkrigaren blir 248 bildrutor.

- **Trimning och packning.** Tom yta runt varje bild skärs bort och
  bilderna packas i rader (`lib/atlas.py`). Masken har exakt samma
  layout som basbilden, så en JSON-fil beskriver båda.
- **Format.** JSON-filen följer Phasers "JSON Hash". Bildrutorna heter
  `<animation>_<riktning>_<nummer>`. `anchor` anger fötternas punkt i den
  otrimmade rutan, så Phaser ställer figuren med fötterna på enhetens
  plats. `meta` har dessutom `scale`, `neutral` (den grå grundfärgen),
  `directions` och `animations` (bildrutor, takt och loop).
- **Skugga.** Atlasen har ingen inbakad skugga. Med skugga blev varje
  bild nästan dubbelt så stor. Spelet ritar en mjuk skugga under varje
  figur i stället.
- **Storlek.** Atlasen renderas i `atlas_scale` gånger spelets pixlar.
  Med 1 är björnkrigarens atlas 2048×676 pixlar och 2,6 MB (bas och mask).
  Med 2 blir den 4096×1300 och 8,3 MB. Förhandsbilderna renderas i
  `render_scale` (2).
- En bildruta där figuren når kanten stoppar bygget med ett felmeddelande
  (`sprite.frame` i `game.toml` är då för liten).

**Sigill.** Varje ras har ett sigill: ett djurhuvud i silhuett, i samma
anda som vapensköldar. Det beskrivs i `emblems/<namn>.toml` som former i
lager: `half` (högra halvan av en symmetrisk form), `pair` (en form som
speglas) eller `shape` (en hel form). Färgen `charge` är sigillets egen
färg; `field` släpper igenom lagfärgen och används för ögon, mun och
ränder. `build_emblem` delar formerna i små trianglar och lägger dem på en
yta via en funktion, så samma sigill passar en platt sköld och en böjd
mantel. Sigill finns för björn, tiger, apa och varg; bara björnens sitter
på en figur.

**Lagfärg och mask.** Hjälmkam, mantel, vapenrock, sköldens fält och
sigillets `field`-delar använder materialet `team_color`. De renderas inte
i någon lagfärg, utan i en neutral grå (`#bcbcbc`), och färgas efteråt.
Varje bild renderas i tre pass med samma ljus (`render_passes`):

1. **Figuren**, med lagfärgsdelarna grå.
2. **Masken**: bara lagfärgsdelarna, skuggade grå, med sin täckning som
   alfa. Övriga delar är urholkade (`is_holdout`), så att de skymmer men
   inte syns.
3. **Skuggan** på marken, från en osynlig yta som bara fångar skugga.

`recolor(bas, mask, färg)` byter sedan ut ljuset från de grå delarna mot
samma ljus skalat till lagfärgen:

```
ljus = linjär(bas) · alfa − linjär(mask) · maskalfa · (1 − linjär(färg) / linjär(grå))
```

Räkningen görs på ljusmängd (linjärt), inte på lagrade färgvärden. Spelet
ska göra samma räkning när bilderna laddas, en gång per lagfärg. Mot en
direkt rendering i lagfärgen skiljer resultatet i snitt 2–3 % per pixel
(`--check-mask`). Med vit grundfärg var felet dubbelt så stort, eftersom
vitt studsar mer ljus mellan ytorna än en riktig färg.

**Skala och upplösning.** En Blender-enhet är 24 spelpixlar. Björnen är
cirka 2,4 enheter till hjälmens topp, alltså runt 50 pixlar hög på en ruta
som är 64×32, och drygt 60 med höjt svärd. En bildruta är 184×184
spelpixlar, så att ett svärd som svingas på rak arm ryms åt alla håll; den
tomma ytan trimmas bort i atlasen. Kameran ser ned i 30°, vilket
ger spelets rutform. Figuren vrids för olika vyer; kameran och ljuset står
still, så att ljuset alltid kommer från samma håll i bilden.

**Kontur och skugga.** Figuren får en mjuk mörk kant (0,75 spelpixlar).
I förhandsbilderna läggs den ovanpå sin renderade markskugga; bara
huvudljuset kastar skugga, och skuggan tonas ut mot bildrutans kant. I
spelets atlas ingår konturen men inte skuggan.

**Deterministiskt.** Ingen slump används när figuren byggs. Cycles kör med
fast frö, fast antal strålar och utan brusreducering. Två byggen efter
varandra ger identiska filer (kontrollerat med kontrollsummor). Det är
bara kontrollerat på samma maskin och samma Blender-version.

**Förhandsbilder**

- `assets/previews/bear_warrior/`: `front.png`, `side.png`, `back.png`,
  `game_blue.png` och `game_red.png` (spelets kameravinkel),
  `mask_demo.png` (grå bas, mask och fyra färger ur samma rendering),
  `ingame_2x.png` (på spelets mark i dubbel upplösning, som på en
  telefon), `ingame_1x.png` (samma bild i spelpixlar),
  `sprite_base.png` och `sprite_mask.png` (en bildruta så som spelet
  kommer att få den) och `overview.png` (allt på ett ark).
- `assets/previews/emblems/`: ett sigill per ras och `all.png` med alla
  fyra i båda lagfärgerna.

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
| `ui.ts` | Dragtröskel, orderringens livslängd och storlek, blinktid vid nekad order, träffblink, utfall, skakning, varningstid, samt för pekskärm: hur långt ett finger får röra sig och ändå räknas som ett tryck (10 px), hålltid för dragruta (300 ms) och ringens radie |
| `ai.ts` | Datormotståndarens beslutstakt, antal arbetare, andel arbetare på trä, flest soldater, försvarsradie och anfallsvågor |
| `production.ts` | Längsta produktionskö |
| `strings.ts` | All speltext (svenska) |

## Testgränssnitt

URL-parametrar:
- `?test=1` – exponerar `window.__TEST__`. Utan parametern finns det inte.
- `?seed=N` – frö för all slump, heltal 0–4294967295. Saknas det eller är
  ogiltigt används `MAP_GEN_CONFIG.defaultSeed` (1).
- `?fog=0` – stänger av krigsdimman. Fungerar bara tillsammans med
  `?test=1`.
- `?ai=0` – ingen datormotståndare; den andra sidan står still. Fungerar
  bara tillsammans med `?test=1`.
- `?start=0` – ingen startskärm; matchen börjar direkt. Fungerar bara
  tillsammans med `?test=1`. `openGame` i `tests/e2e/helpers.ts` lägger
  till den om testet inte ber om startskärmen
  (`openGame(page, '', { startScreen: true })`).

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
| `getStartScreen()` | Startskärmen: `visible`, `title`, `help`, `button` (`label`, mittpunkt `x`/`y`) |
| `getHudButtons()` | Knapparna under resursraden: `id` (`base` eller `deselect`), `label`, mittpunkt `x`/`y`, `width`, `height`. Tom medan startskärmen visas |
| `getTouchMode()` | Vad fingret på kartan gör: `pending`, `held`, `pan`, `box`, eller `none` utan finger |
| `getShakeCount()` | Antal skärmskakningar hittills |
| `getFrameCount()` | Antal ritade bildrutor hittills. Med en klocka ger det bildfrekvensen |
| `getUnitSprite(id)` | Hur en enhet som ritas som figur ser ut just nu: `animation`, `direction`, `frame` (bildrutans namn) och `texture`. `null` för platshållare |
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

Datormotståndaren är på som standard. Den tränar, bygger och flyttar sina
enheter, och skickar sin första våg efter 4 minuter speltid. Tester av
annat än AI:n som behöver en stillastående motståndare, eller som stegar
fram längre än så, ska öppna spelet med `&ai=0`. I enhetstester:
`createGame(seed, undefined, undefined, { ai: [] })`.

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

Pekstyrning testas med ett emulerat finger (`finger(page)` i
`tests/e2e/helpers.ts`, som skickar pekhändelser via Chromes
utvecklarprotokoll; testet behöver `test.use({ hasTouch: true })`). Ett
finger som ska flytta kameran måste röra sig innan 300 ms speltid har
gått. Skicka därför nedsättningen och första rörelsen tillsammans
(`Promise.all([touch.down(…), touch.move(…)])`). Ett test som ska rita en
dragruta väntar med `expect.poll` på att `getTouchMode()` ger `held`.

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
| 9 | AI:n är en funktion som körs från `tick`, med sitt minne i `GameState` | Den blir deterministisk och följer med när tillståndet kopieras, och hela matcher kan köras i enhetstester utan webbläsare. |
| 9 | AI:n slipper krigsdimman genom ett villkor i synlighetsfrågorna | GDD:t säger att den inte påverkas av dimman. Ett ställe i koden räcker, och anfall och byggplacering fungerar utan särfall. |
| 9 | Vågorna har ett tidsfönster, inte bara en tidpunkt | Med bara en tidigaste tid kan en våg vänta för alltid på soldater som aldrig kommer. Efter fönstrets slut går den med vad som finns. |
| 10 | Fingrets hålltid räknas i spelets tid och läget syns i testgränssnittet | Tester kan vänta på att fingret blivit "hållet" i stället för att sova en viss tid, och en långsam maskin kan inte göra om en dragning till en dragruta mitt i ett test. |
| 10 | Gränssnittet stoppar tryck det agerar på (`stopPropagation`) | Ett tryck på "Avmarkera" tog bort knappen innan spelscenen frågade om trycket låg på gränssnittet. Fingret började då flytta kameran. Samma fel fanns för "Starta". |
| 10 | Byggplacering på pekskärm sker i två tryck | Ett finger ger ingen förhandsvisning som muspekaren gör. Med ett enda tryck skulle spelaren betala för en plats den inte har sett konturen på. |
| 10 | Startskärmen hoppas över efter "Spela igen" via sessionslagring | Omladdning är det enklaste sättet att börja om från ett rent tillstånd. Utan markeringen skulle spelaren få trycka "Starta" inför varje ny match. |
| 10 | Balansmålen är enhetstester (`balance.test.ts`) | En ändring i `src/data/` som bryter matchlängden eller försvaret mot första vågen syns direkt, utan att någon behöver spela. |
| Efter MVP | Figurerna byggs med kod i Blender och blir spritesheets | Spelet är 2D i Phaser. Kod i stället för handritade bilder gör figurerna parametriska: en ny ras eller enhet är en ny konfigfil. |
| Efter MVP | Cycles på processorn, inte EEVEE | EEVEE kräver grafikkort, som molnmiljön saknar. Cycles ger dessutom samma pixlar varje gång med fast frö. |
| Efter MVP | Konfigfilerna är TOML | Går att kommentera, och Python läser dem utan extra paket. |
| Efter MVP | Lagfärgen läggs på via en mask, inte genom ett spritesheet per lag | Ett spritesheet räcker för hur många lag som helst. Användarens beslut 2026-11-13. |
| Efter MVP | Lagfärgsdelarna renderas grå, inte vita, och färgas i linjärt ljus | Mätt mot direkt rendering halverade det felet, till 2–3 % per pixel. |
| Efter MVP | Bilderna renderas i dubbel upplösning | Användaren tyckte att figurerna såg pixliga ut. På skärmar med små pixlar visas då varje bildpunkt skarpt i stället för uppförstorad. |
| Efter MVP | Sigill är former i en konfigfil som läggs på ytor som geometri | Samma sigill passar sköld och mantel, och delar i lagfärg följer masken utan särskild kod. |
| Efter MVP | Figurens delar fästs stelt vid benen, utan mjuk skinning | Figuren består av hårda lågpolydelar. Stel bindning ger inga förvrängda ytor och behöver inga vikter; lederna täcks av kulor. |
| Efter MVP | En pose anger riktningar i figurens rum, och animationer utgår från enhetens stående pose | Samma animation passar alla raser och enheter, oavsett proportioner och vad de bär. |
| Efter MVP | Lagfärgen läggs på när spelet startar, som en färgad atlas per spelare | Phaser kan tona en bild, men en toning multiplicerar hela bilden. Att rita ett tonat lager ovanpå varje enhet ger två bilder per enhet och en ljus kant där lagren möts. En färdig atlas per spelare ger en bild per enhet, exakt färg och ingen kostnad per bildruta. Priset är minne: en textur per spelare. |
| Efter MVP | Attackanimationen följer enhetens nedkylning i stället för en egen klocka | Simuleringen delar ut skadan i samma steg som hugget beslutas. Animationen börjar därför där hugget träffar och laddar upp inför nästa, så bild och skada hänger ihop utan att simuleringen ändras. |
| Efter MVP | Spelets atlas är i enkel upplösning och utan inbakad skugga | Dubbel upplösning med skugga gav 11 MB att ladda före startskärmen. Spelet ritar ännu i skärmens grova pixlar, så dubbel upplösning syns inte. `atlas_scale` höjs när spelet ritar i skärmens verkliga upplösning. |
