import { AI_CONFIG } from '../../data/ai';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import { POPULATION_CONFIG } from '../../data/population';
import type { ResourceType } from '../../data/resources';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { missingResources } from '../economy';
import {
  buildingCentre,
  hasSurrendered,
  isBuilding,
  isUnit,
  reservedPopulation,
  unitTile,
} from '../entities';
import { inBounds, isWalkable, isWater, tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { resourceAmountAt, resourceAt } from '../resources';
import type { AiState, Building, GameState, PlayerId, Unit } from '../state';
import { reachableTiles, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import { canPlaceBuilding } from '../systems/construction';
import { plannedWorkTiles } from '../systems/gathering';
import { needsRepair } from '../systems/repair';
import { isBeingResearched, nextUpgradeLevel } from '../systems/research';
import { upgradeLevel } from '../upgrades';

/**
 * The computer opponent. It plays by the same rules as a person: everything
 * it does goes through applyCommand and is paid for from its own stock. Its
 * one advantage is that the fog of war does not hide anything from it.
 *
 * Once a second it goes through a fixed list: train workers, build, repair,
 * put idle workers to work, train soldiers, work out upgrades, defend the
 * base, send attack waves.
 */
export function runAi(state: GameState): void {
  const interval = Math.max(1, Math.round(AI_CONFIG.decisionInterval * SIM_CONFIG.ticksPerSecond));
  if (state.tick % interval !== 0) return;
  state.players.forEach((side, index) => {
    if (side.ai) decide(state, index as PlayerId, side.ai);
  });
}

function decide(state: GameState, player: PlayerId, memory: AiState): void {
  const base = mainBuilding(state, player);
  if (!base) return;
  const mine = state.entities.filter((entity) => entity.owner === player);
  const units = mine.filter(isUnit).filter((unit) => !hasSurrendered(unit));
  const buildings = mine.filter(isBuilding);
  const workers = units.filter((unit) => UNIT_DEFS[unit.type].carryCapacity > 0);
  const soldiers = units.filter((unit) => UNIT_DEFS[unit.type].aggroRadius > 0);

  trainWorkers(state, player, base, workers.length);
  build(state, player, memory, base, buildings, workers);
  repair(state, player, base, buildings, workers);
  assignIdleWorkers(state, player, base, workers);
  // An upgrade it is saving for comes before more soldiers.
  const saving = research(state, player, buildings, soldiers.length);
  if (!saving) trainSoldiers(state, player, buildings, soldiers);

  // Soldiers that are gone no longer belong to a wave.
  memory.attackers = memory.attackers.filter((id) => soldiers.some((s) => s.id === id));
  const home = soldiers.filter((soldier) => !memory.attackers.includes(soldier.id));
  defend(state, player, base, home);
  sendWave(state, player, memory, home);
  driveAttackers(state, player, memory, soldiers);
}

function mainBuilding(state: GameState, player: PlayerId): Building | undefined {
  return state.entities.find(
    (entity): entity is Building =>
      isBuilding(entity) && entity.owner === player && entity.type === START_CONFIG.building,
  );
}

/** The other side's main building: what attack waves go for. */
function enemyMainBuilding(state: GameState, player: PlayerId): Building | undefined {
  return state.entities.find(
    (entity): entity is Building =>
      isBuilding(entity) && entity.owner !== player && entity.type === START_CONFIG.building,
  );
}

function canAfford(
  state: GameState,
  player: PlayerId,
  cost: Parameters<typeof missingResources>[1],
) {
  const stock = state.players[player];
  return stock !== undefined && missingResources(stock, cost).length === 0;
}

/** Trains workers, one at a time, up to the target number. */
function trainWorkers(state: GameState, player: PlayerId, base: Building, workers: number): void {
  const [type] = BUILDING_DEFS[base.type].trains;
  if (!type || base.queue.length > 0) return;
  if (workers >= AI_CONFIG.targetWorkers) return;
  applyCommand(state, { type: 'train', player, buildingId: base.id, unit: type });
}

/**
 * Trains soldiers, one at a time, in every finished building that can.
 * Soldiers that fight from a distance are kept to their share: one for
 * every few that fight hand to hand. See AI_CONFIG.throwers.
 */
function trainSoldiers(
  state: GameState,
  player: PlayerId,
  buildings: readonly Building[],
  soldiers: readonly Unit[],
): void {
  const isThrower = (type: Unit['type']) => UNIT_DEFS[type].ranged !== undefined;
  // What it has and what it has ordered, of each kind.
  let throwers = soldiers.filter((soldier) => isThrower(soldier.type)).length;
  let planned = soldiers.length;
  for (const building of buildings) {
    for (const queued of building.queue) {
      if (UNIT_DEFS[queued].aggroRadius <= 0) continue;
      planned++;
      if (isThrower(queued)) throwers++;
    }
  }
  for (const building of buildings) {
    if (!building.complete) continue;
    for (const type of BUILDING_DEFS[building.type].trains) {
      if (UNIT_DEFS[type].aggroRadius <= 0) continue;
      if (building.queue.length > 0 || planned >= AI_CONFIG.maxSoldiers) continue;
      const others = planned - throwers;
      if (isThrower(type) && (throwers + 1) * AI_CONFIG.throwers.soldiersEach > others) continue;
      const result = applyCommand(state, {
        type: 'train',
        player,
        buildingId: building.id,
        unit: type,
      });
      if (!result.ok) continue;
      planned++;
      if (isThrower(type)) throwers++;
    }
  }
}

/**
 * Builds what is missing: housing when room is running out, then a barracks,
 * then a storehouse by the forest. A site left without a builder gets a new one.
 */
function build(
  state: GameState,
  player: PlayerId,
  memory: AiState,
  base: Building,
  buildings: readonly Building[],
  workers: readonly Unit[],
): void {
  // Someone must be working on every construction site.
  for (const site of buildings) {
    if (site.complete) continue;
    const busy = workers.some((w) => w.task.kind === 'build' && w.task.buildingId === site.id);
    if (busy) continue;
    const helper = nearestWorker(workers, buildingCentre(site), isFreeToBuild);
    if (helper) {
      applyCommand(state, {
        type: 'construct',
        player,
        unitIds: [helper.id],
        buildingId: site.id,
      });
    }
    return;
  }

  const centre = buildingCentre(base);
  const wanted: { type: BuildingType; near: Point; within?: number }[] = [];
  // Housing comes first: without room it can train nothing else. It builds
  // the next house while there is still a little room left.
  const housing = buildableHousing();
  if (housing && needsHousing(state, player, buildings)) {
    wanted.push({ type: housing, near: centre });
  }
  const hasBarracks = buildings.some(
    (b) => b.complete && BUILDING_DEFS[b.type].trains.some((t) => UNIT_DEFS[t].aggroRadius > 0),
  );
  const barracks = buildableBarracks();
  if (barracks && !buildings.some((b) => b.type === barracks)) {
    wanted.push({ type: barracks, near: centre });
  } else if (!buildings.some((b) => b.type !== base.type && BUILDING_DEFS[b.type].dropoff)) {
    const storehouse = buildableStorehouse();
    const forest = nearestSource(state, 'wood', centre);
    if (storehouse && forest) wanted.push({ type: storehouse, near: forest });
  } else if (hasBarracks) {
    // With a finished barracks and a storehouse: a throwing range, once.
    const range = buildableRange();
    if (range && !buildings.some((b) => b.type === range)) {
      wanted.push({ type: range, near: centre });
    }
  }

  // Food without end last: it is for when the berries run low, not instead
  // of the rest. A fishing hut if there is water within reach, since fish
  // comes faster; otherwise, and after it, fields.
  if (placesWanted(state, centre, workers.length) > workPlacesOf(buildings, 'food')) {
    const hut = buildableWorkplace('food', true);
    const huts = buildings.filter((b) => b.type === hut).length;
    const shore =
      hut && huts < AI_CONFIG.fishing.max
        ? findBuildSite(state, player, hut, centre, AI_CONFIG.fishing.reach)
        : undefined;
    const field = buildableWorkplace('food', false);
    if (hut && shore) wanted.push({ type: hut, near: centre, within: AI_CONFIG.fishing.reach });
    else if (field) wanted.push({ type: field, near: centre });
  }

  // Towers last of all: with wood to spare, on the side that faces the enemy.
  const tower = buildableTower();
  const towers = memory.towersPlaced;
  if (
    tower &&
    hasBarracks &&
    towers < AI_CONFIG.towers.max &&
    (state.players[player]?.resources.wood ?? 0) >= AI_CONFIG.towers.whenWood
  ) {
    wanted.push({ type: tower, near: towerSpot(state, player, centre, towers) });
  }

  // A smithy, once: for when there is wood to spare after all that.
  const forge = buildableForge();
  if (
    forge &&
    hasBarracks &&
    !buildings.some((b) => b.type === forge) &&
    (state.players[player]?.resources.wood ?? 0) >= AI_CONFIG.research.whenWood
  ) {
    wanted.push({ type: forge, near: centre });
  }

  for (const { type, near, within } of wanted) {
    if (!canAfford(state, player, BUILDING_DEFS[type].cost)) continue;
    const site = findBuildSite(state, player, type, near, within);
    const builder = site && nearestWorker(workers, site, isFreeToBuild);
    if (!site || !builder) continue;
    const placed = applyCommand(state, {
      type: 'build',
      player,
      unitIds: [builder.id],
      building: type,
      x: site.x,
      y: site.y,
    });
    if (placed.ok && type === tower) memory.towersPlaced++;
    return;
  }
}

/** The building type where upgrades are worked out. */
function buildableForge(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) => BUILDING_DEFS[type].buildTime > 0 && BUILDING_DEFS[type].researches !== undefined,
  );
}

