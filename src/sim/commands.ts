import { isUnit, unitDestination, unitTile } from './entities';
import { tileDistance } from './map/grid';
import type { Point } from './map/iso';
import { findPath, isPassable, nearestReachable } from './pathfinding/astar';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import type { BuildingType } from '../data/buildings';
import type { ResourceType } from '../data/resources';
import type { UnitType } from '../data/units';
import { resourceAt } from './resources';
import type { GameState, PlayerId, Unit } from './state';
import { assistConstruction, placeBuilding } from './systems/construction';
import { startGathering } from './systems/gathering';
import { cancelQueuedUnit, queueUnit } from './systems/production';

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

/** Sends the given units to help finish a building that is under construction. */
export interface ConstructCommand {
  type: 'construct';
  player: PlayerId;
  unitIds: number[];
  buildingId: number;
}

/**
 * Everything a player or the AI can tell the simulation to do. Input, AI and
 * tests all change the game through commands and nothing else.
 */
export type Command =
  MoveCommand | GatherCommand | TrainCommand | CancelTrainCommand | BuildCommand | ConstructCommand;

/** Whether a command was carried out, and if not, why. */
export type CommandResult =
  | { ok: true }
  | { ok: false; reason: 'insufficientResources'; missing: ResourceType[] }
  | { ok: false; reason: 'populationCap' | 'queueFull' | 'invalidPlacement' | 'invalid' };

const OK: CommandResult = { ok: true };

export function applyCommand(state: GameState, command: Command): CommandResult {
  switch (command.type) {
    case 'move':
      applyMove(state, command);
      return OK;
    case 'gather':
      applyGather(state, command);
      return OK;
    case 'train':
      return queueUnit(state, command.player, command.buildingId, command.unit);
    case 'cancelTrain':
      return cancelQueuedUnit(state, command.player, command.buildingId, command.index);
    case 'build':
      return placeBuilding(
        state,
        command.player,
        command.unitIds,
        command.building,
        command.x,
        command.y,
      );
    case 'construct':
      return assistConstruction(state, command.player, command.unitIds, command.buildingId);
  }
}

/** The player's own units named in a command, in id order. */
function orderedUnits(state: GameState, player: PlayerId, unitIds: readonly number[]): Unit[] {
  return state.entities
    .filter(isUnit)
    .filter((unit) => unit.owner === player && unitIds.includes(unit.id));
}

function applyGather(state: GameState, command: GatherCommand): void {
  const x = Math.floor(command.x);
  const y = Math.floor(command.y);
  const resource = resourceAt(state.map, x, y);
  if (!resource) return;
  const grid = buildPathGrid(state);
  for (const unit of orderedUnits(state, command.player, command.unitIds)) {
    startGathering(state, grid, unit, resource, { x, y });
  }
}

function applyMove(state: GameState, command: MoveCommand): void {
  const ordered = orderedUnits(state, command.player, command.unitIds);
  const lead = ordered[0];
  if (!lead) return;

  const grid = buildPathGrid(state);
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
  const free = nearestFreeTiles(grid, [anchor], ordered.length, taken);

  for (const unit of ordered) {
    const destination = takeNearest(free, unit) ?? anchor;
    // A move order ends whatever the unit was doing. It keeps what it carries.
    unit.task = { kind: 'idle' };
    unit.path = findPath(grid, unitTile(unit), destination);
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
