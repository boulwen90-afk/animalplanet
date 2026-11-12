import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { CAVE_CONFIG } from '../../data/map';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import {
  buildings,
  createBuilding,
  createUnit,
  hasSurrendered,
  populationOf,
  unitTile,
  units,
} from '../entities';
import type { Entity, GameState, Unit } from '../state';
import { addCave, openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { strikeDamage, strikeTicks } from './combat';
import { canPlaceBuilding } from './construction';
import { freePlaces } from './surrender';

const SOLDIER = UNIT_DEFS.ramkrigare;
const WORKER = UNIT_DEFS.samlare;
/** Simulation steps between a soldier's strikes: 1.2 s. */
const SOLDIER_TICKS = SOLDIER.attackCooldown * SIM_CONFIG.ticksPerSecond;

function attack(state: GameState, attackers: Unit[], target: Entity) {
  return applyCommand(state, {
    type: 'attack',
    player: attackers[0]!.owner,
    unitIds: attackers.map((u) => u.id),
    targetId: target.id,
  });
}

const exists = (state: GameState, entity: Entity) => state.entities.includes(entity);

describe('damage', () => {
  it("is the attacker's damage minus the target's armour", () => {
    const state = openState(6, 6);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 1);
    const worker = createUnit(state, 'samlare', 1, 2, 1);
    const enemySoldier = createUnit(state, 'ramkrigare', 1, 3, 1);
    expect(strikeDamage(soldier, worker)).toBe(SOLDIER.damage - WORKER.armor);
    expect(strikeDamage(soldier, worker)).toBe(10);
    expect(strikeDamage(soldier, enemySoldier)).toBe(9);
    expect(strikeDamage(worker, soldier)).toBe(2);
  });

  it('is at least 1 however thick the armour', () => {
    const state = openState(6, 6);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const armoured = createUnit(state, 'ramkrigare', 1, 2, 1);
    const original = SOLDIER.armor;
    (UNIT_DEFS.ramkrigare as { armor: number }).armor = 50;
    try {
      expect(strikeDamage(worker, armoured)).toBe(1);
    } finally {
      (UNIT_DEFS.ramkrigare as { armor: number }).armor = original;
    }
  });

  it("counts a building's armour too", () => {
    const state = openState(10, 10);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 1);
    const storide = createBuilding(state, 'storide', 1, 4, 4);
    expect(strikeDamage(soldier, storide)).toBe(SOLDIER.damage - BUILDING_DEFS.storide.armor);
  });
});

describe('striking', () => {
  function duel() {
    const state = openState(8, 8);
    addCave(state, 1, 7, 7);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    return { state, soldier, worker };
  }

  it('happens at once when in reach, then once every 1.2 seconds', () => {
    const { state, soldier, worker } = duel();
    expect(SOLDIER_TICKS).toBe(24);
    expect(strikeTicks(soldier)).toBe(24);
    attack(state, [soldier], worker);

    tick(state);
    expect(worker.hp).toBe(WORKER.hp - 10);
    advance(state, SOLDIER_TICKS - 1);
    expect(worker.hp).toBe(WORKER.hp - 10);
    tick(state);
    expect(worker.hp).toBe(WORKER.hp - 20);
    advance(state, SOLDIER_TICKS);
    expect(worker.hp).toBe(WORKER.hp - 30);
  });

  it('a Ramkrigare makes a Samlare surrender with its fourth strike, after 73 steps', () => {
    const { state, soldier, worker } = duel();
    attack(state, [soldier], worker);
    // 40 life at 10 per strike: strikes on steps 1, 25, 49 and 73.
    const expected = 1 + 3 * SOLDIER_TICKS;
    expect(expected).toBe(73);

    advance(state, expected - 1);
    expect(hasSurrendered(worker)).toBe(false);
    expect(worker.hp).toBe(10);
    tick(state);
    expect(hasSurrendered(worker)).toBe(true);
    expect(worker.hp).toBe(0);
    // The soldier sees on the next step that its target has given up.
    tick(state);
    expect(soldier.task).toEqual({ kind: 'idle' });
  });

  it('reports each hit as an event of the step it happened in', () => {
    const { state, soldier, worker } = duel();
    attack(state, [soldier], worker);
    tick(state);
    expect(state.events).toEqual([
      { type: 'hit', attackerId: soldier.id, targetId: worker.id, damage: 10 },
    ]);
    tick(state);
    expect(state.events).toEqual([]);
  });

  it('a Samlare fights when ordered to', () => {
    const state = openState(8, 8);
    const worker = createUnit(state, 'samlare', 0, 2, 2);
    const enemy = createUnit(state, 'ramkrigare', 1, 3, 2);
    // The enemy is kept from fighting back for this test.
    enemy.task = {
      kind: 'gather',
      resource: 'food',
      node: { x: 0, y: 0 },
      phase: 'gathering',
      workTicks: 0,
      dropoffId: null,
    };
    expect(attack(state, [worker], enemy)).toEqual({ ok: true });
    tick(state);
    expect(enemy.hp).toBe(SOLDIER.hp - 2);
  });

  it('diagonal neighbours are within reach', () => {
    const state = openState(8, 8);
    addCave(state, 1, 7, 7);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 3);
    attack(state, [soldier], worker);
    tick(state);
    expect(worker.hp).toBe(WORKER.hp - 10);
    expect(unitTile(soldier)).toEqual({ x: 2, y: 2 });
  });
});

