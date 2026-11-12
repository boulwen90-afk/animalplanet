/**
 * Fixed time step: turns the uneven time between rendered frames into a whole
 * number of equally long simulation steps, carrying the remainder forward.
 */

export interface StepClock {
  /** Time, in milliseconds, received but not yet simulated. Always less than one step. */
  accumulatorMs: number;
}

export function createStepClock(): StepClock {
  return { accumulatorMs: 0 };
}

/**
 * Adds elapsed time and returns how many steps to simulate now. At most
 * `maxSteps` are returned; time beyond that is dropped so a slow machine
 * falls behind real time instead of freezing while it catches up.
 */
export function consumeSteps(
  clock: StepClock,
  elapsedMs: number,
  stepMs: number,
  maxSteps: number,
): number {
  clock.accumulatorMs += Math.max(0, elapsedMs);
  const due = Math.floor(clock.accumulatorMs / stepMs);
  if (due > maxSteps) {
    clock.accumulatorMs = 0;
    return maxSteps;
  }
  clock.accumulatorMs -= due * stepMs;
  return due;
}
