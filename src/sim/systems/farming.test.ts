import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, removeEntity, unitTile } from '../entities';
import { findPath } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import type { Building, GameState, Unit } from '../state';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { canPlaceBuilding } from './construction';
import { workersAt } from './gathering';

const WORK = BUILDING_DEFS.odling.work!;
const CAPACITY = UNIT_DEFS.samlare.carryCapacity;
/** Simulation steps of work for one unit of food on a field. */
const TICKS_PER_UNIT = WORK.secondsPerUnit * SIM_CONFIG.ticksPerSecond;
const START_FOOD = START_CONFIG.resources.food;

const food = (state: GameState) => state.players[0]!.resources.food;
const work = (state: GameState, units: Unit[], field: Building) =>
  applyCommand(state, {
    type: 'work',
    player: 0,
    unitIds: units.map((unit) => unit.id),
    buildingId: field.id,
  });
const fieldOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.siteId : undefined);

/**
 * A Storide on tiles 4..6, and a field right beside it on 7..8, 4..5. The
 * field's work place is its far corner, tile (7, 4), which is next to the
 * Storide: a worker there delivers without walking.
 */
function setup() {
  const state = openState(16, 12);
  const storide = createBuilding(state, 'storide', 0, 4, 4);
  const field = createBuilding(state, 'odling', 0, 7, 4);
  const worker = createUnit(state, 'samlare', 0, 9, 6);
  return { state, storide, field, worker };
}

describe('the data', () => {
  it('a field costs only wood, is built by workers and can be walked across', () => {
    const def = BUILDING_DEFS.odling;
    expect(Object.keys(def.cost)).toEqual(['wood']);
    expect(UNIT_DEFS.samlare.builds).toContain('odling');
    expect(UNIT_DEFS.ramkrigare.builds).not.toContain('odling');
    expect(def.walkable).toBe(true);
    expect(def.size).toBe(2);
  });

  it('it gives food, to one worker at a time, more slowly than a berry bush', () => {
    expect(WORK.resource).toBe('food');
    expect(WORK.workers).toBe(1);
    // A worker takes 1 unit a second from a bush.
    expect(WORK.secondsPerUnit).toBeGreaterThan(1.5 / UNIT_DEFS.samlare.gatherRate);
  });
});

