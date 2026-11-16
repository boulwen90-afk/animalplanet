import { isUnit, unitTile } from '../entities';
import type { Point } from '../map/iso';
import type { GameState } from '../state';
import { canStep, findPath, pathCost, pathTowards, type PathGrid } from './astar';
import { PathGrids } from './passability';

/**
 * Keeping units on the move right when the ground changes under them: a
 * building or a wall is raised across their way, or one that stood in the
 * way is gone. Every unit keeps the destination it had, the last tile of
 * its path, and gets a new way there.
 */

/** True if every step of a path can still be walked. */
export function isPathOpen(grid: PathGrid, from: Point, path: readonly Point[]): boolean {
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

/**
 * Called when something has come to stand in the way. Every unit whose
 * path no longer works gets a new one to the same place, around the
 * obstacle. If there is no way there any more it goes as near as it can.
 * Units whose path is still open keep it.
 */
export function rerouteBlockedUnits(state: GameState): void {
  const grids = new PathGrids(state);
  for (const unit of state.entities) {
    if (!isUnit(unit) || unit.path.length === 0) continue;
    const grid = grids.for(unit.owner);
    const here = unitTile(unit);
    if (isPathOpen(grid, here, unit.path)) continue;
    unit.path = pathTowards(grid, here, unit.path.at(-1) as Point);
  }
}

/**
 * Called when something that stood in the way is gone. Every unit on the
 * move takes the new way to where it was going, if that is shorter than the
 * way it was on.
 */
export function rerouteForOpening(state: GameState): void {
  const grids = new PathGrids(state);
  for (const unit of state.entities) {
    if (!isUnit(unit) || unit.path.length === 0) continue;
    const here = unitTile(unit);
    const fresh = findPath(grids.for(unit.owner), here, unit.path.at(-1) as Point);
    if (fresh.length > 0 && pathCost(here, fresh) < pathCost(here, unit.path)) unit.path = fresh;
  }
}