describe('the attack command', () => {
  it('walks up to a distant target and then strikes', () => {
    const state = openState(14, 6);
    addCave(state, 1, 13, 5);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 2);
    const worker = createUnit(state, 'samlare', 1, 10, 2);
    attack(state, [soldier], worker);
    advance(state, 60);
    expect(worker.hp).toBe(WORKER.hp);
    advance(state, 60);
    expect(worker.hp).toBeLessThan(WORKER.hp);
    const here = unitTile(soldier);
    expect(Math.max(Math.abs(here.x - 10), Math.abs(here.y - 2))).toBe(1);
  });

  it('follows a target that moves away', () => {
    const state = openState(24, 8);
    addCave(state, 1, 23, 7);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 3);
    const worker = createUnit(state, 'samlare', 1, 4, 3);
    attack(state, [soldier], worker);
    // The Samlare is the faster of the two, so it gets away while it keeps walking.
    applyCommand(state, { type: 'move', player: 1, unitIds: [worker.id], x: 20, y: 3 });
    advance(state, 60);
    expect(unitTile(soldier).x).toBeGreaterThan(5);
    expect(soldier.task).toMatchObject({ kind: 'attack', targetId: worker.id });

    // It catches up once the Samlare has stopped.
    advance(state, 400);
    expect(hasSurrendered(worker) || !exists(state, worker)).toBe(true);
    expect(unitTile(soldier).x).toBeGreaterThan(15);
  });

  it('several attackers stand on separate tiles around the target', () => {
    const state = openState(14, 14);
    const target = createBuilding(state, 'storide', 1, 6, 6);
    const soldiers = [0, 1, 2, 3].map((i) => createUnit(state, 'ramkrigare', 0, 1, 1 + i));
    attack(state, soldiers, target);
    advance(state, 200);
    const tiles = soldiers.map((s) => `${unitTile(s).x},${unitTile(s).y}`);
    expect(new Set(tiles).size).toBe(4);
    expect(target.hp).toBeLessThan(BUILDING_DEFS.storide.hp);
  });

  it('refuses own units, missing targets and surrendered units as targets', () => {
    const state = openState(10, 10);
    addCave(state, 1, 9, 9);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 1);
    const friend = createUnit(state, 'samlare', 0, 2, 1);
    const ownBuilding = createBuilding(state, 'visthus', 0, 5, 5);
    const beaten = createUnit(state, 'samlare', 1, 8, 1);
    beaten.task = { kind: 'flee', caveId: 1 };
    for (const target of [friend, ownBuilding, beaten]) {
      expect(attack(state, [soldier], target)).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(
      applyCommand(state, { type: 'attack', player: 0, unitIds: [soldier.id], targetId: 999 }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(soldier.task).toEqual({ kind: 'idle' });
  });

  it("does not order another player's units", () => {
    const state = openState(10, 10);
    const enemySoldier = createUnit(state, 'ramkrigare', 1, 1, 1);
    const target = createUnit(state, 'samlare', 1, 2, 1);
    expect(
      applyCommand(state, {
        type: 'attack',
        player: 0,
        unitIds: [enemySoldier.id],
        targetId: target.id,
      }),
    ).toEqual({ ok: false, reason: 'invalid' });
  });

  it('gives up on a target it cannot get next to', () => {
    const state = stateFromRows(['...W....', '...W....', '...W....']);
    const soldier = createUnit(state, 'ramkrigare', 0, 0, 1);
    const worker = createUnit(state, 'samlare', 1, 6, 1);
    attack(state, [soldier], worker);
    advance(state, 5);
    expect(soldier.task).toEqual({ kind: 'idle' });
    expect(worker.hp).toBe(WORKER.hp);
  });

  it('a move order calls off the attack', () => {
    const state = openState(14, 6);
    const soldier = createUnit(state, 'ramkrigare', 0, 1, 2);
    const worker = createUnit(state, 'samlare', 1, 10, 2);
    attack(state, [soldier], worker);
    advance(state, 20);
    applyCommand(state, { type: 'move', player: 0, unitIds: [soldier.id], x: 1, y: 5 });
    advance(state, 200);
    expect(unitTile(soldier)).toEqual({ x: 1, y: 5 });
    expect(worker.hp).toBe(WORKER.hp);
  });
});

