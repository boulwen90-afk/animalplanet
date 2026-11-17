import { describe, expect, it, vi } from 'vitest';
import type { Difficulty } from '../data/ai';
import { BUILDING_DEFS, type BuildingType } from '../data/buildings';
import { SIM_CONFIG } from '../data/sim';
import { UNIT_DEFS, type UnitType } from '../data/units';
import { UPGRADE_TYPES } from '../data/upgrades';
import { applyCommand, type Command, type CommandResult } from './commands';
import {
  buildingFrontTile,
  createBuilding,
  createUnit,
  hasSurrendered,
  isBuilding,
  isUnit,
} from './entities';
import type { Point } from './map/iso';
import { createGame } from './game';
import { buildPathGrid, nearestFreeTiles } from './pathfinding/passability';
import { resourceAt } from './resources';
import { createRng, nextFloat, nextInt, pick, type RngState } from './rng';
import type { Building, GameState, PlayerId, Unit } from './state';
import { isAttackable } from './systems/combat';
import { canPlaceBuilding, planLine } from './systems/construction';
import { plannedWorkTiles, workPlacesOf } from './systems/gathering';
import { costToMend, nearestDamaged } from './systems/repair';
import { isTileExplored, visibleEntities } from './systems/visibility';
import { tick } from './tick';

/**
 * Lockstep multiplayer sends only orders between the players, so the same
 * seed and the same orders must give the same game, step for step. These
 * tests record the orders of a match and play them again, comparing a
 * checksum of the whole game state after every simulation step.
 *
 * They are scaled with two environment variables, for a longer run by hand:
 *   DETERMINISM_SEEDS=1,2,3,4   the seeds to play (default 1,2)
 *   DETERMINISM_MINUTES=40      minutes of game time per match (default 8)
 */
const SEEDS = (process.env.DETERMINISM_SEEDS ?? '1,2').split(',').map(Number);
const MINUTES = Number(process.env.DETERMINISM_MINUTES ?? 8);
const STEPS = MINUTES * 60 * SIM_CONFIG.ticksPerSecond;

vi.setConfig({ testTimeout: 3_600_000 });

/** An order as it would travel between two players: plain data, with the step it belongs to. */
interface RecordedOrder {
  step: number;
  command: Command;
  result: CommandResult;
}

// The orders the computer players give are caught on their way into the game.
const recorder = vi.hoisted(() => ({
  state: undefined as unknown,
  orders: [] as { step: number; command: unknown; result: unknown }[],
}));

vi.mock('./commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('./commands')>();
  return {
    ...original,
    applyCommand: (state: GameState, command: Command): CommandResult => {
      const result = original.applyCommand(state, command);
      if (state === recorder.state) {
        recorder.orders.push({ step: state.tick, command: asSent(command), result });
      }
      return result;
    },
  };
});

/** What is left of a value after it has been sent as JSON, as an order or a saved game would be. */
function asSent<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// ---------------------------------------------------------------------------
// Checksum

const float = new Float64Array(1);
const halves = new Uint32Array(float.buffer);
const textSums = new Map<string, number>();

/** One round of MurmurHash3's mixing. */
function mix(hash: number, value: number): number {
  let k = Math.imul(value, 0xcc9e2d51);
  k = (k << 15) | (k >>> 17);
  k = Math.imul(k, 0x1b873593);
  let h = hash ^ k;
  h = (h << 13) | (h >>> 19);
  return (Math.imul(h, 5) + 0xe6546b64) | 0;
}

function textSum(text: string): number {
  let sum = textSums.get(text);
  if (sum === undefined) {
    sum = text.length;
    for (let i = 0; i < text.length; i++) sum = mix(sum, text.charCodeAt(i));
    textSums.set(text, sum);
  }
  return sum;
}

/**
 * A 32-bit checksum of a value and everything in it. Numbers go in bit for
 * bit, so two positions that differ in the last decimal give different sums.
 * A property that is `undefined` counts as missing, which is what it becomes
 * when the state is sent as JSON. Properties named in `skip` are left out.
 */
