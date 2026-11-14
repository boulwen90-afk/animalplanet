import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS, type BuildingType } from '../data/buildings';
import { POPULATION_CONFIG } from '../data/population';
import { UNIT_DEFS, type UnitType } from '../data/units';
import { applyCommand } from './commands';
import {
  createBuilding,
  createUnit,
  populationOf,
  populationRoom,
  removeEntity,
  reservedPopulation,
  units,
} from './entities';
import { createGame } from './game';
import type { Building, GameState } from './state';
import { openState } from './testUtils';
import { advance } from './tick';

const HOUSE = BUILDING_DEFS.ide.housing;
const HOME = BUILDING_DEFS.storide.housing;
const CAP = POPULATION_CONFIG.hardCap;

/** A wide open map with a Storide for side 0 and plenty of food. */
function setup() {
  const state = openState(40, 40);
  const storide = createBuilding(state, 'storide', 0, 18, 18);
  state.players[0]!.resources.food = 100_000;
  return { state, storide };
}

/** Finished houses for a side, in rows along the top of the map. */
function houses(state: GameState, count: number, owner: 0 | 1 = 0): Building[] {
  const built: Building[] = [];
  for (let i = 0; i < count; i++) {
    built.push(
      createBuilding(state, 'ide', owner, (i % 13) * 3, owner * 30 + Math.floor(i / 13) * 3),
    );
  }
  return built;
}

function people(state: GameState, count: number, owner: 0 | 1 = 0): void {
  for (let i = 0; i < count; i++)
    createUnit(state, 'samlare', owner, i % 40, 10 + Math.floor(i / 40));
}

const train = (state: GameState, building: Building, unit: UnitType = 'samlare') =>
  applyCommand(state, { type: 'train', player: 0, buildingId: building.id, unit });

describe('the data', () => {
  it('the main building gives room for 5, a house for 5 more, and nothing else gives any', () => {
    expect(BUILDING_DEFS.storide.housing).toBe(5);
    expect(BUILDING_DEFS.ide.housing).toBe(5);
    expect(BUILDING_DEFS.visthus.housing).toBe(0);
    expect(BUILDING_DEFS.krigshall.housing).toBe(0);
  });

  it('the hard cap is 50 for each side', () => {
    expect(CAP).toBe(50);
  });

  it('every unit type takes up one place', () => {
    for (const type of Object.keys(UNIT_DEFS) as UnitType[]) {
      expect(UNIT_DEFS[type].population, type).toBe(1);
    }
  });

  it('a house is cheap, costs only wood, and is built by workers', () => {
    const cost = BUILDING_DEFS.ide.cost;
    expect(cost).toEqual({ wood: 30 });
    const others = (Object.keys(BUILDING_DEFS) as BuildingType[]).filter(
      (type) => type !== 'ide' && BUILDING_DEFS[type].buildTime > 0,
    );
    for (const type of others) {
      expect(BUILDING_DEFS[type].cost.wood!, type).toBeGreaterThan(cost.wood!);
    }
    expect(UNIT_DEFS.samlare.builds).toContain('ide');
    expect(UNIT_DEFS.ramkrigare.builds).not.toContain('ide');
  });
});

describe('room', () => {
  it('a new game starts with the room of the main building and three units in it', () => {
    const state = createGame(1);
    expect(populationRoom(state, 0)).toBe(HOME);
    expect(populationOf(state, 0)).toBe(3);
    expect(populationRoom(state, 1)).toBe(HOME);
  });

  it('each finished house adds 5', () => {
    const { state } = setup();
    expect(populationRoom(state, 0)).toBe(HOME);
    houses(state, 1);
    expect(populationRoom(state, 0)).toBe(HOME + HOUSE);
    houses(state, 2);
    expect(populationRoom(state, 0)).toBe(HOME + 3 * HOUSE);
  });

  it('a house under construction gives nothing until it is finished', () => {
    const { state } = setup();
    const [house] = houses(state, 1);
    house!.complete = false;
    expect(populationRoom(state, 0)).toBe(HOME);
    house!.complete = true;
    expect(populationRoom(state, 0)).toBe(HOME + HOUSE);
  });

  it("the other side's houses give a side nothing", () => {
    const { state } = setup();
    houses(state, 4, 1);
    expect(populationRoom(state, 0)).toBe(HOME);
    expect(populationRoom(state, 1)).toBe(4 * HOUSE);
  });

  it('never goes above the hard cap, however many houses there are', () => {
    const { state } = setup();
    houses(state, 9);
    expect(populationRoom(state, 0)).toBe(CAP);
    houses(state, 6);
    expect(populationRoom(state, 0)).toBe(CAP);
  });

  it('a worker builds a house, and the room is there when it is done', () => {
    const { state } = setup();
    const worker = createUnit(state, 'samlare', 0, 22, 22);
    state.players[0]!.resources.wood = 30;
    const result = applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [worker.id],
      building: 'ide',
      x: 24,
      y: 22,
    });
    expect(result).toEqual({ ok: true });
    expect(state.players[0]!.resources.wood).toBe(0);
    expect(populationRoom(state, 0)).toBe(HOME);
    advance(state, (BUILDING_DEFS.ide.buildTime + 5) * 20);
    expect(populationRoom(state, 0)).toBe(HOME + HOUSE);
  });
});

