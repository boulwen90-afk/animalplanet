import { describe, expect, it } from 'vitest';
import { BUILDING_DEFS } from '../../data/buildings';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, removeEntity, unitTile } from '../entities';
import { isWater } from '../map/grid';
import { reachableTiles } from '../pathfinding/astar';
import { buildPathGrid } from '../pathfinding/passability';
import type { Building, GameState, Unit } from '../state';
import { stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { canPlaceBuilding, placementProblem } from './construction';
import { plannedWorkTiles, workFocus, workTiles, workersAt } from './gathering';

const HUT = BUILDING_DEFS.fiskehytta;
const WORK = HUT.work!;
const CAPACITY = UNIT_DEFS.samlare.carryCapacity;
/** Simulation steps of fishing for one unit of food. */
const TICKS_PER_UNIT = WORK.secondsPerUnit * SIM_CONFIG.ticksPerSecond;
const MINUTE = 60 * SIM_CONFIG.ticksPerSecond;

const food = (state: GameState) => state.players[0]!.resources.food;
const wood = (state: GameState) => state.players[0]!.resources.wood;
const fish = (state: GameState, units: Unit[], hut: Building) =>
  applyCommand(state, {
    type: 'work',
    player: 0,
    unitIds: units.map((unit) => unit.id),
    buildingId: hut.id,
  });
const hutOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.siteId : undefined);
const placeOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.place : null);

/**
 * Open ground with a lake along its lower edge: rows 0 to 6 are grass and
 * rows 7 to 9 water. Row 6 is the shore.
 */
function lake(): GameState {
  return stateFromRows([
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    'WWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWW',
    'WWWWWWWWWWWWWWWW',
  ]);
}

/**
 * A hut on tiles 6..7, 5..6, with its lower side against the water. Its
 * fishing places are the shore tiles closest to it: (5, 6) and (8, 6) right
 * beside it, then (4, 6).
 */
function setup() {
  const state = lake();
  const hut = createBuilding(state, 'fiskehytta', 0, 6, 5);
  const worker = createUnit(state, 'samlare', 0, 3, 3);
  return { state, hut, worker };
}

describe('the data', () => {
  it('a fishing hut costs only wood, is built by workers and must stand by water', () => {
    expect(Object.keys(HUT.cost)).toEqual(['wood']);
    expect(UNIT_DEFS.samlare.builds).toContain('fiskehytta');
    expect(UNIT_DEFS.ramkrigare.builds).not.toContain('fiskehytta');
    expect(HUT.shore).toBe(true);
    expect(HUT.walkable).toBe(false);
  });

  it('fishing gives food faster than a field and more slowly than a berry bush', () => {
    expect(WORK.resource).toBe('food');
    expect(WORK.secondsPerUnit).toBeLessThan(BUILDING_DEFS.odling.work!.secondsPerUnit);
    // A worker takes 1 unit a second from a bush.
    expect(WORK.secondsPerUnit).toBeGreaterThan(1 / UNIT_DEFS.samlare.gatherRate);
  });

  it('a hut takes a limited number of workers, and the catch is carried to the hut', () => {
    expect(WORK.workers).toBeGreaterThan(1);
    expect(WORK.workers).toBeLessThanOrEqual(4);
    expect(WORK.places).toBe('shore');
    expect(WORK.deliverTo).toBe('here');
    // It is no storehouse: berries and wood are not left there.
    expect(HUT.dropoff).toBe(false);
  });
});

