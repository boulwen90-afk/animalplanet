import { START_CONFIG } from '../data/setup';
import type { Terrain } from '../data/terrain';
import { emptyState } from './game';
import type { Cave } from './map/grid';
import { initialResourceAmounts } from './resources';
import type { GameState } from './state';

/**
 * Builds a small game state for unit tests from rows of characters:
 * '.' grass, 'T' tree, 'B' berries, 'R' rock, 'W' water. No entities.
 */
export function stateFromRows(rows: string[]): GameState {
  const legend: Record<string, Terrain> = {
    '.': 'grass',
    T: 'tree',
    B: 'berries',
    R: 'rock',
    W: 'water',
  };
  const terrain = rows.flatMap((row) =>
    [...row].map((c) => {
      const tile = legend[c];
      if (!tile) throw new Error(`Unknown map character '${c}'`);
      return tile;
    }),
  );
  const state = emptyState(
    0,
    { s: 0 },
    {
      width: (rows[0] as string).length,
      height: rows.length,
      terrain,
      resourceAmount: initialResourceAmounts(terrain),
      startPositions: [],
      caves: [],
    },
  );
  // Two sides, as in a real game, although the test map has no start positions.
  state.players = [0, 1].map(() => ({ resources: { ...START_CONFIG.resources } }));
  return state;
}

/** An open grass map of the given size. */
export function openState(width: number, height: number): GameState {
  return stateFromRows(Array.from({ length: height }, () => '.'.repeat(width)));
}

/** Puts a cave for a side on a tile of a test map. */
export function addCave(state: GameState, owner: number, x: number, y: number): Cave {
  const cave: Cave = { id: state.map.caves.length + 1, owner, x, y, occupants: [], reserved: 0 };
  state.map.caves.push(cave);
  state.map.terrain[y * state.map.width + x] = 'cave';
  state.map.resourceAmount[y * state.map.width + x] = 0;
  return cave;
}
