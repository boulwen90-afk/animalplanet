import { describe, expect, it, vi } from 'vitest';
import type { Difficulty } from '../data/ai';
import { BUILDING_DEFS } from '../data/buildings';
import { SIM_CONFIG } from '../data/sim';
import { checksum, firstDifference } from './checksum';
import { applyCommand, type Command, type CommandResult } from './commands';
import { isBuilding, isUnit } from './entities';
import { createGame } from './game';
import { buildPathGrid } from './pathfinding/passability';
import { createRng } from './rng';
import type { GameState } from './state';
import { isAttackable } from './systems/combat';
import { canPlaceBuilding, planLine } from './systems/construction';
import { plannedWorkTiles, workPlacesOf } from './systems/gathering';
import { costToMend, nearestDamaged } from './systems/repair';
import { isTileExplored, visibleEntities } from './systems/visibility';
import { prepared, scriptedOrder } from './testOrders';
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
