import { describe, expect, it } from 'vitest';
import { createUnit } from '../../sim/entities';
import { openState } from '../../sim/testUtils';
import {
  DIRECTIONS,
  activityOf,
  animationFor,
  attackFrame,
  facingOf,
  frameAt,
  frameName,
  progressFrame,
  travelFrame,
  type AnimationInfo,
  type CharacterAnimations,
} from './animation';

const name = (dx: number, dy: number) => {
  const index = facingOf(dx, dy);
  return index === undefined ? undefined : DIRECTIONS[index];
};

describe('facingOf', () => {
  it('has no direction for no movement', () => {
    expect(facingOf(0, 0)).toBeUndefined();
  });

  it('follows the screen: tile x runs down to the right, tile y down to the left', () => {
    expect(name(1, 1)).toBe('s'); // straight down the screen
    expect(name(-1, -1)).toBe('n');
    expect(name(1, -1)).toBe('e'); // straight to the right
    expect(name(-1, 1)).toBe('w');
    expect(name(1, 0)).toBe('se');
    expect(name(0, 1)).toBe('sw');
    expect(name(-1, 0)).toBe('nw');
    expect(name(0, -1)).toBe('ne');
  });

  it('picks the nearest of the eight directions for steps in between', () => {
    expect(name(1, 0.1)).toBe('se');
    expect(name(1, 0.9)).toBe('s');
    expect(name(0.02, -0.11)).toBe('ne');
  });
});

describe('activityOf', () => {
  const unit = () => createUnit(openState(8, 8), 'ramkrigare', 0, 2, 2);

  it('is idle for a unit that stands still with nothing to do', () => {
    expect(activityOf(unit())).toBe('idle');
  });

  it('is walk for a unit that moved in the last step, whatever its task', () => {
    const walking = unit();
    walking.prevX = walking.x - 0.1;
    expect(activityOf(walking)).toBe('walk');
    walking.task = { kind: 'attack', targetId: 99, repathTicks: 0 };
    walking.attackCooldown = 10;
    expect(activityOf(walking)).toBe('walk');
    walking.task = { kind: 'flee', caveId: 0 };
    expect(activityOf(walking)).toBe('walk');
  });

  it('is attack for a unit that stands still between two strikes at its target', () => {
    const fighting = unit();
    fighting.task = { kind: 'attack', targetId: 99, repathTicks: 0 };
    fighting.attackCooldown = 12;
    expect(activityOf(fighting)).toBe('attack');
  });

  it('is idle for a unit whose target is gone, even while its cooldown runs', () => {
    const done = unit();
    done.attackCooldown = 12;
    expect(activityOf(done)).toBe('idle');
  });
});

describe('activityOf for a worker', () => {
  const worker = () => createUnit(openState(8, 8), 'samlare', 0, 2, 2);
  const gathering = (phase: 'toSource' | 'gathering' | 'toDropoff') => {
    const unit = worker();
    unit.task = {
      kind: 'gather',
      resource: 'wood',
      node: { x: 3, y: 2 },
      phase,
      workTicks: 0,
      dropoffId: null,
    };
    return unit;
  };

  it('is gather while it works a source, and not on the way there or back', () => {
    expect(activityOf(gathering('gathering'))).toBe('gather');
    expect(activityOf(gathering('toSource'))).toBe('idle');
    expect(activityOf(gathering('toDropoff'))).toBe('idle');
  });

  it('goes on working when a neighbour nudges it aside', () => {
    const nudged = gathering('gathering');
    nudged.prevX = nudged.x - 0.02;
    expect(activityOf(nudged)).toBe('gather');
  });

  it('is walk on the way to a source', () => {
    const walking = gathering('toSource');
    walking.prevX = walking.x - 0.1;
    expect(activityOf(walking)).toBe('walk');
  });

  it('is gather while it raises a building, once it has arrived', () => {
    const builder = worker();
    builder.task = { kind: 'build', buildingId: 7 };
    expect(activityOf(builder)).toBe('gather');
    builder.path = [{ x: 4, y: 2 }];
    builder.prevX = builder.x - 0.1;
    expect(activityOf(builder)).toBe('walk');
  });
});

describe('progressFrame', () => {
  const gather: AnimationInfo = { frames: 8, fps: 8, loop: true };

  it('starts on the frame where the tool strikes and runs through the loop once', () => {
    expect(progressFrame(gather, 0)).toBe(0);
    expect(progressFrame(gather, 0.124)).toBe(0);
    expect(progressFrame(gather, 0.125)).toBe(1);
    expect(progressFrame(gather, 0.5)).toBe(4);
    expect(progressFrame(gather, 0.99)).toBe(7);
  });

  it('stays inside the loop for values outside 0 to 1', () => {
    expect(progressFrame(gather, -1)).toBe(0);
    expect(progressFrame(gather, 1)).toBe(7);
    expect(progressFrame(gather, 3)).toBe(7);
  });
});

