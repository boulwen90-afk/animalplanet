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
    siteId: null,
  };
  unit.task = task;
  if (unit.carryAmount >= capacity) headToDropoff(state, grid, unit, task);
  else walkToSource(state, grid, unit, task);
  return true;
}

/**
 * Orders a unit to work at a building, such as a field: it works there and
 * carries what it gets to the nearest drop-off, again and again. If the
 * building has all the workers it takes, the unit goes to the nearest
 * building of the same kind and side with room, within the search radius.
 * Returns false, leaving the unit as it was, if there is nowhere to work.
 */
export function startWorking(
  state: GameState,
  grid: PathGrid,
  unit: Unit,
  building: Building,
): boolean {
  const capacity = UNIT_DEFS[unit.type].carryCapacity;
  if (capacity <= 0 || building.owner !== unit.owner) return false;
  const site = freeWorkSite(state, unit, building);
  const work = site && BUILDING_DEFS[site.building.type].work;
  if (!site || !work) return false;

  // A load of another kind is dropped when the unit switches resource.
  if (unit.carryType !== work.resource) {
    unit.carryType = work.resource;
    unit.carryAmount = 0;
  }
  const task: GatherTask = {
    kind: 'gather',
    resource: work.resource,
    node: site.tile,
    place: site.tile,
    phase: 'toSource',
    workTicks: 0,
    dropoffId: null,
    siteId: site.building.id,
  };
  unit.task = task;
  if (unit.carryAmount >= capacity) headToDropoff(state, grid, unit, task);
  else walkToSource(state, grid, unit, task);
  return true;
}

/** The tiles of a building that its workers stand on, one each, from its far corner. */
export function workTiles(building: Building): Point[] {
  const count = BUILDING_DEFS[building.type].work?.workers ?? 0;
  const size = BUILDING_DEFS[building.type].size;
  const tiles: Point[] = [];
  for (let i = 0; i < count && i < size * size; i++) {
    tiles.push({ x: building.x + (i % size), y: building.y + Math.floor(i / size) });
  }
  return tiles;
}

/** The units that work at a building, wherever they are on their round. */
export function workersAt(state: GameState, buildingId: number): Unit[] {
  return state.entities.filter(
    (entity): entity is Unit =>
      isUnit(entity) && entity.task.kind === 'gather' && entity.task.siteId === buildingId,
  );
}

/** A finished building of the unit's side where workers can work, or undefined. */
function workSite(state: GameState, unit: Unit, id: number): Building | undefined {
  const building = state.entities.find(
    (entity): entity is Building => entity.id === id && isBuilding(entity),
  );
  if (!building || !building.complete || building.owner !== unit.owner) return undefined;
  return BUILDING_DEFS[building.type].work ? building : undefined;
}

/**
 * Where the unit can work: at `wanted` if it has a place free, otherwise at
 * the nearest building of the same kind and side with one, within the
 * search radius. Returns the building and the tile to stand on.
 */
function freeWorkSite(
  state: GameState,
  unit: Unit,
  wanted: Building,
): { building: Building; tile: Point } | undefined {
  let best: { building: Building; tile: Point } | undefined;
  let bestDistance = Infinity;
  for (const entity of state.entities) {
    if (!isBuilding(entity) || entity.type !== wanted.type) continue;
    if (!workSite(state, unit, entity.id)) continue;
    const distance = entity === wanted ? -1 : tileDistance(entity.x, entity.y, wanted.x, wanted.y);
    if (distance > GATHER_CONFIG.searchRadius || distance >= bestDistance) continue;
    const taken = workersAt(state, entity.id)
      .filter((other) => other !== unit)
      .map((other) => (other.task.kind === 'gather' ? other.task.place : null));
    const tile = workTiles(entity).find(
      (candidate) => !taken.some((t) => t && t.x === candidate.x && t.y === candidate.y),
    );
    if (!tile) continue;
    best = { building: entity, tile };
    bestDistance = distance;
  }
  return best;
}

/** Advances a gathering unit. Returns true if it changed phase and should be run again this step. */
function stepGatherer(state: GameState, unit: Unit, grids: GridCache): boolean {
  const task = unit.task;
  if (task.kind !== 'gather') return false;
  const here = unitTile(unit);
  // The source is either a building the unit works at, or a tile of the map.
  const site = task.siteId === null ? undefined : workSite(state, unit, task.siteId);
  const sourceLeft =
    task.siteId === null
      ? resourceAt(state.map, task.node.x, task.node.y) === task.resource
      : site !== undefined;

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
      if (task.workTicks >= ticksPerUnit(unit, site)) {
        task.workTicks = 0;
        if (site) {
          // A building never runs out.
          unit.carryAmount += 1;
        } else {
          unit.carryAmount += takeFromSource(state.map, task.node.x, task.node.y, 1);
          if (resourceAt(state.map, task.node.x, task.node.y) === undefined) grids.invalidate();
        }
      }
      if (unit.carryAmount >= UNIT_DEFS[unit.type].carryCapacity) {
        return headToDropoff(state, grids.get(), unit, task);
      }
      if (!site && resourceAt(state.map, task.node.x, task.node.y) === undefined) {
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

/**
 * Simulation steps a unit works for each unit of resource: at a building,
 * what the building says; at a source on the map, the unit's own pace.
 */
export function ticksPerUnit(unit: Unit, site?: Building): number {
  const work = site && BUILDING_DEFS[site.type].work;
  if (work) return Math.max(1, Math.round(SIM_CONFIG.ticksPerSecond * work.secondsPerUnit));
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
  // A building it worked at is gone, or was never reached: another of the
  // same kind nearby, if there is one with room.
  if (task.siteId !== null) {
    const lost = state.entities.find((entity) => entity.id === task.siteId);
    const others = state.entities.filter(
      (entity): entity is Building =>
        isBuilding(entity) &&
        entity.id !== task.siteId &&
        entity.owner === unit.owner &&
        BUILDING_DEFS[entity.type].work?.resource === task.resource &&
        (!lost || !isBuilding(lost) || entity.type === lost.type),
    );
    const near = unitTile(unit);
    others.sort(
      (a, b) =>
        tileDistance(a.x, a.y, near.x, near.y) - tileDistance(b.x, b.y, near.x, near.y) ||
        a.id - b.id,
    );
    const load = unit.carryAmount;
    for (const other of others) {
      if (tileDistance(other.x, other.y, near.x, near.y) > GATHER_CONFIG.searchRadius) break;
      if (startWorking(state, grid, unit, other)) {
        unit.carryAmount = load;
        return false;
      }
    }
    task.siteId = null;
  }
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
  // At a building the place is a tile of the building itself, and stays the same.
  if (task.siteId !== null) {
    unit.path = task.place ? findPath(grid, here, task.place) : [];
    return;
  }
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
