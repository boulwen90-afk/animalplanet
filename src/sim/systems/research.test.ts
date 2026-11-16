import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { PRODUCTION_CONFIG } from '../../data/production';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { UPGRADE_DEFS, UPGRADE_TYPES, type UpgradeType } from '../../data/upgrades';
import { applyCommand } from '../commands';
import { createBuilding, createUnit } from '../entities';
import type { Building, GameState, SimEvent } from '../state';
import { openState } from '../testUtils';
import { advance, tick } from '../tick';
import { gatherSpeed, unitArmor, unitDamage, upgradeBonus, upgradeLevel } from '../upgrades';
import { strikeDamage } from './combat';
import { ticksPerUnit } from './gathering';
import {
  isBeingResearched,
  nextUpgradeLevel,
  researchFraction,
  researchTicksFor,
} from './research';
import { shotDamage } from './shooting';

const SECOND = SIM_CONFIG.ticksPerSecond;
const WEAPONS = UPGRADE_DEFS.weapons;
const ARMOR = UPGRADE_DEFS.armor;
const GATHERING = UPGRADE_DEFS.gathering;

/** An open map with a finished Smedja of side 0 and plenty in stock. */
function setup() {
  const state = openState(20, 20);
  const forge = createBuilding(state, 'smedja', 0, 8, 8);
  state.players[0]!.resources = { food: 1000, wood: 1000 };
  return { state, forge };
}

const research = (state: GameState, building: Building, upgrade: UpgradeType, player: 0 | 1 = 0) =>
  applyCommand(state, { type: 'research', player, buildingId: building.id, upgrade });
const cancel = (state: GameState, building: Building, index: number) =>
  applyCommand(state, { type: 'cancelResearch', player: 0, buildingId: building.id, index });
const stock = (state: GameState) => ({ ...state.players[0]!.resources });

/** Steps the game and gathers the events of every step. */
function run(state: GameState, steps: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    tick(state);
    events.push(...state.events);
  }
  return events;
}

/** Gives a side a level of an upgrade at once, without the work. */
function give(state: GameState, player: 0 | 1, upgrade: UpgradeType, level: number): void {
  state.players[player]!.upgrades[upgrade] = level;
}

describe('the data', () => {
  it('has three upgrades of two levels each, worked out at the Smedja', () => {
    expect(UPGRADE_TYPES).toEqual(['weapons', 'armor', 'gathering']);
    for (const type of UPGRADE_TYPES) expect(UPGRADE_DEFS[type].levels, type).toHaveLength(2);
    expect(BUILDING_DEFS.smedja.researches).toEqual(UPGRADE_TYPES);
    const others = Object.entries(BUILDING_DEFS).filter(
      ([type, def]) => type !== 'smedja' && def.researches !== undefined,
    );
    expect(others).toEqual([]);
  });

  it('makes the second level of each cost more and take longer than the first', () => {
    for (const type of UPGRADE_TYPES) {
      const [first, second] = UPGRADE_DEFS[type].levels;
      expect(second!.time, type).toBeGreaterThan(first!.time);
      for (const resource of ['food', 'wood'] as const) {
        expect(second!.cost[resource] ?? 0, type).toBeGreaterThan(first!.cost[resource] ?? 0);
      }
    }
  });

  it('a Smedja is built by Samlare and is found under the tab for the army', () => {
    expect(UNIT_DEFS.samlare.builds).toContain('smedja');
    expect(BUILDING_DEFS.smedja.menu).toBe('army');
    expect(BUILDING_DEFS.smedja.cost).toEqual({ wood: 150 });
  });
});

