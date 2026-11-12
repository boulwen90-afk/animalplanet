import { describe, expect, it } from 'vitest';
import { PRODUCTION_CONFIG } from '../../data/production';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import {
  buildingTiles,
  createBuilding,
  createUnit,
  populationOf,
  reservedPopulation,
  unitTile,
  units,
} from '../entities';
import { createGame } from '../game';
import type { Building, GameState } from '../state';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { trainTicksFor } from './production';

const COST = UNIT_DEFS.samlare.cost.food!;
const TRAIN_TICKS = UNIT_DEFS.samlare.trainTime * SIM_CONFIG.ticksPerSecond;
const START_FOOD = START_CONFIG.resources.food;

function setup() {
  const state = openState(12, 12);
  const storide = createBuilding(state, 'storide', 0, 4, 4);
  return { state, storide };
}

function train(state: GameState, building: Building, player: 0 | 1 = 0) {
  return applyCommand(state, {
    type: 'train',
    player,
    buildingId: building.id,
    unit: 'samlare',
  });
}

function cancel(state: GameState, building: Building, index: number, player: 0 | 1 = 0) {
  return applyCommand(state, { type: 'cancelTrain', player, buildingId: building.id, index });
}

const food = (state: GameState) => state.players[0]!.resources.food;

describe('training a unit', () => {
  it('costs 50 food and takes 12 seconds', () => {
    expect(COST).toBe(50);
    expect(TRAIN_TICKS).toBe(240);
    expect(trainTicksFor('samlare')).toBe(240);
  });

  it('takes the price when the unit is queued', () => {
    const { state, storide } = setup();
    expect(train(state, storide)).toEqual({ ok: true });
    expect(food(state)).toBe(START_FOOD - COST);
    expect(storide.queue).toEqual(['samlare']);
    expect(state.players[0]!.resources.wood).toBe(START_CONFIG.resources.wood);
  });

  it('gives a Samlare after exactly 12 seconds of simulated time, and not before', () => {
    const { state, storide } = setup();
    train(state, storide);

    advance(state, TRAIN_TICKS - 1);
    expect(units(state)).toHaveLength(0);
    expect(storide.queue).toEqual(['samlare']);

    tick(state);
    const trained = units(state);
    expect(trained).toHaveLength(1);
    expect(trained[0]).toMatchObject({ type: 'samlare', owner: 0, hp: UNIT_DEFS.samlare.hp });
    expect(trained[0]!.task).toEqual({ kind: 'idle' });
    expect(storide.queue).toEqual([]);
    expect(storide.trainTicks).toBe(0);
    // The price is not taken a second time.
    expect(food(state)).toBe(START_FOOD - COST);
  });

  it('puts the new unit on a free tile next to the building, in front of it', () => {
    const { state, storide } = setup();
    train(state, storide);
    advance(state, TRAIN_TICKS);
    const tile = unitTile(units(state)[0]!);
    expect(buildingTiles(storide)).not.toContainEqual(tile);
    const gap = Math.min(
      ...buildingTiles(storide).map((f) =>
        Math.max(Math.abs(f.x - tile.x), Math.abs(f.y - tile.y)),
      ),
    );
    expect(gap).toBe(1);
    expect(tile.x + tile.y).toBeGreaterThan(storide.x + 1 + storide.y + 1);
  });

  it('trains queued units one after another, each on its own tile', () => {
    const { state, storide } = setup();
    train(state, storide);
    train(state, storide);
    train(state, storide);
    expect(food(state)).toBe(START_FOOD - 3 * COST);

    advance(state, TRAIN_TICKS);
    expect(units(state)).toHaveLength(1);
    expect(storide.queue).toHaveLength(2);
    advance(state, TRAIN_TICKS);
    expect(units(state)).toHaveLength(2);
    advance(state, TRAIN_TICKS);
    expect(units(state)).toHaveLength(3);
    expect(storide.queue).toEqual([]);

    const tiles = units(state).map((u) => `${unitTile(u).x},${unitTile(u).y}`);
    expect(new Set(tiles).size).toBe(3);
  });

  it('does not put a new unit on a tile where another unit stands or is heading', () => {
    const { state, storide } = setup();
    // The tile in front of the building, where the first unit would appear.
    const standing = createUnit(state, 'samlare', 0, 7, 7);
    train(state, storide);
    advance(state, TRAIN_TICKS);
    const [, trained] = units(state);
    expect(unitTile(trained!)).not.toEqual(unitTile(standing));
  });

  it('does not train while the queue is empty', () => {
    const { state, storide } = setup();
    advance(state, 500);
    expect(units(state)).toHaveLength(0);
    expect(storide.trainTicks).toBe(0);
  });

  it('keeps a finished unit waiting when there is nowhere to put it', () => {
    // A map exactly the size of the building: no free tile anywhere.
    const state = openState(3, 3);
    const storide = createBuilding(state, 'storide', 0, 0, 0);
    train(state, storide);
    advance(state, TRAIN_TICKS + 100);
    expect(units(state)).toHaveLength(0);
    expect(storide.queue).toEqual(['samlare']);
    expect(storide.trainTicks).toBe(TRAIN_TICKS);
  });
});

