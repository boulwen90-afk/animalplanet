import { BUILDING_DEFS } from '../../data/buildings';
import { GATHER_CONFIG, type ResourceType } from '../../data/resources';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import {
  isBuilding,
  isUnit,
  nearestBuildingTile,
  tileGapToBuilding,
  unitDestination,
  unitTile,
} from '../entities';
import { tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { findPath, reachableTiles, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import { resourceAt, takeFromSource } from '../resources';
import type { Building, GameState, GatherTask, Unit } from '../state';

/** The eight tiles around a tile. */
const AROUND: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** Most phase changes handled for one unit in one step; a safety limit, never reached in practice. */
const MAX_TRANSITIONS = 6;

/**
 * The walkable tiles, built when first needed and rebuilt after a source is
 * emptied, since an emptied source turns into open ground.
 */
class GridCache {
  private grid: PathGrid | undefined;

  constructor(private readonly state: GameState) {}

  get(): PathGrid {
    this.grid ??= buildPathGrid(this.state);
    return this.grid;
  }

  invalidate(): void {
    this.grid = undefined;
  }
}

/** Runs one simulation step of every gathering unit. */
export function gatherResources(state: GameState): void {
  const grids = new GridCache(state);
  for (const entity of state.entities) {
    if (!isUnit(entity) || entity.task.kind !== 'gather') continue;
    // A unit may finish one phase and start the next within the same step.
    for (let i = 0; i < MAX_TRANSITIONS && stepGatherer(state, entity, grids); i++);
  }
}

/**
 * Orders a unit to gather `resource` from the source at `near`, or if that
 * source cannot be reached, from the closest one within the search radius.
 * Returns false, leaving the unit as it was, if the unit cannot gather or
 * there is no source to go to.
 */
export function startGathering(
  state: GameState,
  grid: PathGrid,
  unit: Unit,
  resource: ResourceType,
  near: Point,
): boolean {
  const capacity = UNIT_DEFS[unit.type].carryCapacity;
  if (capacity <= 0) return false;
  const node = findSource(state, grid, unit, resource, near);
  if (!node) return false;

  // A load of another kind is dropped when the unit switches resource.
  if (unit.carryType !== resource) {
    unit.carryType = resource;
    unit.carryAmount = 0;
  }
  const task: GatherTask = {
    kind: 'gather',
    resource,
    node,
    phase: 'toSource',
    workTicks: 0,
    dropoffId: null,
  };
  unit.task = task;
  if (unit.carryAmount >= capacity) headToDropoff(state, grid, unit, task);
  else walkToSource(state, grid, unit, task);
  return true;
}

/** Advances a gathering unit. Returns true if it changed phase and should be run again this step. */
function stepGatherer(state: GameState, unit: Unit, grids: GridCache): boolean {
  const task = unit.task;
  if (task.kind !== 'gather') return false;
  const here = unitTile(unit);
  const sourceLeft = resourceAt(state.map, task.node.x, task.node.y) === task.resource;

  switch (task.phase) {
    case 'toSource': {
      if (unit.path.length > 0) return false;
      if (sourceLeft && isNextTo(here, task.node)) {
        task.phase = 'gathering';
        task.workTicks = 0;
        return true;
      }
      // The source is gone, or the unit could not get next to it.
      return retarget(state, grids.get(), unit, task);
    }

    case 'gathering': {
      if (!sourceLeft) return retarget(state, grids.get(), unit, task);
      task.workTicks++;
      if (task.workTicks >= ticksPerUnit(unit)) {
        task.workTicks = 0;
        unit.carryAmount += takeFromSource(state.map, task.node.x, task.node.y, 1);
        if (resourceAt(state.map, task.node.x, task.node.y) === undefined) grids.invalidate();
      }
      if (unit.carryAmount >= UNIT_DEFS[unit.type].carryCapacity) {
        return headToDropoff(state, grids.get(), unit, task);
      }
      if (resourceAt(state.map, task.node.x, task.node.y) === undefined) {
        return retarget(state, grids.get(), unit, task);
      }
      return false;
    }

    case 'toDropoff': {
      if (unit.path.length > 0) return false;
      const building = state.entities.find(
        (entity): entity is Building => entity.id === task.dropoffId && isBuilding(entity),
      );
      if (building?.complete && tileGapToBuilding(building, here.x, here.y) <= 1) {
        const stock = state.players[unit.owner];
        if (stock) stock.resources[task.resource] += unit.carryAmount;
        unit.carryAmount = 0;
        task.phase = 'toSource';
        task.dropoffId = null;
        walkToSource(state, grids.get(), unit, task);
        return true;
      }
      // The building is gone, or the unit could not get next to it.
      return headToDropoff(state, grids.get(), unit, task);
    }
  }
}

/** Simulation steps a unit works for each unit of resource. */
function ticksPerUnit(unit: Unit): number {
  return Math.max(1, Math.round(SIM_CONFIG.ticksPerSecond / UNIT_DEFS[unit.type].gatherRate));
}

function isNextTo(tile: Point, node: Point): boolean {
  return Math.max(Math.abs(tile.x - node.x), Math.abs(tile.y - node.y)) === 1;
}

/**
 * Moves on when the current source is used up: to another source of the same
 * kind near the unit, otherwise home with whatever it carries, otherwise idle.
 */
function retarget(state: GameState, grid: PathGrid, unit: Unit, task: GatherTask): boolean {
  const next = findSource(state, grid, unit, task.resource, unitTile(unit));
  if (next) {
    task.node = next;
    task.phase = 'toSource';
    task.workTicks = 0;
    walkToSource(state, grid, unit, task);
    // Run again only if the unit is already standing next to the new source.
    return unit.path.length === 0 && isNextTo(unitTile(unit), next);
  }
  if (unit.carryAmount > 0 && task.phase !== 'toDropoff') {
    return headToDropoff(state, grid, unit, task);
  }
  unit.task = { kind: 'idle' };
  unit.path = [];
  return false;
}

/**
 * The source of `resource` closest to `near`, within the search radius, that
 * the unit can walk up to. A source counts as reachable if the unit can
 * stand on one of the eight tiles around it.
 */
function findSource(
  state: GameState,
  grid: PathGrid,
  unit: Unit,
  resource: ResourceType,
  near: Point,
): Point | undefined {
  const radius = GATHER_CONFIG.searchRadius;
  const reach = reachableTiles(grid, unitTile(unit));
  let best: Point | undefined;
  let bestDistance = Infinity;
  for (let y = near.y - radius; y <= near.y + radius; y++) {
    for (let x = near.x - radius; x <= near.x + radius; x++) {
      if (resourceAt(state.map, x, y) !== resource) continue;
      const distance = tileDistance(x, y, near.x, near.y);
      if (distance > radius || distance >= bestDistance) continue;
      if (!standingTiles(grid, reach, { x, y }).length) continue;
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

/** The tiles around a source that the unit can walk to. */
function standingTiles(grid: PathGrid, reach: Uint8Array, node: Point): Point[] {
  const tiles: Point[] = [];
  for (const [dx, dy] of AROUND) {
    const x = node.x + dx;
    const y = node.y + dy;
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
    if (reach[y * grid.width + x]) tiles.push({ x, y });
  }
  return tiles;
}

/**
 * Sends the unit to a tile next to its source: the closest one, preferring
 * tiles no other unit stands on or is heading for, so workers spread around
 * a source instead of piling up on one tile.
 */
function walkToSource(state: GameState, grid: PathGrid, unit: Unit, task: GatherTask): void {
  const here = unitTile(unit);
  const taken = new Set<number>();
  for (const other of state.entities) {
    if (!isUnit(other) || other === unit) continue;
    const tile = unitDestination(other);
    taken.add(tile.y * grid.width + tile.x);
  }

  let best: Point | undefined;
  let bestScore = Infinity;
  for (const tile of standingTiles(grid, reachableTiles(grid, here), task.node)) {
    const crowded = taken.has(tile.y * grid.width + tile.x) ? 1000 : 0;
    const score = crowded + tileDistance(tile.x, tile.y, here.x, here.y);
    if (score < bestScore) {
      best = tile;
      bestScore = score;
    }
  }
  unit.path = best ? findPath(grid, here, best) : [];
}

/**
 * Sends the unit to its side's nearest drop-off building. Returns true if it
 * is on its way (or already there); otherwise the unit becomes idle, keeping
 * its load.
 */
function headToDropoff(state: GameState, grid: PathGrid, unit: Unit, task: GatherTask): boolean {
  const here = unitTile(unit);
  let nearest: Building | undefined;
  let nearestGap = Infinity;
  for (const entity of state.entities) {
    if (!isBuilding(entity) || entity.owner !== unit.owner) continue;
    // A building under construction does not take deliveries.
    if (!BUILDING_DEFS[entity.type].dropoff || !entity.complete) continue;
    const gap = tileGapToBuilding(entity, here.x, here.y);
    if (gap < nearestGap) {
      nearest = entity;
      nearestGap = gap;
    }
  }

  if (nearest) {
    const door = nearestBuildingTile(nearest, here.x, here.y);
    const path = nearestGap <= 1 ? [] : findPath(grid, here, door);
    const end = path.at(-1) ?? here;
    if (tileGapToBuilding(nearest, end.x, end.y) <= 1) {
      task.phase = 'toDropoff';
      task.dropoffId = nearest.id;
      unit.path = path;
      return true;
    }
  }
  unit.task = { kind: 'idle' };
  unit.path = [];
  return false;
}
