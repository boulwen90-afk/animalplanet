import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { UPGRADE_DEFS } from '../../data/upgrades';
import { applyCommand } from '../commands';
import { buildingCentre, createBuilding, createUnit, hasSurrendered, unitTile } from '../entities';
import { tileDistance } from '../map/grid';
import type { GameState, SimEvent, Unit } from '../state';
import { addCave, openState } from '../testUtils';
import { tick } from '../tick';
import { throwDamage } from '../upgrades';
import { attackMode, strikeDamage, throwDistance, throwTicks } from './combat';

const THROWER = UNIT_DEFS.ramkastare;
const RANGED = THROWER.ranged!;
const WARRIOR = UNIT_DEFS.ramkrigare;
const TOWER = BUILDING_DEFS.vakttorn;
const SECOND = SIM_CONFIG.ticksPerSecond;

/** Steps the game and gathers the events of every step. */
function run(state: GameState, steps: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    tick(state);
    events.push(...state.events);
  }
  return events;
}

const shots = (events: SimEvent[]) => events.filter((event) => event.type === 'shot');
const landed = (events: SimEvent[]) => events.filter((event) => event.type === 'projectileHit');
const struck = (events: SimEvent[]) => events.filter((event) => event.type === 'hit');

function attack(state: GameState, units: Unit[], targetId: number) {
  return applyCommand(state, {
    type: 'attack',
    player: units[0]!.owner,
    unitIds: units.map((unit) => unit.id),
    targetId,
  });
}

describe('the data', () => {
  it('a Ramkastare is trained at a Kastbana, which a Samlare builds for wood', () => {
    expect(BUILDING_DEFS.kastbana.trains).toEqual(['ramkastare']);
    expect(BUILDING_DEFS.kastbana.cost).toEqual({ wood: 130 });
    expect(BUILDING_DEFS.kastbana.menu).toBe('army');
    expect(UNIT_DEFS.samlare.builds).toContain('kastbana');
    expect(BUILDING_DEFS.krigshall.trains).not.toContain('ramkastare');
  });

  it('is weak at close quarters and strong from a distance', () => {
    expect(RANGED.damage).toBe(8);
    expect(THROWER.damage).toBe(3);
    expect(RANGED.damage).toBeGreaterThan(THROWER.damage * 2);
    // Against a Ramkrigare, which strikes for 10 and has 100 life and armour.
    expect(THROWER.damage).toBeLessThan(WARRIOR.damage / 2);
    expect(THROWER.hp).toBeLessThan(WARRIOR.hp);
    expect(THROWER.armor).toBeLessThan(WARRIOR.armor);
  });

  it('throws further than a watchtower shoots, and sees further than it throws', () => {
    expect(RANGED.range).toBe(7);
    expect(RANGED.range).toBeGreaterThan(TOWER.attack!.range);
    expect(THROWER.sight).toBeGreaterThan(RANGED.range);
  });

  it('notices enemies as far away as it can throw, and is slower than a Ramkrigare', () => {
    expect(THROWER.aggroRadius).toBe(RANGED.range);
    expect(THROWER.speed).toBeLessThan(WARRIOR.speed);
  });

  it('is the only unit that fights from a distance', () => {
    const ranged = Object.entries(UNIT_DEFS).filter(([, def]) => def.ranged !== undefined);
    expect(ranged.map(([type]) => type)).toEqual(['ramkastare']);
  });
});

describe('how far a throw is', () => {
  it('to a unit: between the two', () => {
    const state = openState(20, 20);
    const thrower = createUnit(state, 'ramkastare', 0, 3, 10);
    const enemy = createUnit(state, 'samlare', 1, 9, 10);
    expect(throwDistance(thrower, enemy)).toBe(6);
  });

  it('to a building: to the nearest edge of its footprint, not to its middle', () => {
    const state = openState(30, 30);
    const hall = createBuilding(state, 'krigshall', 1, 10, 10);
    // Three tiles wide: its edges are at 10 and 13.
    expect(throwDistance({ x: 5.5, y: 11.5 }, hall)).toBe(4.5);
    expect(throwDistance({ x: 16.5, y: 11.5 }, hall)).toBe(3.5);
    expect(throwDistance({ x: 11.5, y: 20 }, hall)).toBe(7);
    // From beyond a corner: to the corner.
    expect(throwDistance({ x: 16, y: 17 }, hall)).toBe(5);
    // On it: no distance at all.
    expect(throwDistance({ x: 11.5, y: 11.5 }, hall)).toBe(0);
  });
});

