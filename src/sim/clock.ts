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

/** How long simulation steps took, as measured by whoever runs them. */
export interface StepTimes {
  /** The steps measured since the average was last read: how many, and their time together. */
  count: number;
  totalMs: number;
  /** The longest step in the current window and in the one before it. */
  largestMs: [number, number];
  /** Steps measured in the current window. */
  inWindow: number;
}

/** A reading of the step times: the average since the last reading, and the longest step of late. */
export interface StepTime {
  averageMs: number;
  largestMs: number;
}

/** The longest step is remembered for between one and two windows of this many steps (10 to 20 seconds). */
const LARGEST_WINDOW_STEPS = 200;

export function createStepTimes(): StepTimes {
  return { count: 0, totalMs: 0, largestMs: [0, 0], inWindow: 0 };
}

/** Notes how long one step took. */
export function recordStep(times: StepTimes, ms: number): void {
  times.count++;
  times.totalMs += ms;
  if (times.inWindow >= LARGEST_WINDOW_STEPS) {
    times.largestMs = [0, times.largestMs[0]];
    times.inWindow = 0;
  }
  times.inWindow++;
  times.largestMs[0] = Math.max(times.largestMs[0], ms);
}

/** Reads the average of the steps since the last reading, and starts a new average. */
export function takeStepTime(times: StepTimes): StepTime {
  const averageMs = times.count > 0 ? times.totalMs / times.count : 0;
  times.count = 0;
  times.totalMs = 0;
  return { averageMs, largestMs: Math.max(...times.largestMs) };
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
