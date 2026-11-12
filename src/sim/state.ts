import type { GameMap } from './map/grid';
import type { RngState } from './rng';

/**
 * The complete state of a game. Everything the simulation needs lives here,
 * as plain data, so a state can be copied, compared and inspected by tests.
 */
export interface GameState {
  /** Seed the game was created from. */
  seed: number;
  /** Number of simulation steps run so far. */
  tick: number;
  /** Random generator; all randomness in the simulation draws from it. */
  rng: RngState;
  map: GameMap;
}