/**
 * Works out upgrades in the side's idle smithies: the next one in the
 * configured order that it has the fewest levels of, as soon as it can pay
 * for it. See AI_CONFIG.research.
 *
 * @returns True if it wants an upgrade it cannot pay for yet and has
 * soldiers enough to wait: it is saving, and should train no more soldiers
 * this time.
 */
function research(
  state: GameState,
  player: PlayerId,
  buildings: readonly Building[],
  soldiers: number,
): boolean {
  const stock = state.players[player];
  if (!stock) return false;
  const { order, saveAbove } = AI_CONFIG.research;
  let saving = false;
  for (const building of buildings) {
    const offered = BUILDING_DEFS[building.type].researches;
    if (!offered || !building.complete || building.research.length > 0) continue;
    const candidates = order
      .filter((upgrade) => offered.includes(upgrade))
      .filter((upgrade) => nextUpgradeLevel(state, player, upgrade) !== undefined)
      .filter((upgrade) => !isBeingResearched(state, player, upgrade))
      .sort(
        (a, b) =>
          upgradeLevel(state, player, a) - upgradeLevel(state, player, b) ||
          order.indexOf(a) - order.indexOf(b),
      );
    const [next] = candidates;
    const level = next && nextUpgradeLevel(state, player, next);
    if (!next || !level) continue;
    if (canAfford(state, player, level.cost)) {
      applyCommand(state, { type: 'research', player, buildingId: building.id, upgrade: next });
    } else if (soldiers >= saveAbove) {
      saving = true;
    }
  }
  return saving;
}

