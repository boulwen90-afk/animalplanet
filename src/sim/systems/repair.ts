import { BUILDING_DEFS, type BuildingType } from '../../data/buildings';
import { REPAIR_CONFIG } from '../../data/repair';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import type { CommandResult } from '../commands';
import {
  buildingCentre,
  hasSurrendered,
  isBuilding,
  isUnit,
  tileGapToBuilding,
  unitDestination,
  unitTile,
} from '../entities';
import { tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { findPath, isPassable, reachableTiles, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import type { Building, Entity, GameState, PlayerId, Unit } from '../state';
import { startWorking } from './gathering';

/** The resource a repair is paid in. */
const PAID_IN = 'wood';
/** Life is counted in fractions; amounts closer than this count as the same. */
const EPSILON = 1e-9;

/** What a full repair of a building costs, from no life to all of it, in wood. */
export function fullRepairCost(type: BuildingType): number {
  const def = BUILDING_DEFS[type];
  const price = (def.repairPrice ?? def.cost)[PAID_IN] ?? 0;
  return price * REPAIR_CONFIG.costShare;
}

/** How much life one unit of wood buys back for a building; without end for one that costs nothing. */
export function lifePerWood(type: BuildingType): number {
  const cost = fullRepairCost(type);
  return cost > 0 ? BUILDING_DEFS[type].hp / cost : Infinity;
}

/**
 * What it costs in wood to give a building back `life`, counted from an
 * empty purse: wood is paid in whole units, so a part of one counts as one.
 */
export function repairCost(type: BuildingType, life: number): number {
  const perWood = lifePerWood(type);
  // The small margin keeps a division that should come out even from rounding up.
  return perWood === Infinity || life <= 0 ? 0 : Math.ceil(life / perWood - EPSILON);
}

/**
 * The work of a number of repairers, in workers: the first counts fully and
 * each one after it for less than the one before.
 */
export function repairRate(workers: number): number {
  let rate = 0;
  let share = 1;
  for (let i = 0; i < workers; i++) {
    rate += share;
    share *= REPAIR_CONFIG.workerFalloff;
  }
  return rate;
}

/** Life a number of repairers give back in one simulation step. */
export function repairPerStep(workers: number): number {
  return (REPAIR_CONFIG.hpPerSecond / SIM_CONFIG.ticksPerSecond) * repairRate(workers);
}

/** True for a finished building that has lost life. A building under construction is built, not repaired. */
export function needsRepair(building: Building): boolean {
  return building.complete && building.hp < BUILDING_DEFS[building.type].hp;
}

/**
 * What it will cost in wood to make a building whole again from here: its
 * missing life, less what has been paid for already.
 */
export function costToMend(building: Building): number {
  const missing = BUILDING_DEFS[building.type].hp - building.hp - building.repairCredit;
  return repairCost(building.type, missing);
}

/** The damaged finished building of a side that lies closest to a point, in tiles. */
export function nearestDamaged(
  entities: readonly Entity[],
  player: PlayerId,
  to: Point,
): Building | undefined {
  let best: Building | undefined;
  let bestDistance = Infinity;
  for (const entity of entities) {
    if (!isBuilding(entity) || entity.owner !== player || !needsRepair(entity)) continue;
    const centre = buildingCentre(entity);
    const distance = tileDistance(centre.x, centre.y, to.x, to.y);
    if (distance < bestDistance) {
      best = entity;
      bestDistance = distance;
    }
  }
  return best;
}

/** True for a unit that can take an order to repair: one that repairs, and has not surrendered. */
export function canRepair(unit: Unit): boolean {
  return UNIT_DEFS[unit.type].repairs && !hasSurrendered(unit);
}

/** The tiles right around a building's footprint, corners included, that are open ground. */
function ringTiles(grid: PathGrid, building: Building): Point[] {
  const size = BUILDING_DEFS[building.type].size;
  const tiles: Point[] = [];
  for (let y = building.y - 1; y <= building.y + size; y++) {
    for (let x = building.x - 1; x <= building.x + size; x++) {
      const inside =
        x >= building.x && y >= building.y && x < building.x + size && y < building.y + size;
      if (!inside && isPassable(grid, x, y)) tiles.push({ x, y });
    }
  }
  return tiles;
}

/**
 * The places round a building where a repairer can stand that nobody has:
 * open tiles right next to it that no other repairer has taken and no other
 * unit stands on or is on its way to.
 *
 * @param group Units that are being sent there together: where they stand now is not in their way.
 */
export function freeRepairPlaces(
  state: GameState,
  grid: PathGrid,
  building: Building,
  group: readonly Unit[] = [],
): Point[] {
  const taken = new Set<number>();
  const key = (tile: Point) => tile.y * grid.width + tile.x;
  for (const entity of state.entities) {
    if (!isUnit(entity) || group.includes(entity)) continue;
    if (entity.task.kind === 'repair') taken.add(key(entity.task.place));
    taken.add(key(unitDestination(entity)));
  }
  return ringTiles(grid, building).filter((tile) => !taken.has(key(tile)));
}

/**
 * Sends units to repair one of their side's damaged buildings. Each takes a
 * free place right next to it, the one nearest itself that it can walk to;
 * units that find none keep doing what they did. The order is refused if
 * the building is not the player's, is not finished, has all its life, or
 * none of the units can repair.
 */
export function orderRepair(
  state: GameState,
  player: PlayerId,
  unitIds: readonly number[],
  buildingId: number,
): CommandResult {
  const building = state.entities.find(
    (entity): entity is Building =>
      entity.id === buildingId && isBuilding(entity) && entity.owner === player,
  );
  if (!building || !needsRepair(building)) return { ok: false, reason: 'invalid' };
  const repairers = state.entities
    .filter(isUnit)
    .filter((unit) => unit.owner === player && unitIds.includes(unit.id) && canRepair(unit));
  if (repairers.length === 0) return { ok: false, reason: 'invalid' };

  const grid = buildPathGrid(state);
  const places = freeRepairPlaces(state, grid, building, repairers);
  for (const unit of repairers) {
    const here = unitTile(unit);
    const reach = reachableTiles(grid, here);
    let best = -1;
    let bestDistance = Infinity;
    places.forEach((place, i) => {
      if (!reach[place.y * grid.width + place.x]) return;
      const distance = tileDistance(place.x + 0.5, place.y + 0.5, unit.x, unit.y);
      if (distance < bestDistance) {
        best = i;
        bestDistance = distance;
      }
    });
    const place = best < 0 ? undefined : places.splice(best, 1)[0];
    if (!place) continue;
    unit.task = { kind: 'repair', buildingId: building.id, place, waiting: false };
    unit.path = place.x === here.x && place.y === here.y ? [] : findPath(grid, here, place);
  }
  return { ok: true };
}

/**
 * Runs one simulation step of every repair. The repairers standing by a
 * building give it life back, and the life is paid for in wood as it is
 * given: one unit of wood at a time, each buying a fixed amount of life.
 * With no wood left the work stands still until there is some again.
 */
export function repairBuildings(state: GameState): void {
  const crews = new Map<number, Unit[]>();
  for (const unit of state.entities) {
    if (!isUnit(unit) || unit.task.kind !== 'repair') continue;
    const id = unit.task.buildingId;
    const building = state.entities.find(
      (entity): entity is Building => entity.id === id && isBuilding(entity),
    );
    if (!building || building.owner !== unit.owner || !needsRepair(building)) {
      // The building is gone, or someone else finished the work.
      unit.task = { kind: 'idle' };
      continue;
    }
    if (unit.path.length > 0) continue;
    const here = unitTile(unit);
    if (tileGapToBuilding(building, here.x, here.y) > 1) {
      // It could not get next to the building.
      unit.task = { kind: 'idle' };
      continue;
    }
    const crew = crews.get(building.id) ?? [];
    crew.push(unit);
    crews.set(building.id, crew);
  }

  for (const [id, crew] of crews) {
    const building = state.entities.find((entity) => entity.id === id) as Building;
    const stock = state.players[building.owner];
    if (!stock) continue;
    const maxHp = BUILDING_DEFS[building.type].hp;
    const wanted = Math.min(repairPerStep(crew.length), maxHp - building.hp);

    // Buy life a unit of wood at a time until this step's work is covered.
    const perWood = lifePerWood(building.type);
    if (perWood === Infinity) building.repairCredit = wanted;
    while (building.repairCredit < wanted - EPSILON && stock.resources[PAID_IN] >= 1) {
      stock.resources[PAID_IN] -= 1;
      building.repairCredit += perWood;
    }
    const given = Math.min(wanted, building.repairCredit);
    building.hp += given;
    building.repairCredit = Math.max(0, building.repairCredit - given);

    // Out of wood: the work stands still, and the side is told so once.
    const stopped = wanted > EPSILON && given <= EPSILON;
    if (stopped && crew.some((unit) => unit.task.kind === 'repair' && !unit.task.waiting)) {
      state.events.push({ type: 'repairPaused', buildingId: building.id, owner: building.owner });
    }
    for (const unit of crew) {
      if (unit.task.kind === 'repair') unit.task.waiting = stopped;
    }

    if (building.hp >= maxHp - EPSILON) {
      building.hp = maxHp;
      for (const unit of crew) unit.task = { kind: 'idle' };
      // A building that gives work, such as a field, is worked again by those who mended it.
      if (BUILDING_DEFS[building.type].work) {
        const grid = buildPathGrid(state);
        for (const unit of crew) startWorking(state, grid, unit, building);
      }
    }
  }
}