describe('working a field', () => {
  it('the worker walks onto the field and works on its place there', () => {
    const { state, field, worker } = setup();
    expect(work(state, [worker], field)).toEqual({ ok: true });
    expect(worker.task).toMatchObject({ kind: 'gather', resource: 'food', siteId: field.id });
    advance(state, 60);
    expect(unitTile(worker)).toEqual({ x: 7, y: 4 });
    expect(worker.task).toMatchObject({ phase: 'gathering' });
  });

  it('gives one unit of food for every 2.5 seconds of work', () => {
    const { state, field, worker } = setup();
    worker.x = 7.5;
    worker.y = 4.5;
    work(state, [worker], field);
    advance(state, TICKS_PER_UNIT - 1);
    expect(worker.carryAmount).toBe(0);
    advance(state, 1);
    expect(worker.carryAmount).toBe(1);
    advance(state, 3 * TICKS_PER_UNIT);
    expect(worker.carryAmount).toBe(4);
  });

  it('delivers a full load of ten, and nothing before', () => {
    const { state, field, worker } = setup();
    worker.x = 7.5;
    worker.y = 4.5;
    work(state, [worker], field);
    advance(state, CAPACITY * TICKS_PER_UNIT - 1);
    expect(food(state)).toBe(START_FOOD);
    advance(state, 1);
    expect(food(state)).toBe(START_FOOD + CAPACITY);
    expect(worker.carryAmount).toBe(0);
  });

  it('never runs out: it gives the same after fifty loads as after one', () => {
    const { state, field, worker } = setup();
    worker.x = 7.5;
    worker.y = 4.5;
    work(state, [worker], field);
    const round = CAPACITY * TICKS_PER_UNIT;
    advance(state, round);
    expect(food(state)).toBe(START_FOOD + CAPACITY);
    advance(state, 49 * round);
    expect(food(state)).toBe(START_FOOD + 50 * CAPACITY);
    expect(state.entities).toContain(field);
    expect(field.hp).toBe(BUILDING_DEFS.odling.hp);
  });

  it('is clearly slower than a berry bush, worker for worker', () => {
    // The same worker, standing next to the Storide, first on a bush and then on a field.
    const bushes = stateFromRows(['.......', '.......', '.....B.', '.......', '.......']);
    createBuilding(bushes, 'storide', 0, 1, 1);
    const picker = createUnit(bushes, 'samlare', 0, 4, 2);
    applyCommand(bushes, { type: 'gather', player: 0, unitIds: [picker.id], x: 5, y: 2 });
    advance(bushes, 60 * SIM_CONFIG.ticksPerSecond);

    const { state, field, worker } = setup();
    worker.x = 7.5;
    worker.y = 4.5;
    work(state, [worker], field);
    advance(state, 60 * SIM_CONFIG.ticksPerSecond);

    const fromBush = bushes.players[0]!.resources.food - START_FOOD;
    const fromField = food(state) - START_FOOD;
    expect(fromBush).toBe(60);
    expect(fromField).toBe(20);
  });

  it('carries the food to the nearest drop-off, as with berries', () => {
    const state = openState(30, 12);
    createBuilding(state, 'storide', 0, 1, 4);
    const storehouse = createBuilding(state, 'visthus', 0, 20, 4);
    const field = createBuilding(state, 'odling', 0, 23, 4);
    const worker = createUnit(state, 'samlare', 0, 23, 4);
    work(state, [worker], field);
    advance(state, CAPACITY * TICKS_PER_UNIT + 5);
    expect(worker.task).toMatchObject({ phase: 'toDropoff', dropoffId: storehouse.id });
    advance(state, 60);
    expect(food(state)).toBe(START_FOOD + CAPACITY);
  });

  it("is refused for a field that is not finished, not the player's own, or no field at all", () => {
    const { state, storide, field, worker } = setup();
    field.complete = false;
    expect(work(state, [worker], field)).toEqual({ ok: false, reason: 'invalid' });
    field.complete = true;
    field.owner = 1;
    expect(work(state, [worker], field)).toEqual({ ok: false, reason: 'invalid' });
    expect(work(state, [worker], storide)).toEqual({ ok: false, reason: 'invalid' });
    expect(worker.task.kind).toBe('idle');
  });

  it('a warrior cannot work a field', () => {
    const { state, field } = setup();
    const warrior = createUnit(state, 'ramkrigare', 0, 9, 7);
    work(state, [warrior], field);
    expect(warrior.task.kind).toBe('idle');
  });
});

describe('one worker to a field', () => {
  it('takes the first of two workers; the second keeps doing what it did', () => {
    const { state, field, worker } = setup();
    const second = createUnit(state, 'samlare', 0, 10, 6);
    work(state, [worker, second], field);
    expect(fieldOf(worker)).toBe(field.id);
    expect(second.task.kind).toBe('idle');
    expect(workersAt(state, field.id)).toEqual([worker]);
  });

  it('sends the second worker to another field nearby, if there is one with room', () => {
    const { state, field, worker } = setup();
    const other = createBuilding(state, 'odling', 0, 7, 7);
    const second = createUnit(state, 'samlare', 0, 10, 6);
    const third = createUnit(state, 'samlare', 0, 11, 6);
    work(state, [worker, second, third], field);
    expect(fieldOf(worker)).toBe(field.id);
    expect(fieldOf(second)).toBe(other.id);
    // Both fields are taken now.
    expect(third.task.kind).toBe('idle');
  });

  it('holds through a whole match of work: never two workers on one field', () => {
    const { state, field } = setup();
    const others = [
      createBuilding(state, 'odling', 0, 7, 7),
      createBuilding(state, 'odling', 0, 10, 8),
    ];
    const workers = [0, 1, 2, 3, 4].map((i) =>
      createUnit(state, 'samlare', 0, 11 + (i % 3), 2 + i),
    );
    for (let step = 0; step < 3000; step++) {
      // Every worker keeps asking for the first field.
      if (step % 100 === 0) work(state, workers, field);
      tick(state);
      for (const building of [field, ...others]) {
        expect(workersAt(state, building.id).length, `step ${step}`).toBeLessThanOrEqual(1);
      }
    }
    expect(workers.filter((w) => w.task.kind === 'gather')).toHaveLength(3);
    expect(food(state)).toBeGreaterThan(START_FOOD);
  });

  it('keeps its field while it carries the food home', () => {
    const state = openState(30, 12);
    createBuilding(state, 'storide', 0, 1, 4);
    const field = createBuilding(state, 'odling', 0, 12, 4);
    const worker = createUnit(state, 'samlare', 0, 12, 4);
    const second = createUnit(state, 'samlare', 0, 14, 4);
    work(state, [worker], field);
    advance(state, CAPACITY * TICKS_PER_UNIT + 20);
    expect(worker.task).toMatchObject({ phase: 'toDropoff' });
    work(state, [second], field);
    expect(second.task.kind).toBe('idle');
  });

  it('is free for another worker when the first is given another order', () => {
    const { state, field, worker } = setup();
    const second = createUnit(state, 'samlare', 0, 10, 6);
    work(state, [worker], field);
    applyCommand(state, { type: 'move', player: 0, unitIds: [worker.id], x: 12, y: 9 });
    work(state, [second], field);
    expect(fieldOf(second)).toBe(field.id);
  });
});

