import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS, CONSTRUCTION_CONFIG } from '../../data/buildings';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { buildings, createBuilding, createUnit, unitTile } from '../entities';
import { createGame } from '../game';
import type { Building, GameState, Unit } from '../state';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { buildFraction, buildRate, buildWorkFor, canPlaceBuilding } from './construction';

const VISTHUS = BUILDING_DEFS.visthus;
const VISTHUS_TICKS = VISTHUS.buildTime * SIM_CONFIG.ticksPerSecond;
const START_WOOD = START_CONFIG.resources.wood;
const START_FOOD = START_CONFIG.resources.food;

function build(
  state: GameState,
  workers: Unit[],
  building: 'visthus' | 'krigshall',
  x: number,
  y: number,
) {
  return applyCommand(state, {
    type: 'build',
    player: 0,
    unitIds: workers.map((w) => w.id),
    building,
    x,
    y,
  });
}

const wood = (state: GameState) => state.players[0]!.resources.wood;
const site = (state: GameState) => buildings(state).at(-1)!;

describe('canPlaceBuilding', () => {
  it('accepts open ground', () => {
    expect(canPlaceBuilding(openState(6, 6), 'visthus', 2, 2)).toBe(true);
    expect(canPlaceBuilding(openState(6, 6), 'krigshall', 0, 0)).toBe(true);
    expect(canPlaceBuilding(openState(6, 6), 'krigshall', 3, 3)).toBe(true);
  });

  it('refuses a footprint on a tree, berries, rock or water', () => {
    for (const obstacle of ['T', 'B', 'R', 'W']) {
      const state = stateFromRows(['....', `.${obstacle}..`, '....', '....']);
      expect(canPlaceBuilding(state, 'visthus', 1, 1), obstacle).toBe(false);
    }
  });

  it('refuses a footprint that is only partly blocked', () => {
    const state = stateFromRows(['.....', '.....', '...T.', '.....']);
    // The tree is in the far corner of the 2x2 footprint.
    expect(canPlaceBuilding(state, 'visthus', 2, 1)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 1, 1)).toBe(true);
  });

  it('refuses a footprint that overlaps another building, even by one tile', () => {
    const state = openState(10, 10);
    createBuilding(state, 'storide', 0, 3, 3);
    expect(canPlaceBuilding(state, 'visthus', 4, 4)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 2, 2)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 5, 5)).toBe(false);
    // Right next to it is fine.
    expect(canPlaceBuilding(state, 'visthus', 6, 3)).toBe(true);
    expect(canPlaceBuilding(state, 'visthus', 1, 3)).toBe(true);
  });

  it('refuses a footprint that is wholly or partly outside the map', () => {
    const state = openState(6, 6);
    expect(canPlaceBuilding(state, 'visthus', -1, 2)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 2, -1)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 5, 2)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 2, 5)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 40, 40)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 4, 4)).toBe(true);
  });

  it('refuses a footprint with a unit standing on it', () => {
    const state = openState(6, 6);
    createUnit(state, 'samlare', 1, 3, 3);
    expect(canPlaceBuilding(state, 'visthus', 2, 2)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 3, 3)).toBe(false);
    expect(canPlaceBuilding(state, 'visthus', 0, 0)).toBe(true);
  });
});

