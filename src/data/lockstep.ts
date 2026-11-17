/**
 * Turns, for a match between two players. Each of them runs the simulation
 * and only their orders are sent, so an order cannot be carried out the
 * moment it is given: both must first have it. See src/sim/lockstep.ts.
 */
export const LOCKSTEP_CONFIG = {
  /** How many simulation steps a turn is. At 20 steps a second, 4 steps are 200 ms. */
  stepsPerTurn: 4,
  /**
   * How many turns after it was given an order is carried out. With 2 turns
   * of 4 steps that is 8 steps, 400 ms: time for the order to reach the
   * other player before its step comes. Against the computer it is 0.
   */
  delayTurns: 2,
  /**
   * The most turns of orders one message carries. A message repeats every
   * turn the other player has not yet said it has, so that a lost message
   * mends itself with the next one.
   */
  maxTurnsPerMessage: 50,
} as const;