function checksum(value: unknown, skip?: string, hash = 0): number {
  if (typeof value === 'number') {
    if (value === (value | 0) && (value !== 0 || 1 / value > 0)) return mix(mix(hash, 1), value);
    float[0] = value;
    return mix(mix(mix(hash, 2), halves[0] as number), halves[1] as number);
  }
  if (typeof value === 'string') return mix(mix(hash, 3), textSum(value));
  if (typeof value === 'boolean') return mix(hash, value ? 5 : 4);
  if (value === null) return mix(hash, 6);
  if (value === undefined) return mix(hash, 7);
  if (Array.isArray(value) || ArrayBuffer.isView(value)) {
    const items = value as ArrayLike<unknown>;
    let h = mix(mix(hash, 8), items.length);
    for (let i = 0; i < items.length; i++) h = checksum(items[i], skip, h);
    return h;
  }
  if (typeof value !== 'object') throw new Error(`cannot be checksummed: ${typeof value}`);
  let h = mix(hash, 9);
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const item = record[key];
    if (item === undefined || key === skip) continue;
    h = checksum(item, skip, mix(h, textSum(key)));
  }
  return mix(h, 10);
}

/** Where two values first differ, as a path with both values, or undefined if they are alike. */
function firstDifference(a: unknown, b: unknown, path = 'state'): string | undefined {
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return Object.is(a, b) ? undefined : `${path}: ${String(a)} against ${String(b)}`;
  }
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const found = firstDifference(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
      `${path}.${key}`,
    );
    if (found) return found;
  }
  return undefined;
}

