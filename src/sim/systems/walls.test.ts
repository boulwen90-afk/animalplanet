import { describe, expect, it, vi } from 'vitest';
import { BUILDING_DEFS, BUILD_MENUS, CONSTRUCTION_CONFIG } from '../../data/buildings';
import { SIM_CONFIG } from '../../data/sim';
import { UNIT_DEFS } from '../../data/units';
import { applyCommand } from '../commands';
import { createBuilding, createUnit, hasSurrendered, unitTile } from '../entities';
import { createGame } from '../game';
import { lineTiles } from '../map/line';
import { findPath, pathCost } from '../pathfinding/astar';
import { buildBreachGrid, buildPathGrid } from '../pathfinding/passability';
import type { Building, GameState, PlayerId, Unit } from '../state';
import { openState, stateFromRows } from '../testUtils';
import { advance, tick } from '../tick';
import { canGetToAttack, wallInTheWay } from './breach';
import { collapse } from './combat';
import { lineCost, placeablePieces, planLine } from './construction';

// Some of these play a whole match.
vi.setConfig({ testTimeout: 120_000 });

const WALL = BUILDING_DEFS.palissad;
const GATE = BUILDING_DEFS.port;
const SECOND = SIM_CONFIG.ticksPerSecond;
const MINUTE = 60 * SECOND;

const wallsOf = (state: GameState, type = 'palissad') =>
  state.entities.filter((e): e is Building => e.kind === 'building' && e.type === type);

/** True if a unit stands on a tile that a piece of wall or a gate that is shut to it stands on. */
function insideWall(state: GameState, unit: Unit): boolean {
  const grid = buildPathGrid(state, unit.owner);
  const tile = unitTile(unit);
  return grid.blocked[tile.y * grid.width + tile.x] === 1;
}

/** A finished wall along a column of tiles, from one row to another. */
function wallColumn(state: GameState, owner: PlayerId, x: number, fromY: number, toY: number) {
  const pieces: Building[] = [];
  for (let y = fromY; y <= toY; y++) pieces.push(createBuilding(state, 'palissad', owner, x, y));
  return pieces;
}

function move(state: GameState, units: Unit[], x: number, y: number) {
  applyCommand(state, {
    type: 'move',
    player: units[0]!.owner,
    unitIds: units.map((unit) => unit.id),
    x,
    y,
  });
}

function buildLine(
  state: GameState,
  builder: Unit,
  from: [number, number],
  to: [number, number],
  building: 'palissad' | 'port' | 'krigshall' = 'palissad',
) {
  return applyCommand(state, {
    type: 'buildLine',
    player: builder.owner,
    unitIds: [builder.id],
    building,
    fromX: from[0],
    fromY: from[1],
    toX: to[0],
    toY: to[1],
  });
}

/** Steps the game until a unit has stopped, and says where it went on the way. */
function walk(state: GameState, unit: Unit, most = 60 * SECOND) {
  const visited = new Set<string>();
  let everInside = false;
  let steps = 0;
  do {
    tick(state);
    steps++;
    const tile = unitTile(unit);
    visited.add(`${tile.x},${tile.y}`);
    if (insideWall(state, unit)) everInside = true;
  } while (unit.path.length > 0 && steps < most);
  return { visited, everInside, steps };
}

describe('the data', () => {
  it('a piece of palisade stands on one tile, costs wood and is built by Samlare', () => {
    expect(WALL).toMatchObject({ size: 1, cost: { wood: 6 }, wall: 'segment', walkable: false });
    expect(GATE).toMatchObject({ size: 1, cost: { wood: 40 }, wall: 'gate', walkable: false });
    expect(GATE.replaces).toEqual(['palissad']);
    expect(UNIT_DEFS.samlare.builds).toEqual(expect.arrayContaining(['palissad', 'port']));
  });

  it('a gate is stronger than a piece of wall, and both are weaker than a tower', () => {
    expect(GATE.hp).toBeGreaterThan(WALL.hp);
    expect(GATE.hp).toBeLessThan(BUILDING_DEFS.vakttorn.hp);
  });

  it('has three tabs in the build menu: walls and towers under defence, what trains soldiers under army', () => {
    expect(BUILD_MENUS).toEqual(['economy', 'army', 'defence']);
    const under = (menu: string) =>
      Object.entries(BUILDING_DEFS)
        .filter(([, def]) => def.menu === menu && def.buildTime > 0)
        .map(([type]) => type);
    expect(under('army')).toEqual(['krigshall', 'smedja', 'kastbana']);
    expect(under('defence')).toEqual(['vakttorn', 'palissad', 'port']);
  });

  it('only the palisade and the gate are pieces of wall', () => {
    const walls = Object.entries(BUILDING_DEFS).filter(([, def]) => def.wall !== undefined);
    expect(walls.map(([type]) => type)).toEqual(['palissad', 'port']);
  });
});

