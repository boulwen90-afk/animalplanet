import { describe, expect, it, vi } from 'vitest';
import { AI_CONFIG, AI_LEVELS, DEFAULT_DIFFICULTY, DIFFICULTIES } from '../../data/ai';
import { BUILDING_DEFS } from '../../data/buildings';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { buildingCentre, hasSurrendered } from '../entities';
import { createGame, setDifficulty } from '../game';
import { tileDistance } from '../map/grid';
import { resourceAmountAt, resourceAt, takeFromSource } from '../resources';
import type { Building, GameState, Unit } from '../state';
import { advance, tick } from '../tick';
import { sizeWanted, waveAt } from './ai';

// Whole matches are simulated here; they take seconds, not milliseconds.
vi.setConfig({ testTimeout: 180_000 });

const SECOND = SIM_CONFIG.ticksPerSecond;
const MINUTE = 60 * SECOND;

const unitsOf = (state: GameState, owner: number, type: string) =>
  state.entities.filter(
    (e): e is Unit =>
      e.kind === 'unit' && e.owner === owner && e.type === type && !hasSurrendered(e),
  );
const buildingsOf = (state: GameState, owner: number, type: string) =>
  state.entities.filter(
    (e): e is Building => e.kind === 'building' && e.owner === owner && e.type === type,
  );
const soldiersOf = (state: GameState, owner: number) =>
  state.entities.filter(
    (e): e is Unit =>
      e.kind === 'unit' &&
      e.owner === owner &&
      UNIT_DEFS[e.type].aggroRadius > 0 &&
      !hasSurrendered(e),
  );
const gathering = (state: GameState, owner: number, resource: string) =>
  unitsOf(state, owner, 'samlare').filter(
    (u) => u.task.kind === 'gather' && u.task.resource === resource,
  );
/** How many workers a side's fields and fishing huts take. */
const foodPlaces = (state: GameState, owner: number) =>
  state.entities
    .filter((e): e is Building => e.kind === 'building' && e.owner === owner)
    .reduce((sum, b) => sum + (BUILDING_DEFS[b.type].work?.workers ?? 0), 0);

/**
 * A game where the computer plays side 1 on a level, and side 0 does
 * nothing but cannot lose, so that the match goes on.
 */
const against = (seed: number, difficulty = DEFAULT_DIFFICULTY) => {
  const state = createGame(seed, undefined, undefined, { difficulty });
  buildingsOf(state, 0, 'storide')[0]!.hp = 1e9;
  return state;
};

/** Empties the berry bushes near a side's base. */
const emptyBerries = (state: GameState, owner: number) => {
  const centre = buildingCentre(buildingsOf(state, owner, 'storide')[0]!);
  const r = AI_CONFIG.fields.berryRadius;
  for (let y = Math.floor(centre.y - r); y <= centre.y + r; y++) {
    for (let x = Math.floor(centre.x - r); x <= centre.x + r; x++) {
      if (resourceAt(state.map, x, y) !== 'food') continue;
      if (tileDistance(x, y, centre.x, centre.y) > r) continue;
      takeFromSource(state.map, x, y, resourceAmountAt(state.map, x, y));
    }
  }
};

