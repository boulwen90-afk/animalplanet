import { describe, expect, it, vi } from 'vitest';
import { AI_CONFIG } from '../../data/ai';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import {
  buildingCentre,
  createUnit,
  hasSurrendered,
  populationOf,
  populationRoom,
  reservedPopulation,
} from '../entities';
import { createGame } from '../game';
import { tileDistance } from '../map/grid';
import type { Building, GameState, Unit } from '../state';
import { isEntityVisibleTo, visibilityAt } from '../systems/visibility';
import { VISIBLE } from '../state';
import { advance, tick } from '../tick';
import { runAi, waveAt } from './ai';

// Whole matches are simulated here; they take seconds, not milliseconds.
vi.setConfig({ testTimeout: 120_000 });

const SECOND = SIM_CONFIG.ticksPerSecond;
const MINUTE = 60 * SECOND;
const SEEDS = [1, 2, 3];

const unitsOf = (state: GameState, owner: number, type: string) =>
  state.entities.filter(
    (e): e is Unit =>
      e.kind === 'unit' && e.owner === owner && e.type === type && !hasSurrendered(e),
  );
const buildingsOf = (state: GameState, owner: number, type: string) =>
  state.entities.filter(
    (e): e is Building => e.kind === 'building' && e.owner === owner && e.type === type,
  );

/** A game where the computer plays side 1 and nobody touches side 0. */
const againstNobody = (seed: number) => createGame(seed);