describe('where a fishing hut may stand', () => {
  it('with a side of its footprint against water', () => {
    const state = lake();
    expect(canPlaceBuilding(state, 'fiskehytta', 6, 5)).toBe(true);
    expect(placementProblem(state, 'fiskehytta', 6, 5)).toBeUndefined();
  });

  it('not one tile inland, and the reason is that it needs the shore', () => {
    const state = lake();
    expect(canPlaceBuilding(state, 'fiskehytta', 6, 4)).toBe(false);
    expect(placementProblem(state, 'fiskehytta', 6, 4)).toBe('needsShore');
    expect(placementProblem(state, 'fiskehytta', 2, 0)).toBe('needsShore');
  });

  it('not with water only corner to corner', () => {
    // One water tile at (5, 5); the hut on 3..4, 3..4 touches it only by a corner.
    const state = stateFromRows([
      '........',
      '........',
      '........',
      '........',
      '........',
      '.....W..',
      '........',
      '........',
    ]);
    expect(placementProblem(state, 'fiskehytta', 3, 3)).toBe('needsShore');
    // One step down it has the water on its right side.
    expect(placementProblem(state, 'fiskehytta', 3, 4)).toBeUndefined();
    // And above the water, on its lower side.
    expect(placementProblem(state, 'fiskehytta', 4, 3)).toBeUndefined();
  });

  it('not on the water itself, or on anything else in the way: that place is taken', () => {
    const state = lake();
    expect(placementProblem(state, 'fiskehytta', 6, 6)).toBe('blocked');
    expect(placementProblem(state, 'fiskehytta', 6, 8)).toBe('blocked');
    createUnit(state, 'samlare', 0, 7, 6);
    expect(placementProblem(state, 'fiskehytta', 6, 5)).toBe('blocked');
  });

  it('other buildings do not need water, and may stand by it', () => {
    const state = lake();
    expect(placementProblem(state, 'visthus', 6, 2)).toBeUndefined();
    expect(placementProblem(state, 'visthus', 6, 5)).toBeUndefined();
    expect(placementProblem(state, 'odling', 2, 0)).toBeUndefined();
  });

  it('an order to build it inland is refused with the reason, and costs nothing', () => {
    const state = lake();
    const worker = createUnit(state, 'samlare', 0, 3, 3);
    state.players[0]!.resources.wood = 500;
    const order = (x: number, y: number) =>
      applyCommand(state, {
        type: 'build',
        player: 0,
        unitIds: [worker.id],
        building: 'fiskehytta',
        x,
        y,
      });

    expect(order(6, 3)).toEqual({ ok: false, reason: 'invalidPlacement', problem: 'needsShore' });
    expect(order(6, 7)).toEqual({ ok: false, reason: 'invalidPlacement', problem: 'blocked' });
    expect(wood(state)).toBe(500);
    expect(state.entities.filter((e) => e.kind === 'building')).toHaveLength(0);

    expect(order(6, 5)).toEqual({ ok: true });
    expect(wood(state)).toBe(500 - HUT.cost.wood!);
  });
});

describe('the fishing places of a hut', () => {
  it('are the open tiles beside water closest to it, as many as it takes workers', () => {
    const { state, hut } = setup();
    expect(workTiles(state, buildPathGrid(state), hut)).toEqual([
      { x: 5, y: 6 },
      { x: 8, y: 6 },
      { x: 4, y: 6 },
    ]);
  });

  it('are never further from the hut than its reach', () => {
    // A hut by a pond of one tile: the three other tiles round the pond are the only shore.
    const state = stateFromRows([
      '........',
      '........',
      '........',
      '........',
      '........',
      '...W....',
      '........',
      '........',
    ]);
    const hut = createBuilding(state, 'fiskehytta', 0, 3, 3);
    const places = workTiles(state, buildPathGrid(state), hut);
    // The one right under the hut first, then the one off its corner, then the far side of the pond.
    expect(places).toEqual([
      { x: 4, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 6 },
    ]);
  });

  it('leave out a tile that something stands on', () => {
    const { state, hut } = setup();
    createBuilding(state, 'visthus', 0, 8, 5);
    const places = workTiles(state, buildPathGrid(state), hut);
    expect(places).toEqual([
      { x: 5, y: 6 },
      { x: 4, y: 6 },
      { x: 3, y: 6 },
    ]);
  });
});