describe('refusing to queue', () => {
  it('refuses the sixth unit in a queue and takes nothing for it', () => {
    const { state, storide } = setup();
    state.players[0]!.resources.food = 1000;
    for (let i = 0; i < PRODUCTION_CONFIG.maxQueue; i++) {
      expect(train(state, storide)).toEqual({ ok: true });
    }
    expect(PRODUCTION_CONFIG.maxQueue).toBe(5);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'queueFull' });
    expect(storide.queue).toHaveLength(5);
    expect(food(state)).toBe(1000 - 5 * COST);
  });

  it('accepts a new unit once the queue has room again', () => {
    const { state, storide } = setup();
    state.players[0]!.resources.food = 1000;
    for (let i = 0; i < 5; i++) train(state, storide);
    advance(state, TRAIN_TICKS);
    expect(train(state, storide)).toEqual({ ok: true });
    expect(storide.queue).toHaveLength(5);
  });

  it('refuses when there is too little food and takes nothing', () => {
    const { state, storide } = setup();
    state.players[0]!.resources.food = COST - 1;
    expect(train(state, storide)).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['food'],
    });
    expect(storide.queue).toEqual([]);
    expect(food(state)).toBe(COST - 1);
  });

  it('accepts when there is exactly enough food', () => {
    const { state, storide } = setup();
    state.players[0]!.resources.food = COST;
    expect(train(state, storide)).toEqual({ ok: true });
    expect(food(state)).toBe(0);
  });

  it('refuses at the population cap and takes nothing', () => {
    const state = openState(20, 20);
    const storide = createBuilding(state, 'storide', 0, 8, 8);
    for (let i = 0; i < START_CONFIG.populationCap; i++) {
      createUnit(state, 'samlare', 0, i % 20, 0);
    }
    expect(populationOf(state, 0)).toBe(30);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'populationCap' });
    expect(storide.queue).toEqual([]);
    expect(food(state)).toBe(START_FOOD);
  });

  it('counts queued units towards the population cap', () => {
    const state = openState(20, 20);
    const storide = createBuilding(state, 'storide', 0, 8, 8);
    for (let i = 0; i < START_CONFIG.populationCap - 2; i++) {
      createUnit(state, 'samlare', 0, i % 20, 0);
    }
    expect(train(state, storide)).toEqual({ ok: true });
    expect(train(state, storide)).toEqual({ ok: true });
    expect(reservedPopulation(state, 0)).toBe(30);
    expect(train(state, storide)).toEqual({ ok: false, reason: 'populationCap' });
    expect(food(state)).toBe(START_FOOD - 2 * COST);

    // The population never passes the cap.
    advance(state, 3 * TRAIN_TICKS);
    expect(populationOf(state, 0)).toBe(30);
  });

  it("does not count the other side's units towards the cap", () => {
    const state = openState(20, 20);
    const storide = createBuilding(state, 'storide', 0, 8, 8);
    for (let i = 0; i < START_CONFIG.populationCap; i++) {
      createUnit(state, 'samlare', 1, i % 20, 0);
    }
    expect(train(state, storide)).toEqual({ ok: true });
  });

  it("refuses to train in another player's building, a unit, or a missing building", () => {
    const { state, storide } = setup();
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    expect(train(state, storide, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(
      applyCommand(state, { type: 'train', player: 0, buildingId: worker.id, unit: 'samlare' }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(
      applyCommand(state, { type: 'train', player: 0, buildingId: 999, unit: 'samlare' }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(storide.queue).toEqual([]);
    expect(state.players.map((p) => p.resources.food)).toEqual([START_FOOD, START_FOOD]);
  });
});

describe('cancelling', () => {
  it('gives the price back', () => {
    const { state, storide } = setup();
    train(state, storide);
    advance(state, 100);
    expect(cancel(state, storide, 0)).toEqual({ ok: true });
    expect(food(state)).toBe(START_FOOD);
    expect(storide.queue).toEqual([]);

    advance(state, TRAIN_TICKS);
    expect(units(state)).toHaveLength(0);
  });

  it('cancelling the unit in training starts the next one from the beginning', () => {
    const { state, storide } = setup();
    train(state, storide);
    train(state, storide);
    advance(state, 200);
    cancel(state, storide, 0);
    expect(storide.queue).toEqual(['samlare']);
    expect(storide.trainTicks).toBe(0);

    advance(state, TRAIN_TICKS - 1);
    expect(units(state)).toHaveLength(0);
    tick(state);
    expect(units(state)).toHaveLength(1);
  });

  it('cancelling a waiting unit does not disturb the one in training', () => {
    const { state, storide } = setup();
    train(state, storide);
    train(state, storide);
    advance(state, 200);
    cancel(state, storide, 1);
    expect(food(state)).toBe(START_FOOD - COST);
    expect(storide.trainTicks).toBe(200);

    advance(state, 40);
    expect(units(state)).toHaveLength(1);
    expect(storide.queue).toEqual([]);
  });

  it('refuses a position that is not in the queue, without giving anything back', () => {
    const { state, storide } = setup();
    train(state, storide);
    for (const index of [1, -1, 0.5, 99]) {
      expect(cancel(state, storide, index)).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(storide.queue).toEqual(['samlare']);
    expect(food(state)).toBe(START_FOOD - COST);
  });

  it("refuses to cancel in another player's building", () => {
    const { state, storide } = setup();
    train(state, storide);
    expect(cancel(state, storide, 0, 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(storide.queue).toEqual(['samlare']);
    expect(state.players[1]!.resources.food).toBe(START_FOOD);
  });

  it('frees the population it had reserved', () => {
    const state = openState(20, 20);
    const storide = createBuilding(state, 'storide', 0, 8, 8);
    for (let i = 0; i < START_CONFIG.populationCap - 1; i++) {
      createUnit(state, 'samlare', 0, i % 20, 0);
    }
    train(state, storide);
    expect(train(state, storide)).toMatchObject({ ok: false, reason: 'populationCap' });
    cancel(state, storide, 0);
    expect(train(state, storide)).toEqual({ ok: true });
  });
});

describe('training in a real game', () => {
  it('a new Samlare can be put to work at once', () => {
    const state = stateFromRows([
      '..........',
      '..........',
      '..........',
      '..........',
      '......B...',
      '..........',
    ]);
    const storide = createBuilding(state, 'storide', 0, 1, 1);
    train(state, storide);
    advance(state, TRAIN_TICKS);
    const [worker] = units(state);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [worker!.id], x: 6, y: 4 });
    advance(state, 600);
    expect(state.players[0]!.resources.food).toBeGreaterThan(START_FOOD - COST);
  });

  it('the starting Storide trains a fourth Samlare', () => {
    const state = createGame(1);
    const storide = state.entities.find(
      (e): e is Building => e.kind === 'building' && e.owner === 0,
    )!;
    expect(train(state, storide)).toEqual({ ok: true });
    advance(state, TRAIN_TICKS);
    expect(populationOf(state, 0)).toBe(4);
    expect(populationOf(state, 1)).toBe(3);
    expect(food(state)).toBe(START_FOOD - COST);
    const tiles = units(state)
      .filter((u) => u.owner === 0)
      .map((u) => `${unitTile(u).x},${unitTile(u).y}`);
    expect(new Set(tiles).size).toBe(4);
  });

  it('stays deterministic', () => {
    const run = () => {
      const state = createGame(2);
      const storide = state.entities.find(
        (e): e is Building => e.kind === 'building' && e.owner === 0,
      )!;
      train(state, storide);
      train(state, storide);
      advance(state, 500);
      return state;
    };
    expect(run()).toEqual(run());
  });
});
