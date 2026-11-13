import { BUILDING_DEFS } from '../../data/buildings';
import { GATHER_CONFIG, type ResourceType } from '../../data/resources';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { isBuilding, isUnit, nearestBuildingTile, tileGapToBuilding, unitTile } from '../entities';
import { tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import { findPath, reachableTiles, type PathGrid } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import { resourceAt, takeFromSource } from '../resources';
import type { Building, GameState, GatherTask, Unit } from '../state';

/**
 * The eight tiles around a tile. A source's work places are the first open
 * ones in this order: the four that share a side with it, then the corners.
 */
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
  // The place it may already hold is free for the search: it is about to leave it.
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
    place: null,
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
      if (sourceLeft && isAtPlace(here, task)) {
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
export function ticksPerUnit(unit: Unit): number {
  return Math.max(1, Math.round(SIM_CONFIG.ticksPerSecond / UNIT_DEFS[unit.type].gatherRate));
}

/** True if the unit stands on the work place it has taken. */
function isAtPlace(tile: Point, task: GatherTask): boolean {
  return task.place !== null && task.place.x === tile.x && task.place.y === tile.y;
}

/**
 * The work places of a source: the open tiles around it, at most
 * `placesPerSource`, always the same ones as long as the ground around it
 * does not change.
 */
export function workPlaces(grid: PathGrid, node: Point): Point[] {
  const places: Point[] = [];
  for (const [dx, dy] of AROUND) {
    const x = node.x + dx;
    const y = node.y + dy;
    if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
    if (grid.blocked[y * grid.width + x]) continue;
    places.push({ x, y });
    if (places.length >= GATHER_CONFIG.placesPerSource) break;
  }
  return places;
}

/** The tiles that other gathering units have taken as their work places. */
function takenPlaces(state: GameState, grid: PathGrid, unit: Unit): Set<number> {
  const taken = new Set<number>();
  for (const other of state.entities) {
    if (!isUnit(other) || other === unit || other.task.kind !== 'gather') continue;
    const place = other.task.place;
    if (place) taken.add(place.y * grid.width + place.x);
  }
  return taken;
}

/** The places of a source that nobody else has taken and that the unit can walk to. */
function freePlaces(
  grid: PathGrid,
  reach: Uint8Array,
  taken: ReadonlySet<number>,
  node: Point,
): Point[] {
  return workPlaces(grid, node).filter((place) => {
    const index = place.y * grid.width + place.x;
    return reach[index] === 1 && !taken.has(index);
  });
}

/**
 * Moves on when the current source is used up: to another source of the same
 * kind near the unit, otherwise home with whatever it carries, otherwise idle.
 */
function retarget(state: GameState, grid: PathGrid, unit: Unit, task: GatherTask): boolean {
  // It gives up its place, and looks for a source with a place to spare.
  task.place = null;
  const next = findSource(state, grid, unit, task.resource, unitTile(unit));
  if (next) {
    task.node = next;
    task.phase = 'toSource';
    task.workTicks = 0;
    walkToSource(state, grid, unit, task);
    // Run again only if the unit is already standing on its new place.
    return unit.path.length === 0 && isAtPlace(unitTile(unit), task);
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
 * has a work place for the unit: one that no other worker has taken and that
 * the unit can walk to. A source whose places are all taken is passed over,
 * so the unit goes on to the nearest one of the same kind with room.
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
  const taken = takenPlaces(state, grid, unit);
  let best: Point | undefined;
  let bestDistance = Infinity;
  for (let y = near.y - radius; y <= near.y + radius; y++) {
    for (let x = near.x - radius; x <= near.x + radius; x++) {
      if (resourceAt(state.map, x, y) !== resource) continue;
      const distance = tileDistance(x, y, near.x, near.y);
      if (distance > radius || distance >= bestDistance) continue;
      if (!freePlaces(grid, reach, taken, { x, y }).length) continue;
      best = { x, y };
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * Sends the unit to its work place by its source. A unit that comes back
 * from delivering a load returns to the place it has; otherwise it takes the
 * free place closest to it. With no place to be had it stays where it is,
 * and the next step sends it on to another source.
 */
function walkToSource(state: GameState, grid: PathGrid, unit: Unit, task: GatherTask): void {
  const here = unitTile(unit);
  const reach = reachableTiles(grid, here);
  const held = task.place;
  const stillThere =
    held !== null &&
    reach[held.y * grid.width + held.x] === 1 &&
    workPlaces(grid, task.node).some((place) => place.x === held.x && place.y === held.y);
  if (!stillThere) {
    const taken = takenPlaces(state, grid, unit);
    let best: Point | null = null;
    let bestDistance = Infinity;
    for (const place of freePlaces(grid, reach, taken, task.node)) {
      const distance = tileDistance(place.x, place.y, here.x, here.y);
      if (distance < bestDistance) {
        best = place;
        bestDistance = distance;
      }
    }
    task.place = best;
  }
  unit.path = task.place ? findPath(grid, here, task.place) : [];
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
