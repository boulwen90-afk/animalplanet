import { BUILDING_DEFS } from '../../data/buildings';
import { TERRAIN_DEFS } from '../../data/terrain';
import { buildingTiles, isBuilding } from '../entities';
import type { Point } from '../map/iso';
import type { Building, GameState, PlayerId } from '../state';
import { canStep, isPassable, type PathGrid } from './astar';

/**
 * The walkable tiles right now, for the units of one side: walkable
 * terrain not covered by a building. A building that is itself walkable,
 * such as a field, covers nothing, and neither does a gate for the side
 * that owns it. With no side given, every gate is shut.
 */
export function buildPathGrid(state: GameState, owner?: PlayerId): PathGrid {
  return gridWithout(
    state,
    (building) => BUILDING_DEFS[building.type].wall === 'gate' && building.owner === owner,
  );
}

/**
 * The walkable tiles as they would be for a side if the other side had no
 * walls: its pieces of wall and its gates cover nothing. A path over this
 * grid shows where a wall must be broken through to get somewhere.
 */
export function buildBreachGrid(state: GameState, owner: PlayerId): PathGrid {
  return gridWithout(
    state,
    (building) =>
      BUILDING_DEFS[building.type].wall !== undefined &&
      (building.owner !== owner || BUILDING_DEFS[building.type].wall === 'gate'),
  );
}

/** The walkable tiles, where the buildings picked out by `open` count as open ground. */
function gridWithout(state: GameState, open: (building: Building) => boolean): PathGrid {
  const { width, height, terrain } = state.map;
  const blocked = new Uint8Array(width * height);
  for (let i = 0; i < blocked.length; i++) {
    const tile = terrain[i];
    if (tile === undefined || !TERRAIN_DEFS[tile].walkable) blocked[i] = 1;
  }
  for (const entity of state.entities) {
    if (!isBuilding(entity) || BUILDING_DEFS[entity.type].walkable || open(entity)) continue;
    for (const tile of buildingTiles(entity)) {
      if (tile.x >= 0 && tile.y >= 0 && tile.x < width && tile.y < height) {
        blocked[tile.y * width + tile.x] = 1;
      }
    }
  }
  return { width, height, blocked };
}

/**
 * The walkable tiles of each side, built when first asked for. The sides
 * differ where there are gates. Whoever changes what stands on the ground
 * calls `invalidate`, and the grids are built anew.
 */
export class PathGrids {
  private readonly grids = new Map<PlayerId, PathGrid>();

  constructor(private readonly state: GameState) {}

  for(owner: PlayerId): PathGrid {
    let grid = this.grids.get(owner);
    if (!grid) {
      grid = buildPathGrid(this.state, owner);
      this.grids.set(owner, grid);
    }
    return grid;
  }

  invalidate(): void {
    this.grids.clear();
  }
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
