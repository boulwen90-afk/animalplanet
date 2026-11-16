import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { buildingCentre, createBuilding, createUnit, hasSurrendered } from '../entities';
import type { Building, GameState, SimEvent, Unit } from '../state';
import { addCave, openState } from '../testUtils';
import { advance, tick } from '../tick';
import { shootingTarget, shotDamage, shotTicks } from './shooting';
import { isTileVisible, updateVisibility } from './visibility';

const TOWER = BUILDING_DEFS.vakttorn;
const ATTACK = TOWER.attack!;
const SECOND = SIM_CONFIG.ticksPerSecond;

/** An open map with a finished watchtower of side 0 in the middle. */
function setup() {
  const state = openState(30, 30);
  const tower = createBuilding(state, 'vakttorn', 0, 14, 14);
  return { state, tower };
}

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
const hits = (events: SimEvent[]) => events.filter((event) => event.type === 'projectileHit');

describe('the data', () => {
  it('a watchtower stands on one tile, costs wood, and is built by Samlare', () => {
    expect(TOWER.size).toBe(1);
    expect(TOWER.cost).toEqual({ wood: 120 });
    expect(UNIT_DEFS.samlare.builds).toContain('vakttorn');
    expect(UNIT_DEFS.ramkrigare.builds).not.toContain('vakttorn');
  });

  it('sees further than it shoots, so that it never shoots at what it cannot see', () => {
    expect(ATTACK.range).toBe(6);
    expect(TOWER.sight).toBeGreaterThan(ATTACK.range);
  });

  it('is the only building that shoots', () => {
    const shooters = Object.entries(BUILDING_DEFS).filter(([, def]) => def.attack !== undefined);
    expect(shooters.map(([type]) => type)).toEqual(['vakttorn']);
  });
});

describe('whom a watchtower shoots at', () => {
  it('the nearest enemy unit within its range', () => {
    const { state, tower } = setup();
    const far = createUnit(state, 'ramkrigare', 1, 19, 14);
    const near = createUnit(state, 'samlare', 1, 14, 17);
    expect(shootingTarget(state, tower)).toBe(near);
    // The nearest one, whatever kind it is and whoever came first.
    near.x += 4;
    expect(shootingTarget(state, tower)).toBe(far);
  });

  it('nobody outside its range, measured from its middle', () => {
    const { state, tower } = setup();
    const centre = buildingCentre(tower);
    const unit = createUnit(state, 'ramkrigare', 1, 14, 14);
    unit.x = centre.x + ATTACK.range + 0.01;
    unit.y = centre.y;
    expect(shootingTarget(state, tower)).toBeUndefined();
    unit.x = centre.x + ATTACK.range;
    expect(shootingTarget(state, tower)).toBe(unit);
  });

  it('never its own side, a unit that has surrendered, or a building', () => {
    const { state, tower } = setup();
    createUnit(state, 'ramkrigare', 0, 15, 15);
    createBuilding(state, 'visthus', 1, 16, 16);
    const beaten = createUnit(state, 'ramkrigare', 1, 13, 13);
    beaten.task = { kind: 'flee', caveId: 1 };
    expect(shootingTarget(state, tower)).toBeUndefined();
    expect(shots(run(state, 5 * SECOND))).toHaveLength(0);
  });

  it('nobody while it is under construction', () => {
    const { state, tower } = setup();
    createUnit(state, 'ramkrigare', 1, 16, 14);
    tower.complete = false;
    expect(shootingTarget(state, tower)).toBeUndefined();
    expect(shots(run(state, 5 * SECOND))).toHaveLength(0);
    tower.complete = true;
    expect(shots(run(state, 5 * SECOND)).length).toBeGreaterThan(0);
  });
});

