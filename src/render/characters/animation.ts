import type { ResourceType } from '../../data/resources';
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

export type CharacterAnimation = 'idle' | 'walk' | 'attack' | 'chop' | 'pick' | 'hammer' | 'defeat';

/** What a unit is doing, as far as its animation goes. */
export type Activity = Exclude<CharacterAnimation, 'defeat'>;

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
  /** For such an animation: how many loops a second the legs make at the unit's speed. */
  loopsPerSecond?: number;
}

/** What a character has pictures of. Every character can stand, walk and give up. */
export type CharacterAnimations = Record<'idle' | 'walk' | 'defeat', AnimationInfo> &
  Partial<Record<'attack' | 'chop' | 'pick' | 'hammer', AnimationInfo>>;

/** How a unit works each resource: it chops wood and picks food. */
export const GATHER_ACTIVITY: Record<ResourceType, Activity> = { wood: 'chop', food: 'pick' };

/** How a unit raises a building. */
export const BUILD_ACTIVITY: Activity = 'hammer';

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

/** What a unit is doing. A beaten unit that leaves the field walks. */
export function activityOf(unit: Unit): Activity {
  const task = unit.task;
  // A unit at work stands by what it works on. If a neighbour nudges it
  // aside it goes on working, so this comes before the check for movement.
  if (task.kind === 'gather' && task.phase === 'gathering') return GATHER_ACTIVITY[task.resource];
  if (task.kind === 'build' && unit.path.length === 0) return BUILD_ACTIVITY;
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

/**
 * The frame of a loop that is `progress` (0 to 1) of the way through. Used
 * for work that the simulation keeps the pace of: the loop starts where the
 * tool strikes, which is when a unit of the resource has just been taken.
 */
export function progressFrame(info: AnimationInfo, progress: number): number {
  const done = Math.min(1, Math.max(0, progress));
  return Math.min(info.frames - 1, Math.floor(done * info.frames));
}

/** What a character shows instead of an animation it has no pictures of, in order of choice. */
const STAND_INS: Record<Activity, readonly CharacterAnimation[]> = {
  idle: [],
  walk: [],
  // A worker has no attack of its own: it strikes with its axe as when it chops.
  attack: ['chop'],
  chop: ['attack'],
  pick: ['chop'],
  hammer: ['chop'],
};

/** The animation a character plays for what its unit does, of the ones it has pictures of. */
export function animationFor(
  animations: CharacterAnimations,
  activity: Activity,
): CharacterAnimation {
  if (animations[activity]) return activity;
  return STAND_INS[activity].find((name) => animations[name]) ?? 'idle';
}

/** The name of a picture in the atlas. */
export function frameName(animation: CharacterAnimation, direction: number, frame: number): string {
  return `${animation}_${DIRECTIONS[direction] ?? 's'}_${frame}`;
}