describe('difficulty levels', () => {
  it('there are three, and the middle one is the computer opponent as it was', () => {
    expect(DIFFICULTIES).toEqual(['easy', 'medium', 'hard']);
    expect(DEFAULT_DIFFICULTY).toBe('medium');
    expect(AI_LEVELS.medium).toBe(AI_CONFIG);
    // What it was before there were levels: the same start and the same first waves.
    expect(AI_CONFIG.targetWorkers).toBe(10);
    expect(AI_CONFIG.maxSoldiers).toBe(20);
    expect(AI_CONFIG.waves).toEqual([
      { earliest: 240, latest: 330, size: 4 },
      { earliest: 420, latest: 510, size: 6 },
      { earliest: 600, latest: 690, size: 8 },
    ]);
  });

  it('a game is on the middle level unless another is asked for', () => {
    expect(createGame(1).players[1]!.ai!.level).toBe('medium');
    expect(createGame(1, undefined, undefined, { difficulty: 'hard' }).players[1]!.ai!.level).toBe(
      'hard',
    );
    // A side played by a person has no level.
    expect(createGame(1, undefined, undefined, { difficulty: 'hard' }).players[0]!.ai).toBeNull();
  });

  it('the level can be changed until the match begins, and not after', () => {
    const state = createGame(1, undefined, undefined, { ai: [0, 1] });
    expect(setDifficulty(state, 'easy')).toBe(true);
    expect(state.players.map((side) => side.ai!.level)).toEqual(['easy', 'easy']);
    tick(state);
    expect(setDifficulty(state, 'hard')).toBe(false);
    expect(state.players.map((side) => side.ai!.level)).toEqual(['easy', 'easy']);
  });

  it.each(DIFFICULTIES)('on %s it gets nothing for free: same start, same prices', (level) => {
    const state = against(1, level);
    expect(state.players[1]!.resources).toEqual(START_CONFIG.resources);
    expect(unitsOf(state, 1, 'samlare')).toHaveLength(unitsOf(state, 0, 'samlare').length);
    tick(state);
    // Its first decision is to train a worker, at the player's price.
    expect(state.players[1]!.resources.food).toBe(
      START_CONFIG.resources.food - UNIT_DEFS.samlare.cost.food!,
    );
    for (let i = 0; i < 8 * MINUTE; i++) {
      tick(state);
      const { food, wood } = state.players[1]!.resources;
      if (food < 0 || wood < 0) throw new Error(`step ${state.tick}: ${food}/${wood}`);
    }
  });

  it('each level is harder than the one before: more workers, a larger army, earlier and larger waves', () => {
    for (let i = 1; i < DIFFICULTIES.length; i++) {
      const lower = AI_LEVELS[DIFFICULTIES[i - 1]!];
      const higher = AI_LEVELS[DIFFICULTIES[i]!];
      expect(higher.targetWorkers).toBeGreaterThan(lower.targetWorkers);
      expect(higher.maxSoldiers).toBeGreaterThan(lower.maxSoldiers);
      expect(higher.towers.max).toBeGreaterThanOrEqual(lower.towers.max);
      expect(higher.repeat.interval).toBeLessThan(lower.repeat.interval);
      // Wave for wave it comes sooner and with more, also long after the listed ones.
      for (const index of [0, 1, 2, 3, 6, 12, 30]) {
        expect(waveAt(index, higher).earliest).toBeLessThan(waveAt(index, lower).earliest);
        expect(waveAt(index, higher).size).toBeGreaterThan(waveAt(index, lower).size);
      }
      // And at every time of the match it wants at least as much.
      for (const minute of [0, 5, 10, 15, 20, 30, 60]) {
        const a = sizeWanted(lower, minute * 60);
        const b = sizeWanted(higher, minute * 60);
        expect(b.targetWorkers).toBeGreaterThan(a.targetWorkers);
        expect(b.maxSoldiers).toBeGreaterThan(a.maxSoldiers);
        expect(b.barracks).toBeGreaterThanOrEqual(a.barracks);
      }
    }
  });

  it.each(DIFFICULTIES)('on %s it grows step by step, and never shrinks', (level) => {
    const config = AI_LEVELS[level];
    expect(config.growth.length).toBeGreaterThanOrEqual(1);
    let before = sizeWanted(config, 0);
    expect(before).toMatchObject({
      targetWorkers: config.targetWorkers,
      maxSoldiers: config.maxSoldiers,
      barracks: config.barracks,
    });
    for (const step of config.growth) {
      expect(step.after).toBeGreaterThan(before.after);
      expect(step.targetWorkers).toBeGreaterThan(before.targetWorkers);
      expect(step.maxSoldiers).toBeGreaterThan(before.maxSoldiers);
      expect(step.barracks).toBeGreaterThanOrEqual(before.barracks);
      // The step holds from its time on, not a second before.
      expect(sizeWanted(config, step.after - 1)).toEqual(before);
      expect(sizeWanted(config, step.after)).toEqual(step);
      before = step;
    }
    // Its largest wave is no larger than the army it may have.
    expect(config.repeat.maxSize).toBeLessThanOrEqual(before.maxSoldiers);
  });
});