/** The building type that shoots at enemies by itself. */
function buildableTower(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) => BUILDING_DEFS[type].buildTime > 0 && BUILDING_DEFS[type].attack !== undefined,
  );
}

/**
 * Where a side wants its tower number `index` (from 0): a set distance from
 * the middle of its main building towards the enemy's, the towers fanned
 * out to either side of that line.
 */
function towerSpot(state: GameState, player: PlayerId, centre: Point, index: number): Point {
  const { max, distance, spread } = AI_CONFIG.towers;
  const enemy = enemyMainBuilding(state, player);
  const towards = enemy
    ? buildingCentre(enemy)
    : { x: state.map.width / 2, y: state.map.height / 2 };
  const facing = Math.atan2(towards.y - centre.y, towards.x - centre.x);
  const angle = facing + ((index - (max - 1) / 2) * spread * Math.PI) / 180;
  return {
    x: Math.round(centre.x + Math.cos(angle) * distance),
    y: Math.round(centre.y + Math.sin(angle) * distance),
  };
}

/** True for a worker that is neither building nor repairing, and so can be sent to do either. */
function isFreeToBuild(worker: Unit): boolean {
  return worker.task.kind !== 'build' && worker.task.kind !== 'repair';
}

/**
 * Mends damaged buildings while the base is left in peace. See
 * AI_CONFIG.repair. A repairer is taken off the work by a move order to
 * where it stands, which leaves it idle for the next step to put to work.
 */
