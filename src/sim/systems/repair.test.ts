import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS, CONSTRUCTION_CONFIG, type BuildingType } from '../../data/buildings';
import { REPAIR_CONFIG } from '../../data/repair';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, tileGapToBuilding, unitTile } from '../entities';
import type { Building, GameState, Unit } from '../state';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { buildWorkFor } from './construction';
import {
  fullRepairCost,
  lifePerWood,
  needsRepair,
  repairCost,
  repairPerStep,
  repairRate,
} from './repair';

const TYPES = Object.keys(BUILDING_DEFS) as BuildingType[];
const SECOND = SIM_CONFIG.ticksPerSecond;
const VISTHUS = BUILDING_DEFS.visthus;

const wood = (state: GameState) => state.players[0]!.resources.wood;
const setWood = (state: GameState, amount: number) => {
  state.players[0]!.resources.wood = amount;
};

const repair = (state: GameState, workers: Unit[], building: Building) =>
  applyCommand(state, {
    type: 'repair',
    player: 0,
    unitIds: workers.map((w) => w.id),
    buildingId: building.id,
  });

/** An open map with a damaged Visthus of side 0 in the middle, workers beside it, and wood. */
function setup(workers = 1, hp = VISTHUS.hp / 2) {
  const state = openState(16, 16);
  const building = createBuilding(state, 'visthus', 0, 7, 7);
  building.hp = hp;
  setWood(state, 1000);
  const crew: Unit[] = [];
  // Along the side of the building and on, so that nobody has far to walk.
  for (let i = 0; i < workers; i++) crew.push(createUnit(state, 'samlare', 0, 6 + i, 6));
  return { state, building, crew };
}

/** Steps the game until the building is whole, and says how many steps that took. */
function stepsUntilWhole(state: GameState, building: Building, limit = 20000): number {
  for (let step = 1; step <= limit; step++) {
    tick(state);
    if (!needsRepair(building)) return step;
  }
  throw new Error('The building was never whole');
}

describe('what a repair costs', () => {
  it('a full repair costs half the wood of the price, for every building with a price', () => {
    expect(REPAIR_CONFIG.costShare).toBe(0.5);
    for (const type of TYPES) {
      const price = BUILDING_DEFS[type].cost.wood;
      if (price === undefined) continue;
      expect(fullRepairCost(type), type).toBe(price / 2);
      expect(repairCost(type, BUILDING_DEFS[type].hp), type).toBe(Math.ceil(price / 2));
    }
  });

  it('the main building has no price, and is repaired as if it had cost 300 wood', () => {
    expect(BUILDING_DEFS.storide.cost).toEqual({});
    expect(fullRepairCost('storide')).toBe(150);
  });

  it('costs in proportion to the life given back', () => {
    for (const type of TYPES) {
      const { hp } = BUILDING_DEFS[type];
      const full = fullRepairCost(type);
      expect(repairCost(type, hp / 2), type).toBe(Math.ceil(full / 2));
      expect(repairCost(type, hp / 4), type).toBe(Math.ceil(full / 4));
      expect(repairCost(type, 0), type).toBe(0);
    }
  });

  it('takes that much wood from the stock, and no food', () => {
    const { state, building, crew } = setup(1, VISTHUS.hp / 2);
    const food = state.players[0]!.resources.food;
    repair(state, crew, building);
    stepsUntilWhole(state, building);
    expect(building.hp).toBe(VISTHUS.hp);
    expect(1000 - wood(state)).toBe(repairCost('visthus', VISTHUS.hp / 2));
    expect(1000 - wood(state)).toBe(20);
    expect(state.players[0]!.resources.food).toBe(food);
  });

  it('pays as the work goes: a repair half done has cost half', () => {
    const { state, building, crew } = setup(1, VISTHUS.hp / 2);
    repair(state, crew, building);
    while (building.hp < VISTHUS.hp * 0.75) tick(state);
    const paid = 1000 - wood(state);
    // Wood is paid a unit at a time, a little ahead of the work.
    expect(paid).toBeGreaterThanOrEqual(10);
    expect(paid).toBeLessThanOrEqual(11);
  });

  it('never pays twice for the same life: what one unit of wood bought is used up first', () => {
    const { state, building, crew } = setup(1, VISTHUS.hp - 1);
    repair(state, crew, building);
    stepsUntilWhole(state, building);
    // One life cost a whole unit of wood, which buys ten.
    expect(1000 - wood(state)).toBe(1);
    expect(building.repairCredit).toBeCloseTo(lifePerWood('visthus') - 1, 6);
    building.hp -= 5;
    repair(state, crew, building);
    stepsUntilWhole(state, building);
    expect(1000 - wood(state)).toBe(1);
  });

  it('repairing a building all the way costs less than building it anew', () => {
    for (const type of TYPES) {
      const price = BUILDING_DEFS[type].cost.wood;
      if (price !== undefined) expect(fullRepairCost(type), type).toBeLessThan(price);
    }
  });
});

