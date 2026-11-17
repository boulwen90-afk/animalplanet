import { describe, expect, it } from 'vitest';
import { cos, length, sin } from './math';

describe('arithmetic that is the same in every engine', () => {
  it('length is the square root of the sum of the squares, to the last bit', () => {
    expect(length(3, 4)).toBe(5);
    expect(length(0, 0)).toBe(0);
    expect(length(-6, 8)).toBe(10);
    for (const [dx, dy] of [
      [0.1, 0.2],
      [12.5, -7.25],
      [1e-3, 63.9],
    ] as const) {
      expect(length(dx, dy)).toBe(Math.sqrt(dx * dx + dy * dy));
      expect(length(dx, dy)).toBeCloseTo(Math.hypot(dx, dy), 12);
    }
  });

  it('sine and cosine agree with the built-in ones to thirteen decimals within ten turns', () => {
    let worst = 0;
    for (let i = -4000; i <= 4000; i++) {
      const angle = i * 0.0173;
      worst = Math.max(worst, Math.abs(sin(angle) - Math.sin(angle)));
      worst = Math.max(worst, Math.abs(cos(angle) - Math.cos(angle)));
    }
    expect(worst).toBeLessThan(1e-13);
  });

  it('and to ten decimals for the large angles the collision code makes from unit ids', () => {
    // The angle is brought down with the remainder by a full turn, which is
    // exact but uses the nearest number to two pi. The error grows with the
    // number of turns. It is the same error everywhere, which is what counts.
    let worst = 0;
    for (let id = 1; id < 5000; id += 7) {
      const angle = (id * 7 + (id + 1) * 13) * 2.399963;
      worst = Math.max(worst, Math.abs(sin(angle) - Math.sin(angle)));
      worst = Math.max(worst, Math.abs(cos(angle) - Math.cos(angle)));
    }
    expect(worst).toBeLessThan(1e-10);
  });

  it('is exact at nothing and at the half turn, and gives a vector of length one', () => {
    expect(sin(0)).toBe(0);
    expect(cos(0)).toBe(1);
    expect(cos(Math.PI)).toBe(-1);
    expect(cos(Math.PI / 2)).toBe(0);
    expect(sin(Math.PI)).toBe(0);
    expect(sin(Math.PI / 2)).toBeCloseTo(1, 15);
    expect(sin(-Math.PI / 2)).toBeCloseTo(-1, 15);
    for (const angle of [0.3, 1.9, -2.7, 44.1, 12345.678]) {
      expect(sin(angle) ** 2 + cos(angle) ** 2).toBeCloseTo(1, 14);
      expect(sin(-angle)).toBe(-sin(angle));
      expect(cos(-angle)).toBe(cos(angle));
    }
  });

  it('counts the same way as when it was written', () => {
    // These are the values the functions gave then, to the last digit. They
    // must be the same in every engine; a change in how they count shows here.
    expect(sin(1)).toBe(0.8414709848078965);
    expect(cos(1)).toBe(0.5403023058681398);
    expect(sin(100)).toBe(-0.5063656411097553);
    expect(cos(100)).toBe(0.862318872287686);
    expect(length(1, 2)).toBe(2.23606797749979);
  });
});