describe('a stretch of shore that cannot be walked to', () => {
  /**
   * A hut on 3..4, 2..3 with water under it. The shore tile (5, 3) to its
   * right is shut in by rocks, the hut and the water; the shore to its left
   * is open.
   */
  function pocket() {
    const state = stateFromRows([
      '..........',
      '.....R....',
      '.....RR...',
      '......R...',
      'WWWWWWWWWW',
      'WWWWWWWWWW',
    ]);
    const hut = createBuilding(state, 'fiskehytta', 0, 3, 2);
    const worker = createUnit(state, 'samlare', 0, 1, 0);
    return { state, hut, worker };
  }

  it('is no fishing place for someone who cannot get there', () => {
    const { state, hut, worker } = pocket();
    const grid = buildPathGrid(state);
    // By the lie of the land alone it is one of the places: right beside the hut.
    expect(workTiles(state, grid, hut)).toContainEqual({ x: 5, y: 3 });
    const canReach = reachableTiles(grid, unitTile(worker));
    expect(workTiles(state, grid, hut, canReach)).toEqual([
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ]);
  });

  it('is not counted when a hut is planned there', () => {
    const { state, hut, worker } = pocket();
    removeEntity(state, hut.id);
    // What a hut on those tiles would give someone coming from where the worker stands.
    expect(plannedWorkTiles(state, 'fiskehytta', { x: 3, y: 2 }, unitTile(worker))).toEqual([
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 0, y: 3 },
    ]);
    // One step to the left the hut no longer closes the pocket, but it is still walled off by rock.
    expect(
      plannedWorkTiles(state, 'fiskehytta', { x: 2, y: 2 }, unitTile(worker)),
    ).not.toContainEqual({ x: 5, y: 3 });
    // A field is worked on its own tiles, wherever it stands.
    expect(plannedWorkTiles(state, 'odling', { x: 0, y: 0 }, unitTile(worker))).toEqual([
      { x: 0, y: 0 },
    ]);
  });

  it('a worker sent to the hut takes a place it can walk to, and fishes', () => {
    const { state, hut, worker } = pocket();
    const before = food(state);
    fish(state, [worker], hut);
    expect(placeOf(worker)).toEqual({ x: 2, y: 3 });
    advance(state, 3 * MINUTE);
    expect(hutOf(worker)).toBe(hut.id);
    expect(food(state)).toBeGreaterThan(before);
  });

  it('with no place it can walk to, the worker keeps doing what it did', () => {
    // The whole shore is behind rocks; only the hut's own tiles touch the water.
    const state = stateFromRows([
      '..........',
      'RRR..RRRRR',
      '..R..R....',
      '..R..R....',
      'WWWWWWWWWW',
    ]);
    const hut = createBuilding(state, 'fiskehytta', 0, 3, 2);
    const worker = createUnit(state, 'samlare', 0, 1, 0);
    expect(fish(state, [worker], hut)).toEqual({ ok: true });
    expect(worker.task.kind).toBe('idle');
    advance(state, 40);
    expect(worker.task.kind).toBe('idle');
  });
});

describe('a fisher that is not on its place', () => {
  it('walks back to it and goes on fishing at the same hut, not off to the berries', () => {
    const state = stateFromRows([
      '..B.............',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      'WWWWWWWWWWWWWWWW',
    ]);
    const hut = createBuilding(state, 'fiskehytta', 0, 6, 5);
    const worker = createUnit(state, 'samlare', 0, 3, 3);
    fish(state, [worker], hut);
    advance(state, 80);
    expect(worker.task).toMatchObject({ phase: 'gathering' });
    const place = placeOf(worker)!;

    // Something moves it away while it is on its way back from the hut:
    // it stands still, off its place, with nowhere to go.
    if (worker.task.kind === 'gather') worker.task.phase = 'toSource';
    worker.x = place.x + 0.5;
    worker.y = place.y - 2 + 0.5;
    worker.prevX = worker.x;
    worker.prevY = worker.y;
    worker.path = [];

    advance(state, 60);
    expect(hutOf(worker)).toBe(hut.id);
    expect(unitTile(worker)).toEqual(place);
    expect(worker.task).toMatchObject({ phase: 'gathering' });
  });
});