describe('a line of tiles', () => {
  it('runs straight along a row or a column, both ends included', () => {
    expect(lineTiles({ x: 2, y: 5 }, { x: 6, y: 5 })).toEqual([
      { x: 2, y: 5 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
      { x: 6, y: 5 },
    ]);
    expect(lineTiles({ x: 4, y: 7 }, { x: 4, y: 5 })).toEqual([
      { x: 4, y: 7 },
      { x: 4, y: 6 },
      { x: 4, y: 5 },
    ]);
    expect(lineTiles({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual([{ x: 3, y: 3 }]);
  });

  it('at a slant it is a staircase: every tile lies side by side with the one before', () => {
    for (const [to, count] of [
      [{ x: 9, y: 9 }, 13],
      [{ x: 12, y: 5 }, 12],
      [{ x: -2, y: 8 }, 11],
      [{ x: 4, y: -6 }, 11],
    ] as const) {
      const tiles = lineTiles({ x: 3, y: 3 }, to);
      expect(tiles).toHaveLength(count);
      expect(tiles[0]).toEqual({ x: 3, y: 3 });
      expect(tiles.at(-1)).toEqual(to);
      for (let i = 1; i < tiles.length; i++) {
        const step =
          Math.abs(tiles[i]!.x - tiles[i - 1]!.x) + Math.abs(tiles[i]!.y - tiles[i - 1]!.y);
        expect(step).toBe(1);
      }
    }
  });

  it('nobody can walk through a wall built on it, whichever way it runs', () => {
    for (const to of [
      { x: 19, y: 19 },
      { x: 19, y: 7 },
      { x: 13, y: 19 },
    ]) {
      const state = openState(20, 20);
      for (const tile of lineTiles({ x: 0, y: 0 }, to)) {
        createBuilding(state, 'palissad', 0, tile.x, tile.y);
      }
      // From the corner on one side of it to the corner on the other.
      expect(findPath(buildPathGrid(state, 1), { x: 19, y: 0 }, { x: 0, y: 19 })).toEqual([]);
    }
  });

  it('is cut off at the most pieces it may have', () => {
    expect(lineTiles({ x: 0, y: 0 }, { x: 50, y: 0 }, 30)).toHaveLength(30);
    expect(CONSTRUCTION_CONFIG.maxLineLength).toBe(30);
  });
});

describe('drawing out a palisade', () => {
  function setup() {
    const state = openState(30, 20);
    const builder = createUnit(state, 'samlare', 0, 5, 10);
    state.players[0]!.resources = { food: 0, wood: 500 };
    return { state, builder };
  }

  it('puts a construction site on every tile of the line and takes the price of them all', () => {
    const { state, builder } = setup();
    expect(buildLine(state, builder, [8, 4], [8, 12])).toEqual({ ok: true });
    const pieces = wallsOf(state);
    expect(pieces).toHaveLength(9);
    expect(pieces.every((piece) => !piece.complete && piece.owner === 0)).toBe(true);
    expect(pieces.map((piece) => [piece.x, piece.y])).toEqual(
      [4, 5, 6, 7, 8, 9, 10, 11, 12].map((y) => [8, y]),
    );
    expect(state.players[0]!.resources.wood).toBe(500 - 9 * 6);
    expect(lineCost('palissad', 9)).toEqual({ wood: 54 });
    expect(builder.task.kind).toBe('build');
  });

  it('the builder goes on along the wall until every piece stands', () => {
    const { state, builder } = setup();
    buildLine(state, builder, [8, 4], [8, 12]);
    // Nine pieces at 4 seconds each, and the walk between them.
    advance(state, 9 * WALL.buildTime * SECOND + 20 * SECOND);
    const pieces = wallsOf(state);
    expect(pieces.filter((piece) => piece.complete)).toHaveLength(9);
    expect(pieces.every((piece) => piece.hp === WALL.hp)).toBe(true);
    expect(builder.task.kind).toBe('idle');
    expect(insideWall(state, builder)).toBe(false);
  });

  it('starts at the end of the wall that is nearer to the builder', () => {
    const { state, builder } = setup();
    builder.x = 8.5;
    builder.y = 14.5;
    buildLine(state, builder, [8, 4], [8, 12]);
    expect(builder.task).toMatchObject({ kind: 'build' });
    const site = wallsOf(state).find(
      (piece) => builder.task.kind === 'build' && piece.id === builder.task.buildingId,
    );
    expect([site!.x, site!.y]).toEqual([8, 12]);
  });

  it('leaves out the tiles where something is in the way, and takes no price for them', () => {
    const state = stateFromRows([
      '..........',
      '..........',
      '....T.....',
      '..........',
      '....R.....',
      '..........',
      '..........',
      '..........',
    ]);
    const builder = createUnit(state, 'samlare', 0, 1, 1);
    createUnit(state, 'ramkrigare', 0, 4, 6);
    state.players[0]!.resources = { food: 0, wood: 100 };
    const plan = planLine(state, 'palissad', { x: 4, y: 0 }, { x: 4, y: 7 }, 0);
    expect(plan.map((piece) => piece.problem)).toEqual([
      undefined,
      undefined,
      'blocked',
      undefined,
      'blocked',
      undefined,
      'blocked',
      undefined,
    ]);
    expect(buildLine(state, builder, [4, 0], [4, 7])).toEqual({ ok: true });
    expect(wallsOf(state).map((piece) => piece.y)).toEqual([0, 1, 3, 5, 7]);
    expect(state.players[0]!.resources.wood).toBe(100 - 5 * 6);
  });

  it('passes over the pieces of wall that already stand there without paying for them again', () => {
    const { state, builder } = setup();
    buildLine(state, builder, [8, 4], [8, 8]);
    const wood = state.players[0]!.resources.wood;
    const plan = planLine(state, 'palissad', { x: 8, y: 6 }, { x: 8, y: 11 }, 0);
    expect(plan.map((piece) => piece.standing === true)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(placeablePieces(plan)).toHaveLength(3);
    expect(buildLine(state, builder, [8, 6], [8, 11])).toEqual({ ok: true });
    expect(wallsOf(state)).toHaveLength(8);
    expect(state.players[0]!.resources.wood).toBe(wood - 3 * 6);
  });

  it('places nothing if the side cannot pay for the whole line', () => {
    const { state, builder } = setup();
    state.players[0]!.resources.wood = 9 * 6 - 1;
    expect(buildLine(state, builder, [8, 4], [8, 12])).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['wood'],
    });
    expect(wallsOf(state)).toHaveLength(0);
    expect(state.players[0]!.resources.wood).toBe(9 * 6 - 1);
  });

  it('is no longer than 30 pieces, however far it is drawn', () => {
    const state = openState(60, 10);
    const builder = createUnit(state, 'samlare', 0, 1, 1);
    state.players[0]!.resources = { food: 0, wood: 1000 };
    buildLine(state, builder, [5, 5], [55, 5]);
    expect(wallsOf(state)).toHaveLength(30);
    expect(state.players[0]!.resources.wood).toBe(1000 - 30 * 6);
  });

  it('is refused where no piece of it can stand, for what is not a wall, and for those who cannot build', () => {
    const state = stateFromRows(['....', 'TTTT', '....']);
    const builder = createUnit(state, 'samlare', 0, 0, 0);
    const soldier = createUnit(state, 'ramkrigare', 0, 3, 0);
    state.players[0]!.resources = { food: 0, wood: 500 };
    expect(buildLine(state, builder, [0, 1], [3, 1])).toEqual({
      ok: false,
      reason: 'invalidPlacement',
      problem: 'blocked',
    });
    expect(buildLine(state, builder, [0, 2], [3, 2], 'krigshall')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(buildLine(state, builder, [0, 2], [3, 2], 'port')).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(buildLine(state, soldier, [0, 2], [3, 2])).toEqual({ ok: false, reason: 'invalid' });
    expect(state.players[0]!.resources.wood).toBe(500);
  });

  it('a single piece can be placed like any building', () => {
    const { state, builder } = setup();
    const result = applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [builder.id],
      building: 'palissad',
      x: 9,
      y: 9,
    });
    expect(result).toEqual({ ok: true });
    expect(wallsOf(state)).toHaveLength(1);
  });

  it('a piece can be repaired and torn down like any building', () => {
    const { state, builder } = setup();
    const [piece] = wallColumn(state, 0, 8, 9, 9);
    piece!.hp = 100;
    const result = applyCommand(state, {
      type: 'repair',
      player: 0,
      unitIds: [builder.id],
      buildingId: piece!.id,
    });
    expect(result).toEqual({ ok: true });
    advance(state, 40 * SECOND);
    expect(piece!.hp).toBe(WALL.hp);
    const enemy = createUnit(state, 'ramkrigare', 1, 9, 9);
    applyCommand(state, { type: 'attack', player: 1, unitIds: [enemy.id], targetId: piece!.id });
    advance(state, 40 * SECOND);
    expect(state.entities).not.toContain(piece);
  });
});

describe('the gate', () => {
  /** A wall across the whole map with a gate of side 0 in the middle of it. */
  function setup() {
    const state = openState(21, 15);
    wallColumn(state, 0, 10, 0, 6);
    wallColumn(state, 0, 10, 8, 14);
    const gate = createBuilding(state, 'port', 0, 10, 7);
    return { state, gate };
  }

  it('its own side walks through it', () => {
    const { state } = setup();
    const unit = createUnit(state, 'ramkrigare', 0, 3, 7);
    move(state, [unit], 17, 7);
    const { visited, everInside } = walk(state, unit);
    expect(unitTile(unit)).toEqual({ x: 17, y: 7 });
    expect(visited.has('10,7')).toBe(true);
    expect(everInside).toBe(false);
  });

  it('the other side does not: it goes as near as it can and stops', () => {
    const { state } = setup();
    const enemy = createUnit(state, 'ramkrigare', 1, 3, 7);
    move(state, [enemy], 17, 7);
    const { visited, everInside } = walk(state, enemy);
    expect(unitTile(enemy)).toEqual({ x: 9, y: 7 });
    expect(visited.has('10,7')).toBe(false);
    expect(everInside).toBe(false);
  });

  it('is shut to the other side and open to its own in the path grids', () => {
    const { state } = setup();
    const at = 7 * 21 + 10;
    expect(buildPathGrid(state, 0).blocked[at]).toBe(0);
    expect(buildPathGrid(state, 1).blocked[at]).toBe(1);
    expect(buildPathGrid(state).blocked[at]).toBe(1);
    // A piece of wall is shut to everybody.
    expect(buildPathGrid(state, 0).blocked[6 * 21 + 10]).toBe(1);
  });

  it('lets its own side through while it is still being built', () => {
    const state = openState(21, 15);
    wallColumn(state, 0, 10, 0, 6);
    wallColumn(state, 0, 10, 8, 14);
    const builder = createUnit(state, 'samlare', 0, 8, 7);
    state.players[0]!.resources = { food: 0, wood: 100 };
    applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [builder.id],
      building: 'port',
      x: 10,
      y: 7,
    });
    const [gate] = wallsOf(state, 'port');
    expect(gate!.complete).toBe(false);
    const unit = createUnit(state, 'ramkrigare', 0, 3, 5);
    const enemy = createUnit(state, 'ramkrigare', 1, 3, 9);
    move(state, [unit], 17, 5);
    move(state, [enemy], 17, 9);
    walk(state, unit);
    expect(unitTile(unit)).toEqual({ x: 17, y: 5 });
    expect(enemy.x).toBeLessThan(10);
  });

  it('can be put where a piece of the side`s own palisade stands: the piece goes, the gate comes', () => {
    const state = openState(21, 15);
    const pieces = wallColumn(state, 0, 10, 0, 14);
    const builder = createUnit(state, 'samlare', 0, 8, 7);
    state.players[0]!.resources = { food: 0, wood: 100 };
    const result = applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [builder.id],
      building: 'port',
      x: 10,
      y: 7,
    });
    expect(result).toEqual({ ok: true });
    expect(state.entities).not.toContain(pieces[7]);
    expect(wallsOf(state)).toHaveLength(14);
    expect(wallsOf(state, 'port')).toMatchObject([{ x: 10, y: 7, complete: false }]);
    // The gate is paid for in full; nothing comes back for the piece.
    expect(state.players[0]!.resources.wood).toBe(100 - 40);
    advance(state, (GATE.buildTime + 3) * SECOND);
    expect(wallsOf(state, 'port')[0]).toMatchObject({ complete: true, hp: GATE.hp });
  });

  it('cannot be put on the other side`s palisade, on another building or on a gate', () => {
    const state = openState(21, 15);
    wallColumn(state, 1, 10, 5, 5);
    createBuilding(state, 'ide', 0, 12, 5);
    createBuilding(state, 'port', 0, 5, 5);
    const builder = createUnit(state, 'samlare', 0, 8, 7);
    state.players[0]!.resources = { food: 0, wood: 500 };
    for (const [x, y] of [
      [10, 5],
      [12, 5],
      [5, 5],
    ] as const) {
      expect(
        applyCommand(state, {
          type: 'build',
          player: 0,
          unitIds: [builder.id],
          building: 'port',
          x,
          y,
        }),
      ).toEqual({ ok: false, reason: 'invalidPlacement', problem: 'blocked' });
    }
    expect(state.players[0]!.resources.wood).toBe(500);
  });

  it('a gate that falls is open to everybody', () => {
    const { state, gate } = setup();
    const enemy = createUnit(state, 'ramkrigare', 1, 3, 7);
    collapse(state, gate);
    move(state, [enemy], 17, 7);
    walk(state, enemy);
    expect(unitTile(enemy)).toEqual({ x: 17, y: 7 });
  });
});

