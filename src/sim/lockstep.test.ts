import { describe, expect, it, vi } from 'vitest';
import { LOCKSTEP_CONFIG } from '../data/lockstep';
import { SIM_CONFIG } from '../data/sim';
import { UNIT_DEFS } from '../data/units';
import { checksum } from './checksum';
import { applyCommand, checkCommand, type Command } from './commands';
import { isBuilding, isUnit } from './entities';
import { createGame } from './game';
import {
  createSession,
  delaySteps,
  isReady,
  receive,
  resend,
  step,
  submit,
  takeOutbox,
  turnOf,
  type OrderMessage,
} from './lockstep';
import { createRng, nextFloat, nextInt, type RngState } from './rng';
import type { Building, GameState, PlayerId, Unit } from './state';
import { prepared, scriptedOrder } from './testOrders';
import { tick } from './tick';

// Whole matches are simulated here, two at a time.
vi.setConfig({ testTimeout: 300_000 });

const SECOND = SIM_CONFIG.ticksPerSecond;
const DELAY = LOCKSTEP_CONFIG.delayTurns * LOCKSTEP_CONFIG.stepsPerTurn;

const unitsOf = (state: GameState, owner: number) =>
  state.entities.filter((e): e is Unit => isUnit(e) && e.owner === owner);
const homeOf = (state: GameState, owner: number) =>
  state.entities.find((e): e is Building => isBuilding(e) && e.owner === owner)!;
/** A message as it arrives: sent as JSON, so nothing is shared between the two games. */
const sent = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** An order to walk a side's first unit a few tiles. */
const moveOrder = (state: GameState, player: PlayerId, dx = 3): Command => {
  const [unit] = unitsOf(state, player);
  return {
    type: 'move',
    player,
    unitIds: [unit!.id],
    x: Math.floor(unit!.x) + dx,
    y: Math.floor(unit!.y),
  };
};
const trainWorker = (state: GameState, player: PlayerId): Command => ({
  type: 'train',
  player,
  buildingId: homeOf(state, player).id,
  unit: 'samlare',
});

/** Two players with a game each, as they have in a match. */
function twoPlayers(make: () => GameState) {
  const games = [make(), make()] as const;
  const sessions = [
    createSession({ humans: [0, 1], local: 0 }),
    createSession({ humans: [0, 1], local: 1 }),
  ] as const;
  /** Hands every waiting message straight to the other player. */
  const deliver = () => {
    for (const side of [0, 1] as const) {
      for (const message of takeOutbox(sessions[side])) receive(sessions[1 - side]!, sent(message));
    }
  };
  /** Runs one step on both sides with a perfect connection in between. */
  const stepBoth = () => {
    const ran = [step(sessions[0], games[0]), step(sessions[1], games[1])];
    deliver();
    return ran;
  };
  return { games, sessions, deliver, stepBoth };
}

describe('checking an order without carrying it out', () => {
  it('answers what the order would answer, and leaves the game as it was', () => {
    const state = createGame(1, undefined, undefined, { ai: [] });
    const before = checksum(state);
    expect(checkCommand(state, trainWorker(state, 0))).toEqual({ ok: true });
    expect(checkCommand(state, moveOrder(state, 0))).toEqual({ ok: true });
    state.players[0]!.resources.food = 0;
    expect(checkCommand(state, trainWorker(state, 0))).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['food'],
    });
    state.players[0]!.resources.food = 200;
    expect(checksum(state)).toBe(before);
    // And the same order really carried out answers the same.
    expect(applyCommand(state, trainWorker(state, 0))).toEqual({ ok: true });
    expect(checksum(state)).not.toBe(before);
  });
});