describe('the build command', () => {
  it('takes the price when the building is placed', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    expect(build(state, [worker], 'visthus', 4, 4)).toEqual({ ok: true });
    expect(wood(state)).toBe(START_WOOD - VISTHUS.cost.wood!);
    expect(state.players[0]!.resources.food).toBe(START_FOOD);
  });

  it('creates a construction site with a tenth of its hit points', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    build(state, [worker], 'visthus', 4, 4);
    expect(site(state)).toMatchObject({
      type: 'visthus',
      owner: 0,
      x: 4,
      y: 4,
      complete: false,
      buildProgress: 0,
      hp: VISTHUS.hp * CONSTRUCTION_CONFIG.startHpFraction,
    });
    expect(worker.task).toEqual({ kind: 'build', buildingId: site(state).id });
  });

  it('refuses when there is too little wood and takes nothing', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    // The starting 100 wood does not pay for a Krigshall at 150.
    expect(build(state, [worker], 'krigshall', 4, 4)).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['wood'],
    });
    expect(buildings(state)).toHaveLength(0);
    expect(wood(state)).toBe(START_WOOD);
    expect(worker.task).toEqual({ kind: 'idle' });
  });

  it('refuses an invalid place and takes nothing', () => {
    const state = stateFromRows(['......', '..T...', '......', '......']);
    const worker = createUnit(state, 'samlare', 0, 0, 0);
    expect(build(state, [worker], 'visthus', 2, 1)).toEqual({
      ok: false,
      reason: 'invalidPlacement',
    });
    expect(buildings(state)).toHaveLength(0);
    expect(wood(state)).toBe(START_WOOD);
  });

  it('refuses a building that cannot be built, and orders without a builder', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const enemy = createUnit(state, 'samlare', 1, 8, 8);
    expect(
      applyCommand(state, {
        type: 'build',
        player: 0,
        unitIds: [worker.id],
        building: 'storide',
        x: 4,
        y: 4,
      }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(build(state, [], 'visthus', 4, 4)).toEqual({ ok: false, reason: 'invalid' });
    expect(build(state, [enemy], 'visthus', 4, 4)).toEqual({ ok: false, reason: 'invalid' });
    expect(buildings(state)).toHaveLength(0);
    expect(wood(state)).toBe(START_WOOD);
  });

  it('refuses a position that is not a whole tile', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    expect(build(state, [worker], 'visthus', 4.5, 4)).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('building', () => {
  it('one worker finishes a Visthus in exactly 20 seconds', () => {
    const state = openState(10, 10);
    // Standing next to where the building goes.
    const worker = createUnit(state, 'samlare', 0, 3, 4);
    build(state, [worker], 'visthus', 4, 4);
    expect(VISTHUS_TICKS).toBe(400);
    expect(buildWorkFor('visthus')).toBe(400);

    advance(state, VISTHUS_TICKS - 1);
    expect(site(state).complete).toBe(false);
    tick(state);
    expect(site(state)).toMatchObject({ complete: true, hp: VISTHUS.hp });
    expect(worker.task).toEqual({ kind: 'idle' });
  });

  it('hit points grow steadily from 10 % to full', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 3, 4);
    build(state, [worker], 'visthus', 4, 4);
    advance(state, VISTHUS_TICKS / 2);
    // Half built: 10 % plus half of the remaining 90 %.
    expect(site(state).hp).toBeCloseTo(VISTHUS.hp * 0.55);
    expect(buildFraction(site(state))).toBeCloseTo(0.5);
  });

  it('each extra worker adds half a worker', () => {
    expect(buildRate(0)).toBe(0);
    expect(buildRate(1)).toBe(1);
    expect(buildRate(2)).toBe(1.5);
    expect(buildRate(3)).toBe(2);
    expect(buildRate(5)).toBe(3);
  });

  it('two workers finish in two thirds of the time, three in half', () => {
    for (const [count, expected] of [
      [2, Math.ceil(VISTHUS_TICKS / 1.5)],
      [3, VISTHUS_TICKS / 2],
    ] as const) {
      const state = openState(10, 10);
      const workers = Array.from({ length: count }, (_, i) =>
        createUnit(state, 'samlare', 0, 3, 3 + i),
      );
      build(state, workers, 'visthus', 4, 4);
      advance(state, expected - 1);
      expect(site(state).complete, `${count} workers`).toBe(false);
      tick(state);
      expect(site(state).complete, `${count} workers`).toBe(true);
      expect(site(state).hp).toBe(VISTHUS.hp);
    }
  });

  it('a worker walks to the site before building starts', () => {
    const state = openState(14, 6);
    const worker = createUnit(state, 'samlare', 0, 0, 2);
    build(state, [worker], 'visthus', 10, 2);
    // 9 tiles to (9, 2): 72 steps of walking, during which nothing is built.
    advance(state, 72);
    expect(unitTile(worker)).toEqual({ x: 9, y: 2 });
    expect(site(state).buildProgress).toBe(0);
    advance(state, VISTHUS_TICKS);
    expect(site(state).complete).toBe(true);
  });

  it('does not progress without a worker', () => {
    const state = openState(10, 10);
    const worker = createUnit(state, 'samlare', 0, 3, 4);
    build(state, [worker], 'visthus', 4, 4);
    advance(state, 100);
    applyCommand(state, { type: 'move', player: 0, unitIds: [worker.id], x: 0, y: 0 });
    const progress = site(state).buildProgress;
    advance(state, 500);
    expect(site(state).buildProgress).toBe(progress);
    expect(site(state).complete).toBe(false);
  });

  it('another worker can be sent to help, and work resumes where it stopped', () => {
    const state = openState(10, 10);
    const first = createUnit(state, 'samlare', 0, 3, 4);
    const second = createUnit(state, 'samlare', 0, 3, 5);
    build(state, [first], 'visthus', 4, 4);
    advance(state, 100);
    expect(
      applyCommand(state, {
        type: 'construct',
        player: 0,
        unitIds: [second.id],
        buildingId: site(state).id,
      }),
    ).toEqual({ ok: true });
    // 300 worker-steps left at 1.5 per step.
    advance(state, 199);
    expect(site(state).complete).toBe(false);
    tick(state);
    expect(site(state).complete).toBe(true);
    expect(first.task).toEqual({ kind: 'idle' });
    expect(second.task).toEqual({ kind: 'idle' });
  });

  it("refuses help for a finished building, a missing one or another side's", () => {
    const state = openState(12, 12);
    const worker = createUnit(state, 'samlare', 0, 1, 1);
    const finished = createBuilding(state, 'visthus', 0, 4, 4);
    const enemySite = createBuilding(state, 'visthus', 1, 8, 8);
    enemySite.complete = false;
    for (const buildingId of [finished.id, enemySite.id, 999]) {
      expect(
        applyCommand(state, { type: 'construct', player: 0, unitIds: [worker.id], buildingId }),
      ).toEqual({ ok: false, reason: 'invalid' });
    }
    expect(worker.task).toEqual({ kind: 'idle' });
  });

  it('a worker that cannot reach the site gives up', () => {
    const state = stateFromRows(['...W....', '...W....', '...W....', '...W....']);
    const worker = createUnit(state, 'samlare', 0, 0, 1);
    build(state, [worker], 'visthus', 5, 1);
    advance(state, 50);
    expect(worker.task).toEqual({ kind: 'idle' });
    expect(site(state).buildProgress).toBe(0);
  });
});

