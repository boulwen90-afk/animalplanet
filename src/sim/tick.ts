import type { GameState } from './state';
import { moveUnits } from './systems/movement';

/**
 * Advances the game by one simulation step. The systems always run in the
 * same order; later phases add gathering, construction, combat and so on.
 */
export function tick(state: GameState): void {
  moveUnits(state);
  state.tick++;
}

/** Advances the game by `steps` simulation steps. */
export function advance(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) tick(state);
}