describe('attacking on its own', () => {
  it('an idle Ramkrigare attacks an enemy unit within 6 tiles', () => {
    const state = openState(20, 6);
    addCave(state, 1, 19, 5);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 8, 2);
    expect(SOLDIER.aggroRadius).toBe(6);
    tick(state);
    expect(soldier.task).toMatchObject({ kind: 'attack', targetId: worker.id });
    advance(state, 200);
    expect(hasSurrendered(worker) || !exists(state, worker)).toBe(true);
  });

  it('but not one further away than 6 tiles', () => {
    const state = openState(20, 6);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 9, 2);
    advance(state, 100);
    expect(soldier.task).toEqual({ kind: 'idle' });
    expect(unitTile(soldier)).toEqual({ x: 2, y: 2 });
    expect(worker.hp).toBe(WORKER.hp);
  });

  it('picks the nearest of several enemies', () => {
    const state = openState(20, 8);
    const soldier = createUnit(state, 'ramkrigare', 0, 6, 3);
    createUnit(state, 'samlare', 1, 11, 3);
    const near = createUnit(state, 'samlare', 1, 4, 3);
    tick(state);
    expect(soldier.task).toMatchObject({ kind: 'attack', targetId: near.id });
  });

  it('does not attack its own side, buildings, or while walking', () => {
    const state = openState(20, 12);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    createUnit(state, 'samlare', 0, 3, 2);
    const enemyBuilding = createBuilding(state, 'visthus', 1, 5, 2);
    advance(state, 40);
    expect(soldier.task).toEqual({ kind: 'idle' });
    expect(enemyBuilding.hp).toBe(BUILDING_DEFS.visthus.hp);

    const enemy = createUnit(state, 'samlare', 1, 4, 6);
    applyCommand(state, { type: 'move', player: 0, unitIds: [soldier.id], x: 2, y: 11 });
    advance(state, 30);
    // Still walking past: the enemy four tiles away is left alone.
    expect(soldier.path.length).toBeGreaterThan(0);
    expect(enemy.hp).toBe(WORKER.hp);
  });

  it('a Samlare never attacks on its own', () => {
    const state = openState(8, 8);
    const worker = createUnit(state, 'samlare', 0, 2, 2);
    const enemy = createUnit(state, 'samlare', 1, 3, 2);
    advance(state, 100);
    expect(worker.task).toEqual({ kind: 'idle' });
    expect(enemy.hp).toBe(WORKER.hp);
  });

  it('two soldiers fight until one surrenders', () => {
    const state = openState(12, 6);
    addCave(state, 0, 0, 5);
    addCave(state, 1, 11, 5);
    const a = createUnit(state, 'ramkrigare', 0, 4, 2);
    const b = createUnit(state, 'ramkrigare', 1, 6, 2);
    advance(state, 600);
    const standing = units(state).filter((u) => !hasSurrendered(u));
    expect(standing).toHaveLength(1);
    expect([a.id, b.id]).toContain(standing[0]!.id);
    expect(standing[0]!.hp).toBeGreaterThan(0);
  });
});