describe('how fast a repair goes', () => {
  it('one worker gives back 6 life a second', () => {
    expect(REPAIR_CONFIG.hpPerSecond).toBe(6);
    const { state, building, crew } = setup(1, 100);
    repair(state, crew, building);
    // The worker stands next to the building already.
    advance(state, 10 * SECOND);
    expect(building.hp).toBeCloseTo(100 + 60, 6);
  });

  it('is slower than building: a worker adds less life a second than when building any building', () => {
    for (const type of TYPES) {
      const def = BUILDING_DEFS[type];
      if (def.buildTime <= 0) continue;
      // A building under construction starts with a share of its life and gains the rest as it is built.
      const gained = def.hp * (1 - CONSTRUCTION_CONFIG.startHpFraction);
      expect(repairPerStep(1), type).toBeLessThan(gained / buildWorkFor(type));
    }
  });

  it('more workers repair faster, each one adding less than the one before', () => {
    expect(repairRate(0)).toBe(0);
    expect(repairRate(1)).toBe(1);
    expect(repairRate(2)).toBeCloseTo(1.6, 9);
    expect(repairRate(3)).toBeCloseTo(1.96, 9);
    for (let n = 1; n < 8; n++) {
      const gain = repairRate(n + 1) - repairRate(n);
      const before = repairRate(n) - repairRate(n - 1);
      expect(gain).toBeGreaterThan(0);
      expect(gain).toBeLessThan(before);
    }
    // However many, they never do the work of 2.5.
    expect(repairRate(40)).toBeLessThan(1 / (1 - REPAIR_CONFIG.workerFalloff));
  });

  it('three workers take about half the time of one, not a third', () => {
    const one = setup(1, 100);
    repair(one.state, one.crew, one.building);
    const alone = stepsUntilWhole(one.state, one.building);

    const three = setup(3, 100);
    repair(three.state, three.crew, three.building);
    const together = stepsUntilWhole(three.state, three.building);

    expect(alone).toBe(Math.ceil((VISTHUS.hp - 100) / repairPerStep(1)));
    expect(together).toBeLessThan(alone * 0.6);
    expect(together).toBeGreaterThan(alone / 3);
    // And the same wood whoever does it.
    expect(wood(three.state)).toBe(wood(one.state));
  });
});