describe('one player, against the computer: no delay', () => {
  it('carries an order out at once and answers what happened', () => {
    const state = createGame(1);
    const session = createSession({ local: 0 });
    expect(session.delayTurns).toBe(0);
    expect(session.humans).toEqual([0]);

    expect(submit(session, state, trainWorker(state, 0))).toEqual({ ok: true });
    expect(homeOf(state, 0).queue).toEqual(['samlare']);
    state.players[0]!.resources.food = 0;
    expect(submit(session, state, trainWorker(state, 0))).toMatchObject({
      ok: false,
      reason: 'insufficientResources',
    });
    expect(session.issued).toEqual([]);
    expect(session.outbox).toEqual([]);
  });

  it('a step is a step of the game, and never has to wait', () => {
    const state = createGame(1);
    const session = createSession({ local: 0 });
    for (let i = 0; i < 100; i++) {
      expect(isReady(session, state)).toBe(true);
      expect(step(session, state)).toBe(true);
    }
    expect(state.tick).toBe(100);
    expect(session.outbox).toEqual([]);
  });

  it('gives the same match as orders carried out directly, step for step', () => {
    const direct = prepared(2);
    const queued = prepared(2);
    const session = createSession({ local: 0 });
    const rng = createRng(77);
    for (let i = 0; i < 60 * SECOND; i++) {
      if (i % 10 === 0) {
        const command = scriptedOrder(direct, rng, 0);
        if (command) {
          const a = applyCommand(direct, sent(command));
          const b = submit(session, queued, sent(command));
          expect(b).toEqual(a);
        }
      }
      tick(direct);
      step(session, queued);
      if (checksum(direct) !== checksum(queued)) throw new Error(`differ after step ${i}`);
    }
    expect(queued.tick).toBe(60 * SECOND);
  });

  it('takes no orders for another side, and none once the match is over', () => {
    const state = createGame(1);
    const session = createSession({ local: 0 });
    expect(submit(session, state, moveOrder(state, 1))).toEqual({ ok: false, reason: 'invalid' });
    state.winner = 1;
    expect(submit(session, state, moveOrder(state, 0))).toEqual({ ok: false, reason: 'invalid' });
    expect(step(session, state)).toBe(false);
    expect(state.tick).toBe(0);
  });
});

describe('an order with a delay', () => {
  const alone = (delayTurns = LOCKSTEP_CONFIG.delayTurns) => ({
    state: createGame(1, undefined, undefined, { ai: [] }),
    session: createSession({ local: 0, delayTurns }),
  });

  it('a turn is 4 steps and the delay 2 turns: 8 steps, 400 ms', () => {
    const { session } = alone();
    expect(session.stepsPerTurn).toBe(4);
    expect(session.delayTurns).toBe(2);
    expect(delaySteps(session)).toBe(8);
    expect((delaySteps(session) * 1000) / SIM_CONFIG.ticksPerSecond).toBe(400);
    expect([0, 3, 4, 7, 8].map((s) => turnOf(session, s))).toEqual([0, 0, 1, 1, 2]);
  });

  it('is carried out exactly 8 steps after it was given, whenever in the turn that was', () => {
    for (const given of [0, 1, 2, 3, 4, 5, 9, 14]) {
      const { state, session } = alone();
      for (let i = 0; i < given; i++) step(session, state);
      const [unit] = unitsOf(state, 0);
      const before = checksum(state);
      expect(submit(session, state, moveOrder(state, 0))).toEqual({ ok: true });
      // Giving the order changes nothing in the game.
      expect(checksum(state)).toBe(before);

      for (let i = 0; i < DELAY; i++) {
        expect(unit!.path, `given at ${given}, ${i} steps later`).toEqual([]);
        expect(step(session, state)).toBe(true);
        expect(session.outcomes, `given at ${given}, step ${state.tick - 1}`).toEqual([]);
      }
      // Its step: the order is carried out before the game moves on.
      expect(state.tick).toBe(given + DELAY);
      step(session, state);
      expect(session.outcomes).toMatchObject([
        { player: 0, step: given + DELAY, command: { type: 'move' }, result: { ok: true } },
      ]);
      expect(unit!.path.length).toBeGreaterThan(0);
      // And only once.
      step(session, state);
      expect(session.outcomes).toEqual([]);
    }
  });

  it('answers at once what the order would answer now, and does not send one that would be refused', () => {
    const { state, session } = alone();
    state.players[0]!.resources.food = 0;
    expect(submit(session, state, trainWorker(state, 0))).toEqual({
      ok: false,
      reason: 'insufficientResources',
      missing: ['food'],
    });
    expect(session.issued).toEqual([]);
    for (let i = 0; i < 20; i++) step(session, state);
    expect(homeOf(state, 0).queue).toEqual([]);
  });

  it('reports what really became of an order that was refused when its step came', () => {
    const { state, session } = alone();
    // Food for one worker, and two orders for one each: both look fine now.
    state.players[0]!.resources.food = UNIT_DEFS.samlare.cost.food!;
    expect(submit(session, state, trainWorker(state, 0))).toEqual({ ok: true });
    expect(submit(session, state, trainWorker(state, 0))).toEqual({ ok: true });
    for (let i = 0; i < DELAY; i++) step(session, state);
    step(session, state);
    expect(session.outcomes.map((outcome) => outcome.result)).toEqual([
      { ok: true },
      { ok: false, reason: 'insufficientResources', missing: ['food'] },
    ]);
    expect(homeOf(state, 0).queue).toEqual(['samlare']);
  });

  it('keeps a copy of the order: changing what was passed in afterwards changes nothing', () => {
    const { state, session } = alone();
    const command = moveOrder(state, 0);
    submit(session, state, command);
    if (command.type === 'move') command.unitIds.length = 0;
    for (let i = 0; i <= DELAY; i++) step(session, state);
    expect(unitsOf(state, 0)[0]!.path.length).toBeGreaterThan(0);
  });
});