describe('a building under construction', () => {
  it('blocks the way from the moment it is placed', () => {
    const state = openState(12, 5);
    const builder = createUnit(state, 'samlare', 0, 5, 0);
    build(state, [builder], 'visthus', 5, 1);
    const walker = createUnit(state, 'samlare', 0, 1, 2);
    applyCommand(state, { type: 'move', player: 0, unitIds: [walker.id], x: 10, y: 2 });
    for (let i = 0; i < 300 && walker.path.length > 0; i++) {
      tick(state);
      const tile = unitTile(walker);
      const inside = tile.x >= 5 && tile.x <= 6 && tile.y >= 1 && tile.y <= 2;
      expect(inside, `inside the site at ${tile.x},${tile.y}`).toBe(false);
    }
    expect(unitTile(walker)).toEqual({ x: 10, y: 2 });
  });

  it('makes a unit already on its way walk around', () => {
    const state = openState(12, 5);
    const builder = createUnit(state, 'samlare', 0, 5, 0);
    const walker = createUnit(state, 'samlare', 0, 1, 2);
    applyCommand(state, { type: 'move', player: 0, unitIds: [walker.id], x: 10, y: 2 });
    advance(state, 8);
    // The walker's straight path runs through tile (5, 2) and (6, 2).
    expect(walker.path).toContainEqual({ x: 5, y: 2 });

    expect(build(state, [builder], 'visthus', 5, 1)).toEqual({ ok: true });
    expect(walker.path).not.toContainEqual({ x: 5, y: 2 });
    expect(walker.path).not.toContainEqual({ x: 6, y: 2 });

    for (let i = 0; i < 300 && walker.path.length > 0; i++) {
      tick(state);
      const tile = unitTile(walker);
      expect(tile.x >= 5 && tile.x <= 6 && tile.y >= 1 && tile.y <= 2).toBe(false);
    }
    expect(unitTile(walker)).toEqual({ x: 10, y: 2 });
  });

  it('cannot train units', () => {
    const state = openState(10, 10);
    const storide = createBuilding(state, 'storide', 0, 4, 4);
    storide.complete = false;
    expect(
      applyCommand(state, { type: 'train', player: 0, buildingId: storide.id, unit: 'samlare' }),
    ).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('the Visthus as a drop-off point', () => {
  /** A bush at (9, 2), a worker next to it, and a Storide far away to the left. */
  function farFromHome() {
    const state = stateFromRows([
      '............',
      '............',
      '.........B..',
      '............',
      '............',
    ]);
    createBuilding(state, 'storide', 0, 0, 1);
    const gatherer = createUnit(state, 'samlare', 0, 8, 2);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [gatherer.id], x: 9, y: 2 });
    return { state, gatherer };
  }
  const LOAD_TICKS = (UNIT_DEFS.samlare.carryCapacity * SIM_CONFIG.ticksPerSecond) / 1;

  it('an unfinished Visthus does not take resources', () => {
    const { state, gatherer } = farFromHome();
    const unfinished = createBuilding(state, 'visthus', 0, 6, 3);
    unfinished.complete = false;
    advance(state, LOAD_TICKS);
    // Full, and on its way to the Storide rather than the site next to it.
    expect(gatherer.task).toMatchObject({ kind: 'gather', phase: 'toDropoff' });
    expect(gatherer.task.kind === 'gather' && gatherer.task.dropoffId).not.toBe(unfinished.id);
    expect(state.players[0]!.resources.food).toBe(START_FOOD);
  });

  it('a finished Visthus takes resources and is chosen when it is nearest', () => {
    const { state, gatherer } = farFromHome();
    const visthus = createBuilding(state, 'visthus', 0, 6, 3);
    advance(state, LOAD_TICKS);
    // The worker at (8, 2) is already next to the Visthus, so it delivers at once.
    expect(state.players[0]!.resources.food).toBe(START_FOOD + UNIT_DEFS.samlare.carryCapacity);
    expect(visthus.complete).toBe(true);
    expect(gatherer.carryAmount).toBe(0);
  });

  it('the Storide is still used when it is nearer than the Visthus', () => {
    const state = stateFromRows([
      '..............',
      '..............',
      '.....B........',
      '..............',
    ]);
    const storide = createBuilding(state, 'storide', 0, 0, 0);
    createBuilding(state, 'visthus', 0, 11, 1);
    // One tile from the Storide's nearest tile, six from the Visthus.
    const gatherer = createUnit(state, 'samlare', 0, 4, 2);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [gatherer.id], x: 5, y: 2 });
    advance(state, LOAD_TICKS);
    expect(gatherer.task).toMatchObject({ kind: 'gather', phase: 'toDropoff' });
    expect(gatherer.task.kind === 'gather' && gatherer.task.dropoffId).toBe(storide.id);
  });

  it('gatherers switch to a Visthus once it has been built next to them', () => {
    const { state, gatherer } = farFromHome();
    const builder = createUnit(state, 'samlare', 0, 5, 3);
    state.players[0]!.resources.wood = 1000;
    expect(build(state, [builder], 'visthus', 6, 3)).toEqual({ ok: true });
    advance(state, VISTHUS_TICKS + 2 * LOAD_TICKS);
    expect(site(state).complete).toBe(true);
    expect(gatherer.task.kind === 'gather' && gatherer.task.node).toEqual({ x: 9, y: 2 });
    // With the Visthus next door every load is delivered without a walk.
    const food = state.players[0]!.resources.food;
    advance(state, 3 * LOAD_TICKS);
    expect(state.players[0]!.resources.food).toBe(food + 3 * UNIT_DEFS.samlare.carryCapacity);
  });
});

describe('building in a real game', () => {
  it('the starting workers can build a Visthus near the base', () => {
    const state = createGame(1);
    const workers = state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
    const start = state.map.startPositions[0]!;
    // Beside the Storide, wholly inside the four tiles kept clear around the start.
    const x = start.x - 3;
    const y = start.y + 1;
    expect(canPlaceBuilding(state, 'visthus', x, y)).toBe(true);
    expect(build(state, workers, 'visthus', x, y)).toEqual({ ok: true });
    advance(state, VISTHUS_TICKS);
    const visthus = state.entities.find(
      (e): e is Building => e.kind === 'building' && e.type === 'visthus',
    )!;
    expect(visthus.complete).toBe(true);
    expect(wood(state)).toBe(START_WOOD - VISTHUS.cost.wood!);
  });

  it('stays deterministic', () => {
    const run = () => {
      const state = createGame(3);
      const workers = state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
      const start = state.map.startPositions[0]!;
      expect(build(state, workers, 'visthus', start.x - 3, start.y + 1)).toEqual({ ok: true });
      advance(state, 300);
      return state;
    };
    expect(run()).toEqual(run());
  });
});
