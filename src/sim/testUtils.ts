import type { Terrain } from '../data/terrain';
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
  const width = (rows[0] as string).length;
  return {
    seed: 0,
    tick: 0,
    rng: { s: 0 },
    map: {
      width,
      height: rows.length,
      terrain: rows.flatMap((row) =>
        [...row].map((c) => {
          const terrain = legend[c];
          if (!terrain) throw new Error(`Unknown map character '${c}'`);
          return terrain;
        }),
      ),
      startPositions: [],
    },
    entities: [],
    nextEntityId: 1,
  };
}

/** An open grass map of the given size. */
export function openState(width: number, height: number): GameState {
  return stateFromRows(Array.from({ length: height }, () => '.'.repeat(width)));
}
