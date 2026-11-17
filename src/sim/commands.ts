import { hasSurrendered, isBuilding, isUnit, unitDestination, unitTile } from './entities';
import { tileDistance } from './map/grid';
import type { Point } from './map/iso';
import { isPassable, nearestReachable, pathTowards, type PathGrid } from './pathfinding/astar';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import { BUILDING_DEFS, type BuildingType } from '../data/buildings';
import type { ResourceType } from '../data/resources';
import { COLLISION_CONFIG, type UnitType } from '../data/units';
import type { UpgradeType } from '../data/upgrades';
import { resourceAt } from './resources';
import type { Building, GameState, PlayerId, Unit } from './state';
import { orderAttack } from './systems/combat';
import {
  assistConstruction,
  placeBuilding,
  placeLine,
  type PlacementProblem,
} from './systems/construction';
import { startGathering, startWorking } from './systems/gathering';
import { cancelQueuedUnit, queueUnit } from './systems/production';
import { orderRepair } from './systems/repair';
import { cancelResearch, queueResearch } from './systems/research';

/** Orders the given units to walk to a tile. */
export interface MoveCommand {
  type: 'move';
  /** The player giving the order. Only that player's units obey. */
  player: PlayerId;
  unitIds: number[];
  /** Target tile. */
  x: number;
  y: number;
}

/** Orders the given units to gather from a resource source and keep delivering it. */
export interface GatherCommand {
  type: 'gather';
  /** The player giving the order. Only that player's units obey. */
  player: PlayerId;
  unitIds: number[];
  /** Tile of the source. */
  x: number;
  y: number;
}

/** Adds a unit to a building's production queue. Its price is taken at once. */
/** Work at one of the player's own finished buildings where workers can work, such as a field. */
export interface WorkCommand {
  type: 'work';
  player: PlayerId;
  unitIds: number[];
  buildingId: number;
}

export interface TrainCommand {
  type: 'train';
  /** The player giving the order. The building must be that player's. */
  player: PlayerId;
  buildingId: number;
  unit: UnitType;
}

/** Removes a unit from a building's production queue and gives its price back. */
export interface CancelTrainCommand {
  type: 'cancelTrain';
  player: PlayerId;
  buildingId: number;
  /** Position in the queue; 0 is the unit being trained. */
  index: number;
}

/** Adds the next level of an upgrade to a building's queue. Its price is taken at once. */
export interface ResearchCommand {
  type: 'research';
  player: PlayerId;
  buildingId: number;
  upgrade: UpgradeType;
}

/** Removes an upgrade from a building's queue and gives its price back. */
export interface CancelResearchCommand {
  type: 'cancelResearch';
  player: PlayerId;
  buildingId: number;
  /** Position in the queue; 0 is the upgrade being worked out. */
  index: number;
}

/** Places a new building and sends the given units to build it. Its price is taken at once. */
export interface BuildCommand {
  type: 'build';
  /** The player giving the order. Only that player's units obey. */
  player: PlayerId;
  unitIds: number[];
  building: BuildingType;
  /** Tile of the footprint corner with the lowest x and y. */
  x: number;
  y: number;
}

/**
 * Places a wall drawn out in a line between two tiles, a piece on each tile
 * of it where one can stand, and sends the given units to build it. The
 * price of every piece is taken at once.
 */
