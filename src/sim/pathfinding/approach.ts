import { isUnit, unitDestination, unitTile } from '../entities';
import { tileDistance } from '../map/grid';
import type { Point } from '../map/iso';
import type { GameState, Unit } from '../state';
import { findPath, reachableTiles, type PathGrid } from './astar';

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
 * target that the unit can walk to, it picks the closest, preferring tiles no
 * other unit stands on or is heading for, so that several units spread around
 * the target instead of piling up on one tile.
 *
 * Returns an empty path if the unit already stands on the chosen tile, and
 * undefined if it cannot get next to the target at all.
 */
export function approachPath(
  state: GameState,
  grid: PathGrid,
  unit: Unit,
  targetTiles: readonly Point[],
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

  let best: Point | undefined;
  let bestScore = Infinity;
  const seen = new Set<number>();
  for (const target of targetTiles) {
    for (const [dx, dy] of AROUND) {
      const x = target.x + dx;
      const y = target.y + dy;
      if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
      const index = y * grid.width + x;
      if (seen.has(index) || isTarget.has(index) || !reach[index]) continue;
      seen.add(index);
      const score = (taken.has(index) ? 1000 : 0) + tileDistance(x, y, here.x, here.y);
      if (score < bestScore) {
        best = { x, y };
        bestScore = score;
      }
    }
  }
  return best ? findPath(grid, here, best) : undefined;
}
