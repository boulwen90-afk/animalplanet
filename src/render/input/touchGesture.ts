/**
 * What one finger on the map is doing. A touch starts as `pending`. If the
 * finger moves at once, it pans the camera. If it rests long enough first it
 * becomes `held`, and moving it then draws a selection box. A finger lifted
 * without having moved is a tap, however long it rested.
 */
export type TouchMode = 'pending' | 'held' | 'pan' | 'box';

export interface TouchGesture {
  /** Screen position where the finger came down. */
  startX: number;
  startY: number;
  /** How long the finger has rested, in milliseconds of game time. */
  restedMs: number;
  mode: TouchMode;
}

export interface TouchGestureConfig {
  /** How far, in pixels, a finger may move and still count as resting. */
  touchSlopPx: number;
  /** How long a finger must rest before it is `held`, in milliseconds. */
  touchHoldMs: number;
}

export function startGesture(x: number, y: number): TouchGesture {
  return { startX: x, startY: y, restedMs: 0, mode: 'pending' };
}

/**
 * Lets time pass for a finger that has not moved yet. `canHold` is false
 * when a rested finger should not draw a selection box.
 */
export function ageGesture(
  gesture: TouchGesture,
  elapsedMs: number,
  canHold: boolean,
  config: TouchGestureConfig,
): void {
  if (gesture.mode !== 'pending') return;
  gesture.restedMs += elapsedMs;
  if (canHold && gesture.restedMs >= config.touchHoldMs) gesture.mode = 'held';
}

/** The finger is now at a new screen position. */
export function moveGesture(
  gesture: TouchGesture,
  x: number,
  y: number,
  config: TouchGestureConfig,
): void {
  if (gesture.mode === 'pan' || gesture.mode === 'box') return;
  const moved = Math.hypot(x - gesture.startX, y - gesture.startY);
  if (moved < config.touchSlopPx) return;
  gesture.mode = gesture.mode === 'held' ? 'box' : 'pan';
}

/** What lifting the finger means. */
export function endGesture(gesture: TouchGesture): 'tap' | 'box' | 'none' {
  if (gesture.mode === 'pending' || gesture.mode === 'held') return 'tap';
  return gesture.mode === 'box' ? 'box' : 'none';
}
