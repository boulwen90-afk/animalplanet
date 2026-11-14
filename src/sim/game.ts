import { BUILDING_DEFS } from '../data/buildings';
import { MAP_CONFIG, MAP_GEN_CONFIG } from '../data/map';
import { START_CONFIG } from '../data/setup';
import { buildingFrontTile, createBuilding, createUnit } from './entities';
import { generateMap, type MapGenConfig } from './map/mapgen';
import type { MapSize } from './map/iso';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import type { GameMap } from './map/grid';
import { createRng, type RngState } from './rng';
import type { UnitType } from '../data/types';
import {
  UNEXPLORED,
  type Building,
  type GameState,
  type PlayerId,
  type PlayerState,
} from './state';
import { updateVisibility } from './systems/visibility';

export interface GameOptions {
  /** Whether the fog of war is on. Default: on. */
  fog?: boolean;
  /** The sides played by the computer. Default: the opponent, side 1. */
  ai?: readonly PlayerId[];
  /**
   * Units a side has besides its starting ones, for measuring how the game
   * runs with many units. They stand on the free tiles nearest its main
   * building and do not count against the population cap when placed.
   */
  extraUnits?: { owner: PlayerId; type: UnitType; count: number };
}

const DEFAULT_AI_PLAYERS: readonly PlayerId[] = [1];

/** Creates a new game. The same seed always gives the same game. */
export function createGame(
  seed: number,
  mapSize: MapSize = MAP_CONFIG,
  mapGen: MapGenConfig = MAP_GEN_CONFIG,
  options: GameOptions = {},
): GameState {
  const rng = createRng(seed);
  const map = generateMap(rng, mapSize, mapGen);
  const state = emptyState(seed, rng, map, options.fog ?? true);
  for (const player of options.ai ?? DEFAULT_AI_PLAYERS) {
    const side = state.players[player];
    if (side) side.ai = { attackers: [], waveTicks: [] };
  }
  placeStartingEntities(state);
  if (options.extraUnits) placeExtraUnits(state, options.extraUnits);
  updateVisibility(state);
  return state;
}

/** Places extra units for a side on the free tiles nearest the front of its main building. */
function placeExtraUnits(
  state: GameState,
  extra: { owner: PlayerId; type: UnitType; count: number },
): void {
  const home = state.entities.find(
    (entity): entity is Building => entity.kind === 'building' && entity.owner === extra.owner,
  );
  if (!home || extra.count <= 0) return;
  const taken = new Set<number>();
  for (const entity of state.entities) {
    if (entity.kind === 'unit') {
      taken.add(Math.floor(entity.y) * state.map.width + Math.floor(entity.x));
    }
  }
  const tiles = nearestFreeTiles(
    buildPathGrid(state),
    [buildingFrontTile(home)],
    extra.count,
    taken,
  );
  for (const tile of tiles) createUnit(state, extra.type, extra.owner, tile.x, tile.y);
}

/** A game state with a map and each side's starting stock, but no units or buildings. */
export function emptyState(seed: number, rng: RngState, map: GameMap, fog = true): GameState {
  return {
    seed,
    tick: 0,
    rng,
    map,
    players: map.startPositions.map(() => newPlayer(map)),
    entities: [],
    nextEntityId: 1,
    fogEnabled: fog,
    winner: null,
    events: [],
  };
}

/** A side with its starting stock, knowing nothing of the map yet. */
export function newPlayer(map: GameMap): PlayerState {
  return {
    resources: { ...START_CONFIG.resources },
    visibility: new Array<number>(map.width * map.height).fill(UNEXPLORED),
    ai: null,
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

    // Units placed behind a building would be hidden by it, so they start in front.
    const tiles = nearestFreeTiles(buildPathGrid(state), [buildingFrontTile(building)], unitCount);

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