describe('surrender', () => {
  /** A soldier next to an enemy worker, with the worker's caves where the test puts them. */
  function beaten(caves: [number, number][], rows = 8, cols = 16) {
    const state = openState(cols, rows);
    const made = caves.map(([x, y]) => addCave(state, 1, x, y));
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    worker.hp = 1;
    attack(state, [soldier], worker);
    tick(state);
    return { state, soldier, worker, caves: made };
  }

  it("a unit whose life runs out surrenders and heads for its side's cave", () => {
    const { state, worker, caves } = beaten([[12, 2]]);
    expect(worker.task).toEqual({ kind: 'flee', caveId: caves[0]!.id });
    expect(worker.hp).toBe(0);
    expect(worker.path.length).toBeGreaterThan(0);
    expect(state.events).toContainEqual({ type: 'surrender', unitId: worker.id });
  });

  it('reserves its place in the cave at once', () => {
    const { caves } = beaten([[12, 2]]);
    expect(caves[0]!.reserved).toBe(1);
    expect(freePlaces(caves[0]!)).toBe(CAVE_CONFIG.capacity - 1);
  });

  it('walks to the cave, goes in and is gone from the map', () => {
    const { state, worker, caves } = beaten([[12, 2]]);
    // 8 tiles to the tile next to the cave at 2.5 tiles per second.
    advance(state, 63);
    expect(exists(state, worker)).toBe(true);
    advance(state, 2);
    expect(exists(state, worker)).toBe(false);
    expect(caves[0]).toMatchObject({ occupants: ['samlare'], reserved: 0 });
  });

  it('reports going in as an event', () => {
    const { state, worker, caves } = beaten([[5, 2]]);
    let entered = false;
    for (let i = 0; i < 40 && !entered; i++) {
      tick(state);
      entered = state.events.some(
        (e) => e.type === 'enterCave' && e.unitId === worker.id && e.caveId === caves[0]!.id,
      );
    }
    expect(entered).toBe(true);
  });

  it('takes no more damage and is not chosen as a target', () => {
    const { state, soldier, worker } = beaten([[12, 2]]);
    advance(state, 30);
    expect(worker.hp).toBe(0);
    expect(soldier.task).toEqual({ kind: 'idle' });
    expect(attack(state, [soldier], worker)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('no longer counts as population from the moment it surrenders', () => {
    const state = openState(16, 8);
    addCave(state, 1, 12, 2);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    worker.hp = 1;
    expect(populationOf(state, 1)).toBe(1);
    attack(state, [soldier], worker);
    tick(state);
    expect(exists(state, worker)).toBe(true);
    expect(populationOf(state, 1)).toBe(0);
  });

  it('no longer takes orders', () => {
    const { state, worker } = beaten([[12, 2]]);
    const path = [...worker.path];
    applyCommand(state, { type: 'move', player: 1, unitIds: [worker.id], x: 0, y: 7 });
    expect(worker.task.kind).toBe('flee');
    expect(worker.path).toEqual(path);
  });

  it('drops what it was carrying', () => {
    const state = openState(16, 8);
    addCave(state, 1, 12, 2);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    worker.hp = 1;
    worker.carryType = 'food';
    worker.carryAmount = 7;
    attack(state, [soldier], worker);
    tick(state);
    expect(worker.carryAmount).toBe(0);
  });

  it("goes to the nearest of its side's caves", () => {
    const { worker, caves } = beaten([
      [14, 6],
      [6, 2],
    ]);
    expect(worker.task).toEqual({ kind: 'flee', caveId: caves[1]!.id });
  });

  it("never goes to the other side's cave", () => {
    const state = openState(16, 8);
    const enemyCave = addCave(state, 0, 4, 2);
    const ownCave = addCave(state, 1, 14, 6);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    worker.hp = 1;
    attack(state, [soldier], worker);
    tick(state);
    expect(worker.task).toEqual({ kind: 'flee', caveId: ownCave.id });
    advance(state, 400);
    expect(enemyCave.occupants).toEqual([]);
    expect(ownCave.occupants).toEqual(['samlare']);
  });

  it('the thirteenth unit goes to the second cave', () => {
    const { state, worker, caves } = beaten([
      [6, 2],
      [14, 6],
    ]);
    expect(worker.task).toEqual({ kind: 'flee', caveId: caves[0]!.id });

    // Fill the nearest cave, counting the place already held for the first unit.
    caves[0]!.occupants = Array(CAVE_CONFIG.capacity - 1).fill('samlare');
    expect(freePlaces(caves[0]!)).toBe(0);
    const next = createUnit(state, 'samlare', 1, 3, 3);
    next.hp = 1;
    const soldier = units(state).find((u) => u.type === 'ramkrigare')!;
    attack(state, [soldier], next);
    advance(state, 30);
    expect(next.task).toEqual({ kind: 'flee', caveId: caves[1]!.id });
  });

  it('vanishes at once when every cave is full', () => {
    const state = openState(16, 8);
    const caves = [addCave(state, 1, 6, 2), addCave(state, 1, 14, 6)];
    for (const cave of caves) cave.occupants = Array(CAVE_CONFIG.capacity).fill('samlare');
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    worker.hp = 1;
    attack(state, [soldier], worker);
    tick(state);
    expect(exists(state, worker)).toBe(false);
    expect(state.events).toContainEqual({ type: 'vanish', unitId: worker.id });
    expect(caves.map((c) => c.occupants.length)).toEqual([12, 12]);
  });

  it('holds exactly 24 units in two caves; the twenty-fifth vanishes', () => {
    const state = openState(20, 12);
    const caves = [addCave(state, 1, 6, 2), addCave(state, 1, 14, 6)];
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    for (let i = 0; i < 25; i++) {
      const worker = createUnit(state, 'samlare', 1, 3, 2);
      worker.hp = 1;
      attack(state, [soldier], worker);
      advance(state, SOLDIER_TICKS);
    }
    advance(state, 400);
    expect(caves.map((c) => c.occupants.length)).toEqual([12, 12]);
    expect(caves.map((c) => c.reserved)).toEqual([0, 0]);
    expect(units(state).filter((u) => u.owner === 1)).toEqual([]);
  });

  it('vanishes when its side has no cave, or none it can walk to', () => {
    const none = beaten([]);
    expect(exists(none.state, none.worker)).toBe(false);

    const state = stateFromRows(['......W...', '......W...', '......W...', '......W...']);
    const cave = addCave(state, 1, 9, 1);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 1, 3, 2);
    worker.hp = 1;
    attack(state, [soldier], worker);
    tick(state);
    expect(exists(state, worker)).toBe(false);
    expect(cave).toMatchObject({ occupants: [], reserved: 0 });
  });

  it('remembers which kinds of units are inside', () => {
    const state = openState(16, 8);
    const cave = addCave(state, 1, 6, 2);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const victims = [
      createUnit(state, 'samlare', 1, 3, 2),
      createUnit(state, 'ramkrigare', 1, 3, 3),
    ];
    // Keep the enemy soldier from fighting back.
    victims[1]!.task = {
      kind: 'gather',
      resource: 'food',
      node: { x: 0, y: 0 },
      phase: 'gathering',
      workTicks: 0,
      dropoffId: null,
    };
    for (const victim of victims) {
      victim.hp = 1;
      attack(state, [soldier], victim);
      advance(state, SOLDIER_TICKS + 1);
    }
    advance(state, 100);
    expect([...cave.occupants].sort()).toEqual(['ramkrigare', 'samlare']);
  });
});

describe('caves and building', () => {
  it('nothing may be built on a cave or next to one', () => {
    const state = openState(12, 12);
    addCave(state, 0, 6, 6);
    // On it, touching it by a side, touching it by a corner.
    expect(canPlaceBuilding(state, 'visthus', 5, 5)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 7, 6)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 4, 5)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 7, 7)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 4, 4)).toBe(false);
    // One tile of open ground in between is enough.
    expect(canPlaceBuilding(state, 'visthus', 8, 6)).toBe(true);
    expect(canPlaceBuilding(state, 'visthus', 3, 3)).toBe(true);
  });

  it('a cave blocks the way like any obstacle', () => {
    const state = openState(8, 3);
    addCave(state, 0, 4, 1);
    const unit = createUnit(state, 'samlare', 0, 1, 1);
    applyCommand(state, { type: 'move', player: 0, unitIds: [unit.id], x: 7, y: 1 });
    for (let i = 0; i < 200 && unit.path.length > 0; i++) {
      tick(state);
      expect(unitTile(unit)).not.toEqual({ x: 4, y: 1 });
    }
    expect(unitTile(unit)).toEqual({ x: 7, y: 1 });
  });
});

