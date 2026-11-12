import { TERRAIN_DEFS, type Terrain } from '../../data/terrain';
import type { UnitType } from '../../data/types';
import type { MapSize, Point } from './iso';

/** A cave where one side's defeated units take refuge. See GDD section 15. */
export interface Cave {
  id: number;
  /** The side whose units flee here. */
  owner: number;
  /** Tile of the cave entrance. */
  x: number;
  y: number;
  /** Types of the units inside, in the order they arrived. */
  occupants: UnitType[];
  /** Places held for units that have surrendered and are on their way here. */
  reserved: number;
}

/** The tile map. Terrain is stored row by row: index = y * width + x. */
export interface GameMap {
  width: number;
  height: number;
  terrain: Terrain[];
  /** Resource units left in each tile's source; 0 where there is none. Same indexing as terrain. */
  resourceAmount: number[];
  /** Tile where each side's main building stands. Index 0 is the player, 1 the opponent. */
  startPositions: Point[];
  /** Every cave on the map. Each also has terrain 'cave' on its tile. */
  caves: Cave[];
}

export function tileIndex(x: number, y: number, map: MapSize): number {
  return y * map.width + x;
}

export function inBounds(x: number, y: number, map: MapSize): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** Terrain at a tile, or undefined outside the map. */
export function terrainAt(map: GameMap, x: number, y: number): Terrain | undefined {
  return inBounds(x, y, map) ? map.terrain[tileIndex(x, y, map)] : undefined;
}

export function isWalkable(map: GameMap, x: number, y: number): boolean {
  const terrain = terrainAt(map, x, y);
  return terrain !== undefined && TERRAIN_DEFS[terrain].walkable;
}

/** The tile on the opposite side of the map centre. */
export function mirrorTile(x: number, y: number, map: MapSize): Point {
  return { x: map.width - 1 - x, y: map.height - 1 - y };
}

/** Straight-line distance between two tiles, in tiles. */
export function tileDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** The four tiles sharing an edge with a tile. */
export const EDGE_NEIGHBOURS: readonly Point[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];

/**
 * True if `to` can be reached from `from` by stepping between walkable tiles
 * that share an edge. Both ends must be walkable.
 */
export function isReachable(map: GameMap, from: Point, to: Point): boolean {
  if (!isWalkable(map, from.x, from.y) || !isWalkable(map, to.x, to.y)) return false;
  const visited = new Uint8Array(map.width * map.height);
  const queue: number[] = [tileIndex(from.x, from.y, map)];
  visited[queue[0] as number] = 1;
  const target = tileIndex(to.x, to.y, map);

  for (let head = 0; head < queue.length; head++) {
    const index = queue[head] as number;
    if (index === target) return true;
    const x = index % map.width;
    const y = (index - x) / map.width;
    for (const step of EDGE_NEIGHBOURS) {
      const nx = x + step.x;
      const ny = y + step.y;
      if (!isWalkable(map, nx, ny)) continue;
      const next = tileIndex(nx, ny, map);
      if (visited[next]) continue;
      visited[next] = 1;
      queue.push(next);
    }
  }
  return false;
}
