import { describe, expect, it, vi } from 'vitest';
import { AI_CONFIG } from '../data/ai';
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
  it('a match between two computer players takes 10 to 20 minutes', () => {
    for (const seed of SEEDS) {
      const state = createGame(seed, undefined, undefined, { ai: [0, 1] });
      advance(state, 20 * MINUTE);
      expect(state.winner, `seed ${seed}`).not.toBeNull();
      expect(state.tick, `seed ${seed}`).toBeGreaterThan(10 * MINUTE);
      expect(state.tick, `seed ${seed}`).toBeLessThan(20 * MINUTE);
    }
  });

  it('six Ramkrigare at the base beat back the first wave of four', () => {
    const [first, second] = AI_CONFIG.waves;
    expect(first.size).toBe(4);

    for (const seed of SEEDS) {
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
      // The defenders lose at most one of their own, and the Storide is all but untouched.
      expect(soldiersOf(state, 0).length, `seed ${seed}`).toBeGreaterThanOrEqual(5);
      expect(storideOf(state, 0)!.hp, `seed ${seed}`).toBeGreaterThanOrEqual(
        BUILDING_DEFS.storide.hp * 0.95,
      );
    }
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