export interface BuildLineCommand {
  type: 'buildLine';
  player: PlayerId;
  unitIds: number[];
  /** A building type that is a piece of wall. */
  building: BuildingType;
  /** The tiles the line is drawn between. */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

/** Sends the given units to help finish a building that is under construction. */
export interface ConstructCommand {
  type: 'construct';
  player: PlayerId;
  unitIds: number[];
  buildingId: number;
}

/** Sends the given units to repair one of the player's own finished buildings that has lost life. */
export interface RepairCommand {
  type: 'repair';
  player: PlayerId;
  unitIds: number[];
  buildingId: number;
}

/** Orders the given units to attack an enemy unit or building until it is defeated. */
export interface AttackCommand {
  type: 'attack';
  /** The player giving the order. Only that player's units obey. */
  player: PlayerId;
  unitIds: number[];
  targetId: number;
}

/**
 * Everything a player or the AI can tell the simulation to do. Input, AI and
 * tests all change the game through commands and nothing else.
 */
export type Command =
  | MoveCommand
  | GatherCommand
  | WorkCommand
  | TrainCommand
  | CancelTrainCommand
  | ResearchCommand
  | CancelResearchCommand
  | BuildCommand
  | BuildLineCommand
  | ConstructCommand
  | RepairCommand
  | AttackCommand;

/** Whether a command was carried out, and if not, why. */
export type CommandResult =
  | { ok: true }
  | { ok: false; reason: 'insufficientResources'; missing: ResourceType[] }
  | {
      ok: false;
      /**
       * `housingFull`: no room for the unit until more housing is built.
       * `populationCap`: no room, and the side already has the most it can ever have.
       */
      reason: 'housingFull' | 'populationCap' | 'queueFull' | 'invalid';
    }
  /** The building cannot stand there; `problem` says why. */
  | { ok: false; reason: 'invalidPlacement'; problem: PlacementProblem };

const OK: CommandResult = { ok: true };

/**
 * What a command would answer if it were carried out now, without carrying
 * it out: the game is left as it was. For the interface, when an order is
 * not carried out the moment it is given.
 */
export function checkCommand(state: GameState, command: Command): CommandResult {
  return applyCommand(structuredClone(state), command);
}

export function applyCommand(state: GameState, command: Command): CommandResult {
  switch (command.type) {
    case 'move':
      applyMove(state, command);
      return OK;
    case 'gather':
      applyGather(state, command);
      return OK;
    case 'work':
      return applyWork(state, command);
    case 'train':
      return queueUnit(state, command.player, command.buildingId, command.unit);
    case 'cancelTrain':
      return cancelQueuedUnit(state, command.player, command.buildingId, command.index);
    case 'research':
      return queueResearch(state, command.player, command.buildingId, command.upgrade);
    case 'cancelResearch':
      return cancelResearch(state, command.player, command.buildingId, command.index);
    case 'build':
      return placeBuilding(
        state,
        command.player,
        command.unitIds,
        command.building,
        command.x,
        command.y,
      );
    case 'buildLine':
      return placeLine(
        state,
        command.player,
        command.unitIds,
        command.building,
        { x: command.fromX, y: command.fromY },
        { x: command.toX, y: command.toY },
      );
    case 'construct':
      return assistConstruction(state, command.player, command.unitIds, command.buildingId);
    case 'repair':
      return orderRepair(state, command.player, command.unitIds, command.buildingId);
    case 'attack':
      return orderAttack(
        state,
        command.player,
        orderedUnits(state, command.player, command.unitIds),
        command.targetId,
      );
  }
}

/**
 * The player's own units named in a command, in id order. Units that have
 * surrendered no longer take orders.
 */
function orderedUnits(state: GameState, player: PlayerId, unitIds: readonly number[]): Unit[] {
  return state.entities
    .filter(isUnit)
    .filter((unit) => unit.owner === player && unitIds.includes(unit.id) && !hasSurrendered(unit));
}

/**
 * Sends units to work at a building. Each takes a place there if one is
 * free; the rest go to the nearest building of the same kind with room, and
 * those that find none keep doing what they did.
 */
function applyWork(state: GameState, command: WorkCommand): CommandResult {
  const building = state.entities.find(
    (entity): entity is Building => entity.id === command.buildingId && isBuilding(entity),
  );
  if (!building || building.owner !== command.player || !building.complete) {
    return { ok: false, reason: 'invalid' };
  }
  if (!BUILDING_DEFS[building.type].work) return { ok: false, reason: 'invalid' };
  const grid = buildPathGrid(state, command.player);
  for (const unit of orderedUnits(state, command.player, command.unitIds)) {
    startWorking(state, grid, unit, building);
  }
  return OK;
}

function applyGather(state: GameState, command: GatherCommand): void {
  const x = Math.floor(command.x);
  const y = Math.floor(command.y);
  const resource = resourceAt(state.map, x, y);
  if (!resource) return;
  const grid = buildPathGrid(state, command.player);
  for (const unit of orderedUnits(state, command.player, command.unitIds)) {
    startGathering(state, grid, unit, resource, { x, y });
  }
}

/**
 * The tiles a group of `count` units lines up on around an anchor tile,
 * nearest first. A lone unit gets the anchor. A group stands on every other
 * tile, so that there is room between its units; where the ground does not
 * allow that, the tiles in between are used too.
 */
function groupTiles(
  grid: PathGrid,
  anchor: Point,
  count: number,
  taken: ReadonlySet<number>,
): Point[] {
  if (count < 2 || !COLLISION_CONFIG.groupsOnEveryOtherTile) {
    return nearestFreeTiles(grid, [anchor], count, taken);
  }
  // Twice as many as needed, and some to spare for obstacles: half are skipped.
  const near = nearestFreeTiles(grid, [anchor], count * 3 + 8, taken);
  const colour = (anchor.x + anchor.y) % 2;
  const spaced = near.filter((tile) => (tile.x + tile.y) % 2 === colour);
  const between = near.filter((tile) => (tile.x + tile.y) % 2 !== colour);
  return [...spaced, ...between].slice(0, count);
}

function applyMove(state: GameState, command: MoveCommand): void {
  const ordered = orderedUnits(state, command.player, command.unitIds);
  const lead = ordered[0];
  if (!lead) return;

  const grid = buildPathGrid(state, command.player);
  const target = {
    x: Math.min(Math.max(Math.floor(command.x), 0), grid.width - 1),
    y: Math.min(Math.max(Math.floor(command.y), 0), grid.height - 1),
  };

  // Where the group gathers: the target, or if that is an obstacle, the tile
  // closest to it that the first unit can reach.
  const anchor = isPassable(grid, target.x, target.y)
    ? target
    : nearestReachable(grid, unitTile(lead), target);
  if (!anchor) return;

  // Each unit gets a tile of its own around the anchor, avoiding tiles where
  // units outside the group stand or are heading.
  const taken = new Set<number>();
  for (const entity of state.entities) {
    if (!isUnit(entity) || ordered.includes(entity)) continue;
    const tile = unitDestination(entity);
    taken.add(tile.y * grid.width + tile.x);
  }
  const free = groupTiles(grid, anchor, ordered.length, taken);

  for (const unit of ordered) {
    const destination = takeNearest(free, unit) ?? anchor;
    // A move order ends whatever the unit was doing. It keeps what it carries.
    unit.task = { kind: 'idle' };
    // A place that is walled off: as near to it as the unit can get.
    unit.path = pathTowards(grid, unitTile(unit), destination);
  }
}

/** Removes and returns the tile in `tiles` closest to the unit. */
function takeNearest(tiles: Point[], unit: Unit): Point | undefined {
  let best = -1;
  let bestDistance = Infinity;
  tiles.forEach((tile, i) => {
    const distance = tileDistance(tile.x + 0.5, tile.y + 0.5, unit.x, unit.y);
    if (distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best < 0 ? undefined : tiles.splice(best, 1)[0];
}
