import { describe, expect, it } from 'vitest';
import { GATHER_CONFIG, RESOURCE_DEFS } from '../../data/resources';
import { START_CONFIG } from '../../data/setup';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, unitTile } from '../entities';
import { createGame } from '../game';
import { resourceAmountAt, resourceAt } from '../resources';
import type { GameState, Unit } from '../state';
import { stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';

const CAPACITY = UNIT_DEFS.samlare.carryCapacity;
/** Simulation steps a Samlare works for one unit of resource. */
const TICKS_PER_UNIT = SIM_CONFIG.ticksPerSecond / UNIT_DEFS.samlare.gatherRate;
/** Steps to fill up when standing next to the source. */
const TICKS_TO_FILL = CAPACITY * TICKS_PER_UNIT;

/** Steps a Samlare needs, at most, to walk to the next tile. */
const WALK_ONE_TILE = Math.ceil(SIM_CONFIG.ticksPerSecond / UNIT_DEFS.samlare.speed) + 2;

const START_FOOD = START_CONFIG.resources.food;
const START_WOOD = START_CONFIG.resources.wood;

function gather(state: GameState, unit: Unit, x: number, y: number): void {
  applyCommand(state, { type: 'gather', player: unit.owner, unitIds: [unit.id], x, y });
}

/**
 * A Storide at tiles 1..3, 1..3, a berry bush at (5, 2) and a worker at
 * (4, 2), which is next to both.
 */
function adjacentSetup() {
  const state = stateFromRows(['.......', '.......', '.....B.', '.......', '.......']);
  createBuilding(state, 'storide', 0, 1, 1);
  const worker = createUnit(state, 'samlare', 0, 4, 2);
  return { state, worker };
}

describe('gathering next to both the source and the Storide', () => {
  it('delivers exactly 10 units after 200 steps, and nothing before', () => {
    const { state, worker } = adjacentSetup();
    expect(TICKS_TO_FILL).toBe(200);
    gather(state, worker, 5, 2);

    advance(state, TICKS_TO_FILL - 1);
    expect(state.players[0]!.resources.food).toBe(START_FOOD);
    expect(worker.carryAmount).toBe(CAPACITY - 1);

    tick(state);
    expect(state.players[0]!.resources.food).toBe(START_FOOD + CAPACITY);
    expect(worker.carryAmount).toBe(0);
  });

  it('takes one unit from the source every 20 steps', () => {
    const { state, worker } = adjacentSetup();
    gather(state, worker, 5, 2);
    for (let unitsTaken = 1; unitsTaken <= 5; unitsTaken++) {
      advance(state, TICKS_PER_UNIT - 1);
      expect(worker.carryAmount).toBe(unitsTaken - 1);
      tick(state);
      expect(worker.carryAmount).toBe(unitsTaken);
    }
  });

  it('the source shrinks by as much as the stock grows', () => {
    const { state, worker } = adjacentSetup();
    const full = RESOURCE_DEFS.food.amountPerNode;
    gather(state, worker, 5, 2);
    for (let i = 0; i < 700; i++) {
      tick(state);
      const delivered = state.players[0]!.resources.food - START_FOOD;
      const left = resourceAmountAt(state.map, 5, 2);
      expect(delivered + worker.carryAmount + left).toBe(full);
    }
    expect(state.players[0]!.resources.food).toBe(START_FOOD + 30);
  });

  it('keeps delivering a full load every 200 steps', () => {
    const { state, worker } = adjacentSetup();
    gather(state, worker, 5, 2);
    advance(state, 5 * TICKS_TO_FILL);
    expect(state.players[0]!.resources.food).toBe(START_FOOD + 5 * CAPACITY);
  });

  it('does not touch the other resource or the other player', () => {
    const { state, worker } = adjacentSetup();
    gather(state, worker, 5, 2);
    advance(state, 3 * TICKS_TO_FILL);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);
    expect(state.players[1]!.resources).toEqual(START_CONFIG.resources);
  });
});