describe('training against the room', () => {
  it('is refused when the room is full, and takes nothing', () => {
    const { state, storide } = setup();
    people(state, HOME);
    const food = state.players[0]!.resources.food;
    expect(train(state, storide)).toEqual({ ok: false, reason: 'housingFull' });
    expect(storide.queue).toEqual([]);
    expect(state.players[0]!.resources.food).toBe(food);
  });

  it('is allowed again as soon as a house gives more room', () => {
    const { state, storide } = setup();
    people(state, HOME);
    expect(train(state, storide)).toMatchObject({ ok: false });
    houses(state, 1);
    expect(train(state, storide)).toEqual({ ok: true });
  });

  it('counts units in the queue as taken room', () => {
    const { state, storide } = setup();
    people(state, HOME - 2);
    expect(train(state, storide)).toEqual({ ok: true });
    expect(train(state, storide)).toEqual({ ok: true });
    // Three units and two in the queue: all five places are spoken for.
    expect(populationOf(state, 0)).toBe(HOME - 2);
    expect(reservedPopulation(state, 0)).toBe(HOME);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'housingFull' });
  });

  it('counts the queues of all buildings together', () => {
    const { state, storide } = setup();
    const barracks = createBuilding(state, 'krigshall', 0, 24, 18);
    state.players[0]!.resources.wood = 1000;
    people(state, HOME - 2);
    expect(train(state, storide)).toEqual({ ok: true });
    expect(train(state, barracks, 'ramkrigare')).toEqual({ ok: true });
    expect(train(state, barracks, 'ramkrigare')).toEqual({ ok: false, reason: 'housingFull' });
    expect(train(state, storide)).toEqual({ ok: false, reason: 'housingFull' });
  });

  it('says the cap is reached, not that housing is missing, at 50', () => {
    const { state, storide } = setup();
    houses(state, 9);
    people(state, CAP);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'populationCap' });
    // More houses do not help.
    houses(state, 3);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'populationCap' });
  });

  it('fills the room exactly: the fiftieth unit is trained, the fifty-first is not', () => {
    const { state, storide } = setup();
    houses(state, 9);
    people(state, CAP - 1);
    expect(train(state, storide)).toEqual({ ok: true });
    expect(train(state, storide)).toEqual({ ok: false, reason: 'populationCap' });
    advance(state, UNIT_DEFS.samlare.trainTime * 20 + 5);
    expect(populationOf(state, 0)).toBe(CAP);
  });
});

describe('when a house is lost', () => {
  it('no unit dies, though there are more of them than there is room', () => {
    const { state } = setup();
    const built = houses(state, 2);
    people(state, HOME + 2 * HOUSE);
    const before = units(state).map((unit) => unit.id);
    removeEntity(state, built[0]!.id);
    advance(state, 400);
    expect(populationRoom(state, 0)).toBe(HOME + HOUSE);
    expect(populationOf(state, 0)).toBe(HOME + 2 * HOUSE);
    expect(units(state).map((unit) => unit.id)).toEqual(before);
  });

  it('nothing new can be trained until there is room again', () => {
    const { state, storide } = setup();
    const built = houses(state, 2);
    people(state, HOME + 2 * HOUSE - 1);
    removeEntity(state, built[0]!.id);
    // Fourteen units and room for ten.
    expect(train(state, storide)).toEqual({ ok: false, reason: 'housingFull' });
    // One new house brings the room back to fifteen: one place is free.
    houses(state, 1);
    expect(train(state, storide)).toEqual({ ok: true });
    expect(train(state, storide)).toEqual({ ok: false, reason: 'housingFull' });
  });

  it('a house brought down in a fight takes its room with it', () => {
    const { state, storide } = setup();
    const [house] = houses(state, 1);
    people(state, HOME + 1);
    // Enemy warriors next to the house strike it until it falls.
    for (let i = 0; i < 6; i++) {
      const enemy = createUnit(
        state,
        'ramkrigare',
        1,
        house!.x + 2 + (i % 3),
        house!.y + (i > 2 ? 3 : 2),
      );
      applyCommand(state, { type: 'attack', player: 1, unitIds: [enemy.id], targetId: house!.id });
    }
    for (let i = 0; i < 3000 && state.entities.some((e) => e.id === house!.id); i++) {
      advance(state, 1);
    }
    expect(state.entities.some((e) => e.id === house!.id)).toBe(false);
    expect(populationRoom(state, 0)).toBe(HOME);
    expect(populationOf(state, 0)).toBe(HOME + 1);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'housingFull' });
  });

  it('a unit already in the queue is still finished', () => {
    const { state, storide } = setup();
    const [house] = houses(state, 1);
    people(state, HOME + HOUSE - 1);
    expect(train(state, storide)).toEqual({ ok: true });
    removeEntity(state, house!.id);
    advance(state, UNIT_DEFS.samlare.trainTime * 20 + 5);
    expect(storide.queue).toEqual([]);
    expect(populationOf(state, 0)).toBe(HOME + HOUSE);
  });
});