describe('the computer opponent builds an economy', () => {
  it('after 3 minutes it has at least 6 Samlare and a Krigshall', () => {
    for (const seed of SEEDS) {
      const state = againstNobody(seed);
      advance(state, 3 * MINUTE);
      expect(unitsOf(state, 1, 'samlare').length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(buildingsOf(state, 1, 'krigshall'), `seed ${seed}`).toMatchObject([
        { complete: true },
      ]);
    }
  });

  it('stops training workers at the target number', () => {
    const state = againstNobody(1);
    advance(state, 4 * MINUTE);
    expect(unitsOf(state, 1, 'samlare')).toHaveLength(AI_CONFIG.targetWorkers);
  });

  it('builds a Visthus by the forest after the Krigshall', () => {
    for (const seed of SEEDS) {
      const state = againstNobody(seed);
      advance(state, 3 * MINUTE);
      const [visthus] = buildingsOf(state, 1, 'visthus');
      expect(visthus, `seed ${seed}`).toMatchObject({ complete: true });
      // There was a tree within a few tiles of it when it was placed; some may be felled by now.
      const centre = buildingCentre(visthus!);
      const base = buildingCentre(buildingsOf(state, 1, 'storide')[0]!);
      expect(tileDistance(centre.x, centre.y, base.x, base.y)).toBeGreaterThan(3);
    }
  });

  it('keeps its workers busy, on both food and wood', () => {
    const state = againstNobody(1);
    advance(state, 2 * MINUTE);
    const workers = unitsOf(state, 1, 'samlare');
    const idle = workers.filter((w) => w.task.kind === 'idle');
    expect(idle.length).toBeLessThanOrEqual(1);
    const on = (resource: string) =>
      workers.filter((w) => w.task.kind === 'gather' && w.task.resource === resource).length;
    expect(on('food')).toBeGreaterThan(0);
    expect(on('wood')).toBeGreaterThan(0);
  });

  it('trains soldiers once the Krigshall stands', () => {
    const state = againstNobody(1);
    advance(state, 3 * MINUTE);
    expect(unitsOf(state, 1, 'ramkrigare').length).toBeGreaterThanOrEqual(2);
  });
});

describe('the computer opponent plays by the rules', () => {
  it('its stock never goes below zero', () => {
    for (const seed of [1, 2]) {
      const state = againstNobody(seed);
      for (let i = 0; i < 6 * MINUTE && state.winner === null; i++) {
        tick(state);
        const { food, wood } = state.players[1]!.resources;
        if (food < 0 || wood < 0)
          throw new Error(`seed ${seed} step ${state.tick}: ${food}/${wood}`);
      }
    }
  });

  it('pays for what it trains', () => {
    const state = againstNobody(1);
    tick(state);
    // Its first decision is to train a worker.
    const storide = buildingsOf(state, 1, 'storide')[0]!;
    expect(storide.queue).toEqual(['samlare']);
    expect(state.players[1]!.resources.food).toBe(
      START_CONFIG.resources.food - UNIT_DEFS.samlare.cost.food!,
    );
  });

  it('never has more units than it has room for', () => {
    const state = againstNobody(2);
    for (let i = 0; i < 5 * MINUTE && state.winner === null; i++) {
      tick(state);
      expect(populationOf(state, 1)).toBeLessThanOrEqual(populationRoom(state, 1));
    }
  });

  it('builds housing in time: it is never left waiting for room for long', () => {
    const state = againstNobody(2);
    // Steps in a row in which it has no room for another unit.
    let stuck = 0;
    let longest = 0;
    for (let i = 0; i < 8 * MINUTE && state.winner === null; i++) {
      tick(state);
      const full = reservedPopulation(state, 1) >= populationRoom(state, 1);
      stuck = full ? stuck + 1 : 0;
      longest = Math.max(longest, stuck);
    }
    // A house takes 15 seconds to raise; it is never without room for much longer than that.
    expect(longest).toBeLessThan(30 * SIM_CONFIG.ticksPerSecond);
    // And it did grow: well past the room its main building gives.
    expect(populationOf(state, 1)).toBeGreaterThan(15);
    expect(buildingsOf(state, 1, 'ide').length).toBeGreaterThanOrEqual(3);
  });

  it('decides once a second, not every step', () => {
    const state = againstNobody(1);
    advance(state, 7);
    const before = structuredClone(state);
    runAi(state);
    expect(state).toEqual(before);
  });

  it('leaves a side played by a person alone', () => {
    const state = againstNobody(1);
    advance(state, 2 * MINUTE);
    expect(state.players[0]!.ai).toBeNull();
    expect(unitsOf(state, 0, 'samlare')).toHaveLength(3);
    expect(unitsOf(state, 0, 'samlare').every((u) => u.task.kind === 'idle')).toBe(true);
    expect(state.players[0]!.resources).toEqual(START_CONFIG.resources);
  });

  it('does nothing without a side to play', () => {
    const state = createGame(1, undefined, undefined, { ai: [] });
    advance(state, 2 * MINUTE);
    expect(unitsOf(state, 1, 'samlare')).toHaveLength(3);
    expect(state.players[1]!.resources).toEqual(START_CONFIG.resources);
  });

  it('is not bound by the fog of war', () => {
    const state = againstNobody(1);
    const mine = state.map.startPositions[0]!;
    expect(state.fogEnabled).toBe(true);
    expect(visibilityAt(state, 1, mine.x, mine.y)).toBe(VISIBLE);
    const storide = buildingsOf(state, 0, 'storide')[0]!;
    expect(isEntityVisibleTo(state, 1, storide)).toBe(true);
    // The person playing side 0 is.
    expect(isEntityVisibleTo(state, 0, buildingsOf(state, 1, 'storide')[0]!)).toBe(false);
  });
});

describe('attack waves', () => {
  it('the first wave sets off within the time window in the data file', () => {
    const [first] = AI_CONFIG.waves;
    for (const seed of SEEDS) {
      const state = againstNobody(seed);
      advance(state, first.earliest * SECOND - 1);
      expect(state.players[1]!.ai!.waveTicks, `seed ${seed}`).toEqual([]);
      advance(state, (first.latest - first.earliest) * SECOND + SECOND);
      const [sent] = state.players[1]!.ai!.waveTicks;
      expect(sent, `seed ${seed}`).toBeDefined();
      expect(sent!).toBeGreaterThanOrEqual(first.earliest * SECOND);
      expect(sent!).toBeLessThanOrEqual(first.latest * SECOND);
    }
  });

  it('a wave has the size the data file says and goes for the enemy Storide', () => {
    const state = againstNobody(1);
    const [first] = AI_CONFIG.waves;
    advance(state, first.earliest * SECOND + SECOND);
    const memory = state.players[1]!.ai!;
    expect(memory.waveTicks).toHaveLength(1);
    expect(memory.attackers).toHaveLength(first.size);
    const enemyBase = buildingsOf(state, 0, 'storide')[0]!;
    const attackers = state.entities.filter((e): e is Unit => memory.attackers.includes(e.id));
    expect(attackers).toHaveLength(first.size);
    for (const soldier of attackers) {
      expect(soldier.task).toMatchObject({ kind: 'attack', targetId: enemyBase.id });
    }
    // It had more soldiers than the wave needed; the rest stay at home.
    expect(unitsOf(state, 1, 'ramkrigare').length).toBeGreaterThan(first.size);
  });

  it('later waves follow the list, and then repeat', () => {
    expect(waveAt(0)).toEqual(AI_CONFIG.waves[0]);
    expect(waveAt(2)).toEqual(AI_CONFIG.waves[2]);
    const last = AI_CONFIG.waves[AI_CONFIG.waves.length - 1]!;
    const { interval, window, size } = AI_CONFIG.repeat;
    expect(waveAt(3)).toEqual({
      earliest: last.earliest + interval,
      latest: last.earliest + interval + window,
      size,
    });
    expect(waveAt(5).earliest).toBe(last.earliest + 3 * interval);
  });

  it('against a player who does nothing, it wins within 15 minutes', () => {
    for (const seed of SEEDS) {
      const state = againstNobody(seed);
      advance(state, 15 * MINUTE);
      expect(state.winner, `seed ${seed}`).toBe(1);
      expect(state.tick).toBeLessThan(15 * MINUTE);
    }
  });
});

describe('defending the base', () => {
  it('soldiers at home go for an enemy unit that comes near the main building', () => {
    const state = againstNobody(1);
    const base = buildingsOf(state, 1, 'storide')[0]!;
    const centre = buildingCentre(base);
    // Two soldiers of its own behind the base, and an intruder ten tiles away:
    // too far for them to notice by themselves, but inside the defended area.
    const guards = [
      createUnit(state, 'ramkrigare', 1, base.x - 2, base.y + 1),
      createUnit(state, 'ramkrigare', 1, base.x - 2, base.y),
    ];
    const start = state.map.startPositions[1]!;
    const intruder = createUnit(state, 'samlare', 0, start.x - 3, start.y + 9);
    expect(tileDistance(intruder.x, intruder.y, centre.x, centre.y)).toBeLessThan(
      AI_CONFIG.defendRadius,
    );
    for (const guard of guards) {
      expect(tileDistance(intruder.x, intruder.y, guard.x, guard.y)).toBeGreaterThan(
        UNIT_DEFS.ramkrigare.aggroRadius,
      );
    }

    advance(state, SECOND + 1);
    for (const guard of guards) {
      expect(guard.task).toMatchObject({ kind: 'attack', targetId: intruder.id });
    }
    advance(state, MINUTE);
    expect(hasSurrendered(intruder) || !state.entities.includes(intruder)).toBe(true);
  });

  it('gets its Krigshall finished even if the builder is lost', () => {
    const state = againstNobody(1);
    let site: Building | undefined;
    for (let i = 0; i < 3 * MINUTE && !site; i++) {
      tick(state);
      site = buildingsOf(state, 1, 'krigshall')[0];
    }
    expect(site).toBeDefined();
    advance(state, 5 * SECOND);
    const builder = state.entities.find(
      (e): e is Unit =>
        e.kind === 'unit' && e.task.kind === 'build' && e.task.buildingId === site!.id,
    );
    expect(builder).toBeDefined();
    // The builder is taken out of the game.
    state.entities.splice(state.entities.indexOf(builder!), 1);

    advance(state, 2 * MINUTE);
    expect(buildingsOf(state, 1, 'krigshall')).toMatchObject([{ complete: true }]);
  });
});

describe('computer against computer', () => {
  const play = (seed: number) => {
    const state = createGame(seed, undefined, undefined, { ai: [0, 1] });
    advance(state, 30 * MINUTE);
    return state;
  };

  it('the same seed gives the same winner at the same step, twice in a row', () => {
    const first = play(2);
    const second = play(2);
    expect(first.winner).not.toBeNull();
    expect(second.winner).toBe(first.winner);
    expect(second.tick).toBe(first.tick);
    expect(second).toEqual(first);
    // The match is decided, and not at once: it takes 10 to 20 minutes.
    expect(first.tick).toBeGreaterThan(10 * MINUTE);
    expect(first.tick).toBeLessThan(20 * MINUTE);
  });
});