describe('gathering with a walk', () => {
  it('walks to the source, fills up, walks home and delivers', () => {
    const state = stateFromRows([
      '............',
      '............',
      '..........T.',
      '............',
      '............',
    ]);
    createBuilding(state, 'storide', 0, 0, 1);
    const worker = createUnit(state, 'samlare', 0, 4, 2);
    gather(state, worker, 10, 2);
    expect(worker.task.kind).toBe('gather');

    // Walk 5 tiles to (9, 2): 40 steps at 0.125 tiles per step.
    advance(state, 40);
    expect(unitTile(worker)).toEqual({ x: 9, y: 2 });
    expect(worker.carryAmount).toBe(0);

    advance(state, TICKS_TO_FILL);
    expect(worker.carryAmount).toBe(CAPACITY);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);

    // Walk 6 tiles back to (3, 2), next to the Storide, and deliver on arrival.
    advance(state, 48);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD + CAPACITY);
    expect(worker.carryAmount).toBe(0);
    expect(worker.task).toMatchObject({ kind: 'gather', phase: 'toSource' });
  });

  it('delivers wood as wood and food as food', () => {
    const state = stateFromRows(['.......', '....T..', '.......', '....B..', '.......']);
    createBuilding(state, 'storide', 0, 0, 1);
    const woodcutter = createUnit(state, 'samlare', 0, 3, 1);
    const forager = createUnit(state, 'samlare', 0, 3, 3);
    gather(state, woodcutter, 4, 1);
    gather(state, forager, 4, 3);
    advance(state, TICKS_TO_FILL);
    expect(state.players[0]!.resources).toEqual({
      food: START_FOOD + CAPACITY,
      wood: START_WOOD + CAPACITY,
    });
  });

  it('several workers on one source stand on separate tiles', () => {
    const state = stateFromRows(['.......', '.......', '...B...', '.......', '.......']);
    createBuilding(state, 'storide', 0, 0, 0);
    const workers = [0, 1, 2].map((i) => createUnit(state, 'samlare', 0, 6, 1 + i));
    applyCommand(state, {
      type: 'gather',
      player: 0,
      unitIds: workers.map((w) => w.id),
      x: 3,
      y: 2,
    });
    advance(state, 60);
    const tiles = workers.map((w) => `${unitTile(w).x},${unitTile(w).y}`);
    expect(new Set(tiles).size).toBe(3);
    for (const worker of workers) {
      expect(worker.task).toMatchObject({ kind: 'gather', phase: 'gathering' });
    }
  });
});

