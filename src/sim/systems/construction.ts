import { BUILDING_DEFS, CONSTRUCTION_CONFIG, type BuildingType } from '../../data/buildings';
import { CAVE_CONFIG } from '../../data/map';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import type { CommandResult } from '../commands';
import { RESOURCE_TYPES, type Cost } from '../../data/resources';
import { missingResources, pay } from '../economy';
import {
  buildingTiles,
  createBuilding,
  hasSurrendered,
  isBuilding,
  isUnit,
  nearestBuildingTile,
  removeEntity,
  tileGapToBuilding,
  unitTile,
} from '../entities';
import { inBounds, isWalkable, isWater, tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { lineTiles } from '../map/line';
import { findPath, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import { rerouteBlockedUnits, rerouteForOpening } from '../pathfinding/reroute';
import type { Building, GameState, PlayerId, Unit } from '../state';
import { plannedWorkTiles, startWorking } from './gathering';
import { isTileExplored } from './visibility';

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
 * Why a building cannot stand somewhere. `blocked`: the ground is off the
 * map, not open, taken by a building or a unit, or too close to a cave.
 * `unexplored`: the side has not seen the ground. `needsShore`: the building
 * must stand by water, and this place does not. `noWorkPlace`: the building
 * is worked from the ground around it, and here its workers would have
 * nowhere to stand: a fishing hut with no shore to fish from.
 */
export type PlacementProblem = 'blocked' | 'unexplored' | 'needsShore' | 'noWorkPlace';

/**
 * True if a building of this type may be placed with its footprint's
 * lowest corner on tile (x, y). See `placementProblem` for the rules.
 */
export function canPlaceBuilding(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
  player?: PlayerId,
): boolean {
  return placementProblem(state, type, x, y, player) === undefined;
}

/**
 * What stops a building of this type from being placed with its footprint's
 * lowest corner on tile (x, y), or undefined if it may stand there: the
 * rules of `footprintProblem`, and for a building that is worked from the
 * shore, that at least one of its workers gets a place there.
 *
 * @param from Where its builder stands. If given, only places the builder
 * can walk to count; otherwise every open place does.
 */
export function placementProblem(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
  player?: PlayerId,
  from?: Point,
): PlacementProblem | undefined {
  const problem = footprintProblem(state, type, x, y, player);
  if (problem) return problem;
  if (BUILDING_DEFS[type].work?.places !== 'shore') return undefined;
  return plannedWorkTiles(state, type, { x, y }, from).length === 0 ? 'noWorkPlace' : undefined;
}

/**
 * What is wrong with the ground a building of this type would stand on,
 * with its footprint's lowest corner on tile (x, y), or undefined if
 * nothing is. Every tile must be on the map, walkable ground, free of
 * buildings, resources and units, and not on or next to a cave. If `player`
 * is given, that side must also have explored every tile. A building that
 * needs the shore must have a tile of its footprint side by side with water.
 *
 * A building that may be put in the place of another of the side's own
 * (`replaces`), as a gate in a wall, may stand where such a one stands.
 */
export function footprintProblem(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
  player?: PlayerId,
): PlacementProblem | undefined {
  const size = BUILDING_DEFS[type].size;
  const inFootprint = (tx: number, ty: number) =>
    tx >= x && ty >= y && tx < x + size && ty < y + size;

  for (let ty = y; ty < y + size; ty++) {
    for (let tx = x; tx < x + size; tx++) {
      if (!inBounds(tx, ty, state.map)) return 'blocked';
    }
  }
  // A side can only build on ground it has seen. This comes before what is
  // on the ground: a side is not told what stands where it has never looked.
  if (player !== undefined) {
    for (let ty = y; ty < y + size; ty++) {
      for (let tx = x; tx < x + size; tx++) {
        if (!isTileExplored(state, player, tx, ty)) return 'unexplored';
      }
    }
  }
  for (let ty = y; ty < y + size; ty++) {
    for (let tx = x; tx < x + size; tx++) {
      // Walkable terrain excludes trees, berries, rocks and water.
      if (!isWalkable(state.map, tx, ty)) return 'blocked';
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
      return 'blocked';
    }
  }
  for (const entity of state.entities) {
    if (isBuilding(entity)) {
      if (isReplacedBy(entity, type, player)) continue;
      if (buildingTiles(entity).some((tile) => inFootprint(tile.x, tile.y))) return 'blocked';
    } else {
      const tile = unitTile(entity);
      if (inFootprint(tile.x, tile.y)) return 'blocked';
    }
  }
  if (BUILDING_DEFS[type].shore && !touchesWater(state.map, x, y, size)) return 'needsShore';
  return undefined;
}

/** True if a building of `type` raised by `player` would take the place of this building. */
function isReplacedBy(building: Building, type: BuildingType, player?: PlayerId): boolean {
  return (
    player !== undefined &&
    building.owner === player &&
    (BUILDING_DEFS[type].replaces?.includes(building.type) ?? false)
  );
}

/**
 * The buildings a new building of `type` with its corner on (x, y) would
 * take the place of: the side's own ones of a kind it replaces that stand
 * wholly inside its footprint.
 */
function replacedBuildings(
  state: GameState,
  type: BuildingType,
  x: number,
  y: number,
  player: PlayerId,
): Building[] {
  const size = BUILDING_DEFS[type].size;
  return state.entities.filter(
    (entity): entity is Building =>
      isBuilding(entity) &&
      isReplacedBy(entity, type, player) &&
      buildingTiles(entity).some(
        (tile) => tile.x >= x && tile.y >= y && tile.x < x + size && tile.y < y + size,
      ),
  );
}

/** True if a tile of a square footprint lies side by side with water. */
function touchesWater(map: GameState['map'], x: number, y: number, size: number): boolean {
  for (let i = 0; i < size; i++) {
    if (
      isWater(map, x + i, y - 1) ||
      isWater(map, x + i, y + size) ||
      isWater(map, x - 1, y + i) ||
      isWater(map, x + size, y + i)
    ) {
      return true;
    }
  }
  return false;
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
  // The first builder is the one who must be able to get to work there.
  const [first] = builders;
  const problem = placementProblem(state, type, x, y, player, first && unitTile(first));
  if (problem) return { ok: false, reason: 'invalidPlacement', problem };
  const missing = missingResources(stock, BUILDING_DEFS[type].cost);
  if (missing.length > 0) return { ok: false, reason: 'insufficientResources', missing };

  pay(stock, BUILDING_DEFS[type].cost);
  // What the new building takes the place of goes first; nothing is paid back for it.
  const replaced = replacedBuildings(state, type, x, y, player);
  for (const old of replaced) removeEntity(state, old.id);
  const building = raiseSite(state, type, player, x, y);

  // The site blocks its tiles at once, so units walking through must find
  // another way. A gate put into a wall opens a way for its own side instead.
  rerouteBlockedUnits(state);
  if (replaced.length > 0) rerouteForOpening(state);
  sendBuilders(buildPathGrid(state, player), builders, building);
  return { ok: true };
}

/** Puts a construction site on the map: a building with the life it starts with and no work done. */
function raiseSite(
  state: GameState,
  type: BuildingType,
  player: PlayerId,
  x: number,
  y: number,
): Building {
  const building = createBuilding(state, type, player, x, y);
  building.complete = false;
  building.hp = Math.ceil(BUILDING_DEFS[type].hp * CONSTRUCTION_CONFIG.startHpFraction);
  return building;
}

/** One tile of a wall line and what, if anything, stops a piece from standing there. */
export interface LinePiece {
  x: number;
  y: number;
  /** Why no piece can be placed here; undefined where one can. */
  problem?: PlacementProblem;
  /** True where a piece of the side's own wall already stands: nothing is placed, and nothing is wrong. */
  standing?: true;
}

/**
 * The tiles a wall drawn from one tile to another would stand on, each with
 * what stops a piece from being placed there. The line is cut off at the
 * most pieces a line may have. Tiles where something is in the way, such as
 * a tree or a unit, are left out of the wall: the rest is built around them.
 */
export function planLine(
  state: GameState,
  type: BuildingType,
  from: Point,
  to: Point,
  player?: PlayerId,
): LinePiece[] {
  return lineTiles(from, to, CONSTRUCTION_CONFIG.maxLineLength).map((tile) => {
    const standing = state.entities.some(
      (entity) =>
        isBuilding(entity) &&
        entity.owner === player &&
        BUILDING_DEFS[entity.type].wall !== undefined &&
        entity.x === tile.x &&
        entity.y === tile.y,
    );
    if (standing) return { ...tile, standing: true };
    const problem = placementProblem(state, type, tile.x, tile.y, player);
    return problem ? { ...tile, problem } : { ...tile };
  });
}

/** The pieces of a planned line that would be placed. */
export function placeablePieces(line: readonly LinePiece[]): LinePiece[] {
  return line.filter((piece) => !piece.problem && !piece.standing);
}

/**
 * Places a wall drawn out in a line from one tile to another: a
 * construction site on every tile of the line where one can stand. The
 * price of them all is taken at once, and if the side cannot pay for them
 * all nothing is placed. The given units start on the piece nearest the
 * first of them and go on along the wall as each piece is finished.
 */
export function placeLine(
  state: GameState,
  player: PlayerId,
  unitIds: readonly number[],
  type: BuildingType,
  from: Point,
  to: Point,
): CommandResult {
  const stock = state.players[player];
  const def = BUILDING_DEFS[type];
  const builders = buildersAmong(state, player, unitIds, type);
  const whole = [from.x, from.y, to.x, to.y].every(Number.isInteger);
  if (!stock || builders.length === 0 || def.wall !== 'segment' || !whole) {
    return { ok: false, reason: 'invalid' };
  }
  const line = planLine(state, type, from, to, player);
  const pieces = placeablePieces(line);
  if (pieces.length === 0) {
    const problem = line.find((piece) => piece.problem)?.problem ?? 'blocked';
    return { ok: false, reason: 'invalidPlacement', problem };
  }
  const price = lineCost(type, pieces.length);
  const missing = missingResources(stock, price);
  if (missing.length > 0) return { ok: false, reason: 'insufficientResources', missing };

  pay(stock, price);
  const sites = pieces.map((piece) => raiseSite(state, type, player, piece.x, piece.y));
  rerouteBlockedUnits(state);
  // They start at the end of the wall that is nearer to the first of them.
  const [lead] = builders as [Unit, ...Unit[]];
  const first = sites[0] as Building;
  const last = sites.at(-1) as Building;
  const start =
    tileDistance(lead.x, lead.y, last.x + 0.5, last.y + 0.5) <
    tileDistance(lead.x, lead.y, first.x + 0.5, first.y + 0.5)
      ? last
      : first;
  sendBuilders(buildPathGrid(state, player), builders, start);
  return { ok: true };
}

/** What a number of pieces of a wall cost together. */
export function lineCost(type: BuildingType, pieces: number): Cost {
  const each = BUILDING_DEFS[type].cost;
  const total: Cost = {};
  for (const resource of RESOURCE_TYPES) {
    const amount = each[resource];
    if (amount) total[resource] = amount * pieces;
  }
  return total;
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
  sendBuilders(buildPathGrid(state, player), builders, building);
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

/**
 * The unfinished piece of wall of a unit's own side that is nearest to it,
 * within the distance a builder goes on along a wall, if there is one.
 */
function nextWallPiece(state: GameState, unit: Unit): Building | undefined {
  let nearest: Building | undefined;
  let nearestDistance = Infinity;
  for (const entity of state.entities) {
    if (!isBuilding(entity) || entity.owner !== unit.owner || entity.complete) continue;
    if (BUILDING_DEFS[entity.type].wall === undefined) continue;
    if (!UNIT_DEFS[unit.type].builds.includes(entity.type)) continue;
    const distance = tileDistance(unit.x, unit.y, entity.x + 0.5, entity.y + 0.5);
    if (distance <= CONSTRUCTION_CONFIG.wallChainRadius && distance < nearestDistance) {
      nearest = entity;
      nearestDistance = distance;
    }
  }
  return nearest;
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
      // Those who raised a building that can be worked, such as a field,
      // start working it at once, as many as it takes.
      if (BUILDING_DEFS[site.type].work) {
        const grid = buildPathGrid(state, site.owner);
        for (const unit of builders) startWorking(state, grid, unit, site);
      }
      // Those who raised a piece of a wall go on with the next piece of it.
      if (BUILDING_DEFS[site.type].wall !== undefined) {
        const grid = buildPathGrid(state, site.owner);
        for (const unit of builders) {
          const next = nextWallPiece(state, unit);
          if (next) sendBuilders(grid, [unit], next);
        }
      }
    }
  }
}