describe('two players', () => {
  const fresh = () => createGame(3, undefined, undefined, { ai: [] });

  it('must have a delay, and are served in the order of their sides', () => {
    expect(() => createSession({ humans: [0, 1], local: 0, delayTurns: 0 })).toThrow();
    expect(() => createSession({ humans: [1], local: 0 })).toThrow();
    expect(createSession({ humans: [1, 0], local: 1 }).humans).toEqual([0, 1]);
    expect(createSession({ humans: [0, 1], local: 1 }).delayTurns).toBe(2);
  });

  it('an order from one player is carried out in the same step in both games', () => {
    const { games, sessions, stepBoth } = twoPlayers(fresh);
    for (let i = 0; i < 6; i++) stepBoth();
    expect(submit(sessions[1], games[1], moveOrder(games[1], 1))).toEqual({ ok: true });
    const carriedOut: number[][] = [[], []];
    for (let i = 0; i < 20; i++) {
      stepBoth();
      for (const side of [0, 1]) {
        if (sessions[side]!.outcomes.length > 0) carriedOut[side]!.push(games[side]!.tick - 1);
      }
      expect(checksum(games[0])).toBe(checksum(games[1]));
    }
    expect(carriedOut).toEqual([[6 + DELAY], [6 + DELAY]]);
    expect(unitsOf(games[0], 1)[0]!.path.length).toBeGreaterThan(0);
  });

  it('orders for the same step are carried out side 0 first, each side in the order they were given', () => {
    const { games, sessions, stepBoth } = twoPlayers(fresh);
    // Side 1 gives its orders first in time; that must not matter.
    submit(sessions[1], games[1], moveOrder(games[1], 1, 2));
    submit(sessions[1], games[1], trainWorker(games[1], 1));
    submit(sessions[0], games[0], trainWorker(games[0], 0));
    submit(sessions[0], games[0], moveOrder(games[0], 0, 2));
    for (let i = 0; i < DELAY; i++) stepBoth();
    stepBoth();
    for (const session of sessions) {
      expect(session.outcomes.map((o) => [o.player, o.command.type])).toEqual([
        [0, 'train'],
        [0, 'move'],
        [1, 'move'],
        [1, 'train'],
      ]);
    }
    expect(checksum(games[0])).toBe(checksum(games[1]));
  });

  it('a step waits until the other player’s orders for it are here, and then goes on', () => {
    const { games, sessions } = twoPlayers(fresh);
    const [mine, theirs] = sessions;
    // The first two turns have no orders in them: nobody could have given any.
    for (let i = 0; i < DELAY; i++) expect(step(mine, games[0])).toBe(true);
    // The third needs what the other player gave in the first.
    expect(isReady(mine, games[0])).toBe(false);
    expect(step(mine, games[0])).toBe(false);
    expect(games[0].tick).toBe(DELAY);
    const before = checksum(games[0]);
    for (let i = 0; i < 50; i++) step(mine, games[0]);
    expect(checksum(games[0])).toBe(before);

    // The other player plays its first turn and sends it.
    for (let i = 0; i < LOCKSTEP_CONFIG.stepsPerTurn; i++) step(theirs, games[1]);
    const [message] = takeOutbox(theirs);
    expect(message).toMatchObject({ player: 1, turns: [{ turn: 0, orders: [] }] });
    expect(receive(mine, sent(message!))).toBe(true);
    // Now one more turn can be played here, and no more.
    for (let i = 0; i < LOCKSTEP_CONFIG.stepsPerTurn; i++) expect(step(mine, games[0])).toBe(true);
    expect(step(mine, games[0])).toBe(false);
    expect(games[0].tick).toBe(DELAY + LOCKSTEP_CONFIG.stepsPerTurn);
  });

  it('sends one message at the end of every turn, also when there are no orders', () => {
    const { games, sessions } = twoPlayers(fresh);
    for (let i = 0; i < DELAY; i++) step(sessions[0], games[0]);
    const messages = takeOutbox(sessions[0]);
    expect(messages).toHaveLength(LOCKSTEP_CONFIG.delayTurns);
    // Nothing confirmed yet, so the second repeats the first turn.
    expect(messages.map((m) => m.turns.map((t) => t.turn))).toEqual([[0], [0, 1]]);
    expect(messages[1]!.have).toEqual({ 1: -1 });
  });

  it('stops repeating a turn once the other player has said it has it, and forgets it', () => {
    const { games, sessions, stepBoth } = twoPlayers(fresh);
    for (let i = 0; i < 400; i++) {
      if (i % 7 === 0) submit(sessions[0], games[0], moveOrder(games[0], 0, (i % 5) - 2));
      stepBoth();
    }
    expect(games[0].tick).toBe(400);
    expect(games[1].tick).toBe(400);
    for (const session of sessions) {
      // A handful of turns are kept, not all hundred.
      for (const player of [0, 1]) {
        expect(Object.keys(session.turns[player]!).length).toBeLessThanOrEqual(4);
      }
      resend(session);
      const [message] = takeOutbox(session);
      expect(message!.turns.length).toBeLessThanOrEqual(3);
    }
  });

  it('a message may come twice, late and out of order', () => {
    const { games, sessions } = twoPlayers(fresh);
    const [mine, theirs] = sessions;
    submit(theirs, games[1], moveOrder(games[1], 1));
    for (let i = 0; i < 3 * LOCKSTEP_CONFIG.stepsPerTurn; i++) step(theirs, games[1]);
    // Only turns 0 and 1 could be played without us; take what was sent.
    const messages = takeOutbox(theirs).map(sent);
    expect(messages.length).toBeGreaterThanOrEqual(2);
    // The newest first, then the older ones, then all of them again.
    for (const message of [...messages].reverse()) expect(receive(mine, message)).toBe(true);
    const have = mine.have[1];
    const kept = sent(mine.turns[1]);
    for (const message of messages) expect(receive(mine, message)).toBe(true);
    expect(mine.have[1]).toBe(have);
    expect(mine.turns[1]).toEqual(kept);
    expect(have).toBeGreaterThanOrEqual(1);
  });

  it('refuses a message that is not what a message from the other player can be', () => {
    const { games, sessions } = twoPlayers(fresh);
    const [mine] = sessions;
    const order = (player: PlayerId, at: number) => ({
      step: at,
      command: moveOrder(games[0], player),
    });
    const good: OrderMessage = {
      player: 1,
      have: { 0: -1 },
      turns: [{ turn: 0, orders: [order(1, DELAY + 1)] }],
    };
    const bad: [string, OrderMessage][] = [
      ['from this side itself', { ...good, player: 0 }],
      ['from a side that is nobody’s', { ...good, player: 5 as PlayerId }],
      ['an order for our units', { ...good, turns: [{ turn: 0, orders: [order(0, DELAY + 1)] }] }],
      [
        'an order before its turn',
        { ...good, turns: [{ turn: 0, orders: [order(1, DELAY - 1)] }] },
      ],
      ['an order after its turn', { ...good, turns: [{ turn: 0, orders: [order(1, DELAY + 4)] }] }],
      [
        'a step that is no step',
        { ...good, turns: [{ turn: 0, orders: [order(1, DELAY + 0.5)] }] },
      ],
      ['a turn that is no turn', { ...good, turns: [{ turn: -1, orders: [] }] }],
      ['no turns', { ...good, turns: undefined as unknown as [] }],
    ];
    for (const [what, message] of bad) {
      const before = sent(mine);
      expect(receive(mine, sent(message)), what).toBe(false);
      expect(mine, what).toEqual(before);
    }
    expect(receive(mine, sent(good))).toBe(true);
    expect(mine.have[1]).toBe(0);
  });

  it('stands still when the match is over', () => {
    const { games, stepBoth } = twoPlayers(fresh);
    for (let i = 0; i < 10; i++) stepBoth();
    for (const game of games) game.winner = 0;
    expect(stepBoth()).toEqual([false, false]);
    expect(games.map((game) => game.tick)).toEqual([10, 10]);
  });
});

