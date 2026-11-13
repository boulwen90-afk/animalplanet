import { describe, expect, it } from 'vitest';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, hasSurrendered, isUnit, unitTile } from '../entities';
import type { GameState, Unit } from '../state';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { separateUnits } from './separation';

const WARRIOR = UNIT_DEFS.ramkrigare.radius;

/** The smallest distance between the centres of any two of the units. */
function closest(units: readonly Unit[]): number {
  let least = Infinity;
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      least = Math.min(least, Math.hypot(units[i]!.x - units[j]!.x, units[i]!.y - units[j]!.y));
    }
  }
  return least;
}

const standing = (state: GameState) =>
  state.entities.filter(isUnit).filter((u) => !hasSurrendered(u) && u.path.length === 0);

describe('separateUnits', () => {
  it('leaves units on neighbouring tiles alone', () => {
    const state = openState(8, 8);
    const a = createUnit(state, 'ramkrigare', 0, 2, 2);
    const b = createUnit(state, 'ramkrigare', 0, 3, 2);
    const c = createUnit(state, 'ramkrigare', 0, 3, 3);
    separateUnits(state);
    expect([a.x, a.y, b.x, b.y, c.x, c.y]).toEqual([2.5, 2.5, 3.5, 2.5, 3.5, 3.5]);
  });

  it('pushes units that work on the same tile apart, but never off the tile', () => {
    const state = stateFromRows(['.....', '..T..', '.....']);
    const workers = [0, 1, 2].map(() => createUnit(state, 'samlare', 0, 2, 2));
    for (const worker of workers) {
      worker.task = {
        kind: 'gather',
        resource: 'wood',
        node: { x: 2, y: 1 },
        phase: 'gathering',
        workTicks: 0,
        dropoffId: null,
      };
    }
    for (let step = 0; step < 60; step++) separateUnits(state);
    for (const worker of workers) expect(unitTile(worker)).toEqual({ x: 2, y: 2 });
    expect(closest(workers)).toBeGreaterThan(0.5);
  });

  it('idle units that end up on the same tile move to tiles of their own', () => {
    const state = openState(8, 8);
    const units = [0, 1, 2].map(() => createUnit(state, 'ramkrigare', 0, 3, 3));
    advance(state, 60);
    expect(units.every((u) => u.path.length === 0)).toBe(true);
    expect(new Set(units.map((u) => `${unitTile(u).x},${unitTile(u).y}`)).size).toBe(3);
    // The first of them kept the tile.
    expect(unitTile(units[0]!)).toEqual({ x: 3, y: 3 });
    expect(closest(units)).toBeGreaterThanOrEqual(2 * WARRIOR - 0.01);
  });

  it('gives the same result every time', () => {
    const run = () => {
      const state = openState(8, 8);
      for (let i = 0; i < 4; i++) createUnit(state, 'samlare', 0, 3, 3);
      advance(state, 40);
      return state.entities.filter(isUnit).map((u) => [u.x, u.y]);
    };
    expect(run()).toEqual(run());
  });

  it('a unit on the move gives way to one that stands still', () => {
    const state = openState(12, 5);
    const guard = createUnit(state, 'ramkrigare', 0, 5, 2);
    const walker = createUnit(state, 'ramkrigare', 0, 1, 2);
    applyCommand(state, { type: 'move', player: 0, unitIds: [walker.id], x: 9, y: 2 });
    for (let step = 0; step < 120; step++) {
      tick(state);
      expect([guard.x, guard.y]).toEqual([5.5, 2.5]);
    }
    // The walker was slowed down on its way past, but got there.
    expect(unitTile(walker)).toEqual({ x: 9, y: 2 });
    expect(walker.path).toEqual([]);
  });

  it('never pushes a unit onto ground it cannot walk on', () => {
    // A corridor one tile wide, with a guard standing in it.
    const state = stateFromRows(['RRRRRRRRRR', '..........', 'RRRRRRRRRR']);
    const guard = createUnit(state, 'ramkrigare', 0, 5, 1);
    const walker = createUnit(state, 'ramkrigare', 0, 0, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [walker.id], x: 9, y: 1 });
    for (let step = 0; step < 200; step++) {
      tick(state);
      expect(Math.floor(walker.y)).toBe(1);
    }
    // There is no way around, so it squeezes past; nobody gets stuck.
    expect(unitTile(walker)).toEqual({ x: 9, y: 1 });
    expect(unitTile(guard)).toEqual({ x: 5, y: 1 });
  });

  it("units that have surrendered are in nobody's way", () => {
    const state = openState(8, 8);
    const beaten = createUnit(state, 'ramkrigare', 1, 3, 3);
    beaten.task = { kind: 'flee', caveId: 0 };
    const other = createUnit(state, 'ramkrigare', 0, 3, 3);
    separateUnits(state);
    expect([beaten.x, beaten.y, other.x, other.y]).toEqual([3.5, 3.5, 3.5, 3.5]);
  });
});