describe('waves on each level', () => {
  it('after the listed waves each wave is larger than the one before, up to the most', () => {
    // The middle level: 10 soldiers at 12 minutes, then 2 more every other minute.
    expect(waveAt(3)).toEqual({ earliest: 720, latest: 810, size: 10 });
    expect(waveAt(4)).toEqual({ earliest: 840, latest: 930, size: 12 });
    expect(waveAt(5)).toEqual({ earliest: 960, latest: 1050, size: 14 });
    expect(waveAt(13).size).toBe(30);
    expect(waveAt(14).size).toBe(30);
    expect(waveAt(100).size).toBe(30);

    for (const level of DIFFICULTIES) {
      const config = AI_LEVELS[level];
      for (let index = 1; index < 60; index++) {
        const wave = waveAt(index, config);
        const previous = waveAt(index - 1, config);
        expect(wave.earliest, `${level} ${index}`).toBeGreaterThan(previous.earliest);
        expect(wave.latest, `${level} ${index}`).toBeGreaterThan(wave.earliest);
        expect(wave.size, `${level} ${index}`).toBeGreaterThanOrEqual(previous.size);
        expect(wave.size, `${level} ${index}`).toBeLessThanOrEqual(config.repeat.maxSize);
      }
      expect(waveAt(59, config).size, level).toBe(config.repeat.maxSize);
    }
  });

  it.each(DIFFICULTIES)(
    'on %s the first wave sets off within its window, with no more than its size',
    (level) => {
      const [first] = AI_LEVELS[level].waves;
      for (const seed of [1, 2]) {
        const state = against(seed, level);
        const memory = state.players[1]!.ai!;
        while (memory.waveTicks.length === 0 && state.tick < (first!.latest + 5) * SECOND) {
          tick(state);
        }
        expect(memory.waveTicks, `seed ${seed}`).toHaveLength(1);
        expect(memory.waveTicks[0]!, `seed ${seed}`).toBeGreaterThanOrEqual(
          first!.earliest * SECOND,
        );
        expect(memory.waveTicks[0]!, `seed ${seed}`).toBeLessThanOrEqual(
          (first!.latest + 1) * SECOND,
        );
        expect(memory.attackers.length, `seed ${seed}`).toBeGreaterThan(0);
        expect(memory.attackers.length, `seed ${seed}`).toBeLessThanOrEqual(first!.size);
      }
    },
  );

  it('the beginner level is later and smaller than the middle one in a match, the hard one earlier and larger', () => {
    const firstWave = (level: (typeof DIFFICULTIES)[number]) => {
      const state = against(1, level);
      const memory = state.players[1]!.ai!;
      while (memory.waveTicks.length === 0 && state.tick < 10 * MINUTE) tick(state);
      return { tick: memory.waveTicks[0]!, size: memory.attackers.length };
    };
    const [easy, medium, hard] = DIFFICULTIES.map(firstWave);
    expect(easy!.tick).toBeGreaterThan(medium!.tick);
    expect(medium!.tick).toBeGreaterThan(hard!.tick);
    expect(easy!.size).toBeLessThan(medium!.size);
    expect(medium!.size).toBeLessThan(hard!.size);
  });
});

describe('the computer opponent grows', () => {
  it('on the middle level it has ten workers and one Krigshall until ten minutes, and more of both after', () => {
    const state = against(2);
    advance(state, 10 * MINUTE - SECOND);
    expect(unitsOf(state, 1, 'samlare').length).toBeLessThanOrEqual(10);
    expect(buildingsOf(state, 1, 'krigshall')).toHaveLength(1);
    expect(soldiersOf(state, 1).length).toBeLessThanOrEqual(20);

    advance(state, 4 * MINUTE);
    expect(unitsOf(state, 1, 'samlare').length).toBeGreaterThan(13);
    expect(unitsOf(state, 1, 'samlare').length).toBeLessThanOrEqual(16);
    expect(buildingsOf(state, 1, 'krigshall')).toHaveLength(2);
    // Still one throwing range: the extra barracks are for hand-to-hand soldiers.
    expect(buildingsOf(state, 1, 'kastbana')).toHaveLength(1);
  });

  it('the beginner level stays small: seven workers and at most ten soldiers in the first fifteen minutes', () => {
    const state = against(2, 'easy');
    for (let i = 0; i < 15 * MINUTE - SECOND; i++) {
      tick(state);
      if (state.tick % SECOND !== 0) continue;
      expect(unitsOf(state, 1, 'samlare').length).toBeLessThanOrEqual(7);
      expect(soldiersOf(state, 1).length).toBeLessThanOrEqual(10);
    }
    expect(unitsOf(state, 1, 'samlare')).toHaveLength(7);
  });

  it('the hard level has fourteen workers after five minutes, and two towers in time', () => {
    const state = against(2, 'hard');
    advance(state, 5 * MINUTE);
    expect(unitsOf(state, 1, 'samlare')).toHaveLength(14);
    advance(state, 7 * MINUTE);
    expect(state.players[1]!.ai!.towersPlaced).toBe(2);
    expect(buildingsOf(state, 1, 'krigshall').length).toBeGreaterThanOrEqual(2);
  });
});