describe('what the upgrades do', () => {
  it('weapons: a Ramkrigare strikes 2 harder for each level, a Samlare as before', () => {
    const { state } = setup();
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 0, 3, 2);
    const target = createUnit(state, 'samlare', 1, 4, 2);
    expect(unitDamage(state, soldier)).toBe(10);
    expect(strikeDamage(state, soldier, target)).toBe(10);
    give(state, 0, 'weapons', 1);
    expect(unitDamage(state, soldier)).toBe(12);
    expect(strikeDamage(state, soldier, target)).toBe(12);
    give(state, 0, 'weapons', 2);
    expect(unitDamage(state, soldier)).toBe(14);
    expect(strikeDamage(state, soldier, target)).toBe(14);
    expect(unitDamage(state, worker)).toBe(UNIT_DEFS.samlare.damage);
  });

  it('armour: every unit takes 1 less from each strike and each arrow for each level', () => {
    const { state } = setup();
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    const worker = createUnit(state, 'samlare', 0, 3, 2);
    const attacker = createUnit(state, 'ramkrigare', 1, 4, 2);
    expect([unitArmor(state, soldier), unitArmor(state, worker)]).toEqual([1, 0]);
    expect(strikeDamage(state, attacker, soldier)).toBe(9);
    expect(shotDamage(state, 9, worker)).toBe(9);
    give(state, 0, 'armor', 2);
    expect([unitArmor(state, soldier), unitArmor(state, worker)]).toEqual([3, 2]);
    expect(strikeDamage(state, attacker, soldier)).toBe(7);
    expect(strikeDamage(state, attacker, worker)).toBe(8);
    expect(shotDamage(state, 9, soldier)).toBe(6);
    expect(shotDamage(state, 9, worker)).toBe(7);
    // A strike always takes at least 1, however good the armour.
    expect(shotDamage(state, 2, soldier)).toBe(1);
  });

  it('tools: a Samlare gathers, tills and fishes a fifth faster for each level', () => {
    const { state } = setup();
    const worker = createUnit(state, 'samlare', 0, 2, 2);
    const field = createBuilding(state, 'odling', 0, 12, 12);
    const hut = createBuilding(state, 'fiskehytta', 0, 15, 15);
    expect(gatherSpeed(state, worker)).toBe(1);
    expect(ticksPerUnit(state, worker)).toBe(20);
    expect(ticksPerUnit(state, worker, field)).toBe(50);
    expect(ticksPerUnit(state, worker, hut)).toBe(32);
    give(state, 0, 'gathering', 1);
    expect(gatherSpeed(state, worker)).toBeCloseTo(1.2, 9);
    expect(ticksPerUnit(state, worker)).toBe(17);
    expect(ticksPerUnit(state, worker, field)).toBe(42);
    expect(ticksPerUnit(state, worker, hut)).toBe(27);
    give(state, 0, 'gathering', 2);
    expect(gatherSpeed(state, worker)).toBeCloseTo(1.4, 9);
    expect(ticksPerUnit(state, worker)).toBe(14);
    expect(ticksPerUnit(state, worker, field)).toBe(36);
    expect(ticksPerUnit(state, worker, hut)).toBe(23);
  });

  it('hold for the side that bought them only', () => {
    const { state } = setup();
    for (const type of UPGRADE_TYPES) give(state, 0, type, 2);
    const theirs = createUnit(state, 'ramkrigare', 1, 4, 2);
    const worker = createUnit(state, 'samlare', 1, 5, 2);
    expect(unitDamage(state, theirs)).toBe(UNIT_DEFS.ramkrigare.damage);
    expect(unitArmor(state, theirs)).toBe(UNIT_DEFS.ramkrigare.armor);
    expect(gatherSpeed(state, worker)).toBe(1);
  });

  it('hold for units trained afterwards as well as for those the side had', () => {
    const { state } = setup();
    const old = createUnit(state, 'ramkrigare', 0, 2, 2);
    give(state, 0, 'weapons', 1);
    const fresh = createUnit(state, 'ramkrigare', 0, 3, 2);
    expect(unitDamage(state, old)).toBe(12);
    expect(unitDamage(state, fresh)).toBe(12);
  });

  it('show in a fight: a Ramkrigare with better weapons brings another down sooner', () => {
    const fight = (weapons: number) => {
      const state = openState(12, 12);
      give(state, 0, 'weapons', weapons);
      const mine = createUnit(state, 'ramkrigare', 0, 5, 5);
      const theirs = createUnit(state, 'ramkrigare', 1, 6, 5);
      applyCommand(state, { type: 'attack', player: 0, unitIds: [mine.id], targetId: theirs.id });
      applyCommand(state, { type: 'attack', player: 1, unitIds: [theirs.id], targetId: mine.id });
      advance(state, 6 * SECOND);
      return { mine: mine.hp, theirs: theirs.hp };
    };
    const plain = fight(0);
    const sharp = fight(2);
    expect(plain.mine).toBe(plain.theirs);
    expect(sharp.theirs).toBeLessThan(plain.theirs);
    expect(sharp.mine).toBe(plain.mine);
  });

  it('adds up the levels a side has, and nothing beyond the last', () => {
    const { state } = setup();
    expect(upgradeBonus(state, 0, 'ramkrigare', 'damage')).toBe(0);
    give(state, 0, 'weapons', 5);
    expect(upgradeBonus(state, 0, 'ramkrigare', 'damage')).toBe(4);
  });
});