/**
 * A connection that loses, delays, doubles and reorders messages, with its
 * own random numbers.
 */
class BadLine {
  private readonly waiting: { due: number; to: 0 | 1; message: OrderMessage }[] = [];
  lost = 0;
  carried = 0;

  constructor(
    private readonly rng: RngState,
    private readonly loss: number,
    private readonly longest: number,
  ) {}

  send(to: 0 | 1, message: OrderMessage, now: number): void {
    if (nextFloat(this.rng) < this.loss) {
      this.lost++;
      return;
    }
    const copies = nextFloat(this.rng) < 0.1 ? 2 : 1;
    for (let i = 0; i < copies; i++) {
      // Each copy takes its own time, so a later message can overtake it.
      this.waiting.push({
        due: now + nextInt(this.rng, 1, this.longest),
        to,
        message: sent(message),
      });
    }
  }

  arrived(now: number): { to: 0 | 1; message: OrderMessage }[] {
    const due = this.waiting.filter((item) => item.due <= now);
    for (const item of due) this.waiting.splice(this.waiting.indexOf(item), 1);
    this.carried += due.length;
    return due;
  }
}

/**
 * Plays a match between two scripted players over a bad connection. Each
 * side tries to run one step every tick of the clock, as it would with a
 * frame every 50 ms, and sends its message again when it has stood still
 * for a while.
 *
 * @returns How far each side got, and the checksum of each side's game after every step.
 */
