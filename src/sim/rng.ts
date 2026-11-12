/**
 * Seeded random numbers (mulberry32). The generator's whole state is one
 * number kept in the game state, so the same seed always gives the same game.
 */

export interface RngState {
  /** Current 32-bit state. */
  s: number;
}

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

/** Next number in [0, 1). */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Next integer in [min, max], both inclusive. */
export function nextInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

/** A random element of a non-empty array. */
export function pick<T>(rng: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: empty array');
  return items[nextInt(rng, 0, items.length - 1)] as T;
}

const MAX_SEED = 0xffffffff;

/**
 * Reads a seed from text such as the ?seed=N URL parameter. Anything that is
 * not a whole number from 0 to 4294967295 gives the fallback.
 */
export function parseSeed(text: string | null | undefined, fallback: number): number {
  if (text === null || text === undefined || !/^\d{1,10}$/.test(text)) return fallback;
  const seed = Number(text);
  return seed <= MAX_SEED ? seed : fallback;
}
