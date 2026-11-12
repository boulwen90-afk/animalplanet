import type { GameState } from './state';

/**
 * Advances the game by one simulation step. Later phases run their systems
 * (movement, gathering, combat, ...) from here, in a fixed order.
 */
export function tick(state: GameState): void {
  state.tick++;
}

/** Advances the game by `steps` simulation steps. */
export function advance(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) tick(state);
}