describe('throwing', () => {
  it('throws at once at an enemy within range, without taking a step, then every 1.8 seconds', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    // A Samlare stands where it is: it does not fight on its own.
    const enemy = createUnit(state, 'samlare', 1, 11, 10);
    enemy.hp = 1000;
    attack(state, [thrower], enemy.id);
    const thrownAt: number[] = [];
    for (let i = 0; i < 4 * throwTicks(thrower); i++) {
      tick(state);
      if (shots(state.events).length > 0) thrownAt.push(state.tick);
    }
    expect(throwTicks(thrower)).toBe(36);
    expect(thrownAt).toEqual([1, 37, 73, 109]);
    expect(unitTile(thrower)).toEqual({ x: 5, y: 10 });
  });

  it('sends a javelin that flies 10 tiles a second and takes 8 less the armour when it lands', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'ramkrigare', 1, 11, 10);
    attack(state, [thrower], enemy.id);
    tick(state);
    expect(state.projectiles).toHaveLength(1);
    const [javelin] = state.projectiles;
    expect(javelin).toMatchObject({
      kind: 'javelin',
      owner: 0,
      sourceId: thrower.id,
      targetId: enemy.id,
      startX: 5.5,
      startY: 10.5,
      damage: 8,
    });
    expect(javelin!.speed).toBeCloseTo(RANGED.projectileSpeed / SECOND);
    // Nothing has landed yet.
    expect(enemy.hp).toBe(WARRIOR.hp);
    const events = run(state, SECOND);
    expect(landed(events)).toMatchObject([{ targetId: enemy.id, damage: 8 - WARRIOR.armor }]);
    expect(enemy.hp).toBe(WARRIOR.hp - 7);
  });

  it('walks towards a distant enemy and stops as soon as it is within 7 tiles', () => {
    const state = openState(40, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 3, 10);
    const enemy = createUnit(state, 'samlare', 1, 30, 10);
    enemy.hp = 1000;
    attack(state, [thrower], enemy.id);
    let first: number | undefined;
    for (let i = 0; i < 30 * SECOND && first === undefined; i++) {
      tick(state);
      if (shots(state.events).length > 0)
        first = tileDistance(thrower.x, thrower.y, enemy.x, enemy.y);
    }
    expect(first).toBeDefined();
    expect(first!).toBeLessThanOrEqual(RANGED.range);
    // No closer than it must: within a step or two of the rim.
    expect(first!).toBeGreaterThan(RANGED.range - 0.5);
    const at = { x: thrower.x, y: thrower.y };
    run(state, 5 * SECOND);
    expect({ x: thrower.x, y: thrower.y }).toEqual(at);
  });

  it('follows an enemy that walks out of range', () => {
    const state = openState(40, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'samlare', 1, 11, 10);
    enemy.hp = 1000;
    attack(state, [thrower], enemy.id);
    run(state, 2);
    applyCommand(state, { type: 'move', player: 1, unitIds: [enemy.id], x: 30, y: 10 });
    run(state, 20 * SECOND);
    expect(unitTile(enemy)).toEqual({ x: 30, y: 10 });
    expect(tileDistance(thrower.x, thrower.y, enemy.x, enemy.y)).toBeLessThanOrEqual(RANGED.range);
    expect(thrower.task).toMatchObject({ kind: 'attack', targetId: enemy.id, threw: true });
  });

  it('several throwers stand on tiles of their own, all within range', () => {
    const state = openState(40, 30);
    const throwers = [0, 1, 2, 3, 4, 5].map((i) => createUnit(state, 'ramkastare', 0, 2, 8 + i));
    const enemy = createUnit(state, 'samlare', 1, 25, 10);
    enemy.hp = 100000;
    attack(state, throwers, enemy.id);
    run(state, 25 * SECOND);
    const tiles = throwers.map((thrower) => unitTile(thrower));
    expect(new Set(tiles.map((tile) => `${tile.x},${tile.y}`)).size).toBe(throwers.length);
    for (const thrower of throwers) {
      expect(thrower.path).toEqual([]);
      const distance = tileDistance(thrower.x, thrower.y, enemy.x, enemy.y);
      expect(distance).toBeLessThanOrEqual(RANGED.range);
      // Along the rim, not crowding in on the target.
      expect(distance).toBeGreaterThan(RANGED.range - 2.5);
      expect(thrower.task).toMatchObject({ kind: 'attack', threw: true });
    }
  });

  it('an idle Ramkastare throws at an enemy unit that comes within 7 tiles, on its own', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    createUnit(state, 'samlare', 1, 13, 10);
    expect(shots(run(state, SECOND))).toHaveLength(0);
    const near = createUnit(state, 'samlare', 1, 12, 10);
    const events = run(state, SECOND);
    expect(shots(events)).toMatchObject([{ sourceId: thrower.id, targetId: near.id }]);
  });

  it('throws only at what its side can see', () => {
    const state = openState(40, 30);
    state.fogEnabled = true;
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'samlare', 1, 20, 10);
    tick(state);
    expect(attack(state, [thrower], enemy.id)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('a javelin whose target surrenders before it lands is taken away', () => {
    const state = openState(30, 30);
    addCave(state, 1, 28, 28);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'samlare', 1, 12, 10);
    enemy.hp = 8;
    attack(state, [thrower], enemy.id);
    // One javelin is enough; the second is thrown before it lands only if the first has not.
    const events = run(state, 3 * SECOND);
    expect(hasSurrendered(enemy)).toBe(true);
    expect(landed(events)).toHaveLength(1);
    expect(state.projectiles).toHaveLength(0);
    expect(thrower.task.kind).toBe('idle');
  });

  it('gives the same result every time', () => {
    const play = () => {
      const state = openState(40, 30);
      addCave(state, 1, 38, 28);
      addCave(state, 0, 1, 1);
      const mine = [0, 1, 2].map((i) => createUnit(state, 'ramkastare', 0, 3, 8 + i * 2));
      const theirs = [0, 1].map((i) => createUnit(state, 'ramkrigare', 1, 25, 9 + i * 2));
      attack(state, mine, theirs[0]!.id);
      run(state, 40 * SECOND);
      return JSON.stringify(state.entities);
    };
    expect(play()).toBe(play());
  });
});