function repair(
  state: GameState,
  player: PlayerId,
  base: Building,
  buildings: readonly Building[],
  workers: readonly Unit[],
): void {
  const { below, workers: crewSize, minWood } = AI_CONFIG.repair;
  const stop = (worker: Unit) => {
    const here = unitTile(worker);
    applyCommand(state, { type: 'move', player, unitIds: [worker.id], x: here.x, y: here.y });
  };
  const repairers = workers.filter((worker) => worker.task.kind === 'repair');
  if (intrudersNear(state, player, base).length > 0) {
    repairers.forEach(stop);
    return;
  }
  // Out of wood: the hands are better used gathering some.
  repairers.filter((w) => w.task.kind === 'repair' && w.task.waiting).forEach(stop);

  const crewOf = (building: Building) =>
    workers.filter((w) => w.task.kind === 'repair' && w.task.buildingId === building.id);
  const share = (building: Building) => building.hp / BUILDING_DEFS[building.type].hp;
  // What is already being mended is finished first; then the worst hurt.
  const damaged = buildings
    .filter((building) => needsRepair(building))
    .filter((building) => crewOf(building).length > 0 || share(building) < below)
    .sort(
      (a, b) =>
        Math.sign(crewOf(b).length - crewOf(a).length) || share(a) - share(b) || a.id - b.id,
    );
  const [target] = damaged;
  if (!target) return;
  const missing = crewSize - crewOf(target).length;
  if (missing <= 0 || (state.players[player]?.resources.wood ?? 0) < minWood) return;
  const helpers: Unit[] = [];
  for (let i = 0; i < missing; i++) {
    const helper = nearestWorker(
      workers,
      buildingCentre(target),
      (w) => isFreeToBuild(w) && !helpers.includes(w),
    );
    if (helper) helpers.push(helper);
  }
  if (helpers.length === 0) return;
  applyCommand(state, {
    type: 'repair',
    player,
    unitIds: helpers.map((helper) => helper.id),
    buildingId: target.id,
  });
}

/** The building type that only gives room for more units. */
function buildableHousing(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) =>
      BUILDING_DEFS[type].buildTime > 0 &&
      BUILDING_DEFS[type].housing > 0 &&
      BUILDING_DEFS[type].trains.length === 0 &&
      !BUILDING_DEFS[type].dropoff,
  );
}

/**
 * True if the side is about to run out of room: counting the houses already
 * under construction, it has no more than the margin left, and it has not
 * reached the most room a side can have.
 */
function needsHousing(state: GameState, player: PlayerId, buildings: readonly Building[]): boolean {
  let room = 0;
  for (const building of buildings) room += BUILDING_DEFS[building.type].housing;
  if (room >= POPULATION_CONFIG.hardCap) return false;
  return room - reservedPopulation(state, player) <= AI_CONFIG.housingMargin;
}

/**
 * The building type where workers work for a resource without end: the one
 * that must stand by water (a fishing hut), or the one that can stand
 * anywhere (a field).
 */
function buildableWorkplace(resource: ResourceType, shore: boolean): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) =>
      BUILDING_DEFS[type].buildTime > 0 &&
      BUILDING_DEFS[type].work?.resource === resource &&
      (BUILDING_DEFS[type].shore === true) === shore,
  );
}

