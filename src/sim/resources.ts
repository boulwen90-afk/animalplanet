import { RESOURCE_DEFS, type ResourceType } from '../data/resources';
import { TERRAIN_DEFS, type Terrain } from '../data/terrain';
import { inBounds, tileIndex, type GameMap } from './map/grid';

/** The resource a terrain type gives, if any. */
export function terrainResource(terrain: Terrain | undefined): ResourceType | undefined {
  return terrain === undefined ? undefined : TERRAIN_DEFS[terrain].resource;
}

/** Fills in the starting amount of every resource source on a freshly made map. */
export function initialResourceAmounts(terrain: readonly Terrain[]): number[] {
  return terrain.map((tile) => {
    const resource = terrainResource(tile);
    return resource ? RESOURCE_DEFS[resource].amountPerNode : 0;
  });
}

/** The kind of resource source on a tile, or undefined if there is none left. */
export function resourceAt(map: GameMap, x: number, y: number): ResourceType | undefined {
  if (!inBounds(x, y, map)) return undefined;
  const index = tileIndex(x, y, map);
  if ((map.resourceAmount[index] ?? 0) <= 0) return undefined;
  return terrainResource(map.terrain[index]);
}

/** Units left in the source on a tile. */
export function resourceAmountAt(map: GameMap, x: number, y: number): number {
  return inBounds(x, y, map) ? (map.resourceAmount[tileIndex(x, y, map)] ?? 0) : 0;
}

/**
 * Takes up to `amount` units from the source on a tile and returns how many
 * were taken. An emptied source disappears: its tile becomes open grass.
 */
export function takeFromSource(map: GameMap, x: number, y: number, amount: number): number {
  if (resourceAt(map, x, y) === undefined) return 0;
  const index = tileIndex(x, y, map);
  const taken = Math.min(amount, map.resourceAmount[index] as number);
  map.resourceAmount[index] = (map.resourceAmount[index] as number) - taken;
  if (map.resourceAmount[index] === 0) map.terrain[index] = 'grass';
  return taken;
}