describe('finding the way when walls are built and torn down', () => {
  it('a unit whose way is walled off while it walks goes round the wall, and never through it', () => {
    const state = openState(30, 20);
    const walker = createUnit(state, 'ramkrigare', 1, 2, 10);
    const builder = createUnit(state, 'samlare', 0, 14, 1);
    state.players[0]!.resources = { food: 0, wood: 500 };
    move(state, [walker], 25, 10);
    advance(state, SECOND);
    const straight = pathCost(unitTile(walker), walker.path);
    // Across its way, from near the top of the map to near the bottom: open at both ends.
    expect(buildLine(state, builder, [12, 3], [12, 16])).toEqual({ ok: true });
    // A longer way than the straight one it was on.
    expect(pathCost(unitTile(walker), walker.path)).toBeGreaterThan(straight);
    const { visited, everInside } = walk(state, walker);
    expect(everInside).toBe(false);
    expect(unitTile(walker)).toEqual({ x: 25, y: 10 });
    // It went round one end of the wall.
    expect(visited.has('12,2') || visited.has('12,17')).toBe(true);
    for (let y = 3; y <= 16; y++) expect(visited.has(`12,${y}`)).toBe(false);
  });

  it('a unit whose way is shut altogether goes as near as it can and stops there', () => {
    const state = openState(30, 20);
    const walker = createUnit(state, 'ramkrigare', 1, 2, 10);
    const builder = createUnit(state, 'samlare', 0, 14, 1);
    state.players[0]!.resources = { food: 0, wood: 500 };
    move(state, [walker], 25, 10);
    advance(state, SECOND);
    // From edge to edge.
    expect(buildLine(state, builder, [12, 0], [12, 19])).toEqual({ ok: true });
    const { everInside } = walk(state, walker);
    expect(everInside).toBe(false);
    expect(walker.path).toEqual([]);
    expect(unitTile(walker)).toEqual({ x: 11, y: 10 });
  });

  it('a wall raised on the very tile a unit is about to step onto turns it aside', () => {
    const state = openState(30, 20);
    const walker = createUnit(state, 'ramkrigare', 1, 2, 10);
    const builder = createUnit(state, 'samlare', 0, 14, 1);
    state.players[0]!.resources = { food: 0, wood: 500 };
    move(state, [walker], 25, 10);
    // Until it is on its way from one tile to the next.
    while (walker.x < 10.6) tick(state);
    const next = walker.path[0]!;
    expect(next).toEqual({ x: 11, y: 10 });
    expect(buildLine(state, builder, [11, 6], [11, 14])).toEqual({ ok: true });
    const { everInside } = walk(state, walker);
    expect(everInside).toBe(false);
    expect(unitTile(walker)).toEqual({ x: 25, y: 10 });
  });

  it('when a piece of the wall is torn down, a unit on the long way round takes the opening', () => {
    const play = (tearDown: boolean) => {
      const state = openState(30, 20);
      // A wall with its only opening far down at the bottom of the map.
      const pieces = wallColumn(state, 0, 12, 0, 17);
      const walker = createUnit(state, 'ramkrigare', 1, 9, 2);
      move(state, [walker], 15, 2);
      advance(state, SECOND);
      if (tearDown) collapse(state, pieces[3]!);
      const { visited, everInside, steps } = walk(state, walker);
      return { visited, everInside, steps, at: unitTile(walker) };
    };
    const round = play(false);
    const through = play(true);
    expect(round.at).toEqual({ x: 15, y: 2 });
    expect(through.at).toEqual({ x: 15, y: 2 });
    expect(round.visited.has('12,18') || round.visited.has('12,19')).toBe(true);
    expect(through.visited.has('12,3')).toBe(true);
    expect(through.visited.has('12,18')).toBe(false);
    expect(through.everInside).toBe(false);
    // The long way is some 35 tiles; through the opening it is 7.
    expect(through.steps).toBeLessThan(round.steps / 3);
  });

  it('a unit that has another, longer way to go is not turned by an opening that does not help it', () => {
    const state = openState(30, 20);
    const pieces = wallColumn(state, 0, 12, 4, 19);
    const walker = createUnit(state, 'ramkrigare', 1, 9, 2);
    move(state, [walker], 15, 2);
    advance(state, 5);
    const before = [...walker.path];
    // An opening far away from its way.
    collapse(state, pieces[14]!);
    expect(walker.path).toEqual(before);
  });

  it('when a gate is put into the wall, its own side takes it and the other side still goes round', () => {
    const state = openState(30, 20);
    wallColumn(state, 0, 12, 0, 17);
    const own = createUnit(state, 'ramkrigare', 0, 9, 2);
    const enemy = createUnit(state, 'ramkrigare', 1, 9, 4);
    const builder = createUnit(state, 'samlare', 0, 10, 3);
    state.players[0]!.resources = { food: 0, wood: 100 };
    move(state, [own], 15, 2);
    move(state, [enemy], 15, 4);
    advance(state, SECOND);
    const result = applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [builder.id],
      building: 'port',
      x: 12,
      y: 3,
    });
    expect(result).toEqual({ ok: true });
    const ownWalk = walk(state, own);
    expect(unitTile(own)).toEqual({ x: 15, y: 2 });
    expect(ownWalk.visited.has('12,3')).toBe(true);
    const enemyWalk = walk(state, enemy);
    expect(unitTile(enemy)).toEqual({ x: 15, y: 4 });
    expect(enemyWalk.visited.has('12,3')).toBe(false);
    expect(enemyWalk.everInside).toBe(false);
  });

  it('a unit sent to a place inside a ring of walls goes as near to it as it can', () => {
    const state = openState(30, 20);
    for (const tile of [
      ...lineTiles({ x: 10, y: 5 }, { x: 16, y: 5 }),
      ...lineTiles({ x: 16, y: 6 }, { x: 16, y: 11 }),
      ...lineTiles({ x: 15, y: 11 }, { x: 10, y: 11 }),
      ...lineTiles({ x: 10, y: 10 }, { x: 10, y: 6 }),
    ]) {
      createBuilding(state, 'palissad', 0, tile.x, tile.y);
    }
    const outside = createUnit(state, 'ramkrigare', 1, 2, 8);
    const inside = createUnit(state, 'ramkrigare', 0, 13, 8);
    move(state, [outside], 13, 9);
    move(state, [inside], 25, 8);
    walk(state, outside);
    walk(state, inside);
    // Outside the wall, at the place closest to where it was sent: three tiles below it.
    expect(unitTile(outside)).toEqual({ x: 13, y: 12 });
    // Still inside the ring, on the side nearest where it was sent.
    expect(unitTile(inside)).toEqual({ x: 15, y: 8 });
    expect(insideWall(state, outside) || insideWall(state, inside)).toBe(false);
  });

  it('twenty units crossing the ground where a wall is drawn all get round it, none through it', () => {
    const play = () => {
      const state = openState(40, 24);
      const units: Unit[] = [];
      for (let i = 0; i < 20; i++) {
        units.push(createUnit(state, 'ramkrigare', 1, 3 + (i % 4), 8 + Math.floor(i / 4)));
      }
      const builder = createUnit(state, 'samlare', 0, 20, 1);
      state.players[0]!.resources = { food: 0, wood: 500 };
      move(state, units, 32, 10);
      let everInside = false;
      for (let i = 0; i < 60 * SECOND; i++) {
        // While they are on their way to it: a piece cannot be placed where a unit stands.
        if (i === 2 * SECOND) buildLine(state, builder, [14, 4], [14, 19]);
        tick(state);
        if (units.some((unit) => insideWall(state, unit))) everInside = true;
      }
      return { state, units, everInside };
    };
    const { state, units, everInside } = play();
    expect(wallsOf(state)).toHaveLength(16);
    expect(everInside).toBe(false);
    for (const unit of units) {
      expect(unit.path).toEqual([]);
      // Across the wall, by the place they were sent to.
      expect(unit.x).toBeGreaterThan(27);
    }
    // The same every time.
    expect(JSON.stringify(play().state.entities)).toBe(JSON.stringify(state.entities));
  });

  it('gatherers whose way home is walled off go on delivering through a gate of their own', () => {
    const state = stateFromRows([
      '....................',
      '....................',
      '....................',
      'TTT.................',
      'TTT.................',
      '....................',
      '....................',
      '....................',
    ]);
    createBuilding(state, 'storide', 0, 15, 2);
    const workers = [0, 1].map((i) => createUnit(state, 'samlare', 0, 4, 3 + i));
    const builder = createUnit(state, 'samlare', 0, 9, 1);
    state.players[0]!.resources = { food: 0, wood: 200 };
    applyCommand(state, {
      type: 'gather',
      player: 0,
      unitIds: workers.map((worker) => worker.id),
      x: 2,
      y: 3,
    });
    advance(state, 20 * SECOND);
    const before = state.players[0]!.resources.wood;
    expect(before).toBeGreaterThan(200);
    // A wall between the forest and the main building, from edge to edge, with a gate in it.
    expect(buildLine(state, builder, [10, 0], [10, 7])).toEqual({ ok: true });
    applyCommand(state, {
      type: 'build',
      player: 0,
      unitIds: [builder.id],
      building: 'port',
      x: 10,
      y: 4,
    });
    const paid = state.players[0]!.resources.wood;
    let everInside = false;
    for (let i = 0; i < 90 * SECOND; i++) {
      tick(state);
      if (workers.some((worker) => insideWall(state, worker))) everInside = true;
    }
    expect(everInside).toBe(false);
    expect(wallsOf(state).every((piece) => piece.complete)).toBe(true);
    expect(state.players[0]!.resources.wood).toBeGreaterThan(paid + 30);
    for (const worker of workers) expect(worker.task.kind).toBe('gather');
  });

  it('a soldier whose enemy is walled off while it runs at it gives up, and takes it up when the wall falls', () => {
    const state = openState(30, 20);
    const soldier = createUnit(state, 'ramkrigare', 1, 4, 10);
    const prey = createUnit(state, 'samlare', 0, 20, 10);
    prey.hp = 1000;
    applyCommand(state, { type: 'attack', player: 1, unitIds: [soldier.id], targetId: prey.id });
    advance(state, SECOND);
    const pieces = wallColumn(state, 0, 12, 0, 19);
    advance(state, 10 * SECOND);
    expect(soldier.task.kind).toBe('idle');
    expect(insideWall(state, soldier)).toBe(false);
    expect(soldier.x).toBeLessThan(12);
    // Ordered again once there is an opening, it gets there.
    collapse(state, pieces[10]!);
    applyCommand(state, { type: 'attack', player: 1, unitIds: [soldier.id], targetId: prey.id });
    advance(state, 10 * SECOND);
    expect(prey.hp).toBeLessThan(1000);
  });

  it('a new unit comes out on its own side of a wall that stands by the building', () => {
    const state = openState(20, 20);
    const hall = createBuilding(state, 'krigshall', 0, 8, 8);
    // A wall right across the tile new units come out on.
    wallColumn(state, 0, 11, 6, 14);
    state.players[0]!.resources = { food: 500, wood: 500 };
    createBuilding(state, 'ide', 0, 2, 2);
    applyCommand(state, { type: 'train', player: 0, buildingId: hall.id, unit: 'ramkrigare' });
    advance(state, (UNIT_DEFS.ramkrigare.trainTime + 1) * SECOND);
    const soldier = state.entities.find((e): e is Unit => e.kind === 'unit')!;
    expect(soldier).toBeDefined();
    expect(insideWall(state, soldier)).toBe(false);
  });
});