describe('an order to repair', () => {
  it('is refused for a whole building, an unfinished one, the enemy`s, and units that cannot repair', () => {
    const { state, building, crew } = setup(1);
    building.hp = VISTHUS.hp;
    expect(repair(state, crew, building)).toEqual({ ok: false, reason: 'invalid' });

    building.hp = 100;
    building.complete = false;
    expect(repair(state, crew, building)).toEqual({ ok: false, reason: 'invalid' });
    building.complete = true;

    const theirs = createBuilding(state, 'visthus', 1, 12, 12);
    theirs.hp = 100;
    expect(repair(state, crew, theirs)).toEqual({ ok: false, reason: 'invalid' });

    expect(UNIT_DEFS.ramkrigare.repairs).toBe(false);
    const soldier = createUnit(state, 'ramkrigare', 0, 3, 3);
    expect(repair(state, [soldier], building)).toEqual({ ok: false, reason: 'invalid' });
    expect(soldier.task.kind).toBe('idle');

    expect(repair(state, crew, building)).toEqual({ ok: true });
    expect(crew[0]!.task.kind).toBe('repair');
  });

  it('gives each worker a free place of its own right next to the building', () => {
    const state = openState(16, 16);
    const building = createBuilding(state, 'visthus', 0, 7, 7);
    building.hp = 100;
    setWood(state, 1000);
    const crew = [0, 1, 2, 3, 4].map((i) => createUnit(state, 'samlare', 0, 1, 1 + i));
    repair(state, crew, building);
    const places = crew.map((unit) => (unit.task.kind === 'repair' ? unit.task.place : null));
    expect(places.every((place) => place !== null)).toBe(true);
    expect(new Set(places.map((place) => `${place!.x},${place!.y}`)).size).toBe(5);
    for (const place of places) expect(tileGapToBuilding(building, place!.x, place!.y)).toBe(1);

    // They walk there, stand each on its place, and work.
    advance(state, 10 * SECOND);
    crew.forEach((unit, i) => expect(unitTile(unit)).toEqual(places[i]));
    expect(building.hp).toBeGreaterThan(100);
  });

  it('leaves a place alone that another unit stands on or another repairer has', () => {
    const { state, building } = setup(0);
    const first = createUnit(state, 'samlare', 0, 6, 6);
    repair(state, [first], building);
    const bystander = createUnit(state, 'ramkrigare', 0, 6, 7);
    const second = createUnit(state, 'samlare', 0, 5, 6);
    repair(state, [second], building);
    const place = second.task.kind === 'repair' ? second.task.place : undefined;
    expect(place).toBeDefined();
    expect(place).not.toEqual(unitTile(first));
    expect(place).not.toEqual(unitTile(bystander));
  });

  it('sends only as many as there are places: the rest keep doing what they did', () => {
    // A Visthus walled in by rock but for two tiles beside it.
    const state = stateFromRows([
      '........',
      '..RRRR..',
      '..R..R..',
      '..R..R..',
      '..R..R..',
      '..RRRR..',
      '........',
    ]);
    // The footprint takes the lower two rows of the yard; the upper row is the only ground beside it.
    const building = createBuilding(state, 'visthus', 0, 3, 3);
    building.hp = 100;
    setWood(state, 1000);
    const inside = [createUnit(state, 'samlare', 0, 3, 2), createUnit(state, 'samlare', 0, 4, 2)];
    const outside = createUnit(state, 'samlare', 0, 0, 0);
    repair(state, [...inside, outside], building);
    expect(inside.map((unit) => unit.task.kind)).toEqual(['repair', 'repair']);
    // It cannot walk in, and there is no place left for it anyway.
    expect(outside.task.kind).toBe('idle');
    expect(outside.path).toEqual([]);
  });

  it('a worker that gathers puts its gathering aside for the repair', () => {
    const state = stateFromRows(['........', '..T.....', '........', '........', '........']);
    const store = createBuilding(state, 'visthus', 0, 5, 2);
    store.hp = 200;
    setWood(state, 100);
    const worker = createUnit(state, 'samlare', 0, 2, 2);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [worker.id], x: 2, y: 1 });
    expect(worker.task.kind).toBe('gather');
    repair(state, [worker], store);
    expect(worker.task.kind).toBe('repair');
  });
});

