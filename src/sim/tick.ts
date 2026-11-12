import type { GameState } from './state';
import { gatherResources } from './systems/gathering';
import { moveUnits } from './systems/movement';
import { produceUnits } from './systems/production';

/**
 * Advances the game by one simulation step. The systems always run in the
 * same order; later phases add construction, combat and so on.
 */
export function tick(state: GameState): void {
  produceUnits(state);
  gatherResources(state);
  moveUnits(state);
  state.tick++;
}

/** Advances the game by `steps` simulation steps. */
export function advance(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) tick(state);
}