describe('at close quarters', () => {
  it('strikes an enemy unit on a tile next to its own, for 3, and does not throw', () => {
    const state = openState(20, 20);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'samlare', 1, 6, 10);
    enemy.hp = 1000;
    expect(attackMode(thrower, enemy)).toBe('strike');
    expect(strikeDamage(state, thrower, enemy)).toBe(3);
    attack(state, [thrower], enemy.id);
    const events = run(state, 4 * SECOND);
    expect(shots(events)).toHaveLength(0);
    // At once, and then every 1.8 seconds.
    expect(struck(events)).toHaveLength(3);
    expect(struck(events)[0]).toMatchObject({ attackerId: thrower.id, damage: 3 });
    expect(thrower.task).toMatchObject({ kind: 'attack', threw: false });
  });

  it('diagonal neighbours are at close quarters too; two tiles away is not', () => {
    const state = openState(20, 20);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    expect(attackMode(thrower, createUnit(state, 'samlare', 1, 6, 11))).toBe('strike');
    expect(attackMode(thrower, createUnit(state, 'samlare', 1, 7, 10))).toBe('throw');
  });

  it('goes over to striking when the enemy it throws at gets up to it', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    thrower.hp = 1000;
    const enemy = createUnit(state, 'ramkrigare', 1, 12, 10);
    enemy.hp = 1000;
    attack(state, [thrower], enemy.id);
    attack(state, [enemy], thrower.id);
    const events = run(state, 12 * SECOND);
    const mine = (event: SimEvent) =>
      (event.type === 'shot' && event.sourceId === thrower.id) ||
      (event.type === 'hit' && event.attackerId === thrower.id);
    const kinds = events.filter(mine).map((event) => event.type);
    expect(kinds.slice(0, 2)).toEqual(['shot', 'shot']);
    expect(kinds.at(-1)).toBe('hit');
    // Once it has started to strike it does not throw again.
    expect(kinds.lastIndexOf('shot')).toBeLessThan(kinds.indexOf('hit'));
  });

  it('a Ramkrigare and a Samlare never throw', () => {
    const state = openState(20, 20);
    const warrior = createUnit(state, 'ramkrigare', 0, 5, 10);
    const worker = createUnit(state, 'samlare', 0, 5, 12);
    const enemy = createUnit(state, 'samlare', 1, 9, 10);
    expect(attackMode(warrior, enemy)).toBe('strike');
    expect(attackMode(worker, enemy)).toBe('strike');
    expect(throwTicks(warrior)).toBe(0);
    expect(throwDamage(state, warrior)).toBe(0);
  });
});