describe('when a source runs out', () => {
  /** A bush with only a few units left at (5, 2), and optionally another one nearby. */
  function nearlyEmpty(rows: string[], left: number) {
    const state = stateFromRows(rows);
    createBuilding(state, 'storide', 0, 1, 1);
    state.map.resourceAmount[2 * state.map.width + 5] = left;
    const worker = createUnit(state, 'samlare', 0, 4, 2);
    return { state, worker };
  }

  it('removes the emptied source and turns its tile into open ground', () => {
    const { state, worker } = nearlyEmpty(
      ['.......', '.......', '.....B.', '.......', '.......'],
      3,
    );
    gather(state, worker, 5, 2);
    advance(state, 3 * TICKS_PER_UNIT);
    expect(resourceAt(state.map, 5, 2)).toBeUndefined();
    expect(resourceAmountAt(state.map, 5, 2)).toBe(0);
    expect(state.map.terrain[2 * 7 + 5]).toBe('grass');
  });

  it('an emptied tree becomes walkable', () => {
    const state = stateFromRows(['...', '.T.', '...']);
    createBuilding(state, 'storide', 0, 10, 10);
    state.map.resourceAmount[1 * 3 + 1] = 1;
    const worker = createUnit(state, 'samlare', 0, 0, 1);
    gather(state, worker, 1, 1);
    advance(state, TICKS_PER_UNIT);
    expect(state.map.terrain[4]).toBe('grass');

    applyCommand(state, { type: 'move', player: 0, unitIds: [worker.id], x: 1, y: 1 });
    advance(state, 40);
    expect(unitTile(worker)).toEqual({ x: 1, y: 1 });
  });

  it('moves on to the nearest source of the same kind', () => {
    const { state, worker } = nearlyEmpty(
      ['.......', '.......', '.....B.', '.......', '.....B.'],
      3,
    );
    gather(state, worker, 5, 2);
    advance(state, 3 * TICKS_PER_UNIT);
    expect(worker.task).toMatchObject({ kind: 'gather', node: { x: 5, y: 4 } });
    expect(worker.carryAmount).toBe(3);

    // It keeps what it had and fills the rest from the new source.
    advance(state, 400);
    expect(state.players[0]!.resources.food).toBeGreaterThanOrEqual(START_FOOD + CAPACITY);
    expect(resourceAmountAt(state.map, 5, 4)).toBeLessThan(RESOURCE_DEFS.food.amountPerNode);
  });

  it('does not switch to a source of another kind', () => {
    const { state, worker } = nearlyEmpty(
      ['.......', '.......', '.....B.', '.......', '.....T.'],
      3,
    );
    gather(state, worker, 5, 2);
    advance(state, 600);
    expect(worker.task.kind).toBe('idle');
    expect(resourceAmountAt(state.map, 5, 4)).toBe(RESOURCE_DEFS.wood.amountPerNode);
    expect(state.players[0]!.resources.wood).toBe(START_WOOD);
  });

  it('becomes idle when there is no other source nearby, after delivering its load', () => {
    const { state, worker } = nearlyEmpty(
      ['.......', '.......', '.....B.', '.......', '.......'],
      3,
    );
    gather(state, worker, 5, 2);
    advance(state, 3 * TICKS_PER_UNIT);
    // The last three units are delivered rather than lost.
    expect(state.players[0]!.resources.food).toBe(START_FOOD + 3);
    expect(worker.task.kind).toBe('idle');
    expect(worker.carryAmount).toBe(0);
    expect(worker.path).toEqual([]);

    advance(state, 200);
    expect(state.players[0]!.resources.food).toBe(START_FOOD + 3);
  });

  it('ignores a source further away than the search radius', () => {
    const rows = Array.from({ length: 5 }, () => '.'.repeat(20));
    rows[2] = '.....B............B.';
    const { state, worker } = nearlyEmpty(rows, 2);
    gather(state, worker, 5, 2);
    advance(state, 2 * TICKS_PER_UNIT + 200);
    // The other bush is 13 tiles away; the search radius is 8.
    expect(worker.task.kind).toBe('idle');
    expect(resourceAmountAt(state.map, 18, 2)).toBe(RESOURCE_DEFS.food.amountPerNode);
  });

  it('two workers emptying one source do not create resources out of nothing', () => {
    const state = stateFromRows(['.......', '.......', '.....B.', '.......', '.......']);
    createBuilding(state, 'storide', 0, 1, 1);
    state.map.resourceAmount[2 * 7 + 5] = 15;
    const a = createUnit(state, 'samlare', 0, 4, 2);
    const b = createUnit(state, 'samlare', 0, 4, 3);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [a.id, b.id], x: 5, y: 2 });
    advance(state, 1000);
    expect(state.players[0]!.resources.food).toBe(START_FOOD + 15);
    expect(a.task.kind).toBe('idle');
    expect(b.task.kind).toBe('idle');
  });
});