/** How many workers a side's fields and huts for a resource take, finished or not. */
function workPlacesOf(buildings: readonly Building[], resource: ResourceType): number {
  let places = 0;
  for (const building of buildings) {
    const work = BUILDING_DEFS[building.type].work;
    if (work?.resource === resource) places += work.workers;
  }
  return places;
}

/** How much food is left in the berry bushes within reach of a point. */
function berriesLeft(state: GameState, centre: Point): number {
  const { map } = state;
  const radius = AI_CONFIG.fields.berryRadius;
  let left = 0;
  for (let y = Math.floor(centre.y - radius); y <= centre.y + radius; y++) {
    for (let x = Math.floor(centre.x - radius); x <= centre.x + radius; x++) {
      if (resourceAt(map, x, y) !== 'food') continue;
      if (tileDistance(x, y, centre.x, centre.y) > radius) continue;
      left += resourceAmountAt(map, x, y);
    }
  }
  return left;
}

/**
 * How many places to work for food without end the side should have by now,
 * where a field is one: none while there are plenty of berries near its
 * base, then more the lower they run, and never more than it has workers
 * for food.
 */
function placesWanted(state: GameState, centre: Point, workers: number): number {
  const { startWhenFoodLeft, foodPerField, max } = AI_CONFIG.fields;
  const short = startWhenFoodLeft - berriesLeft(state, centre);
  if (short <= 0) return 0;
  const onFood = workers - Math.round(workers * AI_CONFIG.woodShare);
  return Math.min(Math.ceil(short / foodPerField), max, onFood);
}

/** The building type that trains soldiers who fight hand to hand. */
function buildableBarracks(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) =>
      BUILDING_DEFS[type].buildTime > 0 &&
      BUILDING_DEFS[type].trains.some(
        (unit) => UNIT_DEFS[unit].aggroRadius > 0 && UNIT_DEFS[unit].ranged === undefined,
      ),
  );
}

/** The building type that trains soldiers who fight from a distance. */
function buildableRange(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) =>
      BUILDING_DEFS[type].buildTime > 0 &&
      BUILDING_DEFS[type].trains.some((unit) => UNIT_DEFS[unit].ranged !== undefined),
  );
}

/** The building type that is only a drop-off point. */
function buildableStorehouse(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) =>
      BUILDING_DEFS[type].buildTime > 0 &&
      BUILDING_DEFS[type].dropoff &&
      BUILDING_DEFS[type].trains.length === 0,
  );
}

