import { MAP_CONFIG, MAP_GEN_CONFIG } from '../data/map';
import { generateMap, type MapGenConfig } from './map/mapgen';
import type { MapSize } from './map/iso';
import { createRng } from './rng';
import type { GameState } from './state';

/** Creates a new game. The same seed always gives the same game. */
export function createGame(
  seed: number,
  mapSize: MapSize = MAP_CONFIG,
  mapGen: MapGenConfig = MAP_GEN_CONFIG,
): GameState {
  const rng = createRng(seed);
  const map = generateMap(rng, mapSize, mapGen);
  return { seed, tick: 0, rng, map };
}