describe('keeping apart in a group', () => {
  it('a group sent to one place ends up standing a full body apart', () => {
    const state = openState(24, 24);
    const group = Array.from({ length: 16 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 2 + (i % 4), 2 + Math.floor(i / 4)),
    );
    applyCommand(state, {
      type: 'move',
      player: 0,
      unitIds: group.map((u) => u.id),
      x: 16,
      y: 16,
    });
    advance(state, 400);
    expect(group.every((u) => u.path.length === 0)).toBe(true);
    expect(closest(group)).toBeGreaterThanOrEqual(2 * WARRIOR - 0.01);
  });

  it('two groups that walk through each other all arrive and then stand apart', () => {
    const state = openState(30, 12);
    const left = Array.from({ length: 12 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 2 + (i % 2), 2 + Math.floor(i / 2)),
    );
    const right = Array.from({ length: 12 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 26 + (i % 2), 2 + Math.floor(i / 2)),
    );
    for (const [units, x] of [
      [left, 26],
      [right, 2],
    ] as const) {
      applyCommand(state, { type: 'move', player: 0, unitIds: units.map((u) => u.id), x, y: 5 });
    }
    advance(state, 500);
    const all = [...left, ...right];
    expect(all.every((u) => u.path.length === 0)).toBe(true);
    expect(left.every((u) => u.x > 20)).toBe(true);
    expect(right.every((u) => u.x < 10)).toBe(true);
    expect(closest(all)).toBeGreaterThanOrEqual(2 * WARRIOR - 0.01);
  });
});

describe('keeping apart in a fight', () => {
  it('more attackers than there is room for wait further out instead of piling up', () => {
    const state = openState(22, 22);
    const victim = createBuilding(state, 'storide', 1, 10, 10);
    // A 3x3 building has sixteen tiles around it; thirty attackers come.
    const attackers = Array.from({ length: 30 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 1 + (i % 6), 1 + Math.floor(i / 6)),
    );
    applyCommand(state, {
      type: 'attack',
      player: 0,
      unitIds: attackers.map((u) => u.id),
      targetId: victim.id,
    });
    advance(state, 200);
    expect(state.entities.includes(victim)).toBe(true);
    expect(attackers.every((u) => u.path.length === 0)).toBe(true);
    // No two of them on the same tile, and a full body apart.
    expect(new Set(attackers.map((u) => `${unitTile(u).x},${unitTile(u).y}`)).size).toBe(30);
    expect(closest(attackers)).toBeGreaterThanOrEqual(2 * WARRIOR - 0.01);
    const waiting = attackers.filter((u) => u.task.kind === 'attack' && u.task.waiting);
    expect(waiting.length).toBe(30 - 16);
  });

  it('those who wait move in when a place by the target becomes free', () => {
    const state = openState(22, 22);
    const victim = createBuilding(state, 'storide', 1, 10, 10);
    const attackers = Array.from({ length: 20 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 1 + (i % 5), 1 + Math.floor(i / 5)),
    );
    const ids = attackers.map((u) => u.id);
    applyCommand(state, { type: 'attack', player: 0, unitIds: ids, targetId: victim.id });
    advance(state, 200);
    expect(state.entities.includes(victim)).toBe(true);
    const waiting = attackers.filter((u) => u.task.kind === 'attack' && u.task.waiting);
    expect(waiting.length).toBe(4);

    // Four of those by the building are called away.
    const striking = attackers.filter((u) => u.task.kind === 'attack' && !u.task.waiting);
    applyCommand(state, {
      type: 'move',
      player: 0,
      unitIds: striking.slice(0, 4).map((u) => u.id),
      x: 2,
      y: 19,
    });
    advance(state, 60);
    expect(state.entities.includes(victim)).toBe(true);
    expect(attackers.filter((u) => u.task.kind === 'attack' && u.task.waiting)).toEqual([]);
  });

  it('units that walk the same way side by side do not merge into one', () => {
    const state = openState(30, 6);
    // Both start on the same spot and are sent the same way.
    const pair = [0, 1].map(() => createUnit(state, 'ramkrigare', 0, 2, 2));
    applyCommand(state, { type: 'move', player: 0, unitIds: pair.map((u) => u.id), x: 26, y: 2 });
    advance(state, 100);
    expect(pair.every((u) => u.path.length > 0)).toBe(true);
    expect(closest(pair)).toBeGreaterThan(0.4);
  });

  it('in a battle of forty against forty, units that stand still do not stay on the same tile', () => {
    const state = openState(40, 24);
    for (let i = 0; i < 40; i++) {
      createUnit(state, 'ramkrigare', 0, 6 + (i % 4), 2 + Math.floor(i / 4) * 2);
      createUnit(state, 'ramkrigare', 1, 30 + (i % 4), 2 + Math.floor(i / 4) * 2);
    }
    // Both sides are sent to the same place, so that they meet.
    for (const owner of [0, 1] as const) {
      const side = state.entities.filter(isUnit).filter((u) => u.owner === owner);
      applyCommand(state, {
        type: 'move',
        player: owner,
        unitIds: side.map((u) => u.id),
        x: 20,
        y: 11,
      });
    }

    let fought = false;
    let shared = 0;
    let longestShared = 0;
    let steps = 0;
    let sharedSteps = 0;
    const sides = () =>
      new Set(
        state.entities
          .filter(isUnit)
          .filter((u) => !hasSurrendered(u))
          .map((u) => u.owner),
      ).size;
    // Until one side has been beaten, or five minutes at the most.
    for (let step = 0; step < 6000 && sides() > 1; step++) {
      tick(state);
      if (state.events.some((event) => event.type === 'hit')) fought = true;
      const still = standing(state);
      const tiles = new Set(still.map((u) => `${unitTile(u).x},${unitTile(u).y}`));
      steps++;
      if (tiles.size < still.length) {
        shared++;
        sharedSteps++;
      } else {
        shared = 0;
      }
      longestShared = Math.max(longestShared, shared);
    }
    expect(fought).toBe(true);
    // The fight is over: one side has been beaten.
    expect(sides()).toBe(1);
    expect(steps).toBeLessThan(6000);
    // Two units can stop on one tile in the same step; one of them then moves on at once.
    expect(longestShared).toBeLessThanOrEqual(3);
    expect(sharedSteps / steps).toBeLessThan(0.02);
    expect(closest(standing(state))).toBeGreaterThanOrEqual(2 * WARRIOR - 0.01);
  });
});