describe('throwing at buildings', () => {
  it('throws at a building from 7 tiles from its nearest edge, and it loses 8 for each javelin', () => {
    const state = openState(40, 30);
    const hall = createBuilding(state, 'krigshall', 1, 20, 10);
    const thrower = createUnit(state, 'ramkastare', 0, 3, 11);
    attack(state, [thrower], hall.id);
    let first: SimEvent[] = [];
    for (let i = 0; i < 30 * SECOND && first.length === 0; i++) {
      tick(state);
      first = shots(state.events);
    }
    expect(first).toHaveLength(1);
    expect(throwDistance(thrower, hall)).toBeLessThanOrEqual(RANGED.range);
    expect(throwDistance(thrower, hall)).toBeGreaterThan(RANGED.range - 0.5);
    const events = run(state, 2 * SECOND);
    const centre = buildingCentre(hall);
    expect(landed(events)[0]).toMatchObject({
      targetId: hall.id,
      x: centre.x,
      y: centre.y,
      damage: 8,
    });
    expect(events.filter((event) => event.type === 'buildingAttacked').length).toBeGreaterThan(0);
    expect(hall.hp).toBeLessThan(BUILDING_DEFS.krigshall.hp);
  });

  it('throws at a building it stands next to, too: it never strikes a building', () => {
    const state = openState(30, 30);
    const store = createBuilding(state, 'visthus', 1, 10, 10);
    const thrower = createUnit(state, 'ramkastare', 0, 9, 10);
    expect(attackMode(thrower, store)).toBe('throw');
    attack(state, [thrower], store.id);
    const events = run(state, 3 * SECOND);
    expect(struck(events)).toHaveLength(0);
    expect(shots(events).length).toBeGreaterThan(0);
  });

  it('brings a building down, and its tiles are free again', () => {
    const state = openState(30, 30);
    const den = createBuilding(state, 'ide', 1, 14, 10);
    den.hp = 20;
    const thrower = createUnit(state, 'ramkastare', 0, 6, 10);
    attack(state, [thrower], den.id);
    const events = run(state, 8 * SECOND);
    expect(events.some((event) => event.type === 'buildingCollapsed')).toBe(true);
    expect(state.entities).not.toContain(den);
    expect(state.projectiles).toHaveLength(0);
    expect(thrower.task.kind).toBe('idle');
  });

  it('a javelin that brings down a Storide wins the game', () => {
    const state = openState(30, 30);
    createBuilding(state, 'storide', 0, 1, 1);
    const base = createBuilding(state, 'storide', 1, 14, 10);
    base.hp = 5;
    const thrower = createUnit(state, 'ramkastare', 0, 6, 11);
    attack(state, [thrower], base.id);
    run(state, 3 * SECOND);
    expect(state.winner).toBe(0);
  });

  it('an idle Ramkastare does not throw at buildings on its own', () => {
    const state = openState(30, 30);
    createBuilding(state, 'visthus', 1, 10, 10);
    createUnit(state, 'ramkastare', 0, 6, 10);
    expect(shots(run(state, 3 * SECOND))).toHaveLength(0);
  });
});