describe('fishing', () => {
  it('the worker walks to a place on the shore and fishes there, facing the water', () => {
    const { state, hut, worker } = setup();
    expect(fish(state, [worker], hut)).toEqual({ ok: true });
    expect(worker.task).toMatchObject({ kind: 'gather', resource: 'food', siteId: hut.id });
    advance(state, 80);
    expect(unitTile(worker)).toEqual({ x: 5, y: 6 });
    expect(worker.task).toMatchObject({ phase: 'gathering' });
    // The water it fishes in is the tile below its own.
    expect(workFocus(state, worker, hut)).toEqual({ x: 5.5, y: 7.5 });
  });

  it('gives one unit of food for every 1.6 seconds of fishing', () => {
    const { state, hut, worker } = setup();
    fish(state, [worker], hut);
    advance(state, 80);
    expect(worker.task).toMatchObject({ phase: 'gathering' });
    const had = worker.carryAmount;
    const ticksIn = worker.task.kind === 'gather' ? worker.task.workTicks : 0;
    advance(state, TICKS_PER_UNIT - ticksIn - 1);
    expect(worker.carryAmount).toBe(had);
    tick(state);
    expect(worker.carryAmount).toBe(had + 1);
    expect(worker.carryType).toBe('food');
  });

  it('the catch is carried to the hut, which needs no other building', () => {
    // There is no main building and no storehouse on this map at all.
    const { state, hut, worker } = setup();
    const before = food(state);
    fish(state, [worker], hut);
    advance(state, 80 + CAPACITY * TICKS_PER_UNIT + 40);
    expect(food(state)).toBe(before + CAPACITY);
    // And it goes on fishing from the same place.
    expect(hutOf(worker)).toBe(hut.id);
    expect(placeOf(worker)).toEqual({ x: 5, y: 6 });
  });

  it('the catch goes to the hut even when a storehouse is nearer', () => {
    const { state, hut } = setup();
    // The third place, (4, 6), is two tiles from the hut. A storehouse right above it is closer.
    const store = createBuilding(state, 'visthus', 0, 3, 4);
    const workers = [0, 1, 2].map((i) => createUnit(state, 'samlare', 0, 10 + i, 2));
    fish(state, workers, hut);
    const far = workers.find((w) => placeOf(w)?.x === 4)!;
    expect(far).toBeDefined();
    let delivered: number | null = null;
    for (let i = 0; i < 3 * MINUTE && delivered === null; i++) {
      tick(state);
      if (far.task.kind === 'gather' && far.task.phase === 'toDropoff')
        delivered = far.task.dropoffId;
    }
    expect(delivered).toBe(hut.id);
    expect(delivered).not.toBe(store.id);
  });

  it('never runs out: the food keeps coming, minute after minute', () => {
    const { state, hut, worker } = setup();
    fish(state, [worker], hut);
    advance(state, MINUTE);
    const perMinute: number[] = [];
    for (let minute = 0; minute < 6; minute++) {
      const before = food(state);
      advance(state, MINUTE);
      perMinute.push(food(state) - before);
    }
    expect(Math.min(...perMinute)).toBeGreaterThan(0);
    expect(hutOf(worker)).toBe(hut.id);
  });

  it('brings in more food a minute than a field and less than a berry bush', () => {
    const { state, hut } = setup();
    // The three fishers of a hut, over ten minutes.
    const workers = [0, 1, 2].map((i) => createUnit(state, 'samlare', 0, 10 + i, 2));
    fish(state, workers, hut);
    advance(state, MINUTE);
    const before = food(state);
    advance(state, 10 * MINUTE);
    const perWorker = (food(state) - before) / 10 / workers.length;
    // A field gives 24 a minute to a worker who never has to walk, a bush 60.
    expect(perWorker).toBeGreaterThan(60 / BUILDING_DEFS.odling.work!.secondsPerUnit);
    expect(perWorker).toBeLessThan(60 * UNIT_DEFS.samlare.gatherRate);
  });

  it('nobody ever stands on the water', () => {
    const { state, hut } = setup();
    const workers = [0, 1, 2].map((i) => createUnit(state, 'samlare', 0, 10 + i, 2));
    fish(state, workers, hut);
    for (let i = 0; i < 3 * MINUTE; i++) {
      tick(state);
      for (const worker of workers) {
        const tile = unitTile(worker);
        expect(isWater(state.map, tile.x, tile.y), `step ${i}`).toBe(false);
      }
    }
  });
});