function playOverBadLine(seed: number, ticks: number, loss: number, longest: number) {
  const { games, sessions } = twoPlayers(() => prepared(seed));
  const line = new BadLine(createRng(seed * 31 + 7), loss, longest);
  const whims = [createRng(seed * 101 + 1), createRng(seed * 211 + 2)];
  const sums: number[][] = [[], []];
  const stood = [0, 0];
  let longestWait = 0;
  let orders = 0;
  for (let now = 0; now < ticks; now++) {
    for (const { to, message } of line.arrived(now)) receive(sessions[to], message);
    for (const side of [0, 1] as const) {
      // An order every half second or so, as the game stands on this side.
      if (now % 10 === side * 5) {
        const command = scriptedOrder(games[side], whims[side]!, side);
        if (command && submit(sessions[side], games[side], sent(command)).ok) orders++;
      }
      if (step(sessions[side], games[side])) {
        sums[side]!.push(checksum(games[side]));
        stood[side] = 0;
      } else {
        stood[side]!++;
        longestWait = Math.max(longestWait, stood[side]!);
        // Standing still: say again what has been said, four times a second.
        if (stood[side]! % 5 === 0) resend(sessions[side]);
      }
      for (const message of takeOutbox(sessions[side]))
        line.send((1 - side) as 0 | 1, message, now);
    }
  }
  return { games, sums, line, longestWait, orders };
}