describe('working out an upgrade', () => {
  it('takes its price at once, takes its time, and then holds', () => {
    const { state, forge } = setup();
    const [level] = WEAPONS.levels;
    expect(research(state, forge, 'weapons')).toEqual({ ok: true });
    expect(stock(state)).toEqual({
      food: 1000 - level!.cost.food!,
      wood: 1000 - level!.cost.wood!,
    });
    expect(forge.research).toEqual(['weapons']);
    expect(isBeingResearched(state, 0, 'weapons')).toBe(true);
    expect(upgradeLevel(state, 0, 'weapons')).toBe(0);

    const total = level!.time * SECOND;
    expect(researchTicksFor(state, 0, 'weapons')).toBe(total);
    const before = run(state, total - 1);
    expect(before.filter((event) => event.type === 'upgradeDone')).toEqual([]);
    expect(upgradeLevel(state, 0, 'weapons')).toBe(0);
    expect(researchFraction(state, forge)).toBeCloseTo((total - 1) / total, 9);

    const after = run(state, 1);
    expect(after).toContainEqual({ type: 'upgradeDone', owner: 0, upgrade: 'weapons', level: 1 });
    expect(upgradeLevel(state, 0, 'weapons')).toBe(1);
    expect(forge.research).toEqual([]);
    expect(researchFraction(state, forge)).toBe(0);
  });

  it('goes on to the second level, at its own price and time, and then there is no more', () => {
    const { state, forge } = setup();
    research(state, forge, 'armor');
    advance(state, ARMOR.levels[0]!.time * SECOND);
    const paid = stock(state);
    expect(nextUpgradeLevel(state, 0, 'armor')).toBe(ARMOR.levels[1]);
    expect(research(state, forge, 'armor')).toEqual({ ok: true });
    expect(stock(state)).toEqual({
      food: paid.food - ARMOR.levels[1]!.cost.food!,
      wood: paid.wood - ARMOR.levels[1]!.cost.wood!,
    });
    advance(state, ARMOR.levels[1]!.time * SECOND);
    expect(upgradeLevel(state, 0, 'armor')).toBe(2);
    expect(nextUpgradeLevel(state, 0, 'armor')).toBeUndefined();
    const full = stock(state);
    expect(research(state, forge, 'armor')).toEqual({ ok: false, reason: 'invalid' });
    expect(stock(state)).toEqual(full);
  });

  it('works out the upgrades in its queue one after another', () => {
    const { state, forge } = setup();
    expect(research(state, forge, 'weapons')).toEqual({ ok: true });
    expect(research(state, forge, 'gathering')).toEqual({ ok: true });
    expect(forge.research).toEqual(['weapons', 'gathering']);
    advance(state, WEAPONS.levels[0]!.time * SECOND);
    expect(state.players[0]!.upgrades).toEqual({ weapons: 1, armor: 0, gathering: 0 });
    expect(forge.research).toEqual(['gathering']);
    advance(state, GATHERING.levels[0]!.time * SECOND);
    expect(state.players[0]!.upgrades).toEqual({ weapons: 1, armor: 0, gathering: 1 });
  });

  it('two Smedjor work out two upgrades at the same time, but never the same one', () => {
    const { state, forge } = setup();
    const second = createBuilding(state, 'smedja', 0, 12, 8);
    expect(research(state, forge, 'weapons')).toEqual({ ok: true });
    expect(research(state, second, 'weapons')).toEqual({ ok: false, reason: 'invalid' });
    expect(research(state, second, 'armor')).toEqual({ ok: true });
    advance(state, 40 * SECOND);
    expect(state.players[0]!.upgrades).toEqual({ weapons: 1, armor: 1, gathering: 0 });
  });

  it('is refused, and takes nothing, without the price', () => {
    const { state, forge } = setup();
    state.players[0]!.resources = { food: 99, wood: 1000 };
    expect(research(state, forge, 'weapons')).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['food'],
    });
    expect(stock(state)).toEqual({ food: 99, wood: 1000 });
    expect(forge.research).toEqual([]);
  });

  it('is refused in a building that is not a finished Smedja of the side`s own', () => {
    const { state, forge } = setup();
    const hall = createBuilding(state, 'krigshall', 0, 2, 2);
    expect(research(state, hall, 'weapons')).toEqual({ ok: false, reason: 'invalid' });
    forge.complete = false;
    expect(research(state, forge, 'weapons')).toEqual({ ok: false, reason: 'invalid' });
    forge.complete = true;
    state.players[1]!.resources = { food: 1000, wood: 1000 };
    expect(research(state, forge, 'weapons', 1)).toEqual({ ok: false, reason: 'invalid' });
    expect(stock(state)).toEqual({ food: 1000, wood: 1000 });
  });

  it('has room in its queue for every upgrade there is', () => {
    expect(UPGRADE_TYPES.length).toBeLessThanOrEqual(PRODUCTION_CONFIG.maxQueue);
    const { state, forge } = setup();
    for (const type of UPGRADE_TYPES) expect(research(state, forge, type)).toEqual({ ok: true });
    expect(forge.research).toEqual([...UPGRADE_TYPES]);
  });
});

