import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { RESOURCE_DEFS } from '../../data/resources';
import { applyCommand } from '../commands';
import { createBuilding, createUnit } from '../entities';
import type { GameState, Unit } from '../state';
import { stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';

/**
 * What a worker carries is known by kind, so that its basket can show it:
 * berries, fish, grain or wood.
 */

/** Trees and berries above, a field and a fishing hut by a lake below, and a storehouse between. */
function land(): GameState {
  const state = stateFromRows([
    '................',
    '..B..........T..',
    '................',
    '................',
    '................',
    '................',
    '................',
    'WWWWWWWWWWWWWWWW',
  ]);
  createBuilding(state, 'visthus', 0, 7, 2);
  return state;
}

/** Steps the game on until the unit carries something, or gives up after a while. */
function untilLoaded(state: GameState, unit: Unit): void {
  for (let i = 0; i < 600 && unit.carryAmount === 0; i++) tick(state);
  expect(unit.carryAmount).toBeGreaterThan(0);
}

describe('the data', () => {
  it('says what each load looks like', () => {
    expect(RESOURCE_DEFS.food.load).toBe('berries');
    expect(RESOURCE_DEFS.wood.load).toBe('wood');
    expect(BUILDING_DEFS.odling.work?.load).toBe('grain');
    expect(BUILDING_DEFS.fiskehytta.work?.load).toBe('fish');
  });
});

describe('what a worker carries', () => {
  it('is nothing to begin with', () => {
    const state = land();
    expect(createUnit(state, 'samlare', 0, 4, 4).carryLoad).toBeNull();
  });

  it('is berries from a bush and wood from a tree', () => {
    const state = land();
    const picker = createUnit(state, 'samlare', 0, 3, 3);
    const chopper = createUnit(state, 'samlare', 0, 12, 3);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [picker.id], x: 2, y: 1 });
    applyCommand(state, { type: 'gather', player: 0, unitIds: [chopper.id], x: 13, y: 1 });
    untilLoaded(state, picker);
    untilLoaded(state, chopper);
    expect(picker.carryLoad).toBe('berries');
    expect(chopper.carryLoad).toBe('wood');
  });

  it('is grain from a field and fish from the shore', () => {
    const state = land();
    const field = createBuilding(state, 'odling', 0, 2, 4);
    const hut = createBuilding(state, 'fiskehytta', 0, 11, 5);
    const farmer = createUnit(state, 'samlare', 0, 4, 3);
    const fisher = createUnit(state, 'samlare', 0, 10, 3);
    applyCommand(state, { type: 'work', player: 0, unitIds: [farmer.id], buildingId: field.id });
    applyCommand(state, { type: 'work', player: 0, unitIds: [fisher.id], buildingId: hut.id });
    untilLoaded(state, farmer);
    untilLoaded(state, fisher);
    expect(farmer.carryLoad).toBe('grain');
    expect(fisher.carryLoad).toBe('fish');
    // Both are food all the same.
    expect(farmer.carryType).toBe('food');
    expect(fisher.carryType).toBe('food');
  });

  it('is nothing again once it has been delivered', () => {
    const state = land();
    const picker = createUnit(state, 'samlare', 0, 3, 3);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [picker.id], x: 2, y: 1 });
    untilLoaded(state, picker);
    const before = state.players[0]!.resources.food;
    for (let i = 0; i < 2000 && state.players[0]!.resources.food === before; i++) tick(state);
    expect(state.players[0]!.resources.food).toBeGreaterThan(before);
    expect(picker.carryAmount).toBe(0);
    expect(picker.carryLoad).toBeNull();
  });

  it('shows what was got last when a worker with berries goes on to fish', () => {
    const state = land();
    const hut = createBuilding(state, 'fiskehytta', 0, 11, 5);
    const worker = createUnit(state, 'samlare', 0, 3, 3);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [worker.id], x: 2, y: 1 });
    untilLoaded(state, worker);
    advance(state, 40);
    const berries = worker.carryAmount;
    expect(worker.carryLoad).toBe('berries');

    applyCommand(state, { type: 'work', player: 0, unitIds: [worker.id], buildingId: hut.id });
    // It keeps the food it has, and it is still berries until the first fish is in the basket.
    expect(worker.carryAmount).toBe(berries);
    expect(worker.carryLoad).toBe('berries');
    for (let i = 0; i < 1200 && worker.carryAmount === berries; i++) tick(state);
    expect(worker.carryAmount).toBe(berries + 1);
    expect(worker.carryLoad).toBe('fish');
  });

  it('is dropped, kind and all, when the worker turns to another resource', () => {
    const state = land();
    const worker = createUnit(state, 'samlare', 0, 3, 3);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [worker.id], x: 2, y: 1 });
    untilLoaded(state, worker);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [worker.id], x: 13, y: 1 });
    expect(worker.carryAmount).toBe(0);
    expect(worker.carryLoad).toBeNull();
  });
});
