import { BUILDING_DEFS, CONSTRUCTION_CONFIG, type BuildingType } from '../../data/buildings';
import { CAVE_CONFIG } from '../../data/map';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import type { CommandResult } from '../commands';
import { missingResources, pay } from '../economy';
import {
  buildingTiles,
  createBuilding,
  hasSurrendered,
  isBuilding,
  isUnit,
  nearestBuildingTile,
  tileGapToBuilding,
  unitTile,
} from '../entities';
import { inBounds, isWalkable } from '../map/grid';
import type { Point } from '../map/iso';
import { canStep, findPath, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import type { Building, GameState, PlayerId, Unit } from '../state';

/** Work, in worker-steps, needed to finish a building. */
export function buildWorkFor(type: BuildingType): number {
  return Math.round(BUILDING_DEFS[type].buildTime * SIM_CONFIG.ticksPerSecond);
}

/** Work done per step by a number of workers: the first counts fully, the rest partly. */
export function buildRate(workers: number): number {
  return workers <= 0 ? 0 : 1 + CONSTRUCTION_CONFIG.extraBuilderRate * (workers - 1);
}

/** How far a building's construction has come, from 0 to 1. */
export function buildFraction(building: Building): number {
  if (building.complete) return 1;
  return Math.min(building.buildProgress / buildWorkFor(building.type), 1);
}

/**
 * True if a building of this type may be placed with its footprint's
 * lowest corner on tile (x, y): every tile must be on the map, walkable
 * ground, free of buildings, resources and units, and not on or next to a cave.
 */
export function canPlaceBuilding(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
): boolean {
  const size = BUILDING_DEFS[type].size;
  const inFootprint = (tx: number, ty: number) =>
    tx >= x && ty >= y && tx < x + size && ty < y + size;

  for (let ty = y; ty < y + size; ty++) {
    for (let tx = x; tx < x + size; tx++) {
      // Walkable terrain excludes trees, berries, rocks and water.
      if (!inBounds(tx, ty, state.map) || !isWalkable(state.map, tx, ty)) return false;
    }
  }
  // Nothing may be built on a cave or right next to one, so its entrance stays open.
  const keepClear = CAVE_CONFIG.noBuildDistance;
  for (const cave of state.map.caves) {
    if (
      cave.x >= x - keepClear &&
      cave.y >= y - keepClear &&
      cave.x < x + size + keepClear &&
      cave.y < y + size + keepClear
    ) {
      return false;
    }
  }
  for (const entity of state.entities) {
    if (isBuilding(entity)) {
      if (buildingTiles(entity).some((tile) => inFootprint(tile.x, tile.y))) return false;
    } else {
      const tile = unitTile(entity);
      if (inFootprint(tile.x, tile.y)) return false;
    }
  }
  return true;
}

/**
 * Places a construction site, takes its price from the player's stock and
 * sends the given units to build it. Nothing changes if the order is refused.
 */
export function placeBuilding(
  state: GameState,
  player: PlayerId,
  unitIds: readonly number[],
  type: BuildingType,
  x: number,
  y: number,
): CommandResult {
  const stock = state.players[player];
  const builders = buildersAmong(state, player, unitIds, type);
  if (!stock || builders.length === 0 || !Number.isInteger(x) || !Number.isInteger(y)) {
    return { ok: false, reason: 'invalid' };
  }
  if (!canPlaceBuilding(state, type, x, y)) return { ok: false, reason: 'invalidPlacement' };
  const missing = missingResources(stock, BUILDING_DEFS[type].cost);
  if (missing.length > 0) return { ok: false, reason: 'insufficientResources', missing };

  pay(stock, BUILDING_DEFS[type].cost);
  const building = createBuilding(state, type, player, x, y);
  building.complete = false;
  building.hp = Math.ceil(BUILDING_DEFS[type].hp * CONSTRUCTION_CONFIG.startHpFraction);

  // The site blocks its tiles at once, so units walking through must find another way.
  const grid = buildPathGrid(state);
  rerouteBlockedUnits(state, grid);
  sendBuilders(grid, builders, building);
  return { ok: true };
}

/** Sends the given units to help finish a building that is under construction. */
export function assistConstruction(
  state: GameState,
  player: PlayerId,
  unitIds: readonly number[],
  buildingId: number,
): CommandResult {
  const building = state.entities.find(
    (entity): entity is Building =>
      entity.id === buildingId && isBuilding(entity) && entity.owner === player,
  );
  if (!building || building.complete) return { ok: false, reason: 'invalid' };
  const builders = buildersAmong(state, player, unitIds, building.type);
  if (builders.length === 0) return { ok: false, reason: 'invalid' };
  sendBuilders(buildPathGrid(state), builders, building);
  return { ok: true };
}

/** The player's own units in the list that are able to build this type. */
function buildersAmong(
  state: GameState,
  player: PlayerId,
  unitIds: readonly number[],
  type: BuildingType,
): Unit[] {
  return state.entities
    .filter(isUnit)
    .filter(
      (unit) =>
        unit.owner === player &&
        unitIds.includes(unit.id) &&
        !hasSurrendered(unit) &&
        UNIT_DEFS[unit.type].builds.includes(type),
    );
}

/** Gives units the task of building and a path to a tile next to the site. */
function sendBuilders(grid: PathGrid, builders: readonly Unit[], building: Building): void {
  for (const unit of builders) {
    const here = unitTile(unit);
    unit.task = { kind: 'build', buildingId: building.id };
    unit.path =
      tileGapToBuilding(building, here.x, here.y) <= 1
        ? []
        : findPath(grid, here, nearestBuildingTile(building, here.x, here.y));
  }
}

/** Gives a new path to every unit whose current path no longer works. */
function rerouteBlockedUnits(state: GameState, grid: PathGrid): void {
  for (const unit of state.entities) {
    if (!isUnit(unit) || unit.path.length === 0) continue;
    if (isPathOpen(grid, unitTile(unit), unit.path)) continue;
    const destination = unit.path.at(-1) as Point;
    unit.path = findPath(grid, unitTile(unit), destination);
  }
}

/** True if every step of a path can still be walked. */
function isPathOpen(grid: PathGrid, from: Point, path: readonly Point[]): boolean {
  let previous = from;
  for (const tile of path) {
    const dx = tile.x - previous.x;
    const dy = tile.y - previous.y;
    // A unit part-way between two tiles may have its own tile first in the path.
    if ((dx !== 0 || dy !== 0) && !canStep(grid, previous.x, previous.y, dx, dy)) return false;
    previous = tile;
  }
  return true;
}

/** Runs one simulation step of every construction site and every unit with a build task. */
export function constructBuildings(state: GameState): void {
  const workers = new Map<number, Unit[]>();
  for (const unit of state.entities) {
    if (!isUnit(unit) || unit.task.kind !== 'build') continue;
    const id = unit.task.buildingId;
    const site = state.entities.find(
      (entity): entity is Building => entity.id === id && isBuilding(entity),
    );
    if (!site || site.complete || site.owner !== unit.owner) {
      unit.task = { kind: 'idle' };
      continue;
    }
    if (unit.path.length > 0) continue;
    const here = unitTile(unit);
    if (tileGapToBuilding(site, here.x, here.y) > 1) {
      // It could not get next to the site.
      unit.task = { kind: 'idle' };
      continue;
    }
    const list = workers.get(site.id) ?? [];
    list.push(unit);
    workers.set(site.id, list);
  }

  for (const [id, builders] of workers) {
    const site = state.entities.find((entity) => entity.id === id) as Building;
    const total = buildWorkFor(site.type);
    const work = Math.min(buildRate(builders.length), total - site.buildProgress);
    site.buildProgress += work;
    // Hit points grow from the starting share to full as the work is done.
    const maxHp = BUILDING_DEFS[site.type].hp;
    site.hp += (maxHp * (1 - CONSTRUCTION_CONFIG.startHpFraction) * work) / total;

    if (site.buildProgress >= total) {
      site.complete = true;
      site.buildProgress = total;
      site.hp = Math.min(Math.round(site.hp), maxHp);
      for (const unit of builders) unit.task = { kind: 'idle' };
    }
  }
}
