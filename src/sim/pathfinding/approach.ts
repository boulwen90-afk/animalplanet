import { isUnit, unitDestination, unitTile } from '../entities';
import { tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import type { GameState, Unit } from '../state';
import { findPath, reachableTiles, type PathGrid } from './astar';
import { nearestFreeTiles } from './passability';

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

/**
 * A path for a unit to a tile next to something that occupies the given
 * tiles, such as an enemy unit, a building or a cave. Of the tiles around the
 * target that the unit can walk to, it picks the closest that no other unit
 * stands on or is heading for, so that several units spread around the target.
 *
 * When every tile around the target is taken, the unit instead gets a path to
 * the nearest free tile further out, where it waits for a place; with
 * `share` set it goes to a taken tile next to the target after all.
 *
 * Returns an empty path if the unit already stands on the chosen tile, and
 * undefined if it cannot get next to the target at all.
 */
export function approachPath(
  state: GameState,
  grid: PathGrid,
  unit: Unit,
  targetTiles: readonly Point[],
  share = false,
): Point[] | undefined {
  const here = unitTile(unit);
  const reach = reachableTiles(grid, here);
  const isTarget = new Set(targetTiles.map((tile) => tile.y * grid.width + tile.x));

  const taken = new Set<number>();
  for (const other of state.entities) {
    if (!isUnit(other) || other === unit) continue;
    const tile = unitDestination(other);
    taken.add(tile.y * grid.width + tile.x);
  }

  let free: Point | undefined;
  let freeDistance = Infinity;
  let shared: Point | undefined;
  let sharedDistance = Infinity;
  const seen = new Set<number>();
  for (const target of targetTiles) {
    for (const [dx, dy] of AROUND) {
      const x = target.x + dx;
      const y = target.y + dy;
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
      const index = y * grid.width + x;
      if (seen.has(index) || isTarget.has(index) || !reach[index]) continue;
      seen.add(index);
      const distance = tileDistance(x, y, here.x, here.y);
      if (taken.has(index)) {
        if (distance < sharedDistance) {
          shared = { x, y };
          sharedDistance = distance;
        }
      } else if (distance < freeDistance) {
        free = { x, y };
        freeDistance = distance;
      }
    }
  }
  if (free) return findPath(grid, here, free);
  if (!shared) return undefined;
  if (share) return findPath(grid, here, shared);

  // Every place by the target is taken: wait on the nearest free tile further out.
  for (const tile of targetTiles) taken.add(tile.y * grid.width + tile.x);
  const waiting = nearestFreeTiles(grid, targetTiles, 16, taken).find(
    (tile) => reach[tile.y * grid.width + tile.x],
  );
  return waiting ? findPath(grid, here, waiting) : [];
}
