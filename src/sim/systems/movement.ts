import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { isUnit } from '../entities';
import type { GameState, Unit } from '../state';

/** Guards against stopping a hair short of a tile centre because of rounding. */
const EPSILON = 1e-9;

/** Moves every unit one simulation step along its path. */
export function moveUnits(state: GameState): void {
  for (const entity of state.entities) {
    if (isUnit(entity)) moveUnit(entity);
  }
}

function moveUnit(unit: Unit): void {
  unit.prevX = unit.x;
  unit.prevY = unit.y;

  // Distance the unit may cover this step. Whatever is left after reaching
  // one tile centre carries on towards the next, so speed stays constant.
  let budget = UNIT_DEFS[unit.type].speed / SIM_CONFIG.ticksPerSecond;
  while (budget > EPSILON) {
    const next = unit.path[0];
    if (!next) break;
    const targetX = next.x + 0.5;
    const targetY = next.y + 0.5;
    const dx = targetX - unit.x;
    const dy = targetY - unit.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= budget + EPSILON) {
      unit.x = targetX;
      unit.y = targetY;
      unit.path.shift();
      budget -= distance;
    } else {
      unit.x += (dx / distance) * budget;
      unit.y += (dy / distance) * budget;
      budget = 0;
    }
  }
}
