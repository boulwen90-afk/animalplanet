import { describe, expect, it, vi } from 'vitest';
import { AI_CONFIG } from '../../data/ai';
import { BUILDING_DEFS } from '../../data/buildings';
import { MAP_GEN_CONFIG } from '../../data/map';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import {
  buildingCentre,
  createBuilding,
  createUnit,
  hasSurrendered,
  populationOf,
  populationRoom,
  reservedPopulation,
} from '../entities';
import { createGame } from '../game';
import { tileDistance } from '../map/grid';
import { resourceAmountAt, resourceAt, takeFromSource } from '../resources';
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

  it('builds fields or a fishing hut before the berries near its base run out, and then lives on them', () => {
    for (const seed of SEEDS) {
      const state = againstNobody(seed);
      const base = buildingsOf(state, 1, 'storide')[0]!;
      const centre = buildingCentre(base);
      const r = AI_CONFIG.fields.berryRadius;
      const bushes = () => {
        const found: { x: number; y: number; left: number }[] = [];
        for (let y = Math.floor(centre.y - r); y <= centre.y + r; y++) {
          for (let x = Math.floor(centre.x - r); x <= centre.x + r; x++) {
            if (resourceAt(state.map, x, y) !== 'food') continue;
            if (tileDistance(x, y, centre.x, centre.y) > r) continue;
            found.push({ x, y, left: resourceAmountAt(state.map, x, y) });
          }
        }
        return found;
      };
      const berriesNear = () => bushes().reduce((sum, bush) => sum + bush.left, 0);
      // Fields, and a fishing hut where it has water within reach.
      const fields = () =>
        state.entities.filter(
          (e): e is Building =>
            e.kind === 'building' &&
            e.owner === 1 &&
            e.complete &&
            BUILDING_DEFS[e.type].work?.resource === 'food',
        );
      const places = () =>
        fields().reduce((sum, b) => sum + (BUILDING_DEFS[b.type].work?.workers ?? 0), 0);

      // Some maps have berries for a whole match. Leave it 700, a little more
      // than where it starts on fields, so that this is about running low.
      for (const bush of bushes()) {
        const spare = berriesNear() - 700;
        if (spare > 0) takeFromSource(state.map, bush.x, bush.y, Math.min(spare, bush.left - 1));
      }
      expect(berriesNear(), `seed ${seed}`).toBeLessThanOrEqual(700);
      expect(berriesNear(), `seed ${seed}`).toBeGreaterThan(AI_CONFIG.fields.startWhenFoodLeft);
      // And the other side's main building cannot fall, so that the match goes on.
      buildingsOf(state, 0, 'storide')[0]!.hp = 1e9;

      let leftAtFirstField: number | undefined;
      for (let i = 0; i < 12 * MINUTE && berriesNear() > 0; i++) {
        tick(state);
        if (leftAtFirstField === undefined && fields().length > 0) leftAtFirstField = berriesNear();
      }
      expect(state.winner, `seed ${seed}`).toBeNull();
      expect(berriesNear(), `seed ${seed}`).toBe(0);
      // The first field stood finished while there were still berries to pick.
      expect(leftAtFirstField, `seed ${seed}`).toBeGreaterThan(0);

      // With the berries gone, workers are on the fields and food keeps coming in.
      advance(state, 2 * MINUTE);
      const farmers = unitsOf(state, 1, 'samlare').filter(
        (u) => u.task.kind === 'gather' && u.task.siteId !== null,
      );
      expect(places(), `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(farmers.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
    }
  });

  /** Empties the berry bushes near a side's base, so that it wants food without end at once. */
  const emptyBerries = (state: GameState, centre: { x: number; y: number }) => {
    const r = AI_CONFIG.fields.berryRadius;
    for (let y = Math.floor(centre.y - r); y <= centre.y + r; y++) {
      for (let x = Math.floor(centre.x - r); x <= centre.x + r; x++) {
        if (resourceAt(state.map, x, y) !== 'food') continue;
        if (tileDistance(x, y, centre.x, centre.y) > r) continue;
        takeFromSource(state.map, x, y, resourceAmountAt(state.map, x, y) - 1);
      }
    }
  };

  it('builds a fishing hut by the water near its base, and fills it with fishers', () => {
    // Every map has water near each start position.
    for (const seed of [1, 2, 3, 4]) {
      const state = againstNobody(seed);
      const base = buildingsOf(state, 1, 'storide')[0]!;
      const centre = buildingCentre(base);
      emptyBerries(state, centre);
      buildingsOf(state, 0, 'storide')[0]!.hp = 1e9;
      advance(state, 4 * MINUTE);
      const begun = state.entities.filter(
        (e): e is Building => e.kind === 'building' && e.owner === 1 && !e.complete,
      );
      advance(state, 2 * MINUTE);
      // It builds only where its workers can walk: nothing it began stays unfinished.
      for (const site of begun) {
        const now = state.entities.find((e) => e.id === site.id);
        if (now?.kind === 'building') expect(now.complete, `seed ${seed}, ${site.type}`).toBe(true);
      }

      const huts = buildingsOf(state, 1, 'fiskehytta');
      expect(huts, `seed ${seed}`).toHaveLength(AI_CONFIG.fishing.max);
      const hut = huts[0]!;
      expect(hut.complete, `seed ${seed}`).toBe(true);
      const middle = buildingCentre(hut);
      expect(
        tileDistance(middle.x, middle.y, centre.x, centre.y),
        `seed ${seed}`,
      ).toBeLessThanOrEqual(AI_CONFIG.fishing.reach);
      // It chose a shore with a place for every fisher, and uses them all.
      const fishers = unitsOf(state, 1, 'samlare').filter(
        (u) => u.task.kind === 'gather' && u.task.siteId === hut.id,
      );
      expect(fishers, `seed ${seed}`).toHaveLength(BUILDING_DEFS.fiskehytta.work!.workers);
    }
  });

  it('builds no fishing hut on a map without water, and lives on fields instead', () => {
    const { startWater, ...dry } = MAP_GEN_CONFIG;
    expect(startWater).toBeDefined();
    for (const seed of [1, 2]) {
      const state = createGame(seed, undefined, {
        ...dry,
        lakes: { count: 0, minSize: 1, maxSize: 1 },
      });
      expect(state.map.terrain).not.toContain('water');
      const base = buildingsOf(state, 1, 'storide')[0]!;
      emptyBerries(state, buildingCentre(base));
      buildingsOf(state, 0, 'storide')[0]!.hp = 1e9;
      advance(state, 6 * MINUTE);
      expect(buildingsOf(state, 1, 'fiskehytta'), `seed ${seed}`).toHaveLength(0);
      expect(buildingsOf(state, 1, 'odling').length, `seed ${seed}`).toBeGreaterThan(0);
    }
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

describe('repairs', () => {
  const repairersOf = (state: GameState, building: Building) =>
    state.entities.filter(
      (e): e is Unit =>
        e.kind === 'unit' && e.task.kind === 'repair' && e.task.buildingId === building.id,
    );
  /** A game a minute old, with the computer's main building at half its life. */
  const damagedBase = (seed: number) => {
    const state = againstNobody(seed);
    advance(state, MINUTE);
    const base = buildingsOf(state, 1, 'storide')[0]!;
    base.hp = BUILDING_DEFS.storide.hp / 2;
    state.players[1]!.resources.wood = 300;
    return { state, base };
  };

  it('mends a damaged building while its base is left in peace, until it is whole', () => {
    for (const seed of SEEDS) {
      const { state, base } = damagedBase(seed);
      advance(state, 2 * SECOND);
      expect(repairersOf(state, base), `seed ${seed}`).toHaveLength(AI_CONFIG.repair.workers);
      const hp = base.hp;
      advance(state, 20 * SECOND);
      expect(base.hp, `seed ${seed}`).toBeGreaterThan(hp);
      advance(state, 3 * MINUTE);
      expect(base.hp, `seed ${seed}`).toBe(BUILDING_DEFS.storide.hp);
      expect(repairersOf(state, base), `seed ${seed}`).toHaveLength(0);
    }
  });

  it('leaves a building alone that has lost only a little', () => {
    const state = againstNobody(1);
    advance(state, MINUTE);
    const base = buildingsOf(state, 1, 'storide')[0]!;
    base.hp = BUILDING_DEFS.storide.hp * (AI_CONFIG.repair.below + 0.02);
    state.players[1]!.resources.wood = 300;
    advance(state, 10 * SECOND);
    expect(repairersOf(state, base)).toHaveLength(0);
    expect(base.hp).toBe(BUILDING_DEFS.storide.hp * (AI_CONFIG.repair.below + 0.02));
  });

  it('does not repair while an enemy is near its base, and takes it up when the enemy is gone', () => {
    const { state, base } = damagedBase(1);
    const start = state.map.startPositions[1]!;
    // Inside the defended area, but too far off to notice anyone by itself.
    const intruder = createUnit(state, 'samlare', 0, start.x - 3, start.y + 9);
    const centre = buildingCentre(base);
    expect(tileDistance(intruder.x, intruder.y, centre.x, centre.y)).toBeLessThan(
      AI_CONFIG.defendRadius,
    );
    for (let i = 0; i < 20 * SECOND; i++) {
      tick(state);
      expect(repairersOf(state, base)).toHaveLength(0);
    }
    expect(base.hp).toBe(BUILDING_DEFS.storide.hp / 2);

    state.entities.splice(state.entities.indexOf(intruder), 1);
    advance(state, 2 * SECOND);
    expect(repairersOf(state, base)).toHaveLength(AI_CONFIG.repair.workers);
  });

  it('breaks off a repair when an enemy comes near, and its workers go back to work', () => {
    const { state, base } = damagedBase(1);
    advance(state, 5 * SECOND);
    const crew = repairersOf(state, base);
    expect(crew).toHaveLength(AI_CONFIG.repair.workers);
    const start = state.map.startPositions[1]!;
    createUnit(state, 'samlare', 0, start.x - 3, start.y + 9);
    advance(state, 2 * SECOND);
    expect(repairersOf(state, base)).toHaveLength(0);
    for (const worker of crew) expect(worker.task.kind).toBe('gather');
  });

  it('does not start without wood to pay with, and lets go when the wood runs out', () => {
    const { state, base } = damagedBase(1);
    const stock = state.players[1]!.resources;
    // Its workers bring wood in meanwhile; the test takes it away again.
    for (let i = 0; i < 5 * SECOND; i++) {
      stock.wood = Math.min(stock.wood, AI_CONFIG.repair.minWood - 1);
      tick(state);
      expect(repairersOf(state, base)).toHaveLength(0);
    }
    stock.wood = 300;
    advance(state, 2 * SECOND);
    const crew = repairersOf(state, base);
    expect(crew).toHaveLength(AI_CONFIG.repair.workers);

    // The wood runs out in the middle of the work.
    for (let i = 0; i < 5 * SECOND; i++) {
      stock.wood = 0;
      tick(state);
    }
    expect(repairersOf(state, base)).toHaveLength(0);
    for (const worker of crew) expect(worker.task.kind).toBe('gather');
  });
});

describe('watchtowers', () => {
  const towersOf = (state: GameState, owner: number) => buildingsOf(state, owner, 'vakttorn');
  // Against a side that does nothing the game is won before there is wood
  // to spare for a tower, so here the computer plays both sides.
  const bothSides = (seed: number) => createGame(seed, undefined, undefined, { ai: [0, 1] });

  it('builds a tower by its base, on the side that faces the enemy, once it has wood to spare', () => {
    for (const seed of SEEDS) {
      const state = bothSides(seed);
      let built: Building | undefined;
      for (let i = 0; i < 12 * MINUTE && !built; i++) {
        tick(state);
        built = towersOf(state, 1).find((tower) => tower.complete);
      }
      expect(built, `seed ${seed}`).toBeDefined();
      // It had a barracks first: soldiers come before towers.
      expect(buildingsOf(state, 1, 'krigshall'), `seed ${seed}`).toMatchObject([
        { complete: true },
      ]);
      const base = buildingCentre(buildingsOf(state, 1, 'storide')[0]!);
      const enemy = buildingCentre(buildingsOf(state, 0, 'storide')[0]!);
      const at = buildingCentre(built!);
      expect(tileDistance(at.x, at.y, base.x, base.y), `seed ${seed}`).toBeLessThanOrEqual(
        AI_CONFIG.towers.distance + 4,
      );
      // Nearer the enemy than its own main building is.
      expect(tileDistance(at.x, at.y, enemy.x, enemy.y), `seed ${seed}`).toBeLessThan(
        tileDistance(base.x, base.y, enemy.x, enemy.y),
      );
    }
  });

  it('never has more towers than the data file says, and does not replace one that falls', () => {
    const state = bothSides(1);
    let most = 0;
    for (let i = 0; i < 12 * MINUTE; i++) {
      tick(state);
      most = Math.max(most, towersOf(state, 1).length);
    }
    expect(most).toBe(AI_CONFIG.towers.max);
    expect(state.players[1]!.ai!.towersPlaced).toBe(AI_CONFIG.towers.max);

    for (const tower of towersOf(state, 1)) {
      state.entities.splice(state.entities.indexOf(tower), 1);
    }
    state.players[1]!.resources.wood = 1000;
    advance(state, MINUTE);
    expect(towersOf(state, 1)).toHaveLength(0);
  });

  it('does not build a tower before it has a barracks, however much wood it has', () => {
    const state = againstNobody(1);
    state.players[1]!.resources.wood = 1000;
    for (let i = 0; i < 3 * MINUTE; i++) {
      tick(state);
      const barracks = buildingsOf(state, 1, 'krigshall').some((b) => b.complete);
      if (!barracks) expect(towersOf(state, 1)).toHaveLength(0);
    }
  });

  it('its attackers tear down a tower that shoots at them before they go on to the main building', () => {
    const state = againstNobody(1);
    const home = buildingsOf(state, 0, 'storide')[0]!;
    const centre = buildingCentre(home);
    // A tower of the player's by its main building, on the way the attackers come.
    const enemyBase = buildingCentre(buildingsOf(state, 1, 'storide')[0]!);
    const dx = Math.sign(enemyBase.x - centre.x);
    const dy = Math.sign(enemyBase.y - centre.y);
    const tower = createBuilding(state, 'vakttorn', 0, home.x + 1 + dx * 4, home.y + 1 + dy * 4);

    let attackedTower = false;
    let towerFell = -1;
    for (let i = 0; i < 9 * MINUTE && state.winner === null; i++) {
      tick(state);
      const attackers = unitsOf(state, 1, 'ramkrigare').filter(
        (unit) => unit.task.kind === 'attack' && unit.task.targetId === tower.id,
      );
      if (attackers.length > 0) attackedTower = true;
      if (towerFell < 0 && !state.entities.includes(tower)) towerFell = state.tick;
    }
    expect(attackedTower).toBe(true);
    expect(towerFell).toBeGreaterThan(0);
    // With the tower gone they went on: the main building is damaged or has fallen.
    const left = buildingsOf(state, 0, 'storide')[0];
    expect(left === undefined || left.hp < BUILDING_DEFS.storide.hp).toBe(true);
  });
});

describe('upgrades', () => {
  const bothSides = (seed: number) => createGame(seed, undefined, undefined, { ai: [0, 1] });
  /** A game where the computer has a finished Smedja by its base, and whatever stock the test gives it. */
  const withForge = (food: number, wood: number) => {
    const state = againstNobody(1);
    const base = buildingsOf(state, 1, 'storide')[0]!;
    const forge = createBuilding(state, 'smedja', 1, base.x - 4, base.y - 4);
    state.players[1]!.resources = { food, wood };
    return { state, base, forge };
  };

  it('builds a Smedja once it has a Krigshall and wood to spare', () => {
    for (const seed of SEEDS) {
      const state = bothSides(seed);
      let built = false;
      for (let i = 0; i < 14 * MINUTE && !built; i++) {
        tick(state);
        built = [0, 1].some((side) => buildingsOf(state, side, 'smedja').some((b) => b.complete));
      }
      expect(built, `seed ${seed}`).toBe(true);
      for (const side of [0, 1]) {
        if (buildingsOf(state, side, 'smedja').length === 0) continue;
        // A finished one: from ten minutes on it may have started on a second.
        expect(
          buildingsOf(state, side, 'krigshall').some((b) => b.complete),
          `seed ${seed}`,
        ).toBe(true);
        // One is enough.
        expect(buildingsOf(state, side, 'smedja'), `seed ${seed}`).toHaveLength(1);
      }
    }
  });

  it('works out the upgrades in the order of the data file, the first level of each first', () => {
    const { state, forge } = withForge(5000, 5000);
    const done: string[] = [];
    for (let i = 0; i < 6 * MINUTE && done.length < 6; i++) {
      tick(state);
      // Keep it in funds: this is about the order, not about what it can pay.
      state.players[1]!.resources = { food: 5000, wood: 5000 };
      for (const event of state.events) {
        if (event.type === 'upgradeDone' && event.owner === 1) {
          done.push(`${event.upgrade} ${event.level}`);
        }
      }
    }
    expect(done).toEqual([
      'weapons 1',
      'armor 1',
      'gathering 1',
      'weapons 2',
      'armor 2',
      'gathering 2',
    ]);
    // With everything worked out it orders nothing more.
    advance(state, 5 * SECOND);
    expect(forge.research).toEqual([]);
  });

  it('pays for what it works out', () => {
    const { state, forge } = withForge(300, 300);
    // Before it has a barracks it trains no soldiers, so the stock only goes to the upgrade.
    const workers = unitsOf(state, 1, 'samlare').length;
    advance(state, SECOND + 1);
    expect(forge.research).toEqual(['weapons']);
    const spent = (unitsOf(state, 1, 'samlare').length - workers) * UNIT_DEFS.samlare.cost.food!;
    expect(state.players[1]!.resources.food).toBeLessThanOrEqual(300 - 100 - spent);
    expect(state.players[1]!.resources.wood).toBeLessThanOrEqual(300 - 50);
  });

  it('with soldiers enough at home it saves for the next upgrade instead of training more', () => {
    const train = (soldiers: number) => {
      const { state, base } = withForge(0, 400);
      const hall = createBuilding(state, 'krigshall', 1, base.x - 4, base.y + 4);
      // Room for them all, and for one more.
      for (let i = 0; i < 3; i++) createBuilding(state, 'ide', 1, base.x - 8, base.y - 4 + i * 3);
      for (let i = 0; i < soldiers; i++) createUnit(state, 'ramkrigare', 1, base.x + 4 + i, base.y);
      // It trains a Samlare first, as always. What is left is enough for a
      // soldier and too little for the upgrade.
      state.players[1]!.resources.food = UNIT_DEFS.samlare.cost.food! + 90;
      advance(state, SECOND + 1);
      return hall.queue;
    };
    expect(train(AI_CONFIG.research.saveAbove)).toEqual([]);
    expect(train(AI_CONFIG.research.saveAbove - 1)).toEqual(['ramkrigare']);
  });

  it('works out an upgrade by itself in a long match', () => {
    for (const seed of SEEDS) {
      const state = bothSides(seed);
      let done = 0;
      for (let i = 0; i < 20 * MINUTE && state.winner === null; i++) {
        tick(state);
        done += state.events.filter((event) => event.type === 'upgradeDone').length;
      }
      expect(done, `seed ${seed}`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('javelin throwers', () => {
  const bothSides = (seed: number) => createGame(seed, undefined, undefined, { ai: [0, 1] });
  const soldiers = (state: GameState, owner: number) => ({
    warriors: unitsOf(state, owner, 'ramkrigare').length,
    throwers: unitsOf(state, owner, 'ramkastare').length,
  });

  it('builds a Kastbana once it has a Krigshall and a Visthus, and only one', () => {
    for (const seed of SEEDS) {
      const state = bothSides(seed);
      const done = () =>
        [0, 1].every((side) => buildingsOf(state, side, 'kastbana').some((b) => b.complete));
      for (let i = 0; i < 8 * MINUTE && !done() && state.winner === null; i++) tick(state);
      for (const side of [0, 1]) {
        expect(buildingsOf(state, side, 'kastbana'), `seed ${seed}`).toMatchObject([
          { complete: true },
        ]);
        expect(buildingsOf(state, side, 'krigshall'), `seed ${seed}`).toMatchObject([
          { complete: true },
        ]);
        expect(buildingsOf(state, side, 'visthus').length, `seed ${seed}`).toBeGreaterThan(0);
      }
    }
  });

  it('does not build a Kastbana before it has a Krigshall, however much wood it has', () => {
    const state = againstNobody(1);
    state.players[1]!.resources.wood = 1000;
    advance(state, 30 * SECOND);
    expect(buildingsOf(state, 1, 'krigshall')).toHaveLength(1);
    expect(buildingsOf(state, 1, 'kastbana')).toHaveLength(0);
  });

  it('trains one Ramkastare for every two Ramkrigare, never more', () => {
    const state = againstNobody(1);
    const share = AI_CONFIG.throwers.soldiersEach;
    expect(share).toBe(2);
    const queueOf = (type: string) =>
      buildingsOf(state, 1, type).reduce((sum, building) => sum + building.queue.length, 0);
    // With all it can use of food and wood, until just before the first wave
    // leaves: nobody has been lost yet.
    const until = AI_CONFIG.waves[0].earliest * SECOND - SECOND;
    while (state.tick < until) {
      state.players[1]!.resources = { food: 2000, wood: 2000 };
      tick(state);
      const { warriors, throwers } = soldiers(state, 1);
      expect((throwers + queueOf('kastbana')) * share).toBeLessThanOrEqual(
        warriors + queueOf('krigshall'),
      );
    }
    const { warriors, throwers } = soldiers(state, 1);
    expect(warriors).toBeGreaterThanOrEqual(6);
    // As many as its share allows, give or take the one in training.
    expect(throwers).toBeGreaterThanOrEqual(Math.floor(warriors / share) - 1);
    expect(throwers).toBeGreaterThanOrEqual(2);
  });

  it('counts both kinds as soldiers: it stops at the most it may have of them together', () => {
    const state = againstNobody(1);
    const base = buildingsOf(state, 1, 'storide')[0]!;
    createBuilding(state, 'krigshall', 1, base.x - 5, base.y - 5);
    createBuilding(state, 'kastbana', 1, base.x - 5, base.y + 4);
    for (let i = 0; i < 4; i++) createBuilding(state, 'ide', 1, base.x + 5, base.y + i * 3);
    for (let i = 0; i < AI_CONFIG.maxSoldiers; i++) {
      createUnit(
        state,
        i % 3 === 0 ? 'ramkastare' : 'ramkrigare',
        1,
        base.x - 8 + (i % 5),
        base.y + 8 + Math.floor(i / 5),
      );
    }
    state.players[1]!.resources = { food: 2000, wood: 2000 };
    advance(state, 5 * SECOND);
    for (const type of ['krigshall', 'kastbana']) {
      expect(buildingsOf(state, 1, type)[0]!.queue, type).toEqual([]);
    }
  });

  it('its throwers in a wave tear down a tower from outside its range, and are never shot at', () => {
    const state = againstNobody(1);
    const home = buildingsOf(state, 0, 'storide')[0]!;
    const centre = buildingCentre(home);
    const enemyBase = buildingCentre(buildingsOf(state, 1, 'storide')[0]!);
    const dx = Math.sign(enemyBase.x - centre.x);
    const dy = Math.sign(enemyBase.y - centre.y);
    // A tower of the player's by its main building, on the way the attackers come.
    const tower = createBuilding(state, 'vakttorn', 0, home.x + 1 + dx * 4, home.y + 1 + dy * 4);
    // Four throwers of the computer's, well outside the tower's range, sent as a wave.
    const from = { x: tower.x + dx * 16, y: tower.y + dy * 16 };
    const wave = [0, 1, 2, 3].map((i) =>
      createUnit(state, 'ramkastare', 1, from.x + (i % 2), from.y + Math.floor(i / 2)),
    );
    const memory = state.players[1]!.ai!;
    memory.attackers.push(...wave.map((unit) => unit.id));
    for (const unit of wave) unit.task = { kind: 'attack', targetId: home.id, repathTicks: 0 };

    let towerShot = false;
    for (let i = 0; i < 2 * MINUTE && state.entities.includes(tower); i++) {
      tick(state);
      if (state.events.some((event) => event.type === 'shot' && event.sourceId === tower.id)) {
        towerShot = true;
      }
    }
    expect(state.entities).not.toContain(tower);
    expect(towerShot).toBe(false);
    for (const unit of wave) expect(unit.hp).toBe(UNIT_DEFS.ramkastare.hp);
    // With the tower gone they go on to the main building.
    advance(state, 10 * SECOND);
    for (const unit of wave) {
      expect(unit.task).toMatchObject({ kind: 'attack', targetId: home.id });
    }
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
