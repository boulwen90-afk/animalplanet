import type { Unit } from '../../sim/state';

/**
 * Which picture of a character to show: the animation that fits what the
 * unit is doing, the way it faces, and how far into the animation it is.
 * Pure functions, so they can be tested without a browser.
 */

/**
 * The eight ways a character can face, named by where it looks on the screen
 * ("s" is towards the viewer). The order is clockwise seen from above, and is
 * the order the atlas uses.
 */
export const DIRECTIONS = ['s', 'se', 'e', 'ne', 'n', 'nw', 'w', 'sw'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export type CharacterAnimation = 'idle' | 'walk' | 'attack' | 'defeat';

/** What the atlas says about an animation. */
export interface AnimationInfo {
  frames: number;
  fps: number;
  loop: boolean;
  /**
   * For an animation of moving along the ground: how many tiles the figure
   * travels while the loop plays once without its feet sliding.
   */
  distance?: number;
}

/**
 * The direction, as an index into DIRECTIONS, of a step of (dx, dy) tiles;
 * undefined for no movement. On the screen the tile x axis runs down to the
 * right and the tile y axis down to the left.
 */
export function facingOf(dx: number, dy: number): number | undefined {
  if (dx === 0 && dy === 0) return undefined;
  // The same step on the ground as the figures were rendered on: x to the
  // right of the screen, y away from the viewer.
  const right = dx - dy;
  const away = -(dx + dy);
  const fromSouth = Math.atan2(right, -away);
  const eighth = Math.round(fromSouth / (Math.PI / 4));
  return ((eighth % 8) + 8) % 8;
}

/** What a unit is doing, as far as its animation goes. A beaten unit that leaves the field walks. */
export function activityOf(unit: Unit): 'idle' | 'walk' | 'attack' {
  if (unit.x !== unit.prevX || unit.y !== unit.prevY) return 'walk';
  // A unit that stands still with a target strikes it as soon as it may, so a
  // running cooldown means it is in the middle of a fight.
  if (unit.task.kind === 'attack' && unit.attackCooldown > 0) return 'attack';
  return 'idle';
}

/**
 * The frame of an animation after `elapsedMs`. A loop starts over; other
 * animations stay on their last frame. `offset` shifts a loop by whole
 * frames, so that units side by side do not move in step.
 */
export function frameAt(info: AnimationInfo, elapsedMs: number, offset = 0): number {
  const frame = Math.floor((Math.max(0, elapsedMs) / 1000) * info.fps);
  if (!info.loop) return Math.min(info.frames - 1, frame);
  return (frame + offset) % info.frames;
}

/**
 * The frame of a moving animation for a unit that has travelled `tiles` in
 * all. The loop is stepped by distance, not by time, so the feet stay planted
 * on the ground at any speed: a faster unit simply runs through the loop
 * faster. `offset` shifts the loop by whole frames, as in `frameAt`.
 */
export function travelFrame(info: AnimationInfo, tiles: number, offset = 0): number {
  if (!info.distance || info.distance <= 0) return offset % info.frames;
  const loops = tiles / info.distance;
  const frame = Math.floor((loops - Math.floor(loops)) * info.frames);
  return (Math.min(info.frames - 1, frame) + offset) % info.frames;
}

/**
 * The frame of the attack animation for a unit between two strikes. The
 * animation starts where the blow lands, which is when the cooldown has just
 * been set, and winds up for the next blow as the cooldown runs out.
 */
export function attackFrame(info: AnimationInfo, cooldown: number, strikeTicks: number): number {
  const sinceStrike = 1 - Math.min(1, Math.max(0, cooldown / strikeTicks));
  return Math.min(info.frames - 1, Math.floor(sinceStrike * info.frames));
}

/** The name of a picture in the atlas. */
export function frameName(animation: CharacterAnimation, direction: number, frame: number): string {
  return `${animation}_${DIRECTIONS[direction] ?? 's'}_${frame}`;
}