describe('cancelling an upgrade', () => {
  it('gives the whole price back and throws away the work done', () => {
    const { state, forge } = setup();
    research(state, forge, 'weapons');
    advance(state, 10 * SECOND);
    expect(cancel(state, forge, 0)).toEqual({ ok: true });
    expect(stock(state)).toEqual({ food: 1000, wood: 1000 });
    expect(forge.research).toEqual([]);
    expect(forge.researchTicks).toBe(0);
    advance(state, 60 * SECOND);
    expect(upgradeLevel(state, 0, 'weapons')).toBe(0);
    // It can be ordered again, and starts from the beginning.
    expect(research(state, forge, 'weapons')).toEqual({ ok: true });
    expect(researchFraction(state, forge)).toBe(0);
  });

  it('of one that waits leaves the one being worked out alone', () => {
    const { state, forge } = setup();
    research(state, forge, 'weapons');
    research(state, forge, 'armor');
    advance(state, 10 * SECOND);
    const ticks = forge.researchTicks;
    expect(cancel(state, forge, 1)).toEqual({ ok: true });
    expect(forge.research).toEqual(['weapons']);
    expect(forge.researchTicks).toBe(ticks);
    expect(stock(state)).toEqual({
      food: 1000 - WEAPONS.levels[0]!.cost.food!,
      wood: 1000 - WEAPONS.levels[0]!.cost.wood!,
    });
  });

  it('gives back the price of the level that was ordered: the second, after the first', () => {
    const { state, forge } = setup();
    give(state, 0, 'weapons', 1);
    research(state, forge, 'weapons');
    expect(stock(state).food).toBe(1000 - WEAPONS.levels[1]!.cost.food!);
    cancel(state, forge, 0);
    expect(stock(state)).toEqual({ food: 1000, wood: 1000 });
  });

  it('is refused for a place in the queue that is empty', () => {
    const { state, forge } = setup();
    expect(cancel(state, forge, 0)).toEqual({ ok: false, reason: 'invalid' });
    research(state, forge, 'weapons');
    expect(cancel(state, forge, 3)).toEqual({ ok: false, reason: 'invalid' });
    expect(forge.research).toEqual(['weapons']);
  });
});

describe('a Smedja that is lost', () => {
  it('takes the upgrade it was working out with it: nothing is given back, and it can be ordered anew', () => {
    const { state, forge } = setup();
    research(state, forge, 'weapons');
    advance(state, 20 * SECOND);
    const paid = stock(state);
    state.entities.splice(state.entities.indexOf(forge), 1);
    advance(state, 60 * SECOND);
    expect(upgradeLevel(state, 0, 'weapons')).toBe(0);
    expect(stock(state)).toEqual(paid);
    expect(isBeingResearched(state, 0, 'weapons')).toBe(false);
    const again = createBuilding(state, 'smedja', 0, 12, 8);
    expect(research(state, again, 'weapons')).toEqual({ ok: true });
  });

  it('leaves the upgrades the side has already: they are the side`s, not the building`s', () => {
    const { state, forge } = setup();
    research(state, forge, 'weapons');
    advance(state, 40 * SECOND);
    const soldier = createUnit(state, 'ramkrigare', 0, 2, 2);
    state.entities.splice(state.entities.indexOf(forge), 1);
    advance(state, SECOND);
    expect(unitDamage(state, soldier)).toBe(12);
  });
});
