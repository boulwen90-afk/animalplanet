import { isUnit, unitDestination, unitTile } from './entities';
import { tileDistance } from './map/grid';
import type { Point } from './map/iso';
import { findPath, isPassable, nearestReachable } from './pathfinding/astar';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import type { GameState, PlayerId, Unit } from './state';

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

/**
 * Everything a player or the AI can tell the simulation to do. Input, AI and
 * tests all change the game through commands and nothing else.
 */
export type Command = MoveCommand;

export function applyCommand(state: GameState, command: Command): void {
  switch (command.type) {
    case 'move':
      applyMove(state, command);
      break;
  }
}

function applyMove(state: GameState, command: MoveCommand): void {
  const ordered = state.entities
    .filter(isUnit)
    .filter((unit) => unit.owner === command.player && command.unitIds.includes(unit.id));
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