describe('upgrades and throwing', () => {
  it('each level of Vapen adds 2 to the throw and to the strike', () => {
    const state = openState(20, 20);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    expect(UPGRADE_DEFS.weapons.units).toContain('ramkastare');
    expect(throwDamage(state, thrower)).toBe(8);
    state.players[0]!.upgrades.weapons = 1;
    expect(throwDamage(state, thrower)).toBe(10);
    state.players[0]!.upgrades.weapons = 2;
    expect(throwDamage(state, thrower)).toBe(12);
    const enemy = createUnit(state, 'samlare', 1, 6, 10);
    expect(strikeDamage(state, thrower, enemy)).toBe(7);
  });

  it('a javelin keeps the damage it was thrown with', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'samlare', 1, 12, 10);
    enemy.hp = 1000;
    state.players[0]!.upgrades.weapons = 2;
    attack(state, [thrower], enemy.id);
    tick(state);
    state.players[0]!.upgrades.weapons = 0;
    expect(landed(run(state, SECOND))).toMatchObject([{ damage: 12 }]);
  });

  it("Rustning takes off a javelin as it does off a strike: the target's armour when it lands", () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const enemy = createUnit(state, 'ramkrigare', 1, 12, 10);
    enemy.hp = 1000;
    expect(UPGRADE_DEFS.armor.units).toContain('ramkastare');
    state.players[1]!.upgrades.armor = 2;
    attack(state, [thrower], enemy.id);
    tick(state);
    expect(landed(run(state, SECOND))).toMatchObject([{ damage: 8 - (WARRIOR.armor + 2) }]);
  });
});

describe('being thrown at', () => {
  it('an idle Ramkrigare that is hit from beyond the 6 tiles it notices enemies at turns on the thrower', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const warrior = createUnit(state, 'ramkrigare', 1, 12, 10);
    expect(tileDistance(thrower.x, thrower.y, warrior.x, warrior.y)).toBeGreaterThan(
      WARRIOR.aggroRadius,
    );
    // It stands idle until the first javelin lands.
    tick(state);
    expect(warrior.task.kind).toBe('idle');
    run(state, SECOND);
    expect(warrior.task).toMatchObject({ kind: 'attack', targetId: thrower.id });
  });

  it('a Samlare that is hit does not: it only fights on order', () => {
    const state = openState(30, 30);
    createUnit(state, 'ramkastare', 0, 5, 10);
    const worker = createUnit(state, 'samlare', 1, 12, 10);
    run(state, 2 * SECOND);
    expect(worker.hp).toBeLessThan(UNIT_DEFS.samlare.hp);
    expect(worker.task.kind).toBe('idle');
  });

  it('a unit that is busy with something else carries on with it', () => {
    const state = openState(30, 30);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    thrower.hp = 1000;
    const warrior = createUnit(state, 'ramkrigare', 1, 12, 10);
    applyCommand(state, { type: 'move', player: 1, unitIds: [warrior.id], x: 12, y: 25 });
    run(state, 2 * SECOND);
    expect(warrior.hp).toBeLessThan(WARRIOR.hp);
    expect(warrior.task.kind).toBe('idle');
    expect(warrior.path.length).toBeGreaterThan(0);
  });
});

