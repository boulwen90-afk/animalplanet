/** Simulation timing. See GDD section 11. */
export const SIM_CONFIG = {
  /** Simulation steps per second. The simulation always advances in steps of this size. */
  ticksPerSecond: 20,
  /** Most steps simulated in one rendered frame. Extra time is dropped rather than caught up. */
  maxTicksPerFrame: 5,
} as const;

/** Length of one simulation step in milliseconds. */
export const TICK_MS = 1000 / SIM_CONFIG.ticksPerSecond;