describe('the gather command', () => {
  it('does nothing when the tile has no resource', () => {
    const { state, worker } = adjacentSetup();
    gather(state, worker, 6, 4);
    expect(worker.task.kind).toBe('idle');
    expect(worker.path).toEqual([]);
  });

  it("does not move another player's units", () => {
    const { state } = adjacentSetup();
    const enemy = createUnit(state, 'samlare', 1, 4, 3);
    applyCommand(state, { type: 'gather', player: 0, unitIds: [enemy.id], x: 5, y: 2 });
    expect(enemy.task.kind).toBe('idle');
  });

  it('picks a tree at the edge when the chosen tree is enclosed by others', () => {
    const state = stateFromRows(['........', '...TTT..', '...TTT..', '...TTT..', '........']);
    createBuilding(state, 'storide', 0, 10, 10);
    const worker = createUnit(state, 'samlare', 0, 0, 2);
    gather(state, worker, 4, 2);
    // The middle tree cannot be reached; the nearest tree to it that can is used.
    expect(worker.task.kind).toBe('gather');
    advance(state, 60);
    expect(worker.task).toMatchObject({ kind: 'gather', phase: 'gathering' });
    const node = worker.task.kind === 'gather' ? worker.task.node : undefined;
    expect(node).not.toEqual({ x: 4, y: 2 });
    expect(Math.max(Math.abs(node!.x - 4), Math.abs(node!.y - 2))).toBe(1);
  });

  it('does nothing when no source of that kind can be reached', () => {
    const state = stateFromRows(['..W.B', '..W..', '..W..']);
    const worker = createUnit(state, 'samlare', 0, 0, 1);
    gather(state, worker, 4, 0);
    expect(worker.task.kind).toBe('idle');
    expect(worker.path).toEqual([]);
  });

  it('drops a load of another kind when switching resource', () => {
    const state = stateFromRows(['.......', '....T..', '.......', '....B..', '.......']);
    createBuilding(state, 'storide', 0, 0, 1);
    // Between the two sources, on a work place of both.
    const worker = createUnit(state, 'samlare', 0, 4, 2);
    gather(state, worker, 4, 1);
    advance(state, 4 * TICKS_PER_UNIT);
    expect([worker.carryType, worker.carryAmount]).toEqual(['wood', 4]);

    gather(state, worker, 4, 3);
    expect([worker.carryType, worker.carryAmount]).toEqual(['food', 0]);
    // It fills up where it stands, then walks one tile to the Storide.
    advance(state, TICKS_TO_FILL + WALK_ONE_TILE);
    expect(state.players[0]!.resources).toEqual({ food: START_FOOD + CAPACITY, wood: START_WOOD });
  });

  it('keeps a load of the same kind when sent to another source', () => {
    const state = stateFromRows(['.......', '....B..', '.......', '....B..', '.......']);
    createBuilding(state, 'storide', 0, 0, 1);
    const worker = createUnit(state, 'samlare', 0, 4, 2);
    gather(state, worker, 4, 1);
    advance(state, 4 * TICKS_PER_UNIT);
    gather(state, worker, 4, 3);
    expect(worker.carryAmount).toBe(4);
    // Six more units fill the load, and one tile's walk brings it to the Storide.
    advance(state, 6 * TICKS_PER_UNIT + WALK_ONE_TILE);
    expect(state.players[0]!.resources.food).toBe(START_FOOD + CAPACITY);
  });

  it('a move order stops the gathering but keeps the load', () => {
    const { state, worker } = adjacentSetup();
    gather(state, worker, 5, 2);
    advance(state, 5 * TICKS_PER_UNIT);
    applyCommand(state, { type: 'move', player: 0, unitIds: [worker.id], x: 6, y: 4 });
    expect(worker.task.kind).toBe('idle');
    advance(state, 300);
    expect(unitTile(worker)).toEqual({ x: 6, y: 4 });
    expect(worker.carryAmount).toBe(5);
    expect(state.players[0]!.resources.food).toBe(START_FOOD);
  });

  it('becomes idle with its load when its side has no drop-off building', () => {
    const state = stateFromRows(['...', '.B.', '...']);
    const worker = createUnit(state, 'samlare', 0, 0, 1);
    gather(state, worker, 1, 1);
    advance(state, TICKS_TO_FILL + 20);
    expect(worker.task.kind).toBe('idle');
    expect(worker.carryAmount).toBe(CAPACITY);
    expect(state.players[0]!.resources.food).toBe(START_FOOD);
  });

  it("does not deliver to the other side's building", () => {
    const state = stateFromRows(['.......', '.......', '.....B.', '.......', '.......']);
    createBuilding(state, 'storide', 1, 1, 1);
    const worker = createUnit(state, 'samlare', 0, 4, 2);
    gather(state, worker, 5, 2);
    advance(state, TICKS_TO_FILL + 20);
    expect(state.players[0]!.resources.food).toBe(START_FOOD);
    expect(state.players[1]!.resources.food).toBe(START_FOOD);
    expect(worker.task.kind).toBe('idle');
  });
});