describe('wood it has no use for', () => {
  it('with the berries gone, every food worker has a place to work for food without end', () => {
    for (const seed of [1, 2, 3]) {
      const state = against(seed);
      advance(state, 3 * MINUTE);
      emptyBerries(state, 1);
      // Wood enough for the fields, but not so much that it moves workers off wood.
      state.players[1]!.resources.wood = 380;
      advance(state, 3 * MINUTE);
      const workers = unitsOf(state, 1, 'samlare').length;
      const onFood = workers - Math.round(workers * AI_CONFIG.woodShare);
      expect(workers, `seed ${seed}`).toBe(10);
      // It was four places at most before: two of the six had nowhere to go.
      expect(foodPlaces(state, 1), `seed ${seed}`).toBeGreaterThanOrEqual(onFood);
      const atWork = gathering(state, 1, 'food').filter(
        (u) => u.task.kind === 'gather' && u.task.siteId !== null,
      );
      expect(atWork.length, `seed ${seed}`).toBeGreaterThanOrEqual(onFood - 1);
    }
  });

  it('with a heap of wood it keeps fewer workers on wood and builds fields for the others', () => {
    const state = against(1);
    const memory = state.players[1]!.ai!;
    advance(state, 4 * MINUTE);
    expect(memory.woodSurplus).toBe(false);
    expect(gathering(state, 1, 'wood').length).toBeGreaterThanOrEqual(3);
    expect(gathering(state, 1, 'wood').length).toBeLessThanOrEqual(4);

    // The berries run out and the wood piles up, as it did late in a long match.
    emptyBerries(state, 1);
    state.players[1]!.resources.wood = 3000;
    advance(state, 4 * MINUTE);
    expect(memory.woodSurplus).toBe(true);
    const workers = unitsOf(state, 1, 'samlare').length;
    expect(gathering(state, 1, 'wood')).toHaveLength(
      Math.round(workers * AI_CONFIG.surplus.woodShare),
    );
    expect(foodPlaces(state, 1)).toBeGreaterThanOrEqual(
      workers - Math.round(workers * AI_CONFIG.surplus.woodShare),
    );
    const atWork = gathering(state, 1, 'food').filter(
      (u) => u.task.kind === 'gather' && u.task.siteId !== null,
    );
    expect(atWork.length).toBeGreaterThanOrEqual(workers - 3);
  });

  it('goes back to the usual share when the wood has been used', () => {
    const state = against(1);
    const memory = state.players[1]!.ai!;
    advance(state, 4 * MINUTE);
    emptyBerries(state, 1);
    state.players[1]!.resources.wood = 3000;
    advance(state, 4 * MINUTE);
    expect(memory.woodSurplus).toBe(true);

    // Between the two amounts it stays as it is.
    state.players[1]!.resources.wood = 200;
    advance(state, 2 * SECOND);
    expect(memory.woodSurplus).toBe(true);

    state.players[1]!.resources.wood = 0;
    advance(state, MINUTE);
    expect(memory.woodSurplus).toBe(false);
    const workers = unitsOf(state, 1, 'samlare').length;
    const wanted = Math.round(workers * AI_CONFIG.woodShare);
    expect(gathering(state, 1, 'wood').length).toBeGreaterThanOrEqual(wanted - 1);
    expect(gathering(state, 1, 'wood').length).toBeLessThanOrEqual(wanted);
  });
});