/** Fails, saying where, if two games are not in exactly the same state. */
function expectSame(a: GameState, b: GameState, what: string, skip?: string): number {
  const sum = checksum(a, skip);
  if (sum !== checksum(b, skip)) {
    throw new Error(
      `${what}: the games differ after step ${a.tick}: ${firstDifference(a, b) ?? 'only in a checksum'}`,
    );
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Playing recorded orders

/**
 * What the picture and the interface ask the simulation between steps. None
 * of it may change the game: a player who looks around must stay in step
 * with one who does not.
 */
function lookAround(state: GameState): void {
  for (const player of [0, 1] as const) {
    visibleEntities(state, player);
    const grid = buildPathGrid(state, player);
    const home = state.map.startPositions[player];
    if (!home) continue;
    for (let d = -6; d <= 6; d += 3) {
      isTileExplored(state, player, home.x + d, home.y - d);
      canPlaceBuilding(state, 'ide', home.x + d, home.y + 5, player);
      plannedWorkTiles(state, 'fiskehytta', { x: home.x + d, y: home.y + d });
    }
    planLine(state, 'palissad', { x: home.x - 6, y: home.y + 6 }, { x: home.x + 6, y: home.y + 7 });
    nearestDamaged(state.entities, player, home);
    for (const entity of state.entities) {
      isAttackable(state, entity, player);
      if (!isBuilding(entity) || entity.owner !== player) continue;
      costToMend(entity);
      if (entity.complete && BUILDING_DEFS[entity.type].work) workPlacesOf(state, grid, entity);
    }
  }
}

/**
 * Plays recorded orders in two games at once and compares them after every
 * step. The first is played straight through. The second is saved and
 * loaded again as JSON every ten seconds, as it would be for a player who
 * joins again, and is looked at the way the picture looks at it.
 *
 * @returns The checksum of the first game after each step.
 */
function replayTwice(
  make: () => GameState,
  orders: readonly RecordedOrder[],
  steps: number,
  skip?: string,
): Uint32Array {
  const first = make();
  let second = make();
  const sums = new Uint32Array(steps);
  let next = 0;
  for (let step = 0; step < steps; step++) {
    for (; orders[next]?.step === step; next++) {
      const order = orders[next] as RecordedOrder;
      const result = applyCommand(first, asSent(order.command));
      const again = applyCommand(second, asSent(order.command));
      // An order is carried out or refused the same way every time.
      if (JSON.stringify(result) !== JSON.stringify(order.result)) {
        throw new Error(`step ${step}: order ${next} gave ${JSON.stringify(result)} on replay`);
      }
      if (JSON.stringify(again) !== JSON.stringify(result)) {
        throw new Error(`step ${step}: order ${next} differs between the replays`);
      }
    }
    tick(first);
    tick(second);
    if (step % 10 === 0) lookAround(second);
    if (step % 200 === 199) second = asSent(second);
    sums[step] = expectSame(first, second, 'replay against replay', skip);
  }
  if (next !== orders.length) throw new Error(`${orders.length - next} orders were never played`);
  return sums;
}

// ---------------------------------------------------------------------------
// Orders from the computer players

/**
 * Plays a match between two computer players twice at once, compares them
 * step for step, and records every order the first one's players give.
 */
function recordComputerMatch(
  make: () => GameState,
  steps: number,
): { orders: RecordedOrder[]; sums: Uint32Array; played: number } {
  const first = make();
  const second = make();
  recorder.state = first;
  recorder.orders = [];
  const sums = new Uint32Array(steps);
  let played = 0;
  while (played < steps && first.winner === null) {
    tick(first);
    tick(second);
    // Everything alike, the computer players' memories too. The replay has
    // no computer players, so it is compared on all but their memory.
    const memories = (state: GameState) => state.players.map((side) => side.ai);
    if (checksum(memories(first)) !== checksum(memories(second))) {
      throw new Error(`the computer players' memories differ after step ${first.tick}`);
    }
    sums[played++] = expectSame(first, second, 'computer match against itself', 'ai');
  }
  recorder.state = undefined;
  return { orders: recorder.orders as RecordedOrder[], sums, played };
}

/**
 * A new game for a recorded computer match. In a `long` one neither main
 * building can be torn down, so that the match lasts as long as the test
 * asks and both sides grow to their full size.
 */
function computerGame(
  seed: number,
  levels: readonly [Difficulty, Difficulty] | undefined,
  long: boolean,
): GameState {
  const state = createGame(seed, undefined, undefined, { ai: levels ? [0, 1] : [], fog: false });
  state.players.forEach((side, i) => {
    if (side.ai && levels) side.ai.level = levels[i] as Difficulty;
  });
  if (long) {
    for (const entity of state.entities) if (isBuilding(entity)) entity.hp = 1e7;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Orders from two scripted players

const BUILDINGS = (Object.keys(BUILDING_DEFS) as BuildingType[]).filter(
  (type) => BUILDING_DEFS[type].buildTime > 0,
);
const UNITS = Object.keys(UNIT_DEFS) as UnitType[];

/** What each scripted player has from the start besides its main building, so that every kind of order has a use. */
const STARTING_BUILDINGS: readonly BuildingType[] = [
  'ide',
  'ide',
  'ide',
  'krigshall',
  'smedja',
  'odling',
  'kastbana',
];

/** Puts a finished building on the first place near a point where it can stand, with room around it. */
function raiseNear(state: GameState, type: BuildingType, owner: PlayerId, near: Point): void {
  for (let reach = 4; reach <= 16; reach += 4) {
    for (let dy = -reach; dy <= reach; dy += 4) {
      for (let dx = -reach; dx <= reach; dx += 4) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== reach) continue;
        if (!canPlaceBuilding(state, type, near.x + dx, near.y + dy)) continue;
        createBuilding(state, type, owner, near.x + dx, near.y + dy);
        return;
      }
    }
  }
}

/**
 * Gives both sides a stock, a small base and a few soldiers, so that the
 * scripted players have something to do with every kind of order.
 */
function prepared(seed: number): GameState {
  const state = createGame(seed, undefined, undefined, { ai: [] });
  state.map.startPositions.forEach((home, index) => {
    for (const type of STARTING_BUILDINGS) raiseNear(state, type, index as PlayerId, home);
  });
  const taken = new Set<number>();
  for (const unit of state.entities.filter(isUnit)) {
    taken.add(Math.floor(unit.y) * state.map.width + Math.floor(unit.x));
  }
  state.players.forEach((side, index) => {
    side.resources = { food: 4000, wood: 4000 };
    const home = state.entities.find((e): e is Building => isBuilding(e) && e.owner === index)!;
    const tiles = nearestFreeTiles(buildPathGrid(state), [buildingFrontTile(home)], 9, taken);
    tiles.forEach((tile, i) => {
      taken.add(tile.y * state.map.width + tile.x);
      createUnit(
        state,
        i % 3 === 2 ? 'ramkastare' : 'ramkrigare',
        index as PlayerId,
        tile.x,
        tile.y,
      );
    });
  });
  return state;
}

/** Some of the items, each with the given chance; never none if there are any. */
function some<T>(rng: RngState, items: readonly T[], chance: number): T[] {
  const chosen = items.filter(() => nextFloat(rng) < chance);
  return chosen.length > 0 || items.length === 0 ? chosen : [pick(rng, items)];
}

/** An order of a random kind from a player, sensible or not: orders that are refused are part of the game too. */
function scriptedOrder(state: GameState, rng: RngState, player: PlayerId): Command | undefined {
  const mine = state.entities.filter((entity) => entity.owner === player);
  const units = mine.filter(isUnit).filter((unit) => !hasSurrendered(unit));
  const buildings = mine.filter(isBuilding);
  const workers = units.filter((unit: Unit) => UNIT_DEFS[unit.type].carryCapacity > 0);
  const soldiers = units.filter((unit: Unit) => UNIT_DEFS[unit.type].aggroRadius > 0);
  const others = state.entities.filter((entity) => entity.owner !== player);
  const home = state.map.startPositions[player];
  const away = state.map.startPositions[1 - player];
  if (!home || !away || units.length === 0 || buildings.length === 0) return undefined;
  const near = (centre: { x: number; y: number }, reach: number) => ({
    x: centre.x + nextInt(rng, -reach, reach),
    y: centre.y + nextInt(rng, -reach, reach),
  });
  const ids = (list: readonly Unit[], chance: number) =>
    some(rng, list, chance).map((unit) => unit.id);
  // Mostly a building the order could be meant for, sometimes any building.
  const fitting = (accept: (building: Building) => boolean) => {
    const suited = buildings.filter(accept);
    return pick(rng, suited.length > 0 && nextFloat(rng) < 0.8 ? suited : buildings);
  };

  switch (nextInt(rng, 0, 13)) {
    case 0:
      return { type: 'move', player, unitIds: ids(units, 0.3), ...near(home, 12) };
    case 1:
      // An army on its way to the other side: this is what starts the fighting.
      return { type: 'move', player, unitIds: ids(soldiers, 0.8), ...near(away, 6) };
    case 2:
    case 3: {
      // A source of food or wood somewhere near the base, if the tile picked is one.
      const tile = near(home, 14);
      if (!resourceAt(state.map, tile.x, tile.y)) return undefined;
      return { type: 'gather', player, unitIds: ids(workers, 0.4), ...tile };
    }
    case 4: {
      const building = fitting((b) => b.complete && BUILDING_DEFS[b.type].trains.length > 0);
      const trains = BUILDING_DEFS[building.type].trains;
      const unit = trains.length > 0 && nextFloat(rng) < 0.8 ? pick(rng, trains) : pick(rng, UNITS);
      return { type: 'train', player, buildingId: building.id, unit };
    }
    case 5: {
      const building = fitting((b) => b.queue.length > 0);
      return { type: 'cancelTrain', player, buildingId: building.id, index: nextInt(rng, 0, 2) };
    }
    case 6: {
      const building = fitting((b) => b.complete && BUILDING_DEFS[b.type].researches !== undefined);
      const upgrade = pick(rng, UPGRADE_TYPES);
      return { type: 'research', player, buildingId: building.id, upgrade };
    }
    case 7: {
      const building = fitting((b) => b.research.length > 0);
      return { type: 'cancelResearch', player, buildingId: building.id, index: 0 };
    }
    case 8:
    case 9:
      return {
        type: 'build',
        player,
        unitIds: ids(workers, 0.3),
        // Housing often: without room nothing can be trained.
        building: nextFloat(rng) < 0.3 ? 'ide' : pick(rng, BUILDINGS),
        ...near(home, 9),
      };
    case 10: {
      const from = near(home, 9);
      const to = near(from, 6);
      return {
        type: 'buildLine',
        player,
        unitIds: ids(workers, 0.3),
        building: 'palissad',
        fromX: from.x,
        fromY: from.y,
        toX: to.x,
        toY: to.y,
      };
    }
    case 11: {
      if (nextFloat(rng) < 0.5) {
        const site = fitting((b) => !b.complete);
        return { type: 'construct', player, unitIds: ids(workers, 0.3), buildingId: site.id };
      }
      const hurt = fitting((b) => b.complete && b.hp < BUILDING_DEFS[b.type].hp);
      return { type: 'repair', player, unitIds: ids(workers, 0.3), buildingId: hurt.id };
    }
    case 12: {
      const place = fitting((b) => b.complete && BUILDING_DEFS[b.type].work !== undefined);
      return { type: 'work', player, unitIds: ids(workers, 0.3), buildingId: place.id };
    }
    default:
      if (others.length === 0) return undefined;
      return { type: 'attack', player, unitIds: ids(units, 0.6), targetId: pick(rng, others).id };
  }
}

/** Plays a match where two scripted players give an order each every half second, and records them. */
function recordScriptedMatch(
  seed: number,
  steps: number,
): { orders: RecordedOrder[]; sums: Uint32Array; played: number } {
  const state = prepared(seed);
  // The players' whims have their own random numbers: the game's are untouched.
  const rng = createRng(seed * 7919 + 13);
  const orders: RecordedOrder[] = [];
  const sums = new Uint32Array(steps);
  let played = 0;
  while (played < steps && state.winner === null) {
    if (played % 10 === 0) {
      for (const player of [0, 1] as const) {
        const command = scriptedOrder(state, rng, player);
        if (!command) continue;
        const sent = asSent(command);
        orders.push({ step: played, command: sent, result: applyCommand(state, asSent(sent)) });
      }
    }
    tick(state);
    sums[played++] = checksum(state);
  }
  return { orders, sums, played };
}

/** How many of the orders are of each kind, and how many were carried out. */
function tally(orders: readonly RecordedOrder[]): Record<string, string> {
  const counts: Record<string, [number, number]> = {};
  for (const { command, result } of orders) {
    const count = (counts[command.type] ??= [0, 0]);
    count[0]++;
    if (result.ok) count[1]++;
  }
  return Object.fromEntries(
    Object.entries(counts).map(([type, [all, ok]]) => [type, `${ok}/${all}`]),
  );
}

function expectSameSums(replayed: Uint32Array, recorded: Uint32Array, played: number): void {
  for (let step = 0; step < played; step++) {
    if (replayed[step] !== recorded[step]) {
      throw new Error(`the replay left the recorded match at step ${step + 1} of ${played}`);
    }
  }
}

// ---------------------------------------------------------------------------

describe('the checksum', () => {
  it('is the same for the same game and changes with the smallest difference', () => {
    const a = createGame(1);
    const b = createGame(1);
    expect(checksum(a)).toBe(checksum(b));
    expect(checksum(a)).not.toBe(checksum(createGame(2)));

    const unit = b.entities.find(isUnit)!;
    unit.x += Number.EPSILON * 16;
    expect(checksum(a)).not.toBe(checksum(b));
    expect(firstDifference(a, b)).toMatch(/^state\.entities\.\d+\.x: /);
    unit.x = a.entities.find(isUnit)!.x;
    expect(checksum(a)).toBe(checksum(b));

    b.players[1]!.visibility[77] = 2;
    expect(checksum(a)).not.toBe(checksum(b));
  });

  it('is the same after the game has been sent as JSON', () => {
    const state = createGame(3, undefined, undefined, { ai: [0, 1] });
    for (let i = 0; i < 600; i++) tick(state);
    expect(checksum(asSent(state))).toBe(checksum(state));
    expect(firstDifference(asSent(state), state)).toBeUndefined();
  });
});

describe('the same seed and the same orders give the same game, step for step', () => {
  // Matches that play differently, so that the seeds do not all tell the same
  // story: a usual one that ends when a side has won, and long ones.
  const MATCHES: readonly { levels: readonly [Difficulty, Difficulty]; long: boolean }[] = [
    { levels: ['medium', 'medium'], long: false },
    { levels: ['hard', 'easy'], long: true },
    { levels: ['hard', 'hard'], long: true },
    { levels: ['easy', 'medium'], long: false },
  ];

  it.each(SEEDS)('with the orders of two computer players, seed %i', (seed) => {
    const { levels, long } = MATCHES[SEEDS.indexOf(seed) % MATCHES.length]!;
    const recorded = recordComputerMatch(() => computerGame(seed, levels, long), STEPS);
    const { orders, sums, played } = recorded;
    // The match was a real one: both sides built, trained and fought.
    expect(played).toBeGreaterThanOrEqual(Math.min(STEPS, 4 * 60 * SIM_CONFIG.ticksPerSecond));
    if (long) expect(played).toBe(STEPS);
    const kinds = tally(orders);
    for (const kind of ['train', 'build', 'gather', 'attack']) expect(kinds).toHaveProperty(kind);

    // Without computer players, the recorded orders alone give the same match.
    const replayed = replayTwice(() => computerGame(seed, undefined, long), orders, played, 'ai');
    expectSameSums(replayed, sums, played);
    console.log(
      `DETERMINISM computer ${levels.join(' v ')}${long ? ' long' : ''} seed ${seed}: ${played} steps, ${orders.length} orders ${JSON.stringify(kinds)}`,
    );
  });

  it.each(SEEDS)('with orders of every kind from two scripted players, seed %i', (seed) => {
    const { orders, sums, played } = recordScriptedMatch(seed, STEPS);
    const kinds = tally(orders);
    // Every kind of order there is was given, and most kinds were also carried out.
    const all = [
      'move',
      'gather',
      'work',
      'train',
      'cancelTrain',
      'research',
      'cancelResearch',
      'build',
      'buildLine',
      'construct',
      'repair',
      'attack',
    ];
    expect(Object.keys(kinds).sort()).toEqual([...all].sort());
    const carriedOut = all.filter((kind) => !kinds[kind]!.startsWith('0/'));
    expect(carriedOut.length, JSON.stringify(kinds)).toBeGreaterThanOrEqual(10);

    const replayed = replayTwice(() => prepared(seed), orders, played);
    expectSameSums(replayed, sums, played);
    console.log(
      `DETERMINISM scripted seed ${seed}: ${played} steps, ${orders.length} orders ${JSON.stringify(kinds)}`,
    );
  });
});
