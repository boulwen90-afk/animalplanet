import { describe, expect, it, vi } from 'vitest';
import { AI_CONFIG, AI_LEVELS, type AiConfig } from '../data/ai';
import { BUILDING_DEFS } from '../data/buildings';
import { SIM_CONFIG } from '../data/sim';
import { buildingFrontTile, createUnit, hasSurrendered } from './entities';
import { createGame } from './game';
import type { Building, GameState, Unit } from './state';
import { advance } from './tick';

// These tests play whole matches without a browser.
vi.setConfig({ testTimeout: 120_000 });

const SECOND = SIM_CONFIG.ticksPerSecond;
const MINUTE = 60 * SECOND;
const SEEDS = [1, 2, 3];

const soldiersOf = (state: GameState, owner: number) =>
  state.entities.filter(
    (e): e is Unit =>
      e.kind === 'unit' && e.owner === owner && e.type === 'ramkrigare' && !hasSurrendered(e),
  );
const storideOf = (state: GameState, owner: number) =>
  state.entities.find(
    (e): e is Building => e.kind === 'building' && e.owner === owner && e.type === 'storide',
  );

/**
 * The balance goals of the MVP (implementation plan, phase 10). They hold
 * for the numbers in src/data/; a change there that breaks one shows up here.
 */
describe('balance', () => {
  it('a match between two computer players takes 10 to 25 minutes', () => {
    // The goal of the MVP was 10 to 20 minutes. Since the computer player
    // grows during the match (2026-11-16) some matches take a little longer,
    // which the user has said is as it should be. A match is also sensitive
    // to the last digit of a distance: when the simulation's arithmetic was
    // made the same for all browsers (2026-11-17), seed 3 went from 18.6 to
    // 20.2 minutes. Since units look for paths in turn (2026-11-18), ten of
    // twelve seeds are decided within 20 minutes, one takes 25 and one
    // (seed 4) takes 26. The three played here are within 25.
    for (const seed of SEEDS) {
      const state = createGame(seed, undefined, undefined, { ai: [0, 1] });
      advance(state, 25 * MINUTE);
      expect(state.winner, `seed ${seed}`).not.toBeNull();
      expect(state.tick, `seed ${seed}`).toBeGreaterThan(10 * MINUTE);
      expect(state.tick, `seed ${seed}`).toBeLessThan(25 * MINUTE);
    }
  });

  it('six Ramkrigare at the base beat back the first wave of four', () => {
    const [first, second] = AI_CONFIG.waves;
    expect(first.size).toBe(4);

    const left: number[] = [];
    // How the fight goes depends on the lie of the land, so this takes more maps than the rest.
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      // The computer plays side 1. Side 0 does nothing but has six soldiers at home.
      const state = createGame(seed);
      const base = storideOf(state, 0)!;
      const front = buildingFrontTile(base);
      for (let i = 0; i < 6; i++) {
        createUnit(state, 'ramkrigare', 0, front.x - 1 + (i % 3), front.y + 1 + Math.floor(i / 3));
      }

      // Until the wave has set off and every soldier in it has surrendered.
      const memory = state.players[1]!.ai!;
      const waveIsOver = () => memory.waveTicks.length > 0 && memory.attackers.length === 0;
      while (!waveIsOver() && state.winner === null && state.tick < second.earliest * SECOND) {
        advance(state, SECOND);
      }

      expect(waveIsOver(), `seed ${seed}: the wave was beaten`).toBe(true);
      expect(state.winner, `seed ${seed}`).toBeNull();
      expect(memory.waveTicks, `seed ${seed}`).toHaveLength(1);
      // The defenders lose two of their own at the very most, and the Storide is all but untouched.
      left.push(soldiersOf(state, 0).length);
      expect(soldiersOf(state, 0).length, `seed ${seed}`).toBeGreaterThanOrEqual(4);
      expect(storideOf(state, 0)!.hp, `seed ${seed}`).toBeGreaterThanOrEqual(
        BUILDING_DEFS.storide.hp * 0.95,
      );
    }
    // Over the maps they lose one in six at most, on average: five of six are left.
    expect(left.reduce((sum, n) => sum + n, 0) / left.length).toBeGreaterThanOrEqual(5);
  });

  it('the computer player itself has six Ramkrigare when the first wave may set off', () => {
    // So a player who keeps up with it can have the six soldiers the defence needs.
    const [first] = AI_CONFIG.waves;
    for (const seed of SEEDS) {
      const state = createGame(seed);
      advance(state, first.earliest * SECOND - 1);
      expect(soldiersOf(state, 1).length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('the computer player does not fade: against a side that holds out, its waves grow', () => {
    // Side 0 builds up like the middle level but never attacks: a stand-in
    // for a player who has survived the first waves and sits behind a strong
    // defence. Until 2026-11-16 the attacker's waves shrank to between 4 and
    // 8 soldiers here, while its unused wood grew past 1 900 by 24 minutes.
    const levels = AI_LEVELS as Record<string, AiConfig>;
    const easy = levels.easy!;
    levels.easy = { ...AI_CONFIG, waves: [{ earliest: 1e9, latest: 1e9, size: 1 }] };
    try {
      const state = createGame(1, undefined, undefined, { ai: [0, 1] });
      state.players[0]!.ai!.level = 'easy';
      const memory = state.players[1]!.ai!;
      const sizes: number[] = [];
      while (state.winner === null && state.tick < 24 * MINUTE) {
        advance(state, 1);
        if (memory.waveTicks.length > sizes.length) sizes.push(memory.attackers.length);
      }
      expect(state.winner).toBeNull();
      // The three listed waves, and then one every other minute.
      expect(sizes.slice(0, 3)).toEqual([4, 6, 8]);
      expect(sizes.length).toBeGreaterThanOrEqual(9);
      const gaps = memory.waveTicks.slice(1).map((at, i) => at - memory.waveTicks[i]!);
      expect(Math.max(...gaps)).toBeLessThanOrEqual(3.5 * MINUTE);
      // No wave after the listed ones is smaller than six, and the largest
      // is twice the size of the third.
      expect(Math.min(...sizes.slice(3))).toBeGreaterThanOrEqual(6);
      expect(Math.max(...sizes.slice(3))).toBeGreaterThanOrEqual(16);
      // It has grown, and uses what it gathers.
      const workers = state.entities.filter(
        (e) => e.kind === 'unit' && e.owner === 1 && e.type === 'samlare' && !hasSurrendered(e),
      );
      expect(workers.length).toBeGreaterThanOrEqual(18);
      expect(state.players[1]!.resources.wood).toBeLessThan(800);
    } finally {
      levels.easy = easy;
    }
  }, 300_000);

  it('the computer player uses what it gathers: no great heap of wood after ten minutes', () => {
    for (const seed of SEEDS) {
      const state = createGame(seed, undefined, undefined, { ai: [0, 1] });
      advance(state, 10 * MINUTE);
      for (const player of state.players) {
        expect(player.resources.wood, `seed ${seed}`).toBeLessThan(800);
      }
    }
  });
});