describe('animationFor', () => {
  const info: AnimationInfo = { frames: 8, fps: 8, loop: true };
  const warrior: CharacterAnimations = { idle: info, walk: info, defeat: info, attack: info };
  const worker: CharacterAnimations = { idle: info, walk: info, defeat: info, gather: info };

  it('is the animation of the activity when the character has it', () => {
    expect(animationFor(warrior, 'attack')).toBe('attack');
    expect(animationFor(worker, 'gather')).toBe('gather');
    expect(animationFor(worker, 'walk')).toBe('walk');
  });

  it('lets a worker strike with its tool: it has no attack of its own', () => {
    expect(animationFor(worker, 'attack')).toBe('gather');
  });

  it('falls back on standing when a character has neither', () => {
    expect(animationFor({ idle: info, walk: info, defeat: info }, 'attack')).toBe('idle');
    expect(animationFor({ idle: info, walk: info, defeat: info }, 'gather')).toBe('idle');
  });
});

describe('frameAt', () => {
  const walk: AnimationInfo = { frames: 8, fps: 16, loop: true };
  const defeat: AnimationInfo = { frames: 7, fps: 10, loop: false };

  it('steps through a loop at its frame rate and starts over', () => {
    expect(frameAt(walk, 0)).toBe(0);
    expect(frameAt(walk, 62)).toBe(0);
    expect(frameAt(walk, 63)).toBe(1);
    expect(frameAt(walk, 499)).toBe(7);
    expect(frameAt(walk, 500)).toBe(0);
  });

  it('shifts a loop by whole frames', () => {
    expect(frameAt(walk, 0, 3)).toBe(3);
    expect(frameAt(walk, 500, 7)).toBe(7);
  });

  it('stays on the last frame of an animation that plays once', () => {
    expect(frameAt(defeat, 0)).toBe(0);
    expect(frameAt(defeat, 350)).toBe(3);
    expect(frameAt(defeat, 5000)).toBe(6);
  });
});

describe('travelFrame', () => {
  // One loop of eight frames covers 0.8 tiles: a new frame every tenth of a tile.
  const run: AnimationInfo = { frames: 8, fps: 16, loop: true, distance: 0.8 };

  it('steps one frame for each share of the loop the unit has travelled', () => {
    expect(travelFrame(run, 0)).toBe(0);
    expect(travelFrame(run, 0.09)).toBe(0);
    expect(travelFrame(run, 0.11)).toBe(1);
    expect(travelFrame(run, 0.79)).toBe(7);
    expect(travelFrame(run, 0.81)).toBe(0);
    expect(travelFrame(run, 8.25)).toBe(2);
  });

  it('does not depend on time: the same distance gives the same frame at any speed', () => {
    // A unit at 2.2 tiles a second and one at 5 tiles a second, both 1.5 tiles along.
    const slow = travelFrame(run, 2.2 * (1.5 / 2.2));
    const fast = travelFrame(run, 5 * (1.5 / 5));
    expect(slow).toBe(fast);
  });

  it('stands still when the unit does', () => {
    expect(travelFrame(run, 3.33)).toBe(travelFrame(run, 3.33));
  });

  it('shifts the loop by whole frames', () => {
    expect(travelFrame(run, 0, 3)).toBe(3);
    expect(travelFrame(run, 0.75, 3)).toBe(2);
  });

  it('falls back to one frame for an animation without a distance', () => {
    expect(travelFrame({ frames: 8, fps: 16, loop: true }, 5)).toBe(0);
  });
});

describe('attackFrame', () => {
  const attack: AnimationInfo = { frames: 10, fps: 10, loop: true };

  it('shows the blow landing when the cooldown has just been set', () => {
    expect(attackFrame(attack, 24, 24)).toBe(0);
  });

  it('winds up for the next blow as the cooldown runs out', () => {
    expect(attackFrame(attack, 12, 24)).toBe(5);
    expect(attackFrame(attack, 1, 24)).toBe(9);
    expect(attackFrame(attack, 0, 24)).toBe(9);
  });
});

describe('frameName', () => {
  it('names a picture by animation, direction and frame', () => {
    expect(frameName('walk', 0, 3)).toBe('walk_s_3');
    expect(frameName('attack', 7, 0)).toBe('attack_sw_0');
  });
});