describe('gathering in a real game', () => {
  it('starts each side with the configured stock', () => {
    const state = createGame(1);
    expect(state.players).toHaveLength(2);
    for (const player of state.players) expect(player.resources).toEqual(START_CONFIG.resources);
  });

  it('gives every tree and berry bush its starting amount, and nothing else any', () => {
    const state = createGame(1);
    state.map.terrain.forEach((terrain, i) => {
      const expected =
        terrain === 'tree'
          ? RESOURCE_DEFS.wood.amountPerNode
          : terrain === 'berries'
            ? RESOURCE_DEFS.food.amountPerNode
            : 0;
      expect(state.map.resourceAmount[i]).toBe(expected);
    });
  });

  it('all three starting workers bring home food from the nearest berries', () => {
    for (const seed of [1, 2, 3]) {
      const state = createGame(seed);
      const workers = state.entities.filter((e): e is Unit => e.kind === 'unit' && e.owner === 0);
      const start = state.map.startPositions[0]!;
      let bush: { x: number; y: number } | undefined;
      let best = Infinity;
      state.map.terrain.forEach((terrain, i) => {
        if (terrain !== 'berries') return;
        const x = i % state.map.width;
        const y = (i - x) / state.map.width;
        const distance = Math.hypot(x - start.x, y - start.y);
        if (distance < best) {
          best = distance;
          bush = { x, y };
        }
      });
      applyCommand(state, {
        type: 'gather',
        player: 0,
        unitIds: workers.map((w) => w.id),
        x: bush!.x,
        y: bush!.y,
      });
      // One minute of game time.
      advance(state, 60 * SIM_CONFIG.ticksPerSecond);
      expect(state.players[0]!.resources.food, `seed ${seed}`).toBeGreaterThanOrEqual(
        START_FOOD + 3 * CAPACITY,
      );
      expect(state.players[0]!.resources.wood).toBe(START_WOOD);
    }
  });

  it('stays deterministic', () => {
    const run = () => {
      const state = createGame(4);
      const workers = state.entities.filter((e) => e.kind === 'unit' && e.owner === 0);
      const tree = state.map.terrain.findIndex((t) => t === 'tree');
      applyCommand(state, {
        type: 'gather',
        player: 0,
        unitIds: workers.map((w) => w.id),
        x: tree % state.map.width,
        y: Math.floor(tree / state.map.width),
      });
      advance(state, 600);
      return state;
    };
    expect(run()).toEqual(run());
  });
});