describe('a repair that is broken off', () => {
  it('stops when the worker is sent elsewhere: the life given stays, and nothing is paid back', () => {
    const { state, building, crew } = setup(1, 100);
    repair(state, crew, building);
    advance(state, 10 * SECOND);
    const hp = building.hp;
    const paid = 1000 - wood(state);
    expect(hp).toBeCloseTo(160, 6);
    expect(paid).toBe(6);

    applyCommand(state, { type: 'move', player: 0, unitIds: [crew[0]!.id], x: 1, y: 1 });
    expect(crew[0]!.task.kind).toBe('idle');
    advance(state, 10 * SECOND);
    expect(building.hp).toBe(hp);
    expect(1000 - wood(state)).toBe(paid);
  });

  it('can be taken up again, by anyone, and then costs only what is left', () => {
    const { state, building, crew } = setup(1, 100);
    repair(state, crew, building);
    advance(state, 10 * SECOND);
    applyCommand(state, { type: 'move', player: 0, unitIds: [crew[0]!.id], x: 1, y: 1 });
    advance(state, 5 * SECOND);

    const other = createUnit(state, 'samlare', 0, 9, 9);
    repair(state, [other], building);
    stepsUntilWhole(state, building);
    expect(building.hp).toBe(VISTHUS.hp);
    // 300 life in all, at ten life for a unit of wood.
    expect(1000 - wood(state)).toBe(30);
  });

  it('stands still when the wood runs out, says so once, and goes on when there is wood again', () => {
    const { state, building, crew } = setup(2, 100);
    setWood(state, 3);
    repair(state, crew, building);
    const paused: number[] = [];
    let hpWhenPaused = 0;
    for (let step = 0; step < 20 * SECOND; step++) {
      tick(state);
      if (state.events.some((event) => event.type === 'repairPaused')) {
        paused.push(step);
        hpWhenPaused = building.hp;
      }
    }
    // Three units of wood bought thirty life, and then the work stood still.
    expect(wood(state)).toBe(0);
    expect(building.hp).toBeCloseTo(130, 6);
    expect(hpWhenPaused).toBeCloseTo(130, 6);
    expect(paused).toHaveLength(1);
    expect(state.events.some((event) => event.type === 'repairPaused')).toBe(false);
    for (const unit of crew) {
      expect(unit.task).toMatchObject({ kind: 'repair', waiting: true });
    }

    // Wood comes in: the same workers take up the work without a new order.
    setWood(state, 500);
    tick(state);
    for (const unit of crew) expect(unit.task).toMatchObject({ kind: 'repair', waiting: false });
    stepsUntilWhole(state, building);
    expect(building.hp).toBe(VISTHUS.hp);
    expect(500 - wood(state)).toBe(27);
    expect(crew.map((unit) => unit.task.kind)).toEqual(['idle', 'idle']);
  });

  it('tells of the stop again if the wood runs out a second time', () => {
    const { state, building, crew } = setup(1, 100);
    setWood(state, 1);
    repair(state, crew, building);
    let stops = 0;
    const run = (steps: number) => {
      for (let i = 0; i < steps; i++) {
        tick(state);
        if (state.events.some((event) => event.type === 'repairPaused')) stops++;
      }
    };
    run(5 * SECOND);
    expect(stops).toBe(1);
    setWood(state, 1);
    run(5 * SECOND);
    expect(stops).toBe(2);
  });

  it('ends when the building is lost, and the workers are free', () => {
    const { state, building, crew } = setup(2, 100);
    repair(state, crew, building);
    advance(state, SECOND);
    state.entities = state.entities.filter((entity) => entity.id !== building.id);
    tick(state);
    expect(crew.map((unit) => unit.task.kind)).toEqual(['idle', 'idle']);
  });

  it('ends for everyone when the building is whole', () => {
    const { state, building, crew } = setup(3, VISTHUS.hp - 20);
    repair(state, crew, building);
    stepsUntilWhole(state, building);
    expect(crew.map((unit) => unit.task.kind)).toEqual(['idle', 'idle', 'idle']);
    expect(building.hp).toBe(VISTHUS.hp);
  });

  it('a building that is being repaired can still be damaged, and the repair goes on', () => {
    const { state, building, crew } = setup(1, 300);
    repair(state, crew, building);
    advance(state, 5 * SECOND);
    building.hp -= 100;
    const before = building.hp;
    advance(state, 5 * SECOND);
    expect(building.hp).toBeCloseTo(before + 30, 6);
  });
});

describe('a repaired building that gives work', () => {
  it('is worked again by the one who mended it', () => {
    const state = openState(16, 16);
    createBuilding(state, 'storide', 0, 2, 2);
    const field = createBuilding(state, 'odling', 0, 8, 8);
    field.hp = BUILDING_DEFS.odling.hp - 6;
    setWood(state, 100);
    const worker = createUnit(state, 'samlare', 0, 7, 8);
    repair(state, [worker], field);
    stepsUntilWhole(state, field);
    expect(worker.task).toMatchObject({ kind: 'gather', siteId: field.id });
  });
});