describe('getting at what stands behind a wall', () => {
  /** A Storide of side 0 inside a closed ring of its palisade, and a soldier of side 1 outside. */
  function ringed() {
    const state = openState(30, 24);
    const home = createBuilding(state, 'storide', 0, 13, 10);
    const ring = [
      ...lineTiles({ x: 10, y: 7 }, { x: 18, y: 7 }),
      ...lineTiles({ x: 18, y: 8 }, { x: 18, y: 15 }),
      ...lineTiles({ x: 17, y: 15 }, { x: 10, y: 15 }),
      ...lineTiles({ x: 10, y: 14 }, { x: 10, y: 8 }),
    ].map((tile) => createBuilding(state, 'palissad', 0, tile.x, tile.y));
    return { state, home, ring };
  }

  it('knows that a soldier cannot get to a building inside a ring of walls, and can once there is a hole', () => {
    const { state, home, ring } = ringed();
    const soldier = createUnit(state, 'ramkrigare', 1, 2, 11);
    expect(canGetToAttack(buildPathGrid(state, 1), soldier, home)).toBe(false);
    collapse(state, ring[5]!);
    expect(canGetToAttack(buildPathGrid(state, 1), soldier, home)).toBe(true);
  });

  it('a thrower can get at what is within its range of the wall, without a hole', () => {
    const { state, home, ring } = ringed();
    const thrower = createUnit(state, 'ramkastare', 1, 2, 11);
    // The Storide is 3 tiles inside the wall, and it throws 7.
    expect(canGetToAttack(buildPathGrid(state, 1), thrower, home)).toBe(true);
    expect(wallInTheWay(state, thrower, home)).toBe(ring.find((p) => p.x === 10 && p.y === 11));
  });

  it('finds the piece of wall that stands first on the straight way to the target', () => {
    const { state, home, ring } = ringed();
    const west = createUnit(state, 'ramkrigare', 1, 2, 11);
    const north = createUnit(state, 'ramkrigare', 1, 14, 1);
    expect(wallInTheWay(state, west, home)).toBe(ring.find((p) => p.x === 10 && p.y === 11));
    expect(wallInTheWay(state, north, home)).toBe(ring.find((p) => p.x === 14 && p.y === 7));
  });

  it('counts a gate of the other side as wall, and a gate of its own as an open way', () => {
    const state = openState(30, 20);
    wallColumn(state, 0, 12, 0, 8);
    wallColumn(state, 0, 12, 10, 19);
    const gate = createBuilding(state, 'port', 0, 12, 9);
    const target = createBuilding(state, 'ide', 0, 20, 9);
    const enemy = createUnit(state, 'ramkrigare', 1, 4, 9);
    const own = createUnit(state, 'ramkrigare', 0, 4, 11);
    expect(canGetToAttack(buildPathGrid(state, 1), enemy, target)).toBe(false);
    expect(wallInTheWay(state, enemy, target)).toBe(gate);
    expect(canGetToAttack(buildPathGrid(state, 0), own, target)).toBe(true);
    expect(buildBreachGrid(state, 1).blocked[9 * 30 + 12]).toBe(0);
  });

  it('says nothing is in the way when no wall is', () => {
    const state = openState(30, 20);
    const target = createBuilding(state, 'ide', 0, 20, 9);
    const enemy = createUnit(state, 'ramkrigare', 1, 4, 9);
    expect(wallInTheWay(state, enemy, target)).toBeUndefined();
    // Its own side's walls are not something to break through.
    wallColumn(state, 1, 12, 0, 19);
    expect(wallInTheWay(state, enemy, target)).toBeUndefined();
  });
});