describe('how a watchtower shoots', () => {
  it('shoots at once when an enemy is in range, and then every 1.5 seconds', () => {
    const { state, tower } = setup();
    expect(ATTACK.cooldown).toBe(1.5);
    expect(shotTicks(tower)).toBe(30);
    const target = createUnit(state, 'ramkrigare', 1, 17, 14);
    const steps: number[] = [];
    for (let step = 0; step < 100; step++) {
      tick(state);
      if (state.events.some((event) => event.type === 'shot')) steps.push(step);
    }
    expect(steps).toEqual([0, 30, 60, 90]);
    expect(target.hp).toBeLessThan(UNIT_DEFS.ramkrigare.hp);
  });

  it('sends a projectile that flies 12 tiles a second from the tower to its target', () => {
    const { state, tower } = setup();
    expect(ATTACK.projectileSpeed).toBe(12);
    const target = createUnit(state, 'samlare', 1, 19, 14);
    const centre = buildingCentre(tower);
    tick(state);
    expect(state.projectiles).toHaveLength(1);
    const [projectile] = state.projectiles;
    expect(projectile).toMatchObject({
      owner: 0,
      sourceId: tower.id,
      targetId: target.id,
      startX: centre.x,
      startY: centre.y,
      damage: ATTACK.damage,
    });
    // Five tiles to go, at 0.6 tiles a step: it lands in the ninth step after it was shot.
    const distance = target.x - centre.x;
    expect(distance).toBe(5);
    const before = target.hp;
    let landed = -1;
    for (let step = 1; step <= 20 && landed < 0; step++) {
      tick(state);
      if (state.events.some((event) => event.type === 'projectileHit')) landed = step;
    }
    expect(landed).toBe(Math.ceil(distance / (ATTACK.projectileSpeed / SECOND)) - 1);
    expect(target.hp).toBe(before - ATTACK.damage);
    expect(state.projectiles).toHaveLength(0);
  });

  it('takes its damage less the target`s armour, and never less than 1', () => {
    const { state } = setup();
    const worker = createUnit(state, 'samlare', 1, 1, 1);
    const soldier = createUnit(state, 'ramkrigare', 1, 2, 1);
    expect(shotDamage(state, ATTACK.damage, worker)).toBe(ATTACK.damage - UNIT_DEFS.samlare.armor);
    expect(shotDamage(state, ATTACK.damage, soldier)).toBe(
      ATTACK.damage - UNIT_DEFS.ramkrigare.armor,
    );
    expect(shotDamage(state, 0, soldier)).toBe(1);
  });

  it('follows a target that moves, and still lands on it', () => {
    const { state, tower } = setup();
    const target = createUnit(state, 'samlare', 1, 18, 14);
    tick(state);
    applyCommand(state, { type: 'move', player: 1, unitIds: [target.id], x: 18, y: 19 });
    const events = run(state, 2 * SECOND);
    const [hit] = hits(events);
    expect(hit).toBeDefined();
    expect(hit).toMatchObject({ targetId: target.id });
    expect(tower.attackCooldown).toBeGreaterThan(0);
  });

  it('shoots a unit until it surrenders, and then leaves it alone', () => {
    const { state } = setup();
    addCave(state, 1, 27, 27);
    const target = createUnit(state, 'samlare', 1, 17, 14);
    const events = run(state, 12 * SECOND);
    expect(hasSurrendered(target)).toBe(true);
    // 40 life at 9 a shot: five shots.
    expect(hits(events)).toHaveLength(Math.ceil(UNIT_DEFS.samlare.hp / ATTACK.damage));
    expect(events.filter((event) => event.type === 'surrender')).toHaveLength(1);
    // No animal dies: it walks off to its cave, and nothing more is shot at it.
    const later = run(state, 5 * SECOND);
    expect(shots(later)).toHaveLength(0);
    expect(state.projectiles).toHaveLength(0);
  });

  it('a projectile whose target surrenders or leaves before it lands is taken away, harming nobody', () => {
    const { state } = setup();
    addCave(state, 1, 27, 27);
    const target = createUnit(state, 'samlare', 1, 19, 14);
    const bystander = createUnit(state, 'samlare', 1, 19, 15);
    tick(state);
    expect(state.projectiles).toHaveLength(1);
    state.entities.splice(state.entities.indexOf(target), 1);
    tick(state);
    expect(state.projectiles.every((p) => p.targetId !== target.id)).toBe(true);
    expect(
      hits(run(state, 10)).every(
        (hit) => hit.type !== 'projectileHit' || hit.targetId !== target.id,
      ),
    ).toBe(true);
    expect(bystander.hp).toBeLessThanOrEqual(UNIT_DEFS.samlare.hp);
  });

  it('two towers shoot each for itself, and may shoot the same unit', () => {
    const { state } = setup();
    createBuilding(state, 'vakttorn', 0, 16, 14);
    createUnit(state, 'ramkrigare', 1, 15, 17);
    expect(shots(run(state, 1))).toHaveLength(2);
  });

  it('gives the same result every time', () => {
    const play = () => {
      const { state } = setup();
      addCave(state, 1, 27, 27);
      createUnit(state, 'ramkrigare', 1, 18, 14);
      createUnit(state, 'samlare', 1, 14, 18);
      advance(state, 20 * SECOND);
      return JSON.stringify(state);
    };
    expect(play()).toBe(play());
  });
});

