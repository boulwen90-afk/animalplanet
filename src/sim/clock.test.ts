import { describe, expect, it } from 'vitest';
import { consumeSteps, createStepClock } from './clock';

describe('consumeSteps', () => {
  it('returns no steps until a whole step of time has passed', () => {
    const clock = createStepClock();
    expect(consumeSteps(clock, 30, 50, 5)).toBe(0);
    expect(consumeSteps(clock, 19, 50, 5)).toBe(0);
    expect(consumeSteps(clock, 1, 50, 5)).toBe(1);
    expect(clock.accumulatorMs).toBe(0);
  });

  it('carries the remainder to the next frame', () => {
    const clock = createStepClock();
    expect(consumeSteps(clock, 120, 50, 5)).toBe(2);
    expect(clock.accumulatorMs).toBe(20);
    expect(consumeSteps(clock, 30, 50, 5)).toBe(1);
  });

  it('gives 20 steps per second at any frame rate', () => {
    for (const frameMs of [1000 / 144, 1000 / 60, 1000 / 30, 100]) {
      const clock = createStepClock();
      let steps = 0;
      const frames = Math.round(10_000 / frameMs);
      for (let i = 0; i < frames; i++) steps += consumeSteps(clock, frameMs, 50, 5);
      // 10 seconds of frames; allow one step for floating point rounding.
      expect(Math.abs(steps - 200)).toBeLessThanOrEqual(1);
    }
  });

  it('caps the steps per frame and drops the excess time', () => {
    const clock = createStepClock();
    expect(consumeSteps(clock, 5000, 50, 5)).toBe(5);
    expect(clock.accumulatorMs).toBe(0);
    expect(consumeSteps(clock, 50, 50, 5)).toBe(1);
  });

  it('ignores negative time', () => {
    const clock = createStepClock();
    expect(consumeSteps(clock, -500, 50, 5)).toBe(0);
    expect(clock.accumulatorMs).toBe(0);
  });
});
