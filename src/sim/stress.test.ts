import { describe, expect, it, vi } from 'vitest';
import { UNIT_DEFS } from '../data/units';
import { createStepTimes, recordStep, takeStepTime } from './clock';
import { isUnit } from './entities';
import { createGame } from './game';
import type { GameState, Unit } from './state';
import { STRESS_MODES, startStress, stressUnits, type StressMode } from './stress';
import { advance } from './tick';

// Minutes of a match with hundreds of units are simulated here; that takes
// seconds, not milliseconds, and more on a busy machine.
vi.setConfig({ testTimeout: 120_000 });

const stressed = (count: number, mode: StressMode, seed = 1) => {
  const state = createGame(seed, undefined, undefined, {
    ai: [],
    extraUnits: stressUnits(count, mode),
  });
  startStress(state, mode);
  return state;
};
const unitsOf = (state: GameState, owner: number) =>
  state.entities.filter((e): e is Unit => isUnit(e) && e.owner === owner);
const isSoldier = (unit: Unit) => UNIT_DEFS[unit.type].aggroRadius > 0;

describe('stress runs', () => {
  it.each(STRESS_MODES)('%s: 400 extra units are 200 to each side', (mode) => {
    const state = stressed(400, mode);
    // And the three workers each side starts with.
    expect(unitsOf(state, 0)).toHaveLength(203);
    expect(unitsOf(state, 1)).toHaveLength(203);
    const tiles = state.entities.filter(isUnit).map((u) => `${Math.floor(u.x)},${Math.floor(u.y)}`);
    expect(new Set(tiles).size).toBe(406);
  });

  it('an odd number gives the odd one to side 0, and none gives none', () => {
    expect(stressUnits(5, 'still')).toEqual([
      { owner: 0, type: 'samlare', count: 3 },
      { owner: 1, type: 'samlare', count: 2 },
    ]);
    expect(stressUnits(0, 'fight')).toEqual([]);
    expect(unitsOf(stressed(0, 'gather'), 0)).toHaveLength(3);
  });

  it('still: nobody has anything to do, and nobody moves', () => {
    const state = stressed(100, 'still');
    const before = state.entities.filter(isUnit).map((unit) => [unit.id, unit.x, unit.y]);
    advance(state, 200);
    expect(state.entities.filter(isUnit).map((unit) => [unit.id, unit.x, unit.y])).toEqual(before);
    expect(state.entities.filter(isUnit).every((unit) => unit.task.kind === 'idle')).toBe(true);
  });

  it('gather: the workers of both sides gather, both wood and food', () => {
    const state = stressed(100, 'gather');
    for (const owner of [0, 1]) {
      const tasks = unitsOf(state, owner).map((unit) => unit.task);
      const gathering = tasks.filter((task) => task.kind === 'gather');
      // Most of them: some find no place at a source they can reach.
      expect(gathering.length, `side ${owner}`).toBeGreaterThanOrEqual(40);
      const resources = gathering.map((task) => (task.kind === 'gather' ? task.resource : ''));
      expect(new Set(resources)).toEqual(new Set(['wood', 'food']));
    }
    const stock = state.players.map((side) => ({ ...side.resources }));
    advance(state, 60 * 20);
    state.players.forEach((side, i) => {
      expect(side.resources.wood, `side ${i}`).toBeGreaterThan(stock[i]!.wood);
      expect(side.resources.food, `side ${i}`).toBeGreaterThan(stock[i]!.food);
    });
  });

  it('fight: soldiers of both kinds, one in three a thrower, who meet and fight', () => {
    const state = stressed(120, 'fight');
    for (const owner of [0, 1]) {
      const soldiers = unitsOf(state, owner).filter(isSoldier);
      expect(soldiers).toHaveLength(60);
      expect(soldiers.filter((unit) => unit.type === 'ramkastare')).toHaveLength(20);
      // All of them are on their way at once.
      expect(soldiers.every((unit) => unit.path.length > 0)).toBe(true);
    }
    let fighting = 0;
    let hits = 0;
    // Until the fight is well under way, and for a minute and a half at the most.
    for (let i = 0; i < 90 * 20 && (fighting <= 60 || hits <= 100); i++) {
      advance(state, 1);
      hits += state.events.filter((event) => event.type === 'hit').length;
      fighting = Math.max(
        fighting,
        state.entities.filter((e) => isUnit(e) && e.task.kind === 'attack').length,
      );
    }
    expect(fighting).toBeGreaterThan(60);
    expect(hits).toBeGreaterThan(100);
  });

  it('the same seed gives the same stress run', () => {
    const a = stressed(60, 'fight', 3);
    const b = stressed(60, 'fight', 3);
    advance(a, 600);
    advance(b, 600);
    expect(a.entities).toEqual(b.entities);
  });
});

describe('step times', () => {
  it('gives the average since the last reading and the longest step of late', () => {
    const times = createStepTimes();
    expect(takeStepTime(times)).toEqual({ averageMs: 0, largestMs: 0 });
    for (const ms of [2, 4, 9]) recordStep(times, ms);
    expect(takeStepTime(times)).toEqual({ averageMs: 5, largestMs: 9 });
    // A new average, but the long step is still remembered.
    recordStep(times, 1);
    expect(takeStepTime(times)).toEqual({ averageMs: 1, largestMs: 9 });
  });

  it('forgets a long step after one to two windows of 200 steps', () => {
    const times = createStepTimes();
    recordStep(times, 30);
    for (let i = 0; i < 199; i++) recordStep(times, 1);
    expect(takeStepTime(times).largestMs).toBe(30);
    // The next window: the long step is in the one before, and still counts.
    for (let i = 0; i < 200; i++) recordStep(times, 1);
    expect(takeStepTime(times).largestMs).toBe(30);
    // One step into the window after that it is gone.
    recordStep(times, 1);
    expect(takeStepTime(times).largestMs).toBe(1);
  });
});