describe('rock, paper, scissors', () => {
  it('Ramkastare beat a Vakttorn: four tear one down in about half a minute and are never shot at', () => {
    const state = openState(40, 30);
    const tower = createBuilding(state, 'vakttorn', 1, 25, 14);
    const throwers = [0, 1, 2, 3].map((i) => createUnit(state, 'ramkastare', 0, 3, 12 + i));
    attack(state, throwers, tower.id);
    let first: number | undefined;
    let fell: number | undefined;
    const events: SimEvent[] = [];
    for (let i = 0; i < 90 * SECOND && fell === undefined; i++) {
      tick(state);
      events.push(...state.events);
      if (first === undefined && shots(state.events).length > 0) first = state.tick;
      if (!state.entities.includes(tower)) fell = state.tick;
    }
    expect(fell).toBeDefined();
    // The tower never got to shoot: every shot was a thrower's.
    expect(
      shots(events).every((event) => event.type === 'shot' && event.sourceId !== tower.id),
    ).toBe(true);
    for (const thrower of throwers) expect(thrower.hp).toBe(THROWER.hp);
    const seconds = (fell! - first!) / SECOND;
    expect(seconds).toBeGreaterThan(25);
    expect(seconds).toBeLessThan(35);
  });

  it('a Ramkrigare beats a Ramkastare: it takes two javelins on its way up and wins with most of its life', () => {
    const state = openState(40, 30);
    addCave(state, 0, 1, 1);
    const thrower = createUnit(state, 'ramkastare', 0, 5, 10);
    const warrior = createUnit(state, 'ramkrigare', 1, 12, 10);
    attack(state, [warrior], thrower.id);
    const events: SimEvent[] = [];
    let firstStrike: number | undefined;
    for (let i = 0; i < 60 * SECOND && !hasSurrendered(thrower); i++) {
      tick(state);
      events.push(...state.events);
      const blow = struck(state.events).some(
        (event) => event.type === 'hit' && event.attackerId === warrior.id,
      );
      if (blow && firstStrike === undefined) firstStrike = events.length;
    }
    expect(hasSurrendered(thrower)).toBe(true);
    expect(hasSurrendered(warrior)).toBe(false);
    const javelinsOnTheWay = landed(events.slice(0, firstStrike)).length;
    expect(javelinsOnTheWay).toBeLessThanOrEqual(2);
    expect(warrior.hp).toBeGreaterThanOrEqual(70);
    expect(warrior.hp).toBeLessThan(WARRIOR.hp);
  });

  it('for the same price in resources, Ramkrigare beat Ramkastare in the open', () => {
    // Three of each: 180 food and 75 wood against 150 food and 120 wood.
    const state = openState(40, 30);
    addCave(state, 0, 1, 1);
    addCave(state, 0, 1, 28);
    addCave(state, 1, 38, 1);
    const throwers = [0, 1, 2].map((i) => createUnit(state, 'ramkastare', 0, 5, 8 + i * 2));
    const warriors = [0, 1, 2].map((i) => createUnit(state, 'ramkrigare', 1, 16, 8 + i * 2));
    warriors.forEach((warrior, i) => attack(state, [warrior], throwers[i]!.id));
    run(state, 90 * SECOND);
    expect(
      throwers.every((thrower) => hasSurrendered(thrower) || !state.entities.includes(thrower)),
    ).toBe(true);
    expect(warriors.filter((warrior) => !hasSurrendered(warrior)).length).toBeGreaterThanOrEqual(2);
  });

  it('a Vakttorn beats Ramkrigare: two that attack it are beaten before it falls', () => {
    const state = openState(40, 30);
    addCave(state, 0, 1, 1);
    const tower = createBuilding(state, 'vakttorn', 1, 25, 14);
    const warriors = [0, 1].map((i) => createUnit(state, 'ramkrigare', 0, 12, 13 + i * 2));
    attack(state, warriors, tower.id);
    run(state, 120 * SECOND);
    expect(state.entities).toContain(tower);
    expect(
      warriors.every((warrior) => hasSurrendered(warrior) || !state.entities.includes(warrior)),
    ).toBe(true);
  });
});
