import { describe, expect, it } from 'vitest';
import { ageGesture, endGesture, moveGesture, startGesture } from './touchGesture';

const config = { touchSlopPx: 10, touchHoldMs: 300 };

describe('touch gestures', () => {
  it('is a tap when the finger is lifted without moving', () => {
    const gesture = startGesture(100, 100);
    ageGesture(gesture, 50, true, config);
    expect(endGesture(gesture)).toBe('tap');
  });

  it('is still a tap when the finger moved less than the slop', () => {
    const gesture = startGesture(100, 100);
    moveGesture(gesture, 106, 107, config);
    expect(gesture.mode).toBe('pending');
    expect(endGesture(gesture)).toBe('tap');
  });

  it('pans when the finger moves at once', () => {
    const gesture = startGesture(100, 100);
    ageGesture(gesture, 100, true, config);
    moveGesture(gesture, 120, 100, config);
    expect(gesture.mode).toBe('pan');
    expect(endGesture(gesture)).toBe('none');
  });

  it('is held after resting 300 ms, and then a drag draws a box', () => {
    const gesture = startGesture(100, 100);
    ageGesture(gesture, 250, true, config);
    expect(gesture.mode).toBe('pending');
    ageGesture(gesture, 50, true, config);
    expect(gesture.mode).toBe('held');
    moveGesture(gesture, 160, 140, config);
    expect(gesture.mode).toBe('box');
    expect(endGesture(gesture)).toBe('box');
  });

  it('is a tap when a held finger is lifted without moving', () => {
    const gesture = startGesture(100, 100);
    ageGesture(gesture, 400, true, config);
    expect(endGesture(gesture)).toBe('tap');
  });

  it('keeps panning once it has started, however long it lasts', () => {
    const gesture = startGesture(100, 100);
    moveGesture(gesture, 130, 100, config);
    ageGesture(gesture, 1000, true, config);
    moveGesture(gesture, 100, 100, config);
    expect(gesture.mode).toBe('pan');
  });

  it('never becomes held when holding is not allowed', () => {
    const gesture = startGesture(100, 100);
    ageGesture(gesture, 1000, false, config);
    expect(gesture.mode).toBe('pending');
    moveGesture(gesture, 150, 100, config);
    expect(gesture.mode).toBe('pan');
  });
});