describe('two players over a bad connection', () => {
  it.each([
    ['a good one: nothing lost, a tenth of a second on the way', 0, 2],
    ['a slow one: nothing lost, up to half a second on the way', 0, 10],
    ['a poor one: a fifth lost, up to 300 ms on the way', 0.2, 6],
    ['a bad one: half lost, up to a second on the way', 0.5, 20],
  ] as const)('%s: the two games are alike after every step', (_name, loss, longest) => {
    for (const seed of [1, 2]) {
      const ticks = 90 * SECOND;
      const played = playOverBadLine(seed, ticks, loss, longest);
      const { sums, games } = played;
      const both = Math.min(sums[0]!.length, sums[1]!.length);
      for (let i = 0; i < both; i++) {
        if (sums[0]![i] !== sums[1]![i])
          throw new Error(`seed ${seed}: differ after step ${i + 1}`);
      }
      // Orders were given and carried out, and neither side is far ahead of the other.
      expect(played.orders, `seed ${seed}`).toBeGreaterThan(100);
      expect(Math.abs(games[0].tick - games[1].tick), `seed ${seed}`).toBeLessThanOrEqual(
        DELAY + LOCKSTEP_CONFIG.stepsPerTurn,
      );
      // The match got on. With nothing lost and a short way it runs at full speed.
      if (loss === 0 && longest <= 2) expect(both, `seed ${seed}`).toBeGreaterThan(ticks - 20);
      else expect(both, `seed ${seed}`).toBeGreaterThan(ticks / 4);
      if (loss > 0) expect(played.line.lost, `seed ${seed}`).toBeGreaterThan(50);
    }
  });

  it('the same match over the same bad connection goes the same way twice', () => {
    const a = playOverBadLine(3, 40 * SECOND, 0.3, 8);
    const b = playOverBadLine(3, 40 * SECOND, 0.3, 8);
    expect(a.sums).toEqual(b.sums);
    expect(a.longestWait).toBe(b.longestWait);
  });

  it('a connection that is cut stops both, and they go on in step when it is back', () => {
    const { games, sessions, stepBoth } = twoPlayers(() => prepared(4));
    for (let i = 0; i < 100; i++) stepBoth();
    // Cut: each side plays on alone and what it sends is lost.
    for (let i = 0; i < 200; i++) {
      for (const side of [0, 1] as const) {
        step(sessions[side], games[side]);
        if (i % 5 === 0) resend(sessions[side]);
        takeOutbox(sessions[side]);
      }
    }
    // Each got as far as the orders it already had allowed, and no further.
    expect(games[0].tick).toBe(games[1].tick);
    expect(games[0].tick).toBeLessThanOrEqual(100 + DELAY + LOCKSTEP_CONFIG.stepsPerTurn);
    expect(checksum(games[0])).toBe(checksum(games[1]));
    const stoppedAt = games[0].tick;

    // Back: one message each way is enough.
    for (const session of sessions) resend(session);
    for (let i = 0; i < 100; i++) stepBoth();
    expect(games[0].tick).toBeGreaterThan(stoppedAt + 90);
    expect(checksum(games[0])).toBe(checksum(games[1]));
  });
});