describe('a watchtower and the fog of war', () => {
  it('lets its side see 8 tiles around it', () => {
    const state = openState(30, 30);
    state.fogEnabled = true;
    const tower = createBuilding(state, 'vakttorn', 0, 14, 14);
    updateVisibility(state);
    expect(TOWER.sight).toBe(8);
    expect(isTileVisible(state, 0, 14 + 8, 14)).toBe(true);
    expect(isTileVisible(state, 0, 14 + 10, 14)).toBe(false);
    expect(isTileVisible(state, 1, 14, 14)).toBe(false);
    expect(tower.complete).toBe(true);
  });

  it('shoots only at what its side can see', () => {
    const state = openState(30, 30);
    state.fogEnabled = true;
    createBuilding(state, 'vakttorn', 0, 14, 14);
    createUnit(state, 'ramkrigare', 1, 17, 14);
    updateVisibility(state);
    // In sight of the tower itself: it shoots.
    expect(shots(run(state, 1))).toHaveLength(1);
  });
});

describe('a watchtower can be repaired', () => {
  it('like any other building, for half its price', () => {
    const { state, tower } = setup();
    tower.hp = TOWER.hp / 2;
    state.players[0]!.resources.wood = 100;
    const worker = createUnit(state, 'samlare', 0, 13, 14);
    expect(
      applyCommand(state, {
        type: 'repair',
        player: 0,
        unitIds: [worker.id],
        buildingId: tower.id,
      }),
    ).toEqual({ ok: true });
    advance(state, 60 * SECOND);
    expect(tower.hp).toBe(TOWER.hp);
    expect(100 - state.players[0]!.resources.wood).toBe(30);
  });

  it('goes on shooting while it is repaired and while it is damaged', () => {
    const { state, tower } = setup();
    tower.hp = 50;
    createUnit(state, 'ramkrigare', 1, 18, 14);
    expect(shots(run(state, 1))).toHaveLength(1);
  });
});

describe('a watchtower that falls', () => {
  it('stops shooting, and what it had in the air still lands', () => {
    const { state, tower } = setup();
    const target = createUnit(state, 'samlare', 1, 19, 14);
    tick(state);
    expect(state.projectiles).toHaveLength(1);
    state.entities.splice(state.entities.indexOf(tower as Building), 1);
    const events = run(state, 3 * SECOND);
    expect(hits(events)).toHaveLength(1);
    expect(shots(events)).toHaveLength(0);
    expect((target as Unit).hp).toBe(UNIT_DEFS.samlare.hp - ATTACK.damage);
  });
});
