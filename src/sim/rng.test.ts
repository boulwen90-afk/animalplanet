import { describe, expect, it } from 'vitest';
import { createRng, nextFloat, nextInt, parseSeed, pick } from './rng';

function sequence(seed: number, length: number): number[] {
  const rng = createRng(seed);
  return Array.from({ length }, () => nextFloat(rng));
}

describe('seeded rng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(sequence(42, 100)).toEqual(sequence(42, 100));
  });

  it('gives different sequences for different seeds', () => {
    expect(sequence(1, 20)).not.toEqual(sequence(2, 20));
  });

  it('gives a fixed, known sequence for seed 1', () => {
    // Pins the algorithm: changing it would silently change every map.
    const rng = createRng(1);
    expect([nextInt(rng, 0, 999), nextInt(rng, 0, 999), nextInt(rng, 0, 999)]).toEqual([
      627, 2, 527,
    ]);
  });

  it('continues from its stored state', () => {
    const rng = createRng(7);
    nextFloat(rng);
    nextFloat(rng);
    const copy = { ...rng };
    expect(nextFloat(copy)).toBe(nextFloat(rng));
  });

  it('stays within [0, 1) and looks uniform', () => {
    const values = sequence(123, 10_000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it('nextInt covers both ends of its range and nothing outside', () => {
    const rng = createRng(5);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(nextInt(rng, 3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it('pick returns elements of the array', () => {
    const rng = createRng(9);
    const items = ['a', 'b', 'c'];
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(pick(rng, items));
    expect([...seen].sort()).toEqual(items);
  });

  it('pick refuses an empty array', () => {
    expect(() => pick(createRng(1), [])).toThrow();
  });
});

describe('parseSeed', () => {
  it('reads whole numbers', () => {
    expect(parseSeed('0', 99)).toBe(0);
    expect(parseSeed('12345', 99)).toBe(12345);
    expect(parseSeed('4294967295', 99)).toBe(4294967295);
  });

  it('falls back when the seed is missing or not a whole number in range', () => {
    for (const text of [null, undefined, '', 'abc', '-1', '1.5', '1e3', ' 7', '4294967296']) {
      expect(parseSeed(text, 99)).toBe(99);
    }
  });
});
