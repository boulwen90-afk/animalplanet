import { TERRAIN_DEFS } from '../../data/terrain';
import { buildingTiles, isBuilding } from '../entities';
import type { Point } from '../map/iso';
import type { GameState } from '../state';
import { canStep, isPassable, type PathGrid } from './astar';

/** The walkable tiles right now: walkable terrain not covered by a building. */
export function buildPathGrid(state: GameState): PathGrid {
  const { width, height, terrain } = state.map;
  const blocked = new Uint8Array(width * height);
  for (let i = 0; i < blocked.length; i++) {
    const tile = terrain[i];
    if (tile === undefined || !TERRAIN_DEFS[tile].walkable) blocked[i] = 1;
  }
  for (const entity of state.entities) {
    if (!isBuilding(entity)) continue;
    for (const tile of buildingTiles(entity)) {
      if (tile.x >= 0 && tile.y >= 0 && tile.x < width && tile.y < height) {
        blocked[tile.y * width + tile.x] = 1;
      }
    }
  }
  return { width, height, blocked };
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
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
 * Up to `count` open tiles closest to the `sources`, nearest first, found by
 * spreading outwards one step at a time. Tiles in `taken` (tile indices) are
 * passed through but not returned.
 *
 * Sources may be obstacles, such as the tiles under a building: the search
 * then starts from the open tiles around them. From open tiles the search
 * only spreads along steps a unit could walk, so every returned tile can be
 * reached from the first one.
 */
export function nearestFreeTiles(
  grid: PathGrid,
  sources: readonly Point[],
  count: number,
  taken: ReadonlySet<number> = new Set(),
): Point[] {
  const found: Point[] = [];
  const visited = new Uint8Array(grid.width * grid.height);
  const queue: number[] = [];
  for (const source of sources) {
    if (source.x < 0 || source.y < 0 || source.x >= grid.width || source.y >= grid.height) continue;
    const index = source.y * grid.width + source.x;
    if (visited[index]) continue;
    visited[index] = 1;
    queue.push(index);
  }

  for (let head = 0; head < queue.length && found.length < count; head++) {
    const index = queue[head] as number;
    const x = index % grid.width;
    const y = (index - x) / grid.width;
    const open = grid.blocked[index] === 0;
    if (open && !taken.has(index)) found.push({ x, y });

    for (const [dx, dy] of NEIGHBOURS) {
      // From an obstacle any open neighbour will do; from open ground, walk.
      const ok = open ? canStep(grid, x, y, dx, dy) : isPassable(grid, x + dx, y + dy);
      if (!ok) continue;
      const next = (y + dy) * grid.width + (x + dx);
      if (visited[next]) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  return found;
}