function nearestWorker(
  workers: readonly Unit[],
  to: Point,
  accept: (worker: Unit) => boolean,
): Unit | undefined {
  let best: Unit | undefined;
  let bestDistance = Infinity;
  for (const worker of workers) {
    if (!accept(worker)) continue;
    const distance = tileDistance(worker.x, worker.y, to.x, to.y);
    if (distance < bestDistance) {
      best = worker;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * A place for a building as close to `near` as possible, with a tile of open
 * ground all round it, so that it does not wall anything in. A building
 * that stands by water may have water there. With `within`, the middle of
 * the building must be no further than that from `near`, in tiles.
 */
function findBuildSite(
  state: GameState,
  player: PlayerId,
  type: BuildingType,
  near: Point,
  within?: number,
): Point | undefined {
  const radius = Math.ceil(within ?? AI_CONFIG.buildSearchRadius);
  const size = BUILDING_DEFS[type].size;
  const waterAllowed = BUILDING_DEFS[type].shore === true;
  const work = BUILDING_DEFS[type].work;
  // Its workers must be able to walk there: made when the first place is tried.
  let grid: PathGrid | undefined;
  let canReach: Uint8Array | undefined;
  const reachable = (x: number, y: number): boolean => {
    grid ??= buildPathGrid(state);
    canReach ??= reachFromBase(state, grid, player);
    // Next to it is enough: a builder works from beside the footprint.
    for (let ty = y - 1; ty <= y + size; ty++) {
      for (let tx = x - 1; tx <= x + size; tx++) {
        if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) continue;
        if (canReach[ty * grid.width + tx] === 1) return true;
      }
    }
    return false;
  };
  const centreX = Math.floor(near.x);
  const centreY = Math.floor(near.y);
  let best: Point | undefined;
  let bestDistance = Infinity;

  for (let y = centreY - radius; y <= centreY + radius; y++) {
    for (let x = centreX - radius; x <= centreX + radius; x++) {
      const distance = tileDistance(x + size / 2, y + size / 2, near.x, near.y);
      if (distance >= bestDistance || (within !== undefined && distance > within)) continue;
      if (!canPlaceBuilding(state, type, x, y, player)) continue;
      if (!hasOpenBorder(state, x, y, size, waterAllowed)) continue;
      if (!reachable(x, y)) continue;
      // A hut is worth building only where all its fishers get a place on
      // the shore that they can walk to.
      if (work?.places === 'shore') {
        const from = workerTile(state, player);
        if (!from || plannedWorkTiles(state, type, { x, y }, from).length < work.workers) continue;
      }
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

/** The tile one of a side's workers stands on, if it has any. */
function workerTile(state: GameState, player: PlayerId): Point | undefined {
  const worker = state.entities.find(
    (entity): entity is Unit =>
      isUnit(entity) &&
      entity.owner === player &&
      !hasSurrendered(entity) &&
      UNIT_DEFS[entity.type].carryCapacity > 0,
  );
  return worker && unitTile(worker);
}

/** The tiles a side's workers can walk to from where they are; all of the map if it has none. */
function reachFromBase(state: GameState, grid: PathGrid, player: PlayerId): Uint8Array {
  const from = workerTile(state, player);
  if (!from) return new Uint8Array(grid.width * grid.height).fill(1);
  return reachableTiles(grid, from);
}

/**
 * True if every tile in the ring around a footprint is open, walkable ground
 * without a building, or, where that is allowed, water.
 */
function hasOpenBorder(
  state: GameState,
  x: number,
  y: number,
  size: number,
  waterAllowed: boolean,
): boolean {
  const occupied = new Set<number>();
  for (const entity of state.entities) {
    if (!isBuilding(entity)) continue;
    const side = BUILDING_DEFS[entity.type].size;
    for (let ty = entity.y; ty < entity.y + side; ty++) {
      for (let tx = entity.x; tx < entity.x + side; tx++) occupied.add(ty * state.map.width + tx);
    }
  }
  for (let ty = y - 1; ty <= y + size; ty++) {
    for (let tx = x - 1; tx <= x + size; tx++) {
      const inside = tx >= x && ty >= y && tx < x + size && ty < y + size;
      if (inside) continue;
      if (waterAllowed && isWater(state.map, tx, ty)) continue;
      if (!inBounds(tx, ty, state.map) || !isWalkable(state.map, tx, ty)) return false;
      if (occupied.has(ty * state.map.width + tx)) return false;
    }
  }
  return true;
}

/** The source of a resource closest to a point. */
function nearestSource(state: GameState, resource: ResourceType, to: Point): Point | undefined {
  const { map } = state;
  let best: Point | undefined;
  let bestDistance = Infinity;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      if (resourceAt(map, x, y) !== resource) continue;
      const distance = tileDistance(x, y, to.x, to.y);
      if (distance < bestDistance) {
        best = { x, y };
        bestDistance = distance;
      }
    }
  }
  return best;
}

/**
 * Sends idle workers to gather, keeping the configured share of the workers
 * on wood and the rest on food.
 */
function assignIdleWorkers(
  state: GameState,
  player: PlayerId,
  base: Building,
  workers: readonly Unit[],
): void {
  let onWood = workers.filter((worker) => gatheredResource(worker) === 'wood').length;
  const wantedOnWood = Math.round(workers.length * AI_CONFIG.woodShare);
  const centre = buildingCentre(base);

  for (const worker of workers) {
    if (worker.task.kind !== 'idle' || worker.path.length > 0) continue;
    const resource: ResourceType = onWood < wantedOnWood ? 'wood' : 'food';
    const source = nearestSource(state, resource, centre);
    // Berries near the base come first: they give food faster than a field.
    const near =
      source !== undefined &&
      tileDistance(source.x, source.y, centre.x, centre.y) <= AI_CONFIG.fields.berryRadius;
    if (source && (resource === 'wood' || near)) gather(state, player, worker, source);
    // With none near, or none with a place free, it fishes or works a
    // field: where the food comes fastest first.
    if (worker.task.kind === 'idle' && resource === 'food') workForFood(state, player, worker);
    // Then berries however far away, and last the other resource.
    if (worker.task.kind === 'idle' && source) gather(state, player, worker, source);
    if (worker.task.kind === 'idle') {
      const other = nearestSource(state, resource === 'wood' ? 'food' : 'wood', centre);
      if (other) gather(state, player, worker, other);
    }
    if (gatheredResource(worker) === 'wood') onWood++;
  }

  // A worker picking berries far from the base moves to a hut or a field as
  // soon as one has a place free: the walk home with each load is long.
  for (const worker of workers) {
    const task = worker.task;
    if (task.kind !== 'gather' || task.resource !== 'food' || task.siteId !== null) continue;
    const far =
      tileDistance(task.node.x, task.node.y, centre.x, centre.y) > AI_CONFIG.fields.berryRadius;
    if (far) workForFood(state, player, worker);
  }
}

/**
 * Orders a worker to a fishing hut or a field of its side: the one where
 * food comes fastest first. It keeps what it was doing if none has a place free.
 */
function workForFood(state: GameState, player: PlayerId, worker: Unit): void {
  const places = state.entities
    .filter(
      (entity): entity is Building =>
        isBuilding(entity) &&
        entity.owner === player &&
        entity.complete &&
        BUILDING_DEFS[entity.type].work?.resource === 'food',
    )
    .sort(
      (a, b) =>
        (BUILDING_DEFS[a.type].work?.secondsPerUnit ?? 0) -
          (BUILDING_DEFS[b.type].work?.secondsPerUnit ?? 0) || a.id - b.id,
    );
  for (const place of places) {
    if (worker.task.kind === 'gather' && worker.task.siteId !== null) return;
    applyCommand(state, { type: 'work', player, unitIds: [worker.id], buildingId: place.id });
  }
}

function gather(state: GameState, player: PlayerId, worker: Unit, source: Point): void {
  applyCommand(state, {
    type: 'gather',
    player,
    unitIds: [worker.id],
    x: source.x,
    y: source.y,
  });
}

/** What a unit is gathering right now, if anything. */
function gatheredResource(unit: Unit): ResourceType | undefined {
  return unit.task.kind === 'gather' ? unit.task.resource : undefined;
}

/** Sends the soldiers at home against enemy units that come near the main building. */
function defend(state: GameState, player: PlayerId, base: Building, home: readonly Unit[]): void {
  const intruders = intrudersNear(state, player, base);
  if (intruders.length === 0) return;

  for (const soldier of home) {
    if (soldier.task.kind === 'attack') continue;
    const target = nearestTo(intruders, soldier);
    if (target) {
      applyCommand(state, {
        type: 'attack',
        player,
        unitIds: [soldier.id],
        targetId: target.id,
      });
    }
  }
}

/** The enemy units near a side's main building: while there are any, the base is under attack. */
function intrudersNear(state: GameState, player: PlayerId, base: Building): Unit[] {
  const centre = buildingCentre(base);
  return state.entities
    .filter(isUnit)
    .filter(
      (unit) =>
        unit.owner !== player &&
        !hasSurrendered(unit) &&
        tileDistance(unit.x, unit.y, centre.x, centre.y) <= AI_CONFIG.defendRadius,
    );
}

function nearestTo(units: readonly Unit[], to: Unit): Unit | undefined {
  let best: Unit | undefined;
  let bestDistance = Infinity;
  for (const unit of units) {
    const distance = tileDistance(unit.x, unit.y, to.x, to.y);
    if (distance < bestDistance) {
      best = unit;
      bestDistance = distance;
    }
  }
  return best;
}

/** The time window and size of the wave with the given number, counting from 0. */
export function waveAt(index: number): { earliest: number; latest: number; size: number } {
  const listed = AI_CONFIG.waves[index];
  if (listed) return listed;
  const last = AI_CONFIG.waves[AI_CONFIG.waves.length - 1];
  const extra = index - AI_CONFIG.waves.length + 1;
  const earliest = (last?.earliest ?? 0) + extra * AI_CONFIG.repeat.interval;
  return {
    earliest,
    latest: earliest + AI_CONFIG.repeat.window,
    size: AI_CONFIG.repeat.size,
  };
}

/** Sends the next attack wave when its time has come. */
function sendWave(
  state: GameState,
  player: PlayerId,
  memory: AiState,
  home: readonly Unit[],
): void {
  const target = enemyMainBuilding(state, player);
  if (!target || home.length === 0) return;
  const wave = waveAt(memory.waveTicks.length);
  const seconds = state.tick / SIM_CONFIG.ticksPerSecond;
  if (seconds < wave.earliest) return;
  // Before the latest time it waits for the full number; after it, it goes with what it has.
  if (home.length < wave.size && seconds < wave.latest) return;

  const going = home.slice(0, Math.max(wave.size, 1));
  const result = applyCommand(state, {
    type: 'attack',
    player,
    unitIds: going.map((soldier) => soldier.id),
    targetId: target.id,
  });
  if (!result.ok) return;
  memory.attackers.push(...going.map((soldier) => soldier.id));
  memory.waveTicks.push(state.tick);
}

/**
 * Keeps the soldiers of a wave at it: they fight enemy soldiers that come
 * within their reach, then tear down a tower that can shoot them where they
 * stand, and otherwise go for the enemy's main building. A soldier that
 * fights from a distance turns on a tower sooner: when the tower is just
 * outside its own range, so that it never has to step into the tower's.
 */
function driveAttackers(
  state: GameState,
  player: PlayerId,
  memory: AiState,
  soldiers: readonly Unit[],
): void {
  const target = enemyMainBuilding(state, player);
  if (!target) return;
  const enemyFighters = state.entities
    .filter(isUnit)
    .filter(
      (unit) =>
        unit.owner !== player && !hasSurrendered(unit) && UNIT_DEFS[unit.type].aggroRadius > 0,
    );

  const enemyTowers = state.entities.filter(
    (entity): entity is Building =>
      isBuilding(entity) &&
      entity.owner !== player &&
      entity.complete &&
      BUILDING_DEFS[entity.type].attack !== undefined,
  );

  for (const soldier of soldiers) {
    if (!memory.attackers.includes(soldier.id)) continue;
    const reach = UNIT_DEFS[soldier.type].aggroRadius;
    const threat = nearestTo(
      enemyFighters.filter((e) => tileDistance(e.x, e.y, soldier.x, soldier.y) <= reach),
      soldier,
    );
    // A tower that has the soldier within its range, or that the soldier
    // will soon have within its own: the nearest such one.
    const ownRange = UNIT_DEFS[soldier.type].ranged?.range;
    const notices = ownRange === undefined ? 0 : ownRange + AI_CONFIG.throwers.towerMargin;
    let tower: Building | undefined;
    let towerDistance = Infinity;
    for (const candidate of enemyTowers) {
      const centre = buildingCentre(candidate);
      const distance = tileDistance(centre.x, centre.y, soldier.x, soldier.y);
      const range = Math.max(BUILDING_DEFS[candidate.type].attack?.range ?? 0, notices);
      if (distance <= range && distance < towerDistance) {
        tower = candidate;
        towerDistance = distance;
      }
    }
    const current = soldier.task.kind === 'attack' ? soldier.task.targetId : undefined;
    const wanted = threat?.id ?? tower?.id ?? target.id;
    if (current === wanted) continue;
    // It finishes a fight it is in before turning back to the building.
    if (!threat && current !== undefined && enemyFighters.some((e) => e.id === current)) continue;
    applyCommand(state, { type: 'attack', player, unitIds: [soldier.id], targetId: wanted });
  }
}