describe('buildings in combat', () => {
  it('a building whose life runs out collapses and frees its tiles', () => {
    const state = openState(12, 12);
    const soldier = createUnit(state, 'ramkrigare', 0, 3, 5);
    const visthus = createBuilding(state, 'visthus', 1, 4, 4);
    visthus.hp = 10;
    attack(state, [soldier], visthus);
    tick(state);
    expect(exists(state, visthus)).toBe(false);
    expect(state.events).toContainEqual({
      type: 'buildingCollapsed',
      buildingId: visthus.id,
      owner: 1,
      x: 4,
      y: 4,
    });
    expect(canPlaceBuilding(state, 'visthus', 4, 4)).toBe(true);

    applyCommand(state, { type: 'move', player: 0, unitIds: [soldier.id], x: 5, y: 5 });
    advance(state, 100);
    expect(unitTile(soldier)).toEqual({ x: 5, y: 5 });
  });

  it('reports an attacked building, for the warning to the player', () => {
    const state = openState(12, 12);
    const soldier = createUnit(state, 'ramkrigare', 1, 3, 5);
    const visthus = createBuilding(state, 'visthus', 0, 4, 4);
    attack(state, [soldier], visthus);
    tick(state);
    expect(state.events).toContainEqual({
      type: 'buildingAttacked',
      buildingId: visthus.id,
      owner: 0,
    });
    expect(visthus.hp).toBe(BUILDING_DEFS.visthus.hp - SOLDIER.damage);
  });

  it('losing a Visthus does not end the game', () => {
    const state = openState(12, 12);
    const soldier = createUnit(state, 'ramkrigare', 0, 3, 5);
    const visthus = createBuilding(state, 'visthus', 1, 4, 4);
    visthus.hp = 1;
    attack(state, [soldier], visthus);
    advance(state, 5);
    expect(state.winner).toBeNull();
    expect(state.tick).toBe(5);
  });

  it('a collapsed Storide gives the other side the win and stops the simulation', () => {
    for (const [attacker, loser] of [
      [0, 1],
      [1, 0],
    ] as const) {
      const state = openState(12, 12);
      const soldier = createUnit(state, 'ramkrigare', attacker, 3, 5);
      const storide = createBuilding(state, 'storide', loser, 4, 4);
      storide.hp = 5;
      attack(state, [soldier], storide);
      tick(state);
      expect(state.winner).toBe(attacker);
      expect(buildings(state)).toEqual([]);

      const frozen = structuredClone(state);
      advance(state, 100);
      expect(state).toEqual(frozen);
    }
  });

  it('eight Ramkrigare bring down a full Storide', () => {
    const state = openState(16, 16);
    const storide = createBuilding(state, 'storide', 1, 7, 7);
    const soldiers = Array.from({ length: 8 }, (_, i) =>
      createUnit(state, 'ramkrigare', 0, 2 + (i % 4), 2 + Math.floor(i / 4)),
    );
    attack(state, soldiers, storide);
    // 1500 life at 8 x 10 per 1.2 s is about 23 seconds, plus the walk there.
    advance(state, 700);
    expect(state.winner).toBe(0);
  });

  it('a unit building or delivering to a building that collapses carries on sensibly', () => {
    const state = stateFromRows([
      '..............',
      '..............',
      '.........B....',
      '..............',
      '..............',
    ]);
    createBuilding(state, 'storide', 1, 0, 1);
    const visthus = createBuilding(state, 'visthus', 1, 6, 3);
    const gatherer = createUnit(state, 'samlare', 1, 8, 2);
    applyCommand(state, { type: 'gather', player: 1, unitIds: [gatherer.id], x: 9, y: 2 });
    const soldier = createUnit(state, 'ramkrigare', 0, 5, 4);
    // Keep the soldier's mind on the building rather than on the worker.
    visthus.hp = 30;
    attack(state, [soldier], visthus);
    advance(state, 80);
    expect(exists(state, visthus)).toBe(false);
    // The worker now delivers to the Storide instead; the game does not break.
    expect(() => advance(state, 400)).not.toThrow();
  });
});

describe('combat stays deterministic', () => {
  it('gives the same result for the same battle', () => {
    const run = () => {
      const state = openState(20, 12);
      addCave(state, 0, 0, 11);
      addCave(state, 1, 19, 11);
      for (let i = 0; i < 4; i++) {
        createUnit(state, 'ramkrigare', 0, 5, 2 + i);
        createUnit(state, 'ramkrigare', 1, 9, 2 + i);
      }
      advance(state, 800);
      return state;
    };
    expect(run()).toEqual(run());
  });
});