describe('work places around a source', () => {
  const PLACES = GATHER_CONFIG.placesPerSource;
  const workers = (state: GameState) =>
    state.entities.filter((e): e is Unit => e.kind === 'unit' && e.type === 'samlare');
  const tileKey = (unit: Unit) => `${unitTile(unit).x},${unitTile(unit).y}`;
  const nodeOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.node : undefined);
  const placeOf = (unit: Unit) => (unit.task.kind === 'gather' ? unit.task.place : undefined);

  /** Two lone trees eight tiles apart, a Storide far below them, and `count` workers in a row. */
  function twoTrees(count: number) {
    const rows = Array.from({ length: 14 }, () => '.'.repeat(16));
    rows[3] = '...T.......T....';
    const state = stateFromRows(rows);
    createBuilding(state, 'storide', 0, 6, 9);
    const units = Array.from({ length: count }, (_, i) =>
      createUnit(state, 'samlare', 0, 1 + i, 6),
    );
    return { state, units };
  }

  it('has four places: the tiles that share a side with the source', () => {
    const { state, units } = twoTrees(4);
    applyCommand(state, {
      type: 'gather',
      player: 0,
      unitIds: units.map((u) => u.id),
      x: 3,
      y: 3,
    });
    advance(state, 60);
    expect(units.map(tileKey).sort()).toEqual(['2,3', '3,2', '3,4', '4,3']);
    for (const unit of units) {
      expect(unit.task).toMatchObject({ kind: 'gather', phase: 'gathering', node: { x: 3, y: 3 } });
    }
  });

  it('sends the workers that find no place to the nearest source of the same kind', () => {
    const { state, units } = twoTrees(6);
    applyCommand(state, {
      type: 'gather',
      player: 0,
      unitIds: units.map((u) => u.id),
      x: 3,
      y: 3,
    });
    const first = units.filter((u) => nodeOf(u)?.x === 3);
    const second = units.filter((u) => nodeOf(u)?.x === 11);
    expect(first).toHaveLength(PLACES);
    expect(second).toHaveLength(2);
    advance(state, 120);
    // Every worker stands on a tile of its own.
    expect(new Set(units.map(tileKey)).size).toBe(units.length);
    for (const unit of units) expect(unit.task).toMatchObject({ phase: 'gathering' });
  });

  it('never lets two workers hold the same place, through a whole match of work', () => {
    const { state, units } = twoTrees(8);
    applyCommand(state, {
      type: 'gather',
      player: 0,
      unitIds: units.map((u) => u.id),
      x: 3,
      y: 3,
    });
    for (let step = 0; step < 2400; step++) {
      tick(state);
      const held = workers(state)
        .map(placeOf)
        .filter((place): place is { x: number; y: number } => !!place)
        .map((place) => `${place.x},${place.y}`);
      expect(new Set(held).size, `step ${step}`).toBe(held.length);
      // Nobody works anywhere but on the place it holds.
      for (const unit of units) {
        if (unit.task.kind === 'gather' && unit.task.phase === 'gathering') {
          expect(tileKey(unit)).toBe(`${unit.task.place!.x},${unit.task.place!.y}`);
        }
      }
    }
    expect(state.players[0]!.resources.wood).toBeGreaterThan(START_WOOD);
  });

  it('keeps its place while it carries a load home, and returns to it', () => {
    const { state, units } = twoTrees(1);
    const [worker] = units;
    gather(state, worker!, 3, 3);
    advance(state, 60);
    const place = { ...placeOf(worker!)! };
    // Until it has delivered once.
    for (let step = 0; step < 1200 && state.players[0]!.resources.wood === START_WOOD; step++) {
      tick(state);
      expect(placeOf(worker!)).toEqual(place);
    }
    expect(state.players[0]!.resources.wood).toBe(START_WOOD + CAPACITY);
    advance(state, 200);
    expect(worker!.task).toMatchObject({ phase: 'gathering' });
    expect(unitTile(worker!)).toEqual(place);
  });

  it('gives a source by other trees only as many places as it has open tiles', () => {
    // The middle tree of a row has two open sides; its corners are open too.
    const state = stateFromRows(['.......', '.......', '..TTT..', '.......', '.......', '.......']);
    createBuilding(state, 'storide', 0, 0, 3);
    const units = [0, 1, 2, 3, 4].map((i) => createUnit(state, 'samlare', 0, 6, 1 + i));
    applyCommand(state, {
      type: 'gather',
      player: 0,
      unitIds: units.map((u) => u.id),
      x: 3,
      y: 2,
    });
    const onMiddle = units.filter((u) => nodeOf(u)?.x === 3);
    expect(onMiddle).toHaveLength(PLACES);
    // Above, below, and the two corners that come first in the fixed order.
    expect(onMiddle.map((u) => `${placeOf(u)!.x},${placeOf(u)!.y}`).sort()).toEqual([
      '3,1',
      '3,3',
      '4,1',
      '4,3',
    ]);
    expect(units.filter((u) => nodeOf(u)?.x !== 3)).toHaveLength(1);
  });

  it('frees the place when the worker is given another order', () => {
    const { state, units } = twoTrees(5);
    const ids = units.map((u) => u.id);
    applyCommand(state, { type: 'gather', player: 0, unitIds: ids, x: 3, y: 3 });
    const away = units.find((u) => nodeOf(u)?.x === 11)!;
    const leaver = units.find((u) => nodeOf(u)?.x === 3)!;
    applyCommand(state, { type: 'move', player: 0, unitIds: [leaver.id], x: 8, y: 8 });
    // The one that was turned away now finds room at the first tree.
    gather(state, away, 3, 3);
    expect(nodeOf(away)).toEqual({ x: 3, y: 3 });
  });
});
