import { BUILDING_DEFS } from '../data/buildings';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../data/map';
import { START_CONFIG } from '../data/setup';
import { createBuilding, createUnit } from './entities';
import { generateMap, type MapGenConfig } from './map/mapgen';
import type { MapSize } from './map/iso';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import type { GameMap } from './map/grid';
import { createRng, type RngState } from './rng';
import type { GameState, PlayerId } from './state';

/** Creates a new game. The same seed always gives the same game. */
export function createGame(
  seed: number,
  mapSize: MapSize = MAP_CONFIG,
  mapGen: MapGenConfig = MAP_GEN_CONFIG,
): GameState {
  const rng = createRng(seed);
  const map = generateMap(rng, mapSize, mapGen);
  const state = emptyState(seed, rng, map);
  placeStartingEntities(state);
  return state;
}

/** A game state with a map and each side's starting stock, but no units or buildings. */
export function emptyState(seed: number, rng: RngState, map: GameMap): GameState {
  return {
    seed,
    tick: 0,
    rng,
    map,
    players: map.startPositions.map(() => ({ resources: { ...START_CONFIG.resources } })),
    entities: [],
    nextEntityId: 1,
  };
}

/**
 * Gives each side its main building, centred on its start position, and its
 * starting units on the free tiles nearest to the front of the building.
 */
function placeStartingEntities(state: GameState): void {
  const size = BUILDING_DEFS[START_CONFIG.building].size;
  const offset = Math.floor(size / 2);
  const unitCount = START_CONFIG.units.reduce((sum, entry) => sum + entry.count, 0);

  state.map.startPositions.forEach((start, index) => {
    const owner = index as PlayerId;
    const building = createBuilding(
      state,
      START_CONFIG.building,
      owner,
      start.x - offset,
      start.y - offset,
    );

    // The tile diagonally in front of the building, at the bottom of it on
    // screen. Units placed behind a building would be hidden by it.
    const front = { x: building.x + size, y: building.y + size };
    const tiles = nearestFreeTiles(buildPathGrid(state), [front], unitCount);

    let next = 0;
    for (const entry of START_CONFIG.units) {
      for (let i = 0; i < entry.count; i++) {
        const tile = tiles[next++];
        if (!tile) throw new Error('No free tile for a starting unit');
        createUnit(state, entry.type, owner, tile.x, tile.y);
      }
    }
  });
}