describe('building a field', () => {
  it('the worker that raises it starts working it when it is done', () => {
    const state = openState(16, 12);
    createBuilding(state, 'storide', 0, 4, 4);
    const builder = createUnit(state, 'samlare', 0, 9, 6);
    const helper = createUnit(state, 'samlare', 0, 10, 6);
    state.players[0]!.resources.wood = BUILDING_DEFS.odling.cost.wood!;
    const placed = applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [builder.id, helper.id],
      building: 'odling',
      x: 9,
      y: 2,
    });
    expect(placed).toEqual({ ok: true });
    expect(state.players[0]!.resources.wood).toBe(0);
    advance(state, (BUILDING_DEFS.odling.buildTime + 5) * SIM_CONFIG.ticksPerSecond);
    const field = state.entities.find(
      (e): e is Building => e.kind === 'building' && e.type === 'odling',
    )!;
    expect(field.complete).toBe(true);
    // One of the two works it; the other has nothing to do.
    const tasks = [builder, helper].map((unit) => unit.task.kind).sort();
    expect(tasks).toEqual(['gather', 'idle']);
    expect(workersAt(state, field.id)).toHaveLength(1);
    advance(state, 2 * CAPACITY * TICKS_PER_UNIT);
    expect(food(state)).toBeGreaterThan(START_FOOD);
  });

  it('units can walk across a field, but nothing can be built on it', () => {
    const state = openState(12, 6);
    const field = createBuilding(state, 'odling', 0, 4, 2);
    const grid = buildPathGrid(state);
    // Straight through the field.
    expect(findPath(grid, { x: 2, y: 2 }, { x: 7, y: 2 })).toHaveLength(5);
    expect(canPlaceBuilding(state, 'ide', 4, 2)).toBe(false);
    expect(canPlaceBuilding(state, 'ide', 5, 3)).toBe(false);
    expect(canPlaceBuilding(state, 'ide', 6, 2)).toBe(true);
    expect(state.entities).toContain(field);
  });
});

describe('when a field is lost', () => {
  it('its worker delivers what it carries and then has nothing to do', () => {
    const { state, field, worker } = setup();
    worker.x = 7.5;
    worker.y = 4.5;
    work(state, [worker], field);
    advance(state, 4 * TICKS_PER_UNIT);
    expect(worker.carryAmount).toBe(4);
    removeEntity(state, field.id);
    advance(state, 200);
    expect(food(state)).toBe(START_FOOD + 4);
    expect(worker.task.kind).toBe('idle');
  });

  it('its worker moves to another field nearby, if there is one free', () => {
    const { state, field, worker } = setup();
    const other = createBuilding(state, 'odling', 0, 7, 7);
    work(state, [worker], field);
    advance(state, 100);
    removeEntity(state, field.id);
    advance(state, 5);
    expect(fieldOf(worker)).toBe(other.id);
  });
});