describe('the computer player and walls', () => {
  const homeOf = (state: GameState, owner: number) =>
    state.entities.find(
      (e): e is Building => e.kind === 'building' && e.type === 'storide' && e.owner === owner,
    )!;

  /** Puts a closed ring of finished palisade round a side's main building, three tiles out. */
  function ring(state: GameState, owner: PlayerId): Building[] {
    const home = homeOf(state, owner);
    const lowX = home.x - 4;
    const lowY = home.y - 4;
    const highX = home.x + 6;
    const highY = home.y + 6;
    const pieces: Building[] = [];
    for (let y = lowY; y <= highY; y++) {
      for (let x = lowX; x <= highX; x++) {
        if (x !== lowX && x !== highX && y !== lowY && y !== highY) continue;
        const open = buildPathGrid(state, owner).blocked[y * state.map.width + x] === 0;
        const taken = state.entities.some(
          (e) => e.kind === 'unit' && Math.floor(e.x) === x && Math.floor(e.y) === y,
        );
        // Trees and rocks are wall enough where they stand.
        if (open && !taken) pieces.push(createBuilding(state, 'palissad', owner, x, y));
      }
    }
    return pieces;
  }

  it('its attackers break through a wall that shuts them out, and go on to the main building', () => {
    const state = createGame(1);
    const home = homeOf(state, 0);
    const pieces = ring(state, 0);
    const wave = [0, 1, 2, 3].map((i) =>
      createUnit(state, 'ramkrigare', 1, home.x + 14 + (i % 2), home.y + 1 + Math.floor(i / 2)),
    );
    // Shut out: this is what the test is about.
    expect(canGetToAttack(buildPathGrid(state, 1), wave[0]!, home)).toBe(false);
    const memory = state.players[1]!.ai!;
    memory.attackers.push(...wave.map((unit) => unit.id));

    let attackedWall = false;
    let fell = -1;
    for (let i = 0; i < 3 * MINUTE && state.winner === null; i++) {
      tick(state);
      const targets = wave.map((unit) => (unit.task.kind === 'attack' ? unit.task.targetId : -1));
      if (targets.some((id) => pieces.some((piece) => piece.id === id))) attackedWall = true;
      if (fell < 0 && pieces.some((piece) => !state.entities.includes(piece))) fell = state.tick;
    }
    expect(attackedWall).toBe(true);
    expect(fell).toBeGreaterThan(0);
    // Through the hole and on: the main building is damaged or has fallen.
    const left = homeOf(state, 0);
    expect(left === undefined || left.hp < BUILDING_DEFS.storide.hp).toBe(true);
    // They did not stand about: every one of them still in the game is at it.
    for (const unit of wave) {
      if (state.winner === null && !hasSurrendered(unit)) expect(unit.task.kind).toBe('attack');
    }
  });

  it('wins a whole match against a player who has walled the main building in and does nothing else', () => {
    for (const seed of [1, 2, 3]) {
      const state = createGame(seed);
      const pieces = ring(state, 0);
      expect(pieces.length, `seed ${seed}`).toBeGreaterThan(20);
      advance(state, 15 * MINUTE);
      expect(state.winner, `seed ${seed}`).toBe(1);
      expect(
        pieces.some((piece) => !state.entities.includes(piece)),
        `seed ${seed}`,
      ).toBe(true);
    }
  });
});