describe('the number of fishers at a hut is limited', () => {
  it('takes as many as it has places, each on a place of their own', () => {
    const { state, hut } = setup();
    const workers = [0, 1, 2, 3, 4].map((i) => createUnit(state, 'samlare', 0, 6 + i, 2));
    fish(state, workers, hut);

    expect(workersAt(state, hut.id)).toHaveLength(WORK.workers);
    const places = workersAt(state, hut.id).map((w) => `${placeOf(w)?.x},${placeOf(w)?.y}`);
    expect(new Set(places).size).toBe(WORK.workers);
    // The ones left over keep doing what they did: nothing.
    expect(workers.filter((w) => w.task.kind === 'idle')).toHaveLength(5 - WORK.workers);
  });

  it('stays at that number however long they fish', () => {
    const { state, hut } = setup();
    const workers = [0, 1, 2, 3, 4].map((i) => createUnit(state, 'samlare', 0, 6 + i, 2));
    for (let step = 0; step < 2 * MINUTE; step++) {
      // The player keeps ordering everyone to the hut.
      if (step % 40 === 0) fish(state, workers, hut);
      tick(state);
      expect(workersAt(state, hut.id).length, `step ${step}`).toBeLessThanOrEqual(WORK.workers);
    }
    expect(workersAt(state, hut.id)).toHaveLength(WORK.workers);
  });

  it('sends the ones left over to another hut of the side with room', () => {
    const { state, hut } = setup();
    const other = createBuilding(state, 'fiskehytta', 0, 12, 5);
    const workers = [0, 1, 2, 3, 4].map((i) => createUnit(state, 'samlare', 0, 6 + i, 2));
    fish(state, workers, hut);
    expect(workersAt(state, hut.id)).toHaveLength(3);
    expect(workersAt(state, other.id)).toHaveLength(2);
    // No two of them share a place, also where the two huts reach the same shore.
    const places = workers.map((w) => `${placeOf(w)?.x},${placeOf(w)?.y}`);
    expect(new Set(places).size).toBe(5);
  });

  it("does not let the other side's workers in", () => {
    const { state, hut } = setup();
    const enemy = createUnit(state, 'samlare', 1, 3, 2);
    expect(
      applyCommand(state, { type: 'work', player: 1, unitIds: [enemy.id], buildingId: hut.id }),
    ).toEqual({ ok: false, reason: 'invalid' });
    expect(enemy.task.kind).toBe('idle');
  });
});

describe('a hut as a building', () => {
  it('cannot be fished at until it is finished', () => {
    const { state, hut, worker } = setup();
    hut.complete = false;
    expect(fish(state, [worker], hut)).toEqual({ ok: false, reason: 'invalid' });
  });

  it('the one who builds it starts to fish when it stands finished', () => {
    const state = lake();
    const worker = createUnit(state, 'samlare', 0, 3, 3);
    state.players[0]!.resources.wood = 500;
    applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [worker.id],
      building: 'fiskehytta',
      x: 6,
      y: 5,
    });
    advance(state, (HUT.buildTime + 10) * SIM_CONFIG.ticksPerSecond);
    const hut = state.entities.find((e): e is Building => e.kind === 'building')!;
    expect(hut.complete).toBe(true);
    expect(hutOf(worker)).toBe(hut.id);
  });

  it('is no place to leave berries: a berry picker with only a hut has nowhere to go', () => {
    const state = stateFromRows([
      '..........',
      '....B.....',
      '..........',
      '..........',
      '..........',
      'WWWWWWWWWW',
    ]);
    createBuilding(state, 'fiskehytta', 0, 6, 3);
    const picker = createUnit(state, 'samlare', 0, 3, 1);
    const before = food(state);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [picker.id], x: 4, y: 1 });
    advance(state, 2 * MINUTE);
    expect(food(state)).toBe(before);
    expect(picker.carryAmount).toBe(CAPACITY);
  });

  it('when the hut is lost, its fishers go to another hut with room, or stop', () => {
    const { state, hut, worker } = setup();
    fish(state, [worker], hut);
    advance(state, 80);
    removeEntity(state, hut.id);
    advance(state, 5);
    expect(worker.task.kind).toBe('idle');

    const { state: two, hut: first, worker: fisher } = setup();
    const second = createBuilding(two, 'fiskehytta', 0, 11, 5);
    fish(two, [fisher], first);
    advance(two, 80);
    removeEntity(two, first.id);
    advance(two, 5);
    expect(hutOf(fisher)).toBe(second.id);
  });
});
