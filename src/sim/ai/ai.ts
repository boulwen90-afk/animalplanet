import { AI_CONFIG } from '../../data/ai';
import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import type { ResourceType } from '../../data/resources';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { missingResources } from '../economy';
import { buildingCentre, hasSurrendered, isBuilding, isUnit } from '../entities';
import { inBounds, isWalkable, tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { resourceAt } from '../resources';
import type { AiState, Building, GameState, PlayerId, Unit } from '../state';
import { canPlaceBuilding } from '../systems/construction';

/**
 * The computer opponent. It plays by the same rules as a person: everything
 * it does goes through applyCommand and is paid for from its own stock. Its
 * one advantage is that the fog of war does not hide anything from it.
 *
 * Once a second it goes through a fixed list: train workers, put idle
 * workers to work, build, train soldiers, defend the base, send attack waves.
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
  build(state, player, base, buildings, workers);
  assignIdleWorkers(state, player, base, workers);
  trainSoldiers(state, player, buildings, soldiers.length);

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

/** Trains soldiers, one at a time, in every finished building that can. */
function trainSoldiers(
  state: GameState,
  player: PlayerId,
  buildings: readonly Building[],
  soldiers: number,
): void {
  let planned = soldiers;
  for (const building of buildings) {
    if (!building.complete) continue;
    for (const type of BUILDING_DEFS[building.type].trains) {
      if (UNIT_DEFS[type].aggroRadius <= 0) continue;
      planned += building.queue.filter((queued) => queued === type).length;
      if (building.queue.length > 0 || planned >= AI_CONFIG.maxSoldiers) continue;
      const result = applyCommand(state, {
        type: 'train',
        player,
        buildingId: building.id,
        unit: type,
      });
      if (result.ok) planned++;
    }
  }
}

/**
 * Builds what is missing: first a barracks, then a storehouse by the forest.
 * A site left without a builder gets a new one.
 */
function build(
  state: GameState,
  player: PlayerId,
  base: Building,
  buildings: readonly Building[],
  workers: readonly Unit[],
): void {
  // Someone must be working on every construction site.
  for (const site of buildings) {
    if (site.complete) continue;
    const busy = workers.some((w) => w.task.kind === 'build' && w.task.buildingId === site.id);
    if (busy) continue;
    const helper = nearestWorker(workers, buildingCentre(site), (w) => w.task.kind !== 'build');
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
  const wanted: { type: BuildingType; near: Point }[] = [];
  if (
    !buildings.some((b) => BUILDING_DEFS[b.type].trains.some((t) => UNIT_DEFS[t].aggroRadius > 0))
  ) {
    const barracks = buildableBarracks();
    if (barracks) wanted.push({ type: barracks, near: centre });
  } else if (!buildings.some((b) => b.type !== base.type && BUILDING_DEFS[b.type].dropoff)) {
    const storehouse = buildableStorehouse();
    const forest = nearestSource(state, 'wood', centre);
    if (storehouse && forest) wanted.push({ type: storehouse, near: forest });
  }

  for (const { type, near } of wanted) {
    if (!canAfford(state, player, BUILDING_DEFS[type].cost)) continue;
    const site = findBuildSite(state, player, type, near);
    const builder = site && nearestWorker(workers, site, (w) => w.task.kind !== 'build');
    if (!site || !builder) continue;
    applyCommand(state, {
      type: 'build',
      player,
      unitIds: [builder.id],
      building: type,
      x: site.x,
      y: site.y,
    });
    return;
  }
}

/** The building type that trains soldiers. */
function buildableBarracks(): BuildingType | undefined {
  return (Object.keys(BUILDING_DEFS) as BuildingType[]).find(
    (type) =>
      BUILDING_DEFS[type].buildTime > 0 &&
      BUILDING_DEFS[type].trains.some((unit) => UNIT_DEFS[unit].aggroRadius > 0),
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
 * ground all round it, so that it does not wall anything in.
 */
function findBuildSite(
  state: GameState,
  player: PlayerId,
  type: BuildingType,
  near: Point,
): Point | undefined {
  const size = BUILDING_DEFS[type].size;
  const radius = AI_CONFIG.buildSearchRadius;
  const centreX = Math.floor(near.x);
  const centreY = Math.floor(near.y);
  let best: Point | undefined;
  let bestDistance = Infinity;

  for (let y = centreY - radius; y <= centreY + radius; y++) {
    for (let x = centreX - radius; x <= centreX + radius; x++) {
      const distance = tileDistance(x + size / 2, y + size / 2, near.x, near.y);
      if (distance >= bestDistance) continue;
      if (!canPlaceBuilding(state, type, x, y, player)) continue;
      if (!hasOpenBorder(state, x, y, size)) continue;
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

/** True if every tile in the ring around a footprint is open, walkable ground without a building. */
function hasOpenBorder(state: GameState, x: number, y: number, size: number): boolean {
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
    // If one kind has run out near and far, the worker takes the other.
    const source = nearestSource(state, resource, centre);
    const fallback = resource === 'wood' ? 'food' : 'wood';
    const target = source ?? nearestSource(state, fallback, centre);
    if (!target) continue;
    applyCommand(state, {
      type: 'gather',
      player,
      unitIds: [worker.id],
      x: target.x,
      y: target.y,
    });
    if (gatheredResource(worker) === 'wood') onWood++;
  }
}

/** What a unit is gathering right now, if anything. */
function gatheredResource(unit: Unit): ResourceType | undefined {
  return unit.task.kind === 'gather' ? unit.task.resource : undefined;
}

/** Sends the soldiers at home against enemy units that come near the main building. */
function defend(state: GameState, player: PlayerId, base: Building, home: readonly Unit[]): void {
  const centre = buildingCentre(base);
  const intruders = state.entities
    .filter(isUnit)
    .filter(
      (unit) =>
        unit.owner !== player &&
        !hasSurrendered(unit) &&
        tileDistance(unit.x, unit.y, centre.x, centre.y) <= AI_CONFIG.defendRadius,
    );
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
 * within their reach, and otherwise go for the enemy's main building.
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

  for (const soldier of soldiers) {
    if (!memory.attackers.includes(soldier.id)) continue;
    const reach = UNIT_DEFS[soldier.type].aggroRadius;
    const threat = nearestTo(
      enemyFighters.filter((e) => tileDistance(e.x, e.y, soldier.x, soldier.y) <= reach),
      soldier,
    );
    const current = soldier.task.kind === 'attack' ? soldier.task.targetId : undefined;
    const wanted = threat?.id ?? target.id;
    if (current === wanted) continue;
    // It finishes a fight it is in before turning back to the building.
    if (!threat && current !== undefined && enemyFighters.some((e) => e.id === current)) continue;
    applyCommand(state, { type: 'attack', player, unitIds: [soldier.id], targetId: wanted });
  }
}
