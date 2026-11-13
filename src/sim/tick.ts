import { runAi } from './ai/ai';
import type { GameState } from './state';
import { resolveCombat } from './systems/combat';
import { constructBuildings } from './systems/construction';
import { gatherResources } from './systems/gathering';
import { moveUnits } from './systems/movement';
import { produceUnits } from './systems/production';
import { separateUnits, settleUnits } from './systems/separation';
import { resolveSurrenders } from './systems/surrender';
import { updateVisibility } from './systems/visibility';

/**
 * Advances the game by one simulation step. The systems always run in the
 * same order. Once a side has won, the game stands still.
 */
export function tick(state: GameState): void {
  if (state.winner !== null) return;
  state.events = [];
  runAi(state);
  produceUnits(state);
  constructBuildings(state);
  gatherResources(state);
  resolveCombat(state);
  resolveSurrenders(state);
  moveUnits(state);
  separateUnits(state);
  settleUnits(state);
  updateVisibility(state);
  state.tick++;
}

/** Advances the game by `steps` simulation steps. */
export function advance(state: GameState, steps: number): void {
  for (let i = 0; i < steps; i++) tick(state);
}
