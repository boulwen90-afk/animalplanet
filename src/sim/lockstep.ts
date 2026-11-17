import { LOCKSTEP_CONFIG } from '../data/lockstep';
import { checksum, firstDifference } from './checksum';
import { applyCommand, checkCommand, type Command, type CommandResult } from './commands';
import type { GameState, PlayerId } from './state';
import { tick } from './tick';

/**
 * Turns and the queue of orders.
 *
 * In a match between two players each runs the simulation on their own
 * machine, and only orders travel between them. The games stay alike as
 * long as both carry out the same orders in the same simulation step. So an
 * order is not carried out when it is given. It is given a step some turns
 * ahead, sent to the other player, and carried out by both when that step
 * comes; and a step is not run until the orders that belong to it are here
 * from everybody.
 *
 * - The match is divided into turns of `stepsPerTurn` steps.
 * - An order given at step s is carried out at step s + delay, where the
 *   delay is `delayTurns` turns. Orders for the same step are carried out
 *   side by side in a fixed order: the sides in the order of `humans`, and
 *   each side's orders in the order they were given.
 * - When a turn ends, the orders given during it are sealed and sent. The
 *   turn `delayTurns` later cannot begin before every player's sealed
 *   orders from this one have arrived.
 * - A message repeats every sealed turn the other player has not confirmed,
 *   so a message that is lost, late or doubled does no harm.
 *
 * With one player, against the computer, the delay is 0: an order is
 * carried out at once, and nothing is sent. It is the same code either way.
 *
 * The players also watch that their games really are alike. Once a second
 * each takes a checksum of its whole game state and sends it along with its
 * orders. If two checksums for the same step differ, the games have come
 * apart: both stop, the host sends its game state, the other takes it over,
 * and they go on from there.
 *
 * Everything here is plain data and pure logic. Sending the messages is
 * somebody else's work: they are taken from `outbox` and handed to
 * `receive` on the other side.
 */

/** An order and the simulation step it is to be carried out in. */
export interface ScheduledOrder {
  step: number;
  command: Command;
}

/** The orders a player gave during one turn. */
export interface TurnOrders {
  turn: number;
  orders: ScheduledOrder[];
}

/** A checksum of a player's game state after a number of steps. */
export interface StateCheck {
  step: number;
  sum: number;
}

/** A player's orders, and its latest checksums. Sent at the end of every turn. */
export interface OrderMessage {
  kind: 'orders';
  /** The side that gave these orders. */
  player: PlayerId;
  /** How many times the sender's game has been set right from the host's. See `Session.epoch`. */
  epoch: number;
  /**
   * For each other side, the last turn up to which the sender holds all of
   * that side's orders; -1 if none. The receiver need not send those again.
   */
  have: Record<number, number>;
  /** The sender's sealed turns that the receiver has not confirmed, oldest first. */
  turns: TurnOrders[];
  /** The sender's latest checksums, oldest first. */
  checks: StateCheck[];
}

/** The host's whole game, for a player whose game has come apart from it to take over. */
export interface StateMessage {
  kind: 'state';
  /** The host. */
  player: PlayerId;
  /** The epoch that begins with this state. */
  epoch: number;
  state: GameState;
  /**
   * The host's game as it was at the step where the games were found to
   * differ, when it keeps such copies. With it the receiver can say where
   * its own game differed. For finding the fault, not for playing on.
   */
  trace?: { step: number; state: GameState };
}

/** Anything one player sends to another. */
export type Message = OrderMessage | StateMessage;

/** A time the games were found to have come apart. */
export interface Divergence {
  /** The step after which the checksums differed. */
  step: number;
  /** Where in the game state this side differed from the host, if it could be told. */
  where?: string;
}

/** What became of an order when it was carried out. */
export interface OrderOutcome {
  player: PlayerId;
  step: number;
  command: Command;
  result: CommandResult;
}

/** A player's view of the turns of a match. Plain data. */
export interface Session {
  stepsPerTurn: number;
  delayTurns: number;
  maxTurnsPerMessage: number;
  /** The sides played by people, in the order their orders are carried out. */
  humans: PlayerId[];
  /** The side played on this machine. */
  local: PlayerId;
  /** Orders given here during the turn that is going on, not yet sealed. */
  issued: ScheduledOrder[];
  /** Each side's sealed orders, by side and then by the turn they were given in. */
  turns: Record<number, Record<number, ScheduledOrder[]>>;
  /** For each side, the last turn up to which all its orders are here; -1 if none. */
  have: Record<number, number>;
  /** For each other side, the last of this side's turns it has confirmed; -1 if none. */
  confirmed: Record<number, number>;
  /** Messages to send, oldest first. Whoever sends them empties the list. */
  outbox: Message[];
  /** What became of the orders carried out in the latest step, in the order they were carried out. */
  outcomes: OrderOutcome[];

  /** The side whose game the others take over when the games have come apart. */
  host: PlayerId;
  /**
   * How many times the games have been set right from the host's. Checksums
   * from an earlier epoch belong to a game that has been replaced, and are
   * not compared.
   */
  epoch: number;
  /** A checksum is taken after every this many steps. */
  checkEvery: number;
  /** Each side's latest checksums of this epoch, by side and then by step. */
  checks: Record<number, Record<number, number>>;
  /**
   * Why the match stands still, if it does for this reason: `diverged`
   * when the games have been found to differ and this side waits for the
   * host's game, `resyncing` on the host while it waits for the others to
   * say they have taken its game over.
   */
  stopped: 'diverged' | 'resyncing' | null;
  /** The host's game as it was sent, kept to be sent again until it is confirmed. */
  snapshot: StateMessage | null;
  /** Every time the games have come apart, oldest first. */
  divergences: Divergence[];
  /** Whether copies of the game are kept at the checksum steps, to tell where two games differ. */
  trace: boolean;
  /** Those copies, oldest first: at most a few. */
  kept: { step: number; state: GameState }[];
}

export interface SessionOptions {
  /** The sides played by people. Default: the local side alone. */
  humans?: readonly PlayerId[];
  /** The side played on this machine. */
  local: PlayerId;
  /** Turns between an order and its step. Default: 0 alone, the configured delay with others. */
  delayTurns?: number;
  stepsPerTurn?: number;
  /** The side whose game the others take over. Default: the first of the humans. */
  host?: PlayerId;
  /** Keep copies of the game to tell where two games differ. Costs a copy a second. Default: off. */
  trace?: boolean;
}

export function createSession(options: SessionOptions): Session {
  const humans = [...(options.humans ?? [options.local])].sort((a, b) => a - b);
  if (!humans.includes(options.local)) throw new Error('the local side must be one of the humans');
  const delayTurns = options.delayTurns ?? (humans.length > 1 ? LOCKSTEP_CONFIG.delayTurns : 0);
  if (humans.length > 1 && delayTurns < 1) {
    throw new Error('orders between players need at least one turn of delay');
  }
  const session: Session = {
    stepsPerTurn: options.stepsPerTurn ?? LOCKSTEP_CONFIG.stepsPerTurn,
    delayTurns,
    maxTurnsPerMessage: LOCKSTEP_CONFIG.maxTurnsPerMessage,
    humans,
    local: options.local,
    issued: [],
    turns: {},
    have: {},
    confirmed: {},
    outbox: [],
    outcomes: [],
    host: options.host ?? (humans[0] as PlayerId),
    epoch: 0,
    checkEvery: LOCKSTEP_CONFIG.checkEvery,
    checks: {},
    stopped: null,
    snapshot: null,
    divergences: [],
    trace: options.trace ?? false,
    kept: [],
  };
  if (!humans.includes(session.host)) throw new Error('the host must be one of the humans');
  for (const player of humans) {
    session.turns[player] = {};
    session.checks[player] = {};
    session.have[player] = -1;
    if (player !== options.local) session.confirmed[player] = -1;
  }
  return session;
}

/** The turn a step belongs to. */
export function turnOf(session: Session, step: number): number {
  return Math.floor(step / session.stepsPerTurn);
}

/** How many steps after it is given an order is carried out. */
export function delaySteps(session: Session): number {
  return session.delayTurns * session.stepsPerTurn;
}

/**
 * Gives an order from the player on this machine. With no delay it is
 * carried out now and the answer is what happened. With a delay it is put
 * in the queue for its step and the answer is what would happen if it were
 * carried out now; an order that would be refused now is not sent at all.
 * What really becomes of a queued order is in `outcomes` when its step has
 * been run.
 */
export function submit(session: Session, state: GameState, command: Command): CommandResult {
  // No orders while the games are being set right: the game they were meant for may be replaced.
  if (command.player !== session.local || state.winner !== null || session.stopped !== null) {
    return { ok: false, reason: 'invalid' };
  }
  const delay = delaySteps(session);
  if (delay === 0) return applyCommand(state, command);
  const expected = checkCommand(state, command);
  if (!expected.ok) return expected;
  // Its step, but never in a turn that is already sealed: after the game
  // has been set back to the host's, this side may have sealed turns ahead.
  const firstOpen = ((session.have[session.local] as number) + 1) * session.stepsPerTurn;
  const at = Math.max(state.tick, firstOpen) + delay;
  // A copy: the caller may go on using what it passed in.
  session.issued.push({ step: at, command: structuredClone(command) });
  return expected;
}

/**
 * The turn whose orders the next step needs: the one `delayTurns` before the
 * step's own. Negative at the start of the match, when no orders can be due.
 */
function neededTurn(session: Session, state: GameState): number {
  return turnOf(session, state.tick) - session.delayTurns;
}

/** True if the orders that belong to the next step are here from every player. */
export function isReady(session: Session, state: GameState): boolean {
  // Without a delay orders are carried out when they are given: none are ever due.
  if (session.delayTurns === 0) return true;
  const needed = neededTurn(session, state);
  if (needed < 0) return true;
  return session.humans.every((player) => (session.have[player] as number) >= needed);
}

/**
 * Runs one simulation step, if the orders for it are here: carries out the
 * orders that are due and then advances the game. At the end of a turn the
 * orders given during it are sealed and, with other players, a message is
 * put in the outbox.
 *
 * @returns False, with nothing changed, if the step has to wait for another
 * player's orders or the match is over.
 */
export function step(session: Session, state: GameState): boolean {
  if (session.stopped === 'diverged' && session.local === session.host) sendState(session, state);
  if (session.stopped !== null) return false;
  if (state.winner !== null || !isReady(session, state)) return false;
  const now = state.tick;
  const needed = neededTurn(session, state);
  session.outcomes = [];
  if (needed >= 0 && session.delayTurns > 0) {
    for (const player of session.humans) {
      for (const order of session.turns[player]?.[needed] ?? []) {
        if (order.step !== now) continue;
        const result = applyCommand(state, order.command);
        session.outcomes.push({ player, step: now, command: order.command, result });
      }
    }
  }
  tick(state);
  if (session.humans.length > 1 && state.tick % session.checkEvery === 0) check(session, state);

  const turn = turnOf(session, now);
  if (turnOf(session, state.tick) === turn) return true;
  // The turn is over. Its orders are sealed, unless they already were: a
  // game set back to the host's plays turns over that this side had sealed.
  if (turn > (session.have[session.local] as number)) {
    (session.turns[session.local] as Record<number, ScheduledOrder[]>)[turn] = session.issued;
    session.have[session.local] = turn;
    session.issued = [];
  }
  // The turn the orders were due in is done with, but is kept a while yet:
  // see `forget`.
  forget(session, needed - session.delayTurns - 2);
  if (session.humans.length > 1) session.outbox.push(message(session));
  return true;
}

/** How many checksums, and copies of the game, a side keeps of each player. */
const CHECKS_KEPT = 8;
const COPIES_KEPT = 3;

/** Takes this side's checksum after the step just run, and compares it with the others'. */
function check(session: Session, state: GameState): void {
  const mine = session.checks[session.local] as Record<number, number>;
  mine[state.tick] = checksum(state);
  if (session.trace) {
    session.kept.push({ step: state.tick, state: structuredClone(state) });
    if (session.kept.length > COPIES_KEPT) session.kept.shift();
  }
  compare(session);
  forgetOldChecks(session);
}

/** Keeps only each side's latest checksums. */
function forgetOldChecks(session: Session): void {
  for (const player of session.humans) {
    const kept = session.checks[player] as Record<number, number>;
    const steps = Object.keys(kept).map(Number);
    for (const old of steps.slice(0, Math.max(0, steps.length - CHECKS_KEPT))) delete kept[old];
  }
}

/**
 * Compares the checksums that both this side and another have for the same
 * step. If any differ, the games have come apart, and the match stops.
 */
function compare(session: Session): void {
  if (session.stopped !== null) return;
  const mine = session.checks[session.local] as Record<number, number>;
  for (const player of session.humans) {
    if (player === session.local) continue;
    const theirs = session.checks[player] as Record<number, number>;
    for (const key of Object.keys(theirs)) {
      const at = Number(key);
      if (mine[at] === undefined || mine[at] === theirs[at]) continue;
      session.stopped = 'diverged';
      session.divergences.push({ step: at });
      // The host may not know yet: this side's checksum goes to it at once,
      // not with the next turn, which will not come while the match stands.
      if (session.local !== session.host) session.outbox.push(message(session));
      return;
    }
  }
}

/**
 * On the host, when the games have come apart: begins a new epoch and sends
 * the whole game for the others to take over. The host then waits until
 * they have said they have it.
 */
function sendState(session: Session, state: GameState): void {
  const found = session.divergences[session.divergences.length - 1];
  const trace = session.kept.find((copy) => copy.step === found?.step);
  session.epoch++;
  session.snapshot = {
    kind: 'state',
    player: session.local,
    epoch: session.epoch,
    state: structuredClone(state),
    ...(trace ? { trace: structuredClone(trace) } : {}),
  };
  session.stopped = 'resyncing';
  forgetChecks(session);
  session.outbox.push(session.snapshot);
}

/** Drops every checksum and copy: they belong to the epoch that is over. */
function forgetChecks(session: Session): void {
  for (const player of session.humans) session.checks[player] = {};
  session.kept = [];
}

/**
 * Drops the turns that are no longer needed: those up to `carriedOut`, and
 * of this side's own, only those the others have confirmed.
 *
 * A turn that has been carried out is kept a few turns longer. A side whose
 * game is set back to the host's may have been a little ahead of the host,
 * by no more than the delay, and then carries the same orders out again.
 */
function forget(session: Session, carriedOut: number): void {
  const others = session.humans.filter((player) => player !== session.local);
  const confirmedByAll = Math.min(...others.map((player) => session.confirmed[player] as number));
  for (const player of session.humans) {
    const kept = session.turns[player] as Record<number, ScheduledOrder[]>;
    const upTo = player === session.local ? Math.min(carriedOut, confirmedByAll) : carriedOut;
    for (const key of Object.keys(kept)) {
      if (Number(key) <= upTo) delete kept[Number(key)];
    }
  }
}

/** The message this side would send now: what it holds of the others, and its unconfirmed turns. */
function message(session: Session): OrderMessage {
  const others = session.humans.filter((player) => player !== session.local);
  const confirmedByAll = Math.min(...others.map((player) => session.confirmed[player] as number));
  const own = session.turns[session.local] as Record<number, ScheduledOrder[]>;
  const turns: TurnOrders[] = [];
  const last = session.have[session.local] as number;
  for (let turn = confirmedByAll + 1; turn <= last; turn++) {
    if (turns.length >= session.maxTurnsPerMessage) break;
    turns.push({ turn, orders: own[turn] ?? [] });
  }
  const have: Record<number, number> = {};
  for (const player of others) have[player] = session.have[player] as number;
  const mine = session.checks[session.local] as Record<number, number>;
  const checks = Object.keys(mine)
    .map(Number)
    .slice(-LOCKSTEP_CONFIG.checksPerMessage)
    .map((at) => ({ step: at, sum: mine[at] as number }));
  return { kind: 'orders', player: session.local, epoch: session.epoch, have, turns, checks };
}

/**
 * Puts the current message in the outbox once more. For when the match
 * stands still waiting for the other player: the message that would have
 * got it going may be the one that was lost.
 */
export function resend(session: Session): void {
  if (session.humans.length < 2) return;
  // A host that waits for its game to be taken over says that again instead.
  session.outbox.push(session.snapshot ?? message(session));
}

/** Takes the messages to send out of the session. */
export function takeOutbox(session: Session): Message[] {
  const messages = session.outbox;
  session.outbox = [];
  return messages;
}

/**
 * Takes in a message from another player. A message that is not what such a
 * message can be is refused whole: one from a side that is not another
 * player's, or with an order for somebody else's units, or with an order
 * outside the turn it must belong to. Turns that are already here are
 * skipped, so the same message may come any number of times, in any order.
 *
 * A message with the host's game needs `state`, this side's game, which is
 * then made the same as the host's. See `adoptState`.
 *
 * @returns False if the message was refused.
 */
export function receive(session: Session, incoming: Message, state?: GameState): boolean {
  const from = incoming?.player;
  if (from === session.local || !session.humans.includes(from)) return false;
  if (!Number.isInteger(incoming.epoch) || incoming.epoch < 0) return false;
  if (incoming.kind === 'state') return receiveState(session, incoming, state);
  if (incoming.kind !== 'orders') return false;
  if (!Array.isArray(incoming.turns) || typeof incoming.have !== 'object') return false;
  if (!Array.isArray(incoming.checks)) return false;
  for (const { step: at, sum } of incoming.checks) {
    if (!Number.isInteger(at) || !Number.isInteger(sum)) return false;
  }
  const delay = delaySteps(session);
  for (const { turn, orders } of incoming.turns) {
    if (!Number.isInteger(turn) || turn < 0 || !Array.isArray(orders)) return false;
    // An order given in a turn is due in the turn `delayTurns` later.
    const first = turn * session.stepsPerTurn + delay;
    for (const order of orders) {
      if (order.command?.player !== from) return false;
      if (!Number.isInteger(order.step)) return false;
      if (order.step < first || order.step >= first + session.stepsPerTurn) return false;
    }
  }

  const kept = session.turns[from] as Record<number, ScheduledOrder[]>;
  for (const { turn, orders } of incoming.turns) {
    if (turn <= (session.have[from] as number) || kept[turn] !== undefined) continue;
    kept[turn] = orders;
  }
  // The turns are here up to the first gap.
  while (kept[(session.have[from] as number) + 1] !== undefined) {
    session.have[from] = (session.have[from] as number) + 1;
  }
  // What the sender holds of this side's turns need not be sent again.
  const theirs = incoming.have[session.local];
  if (typeof theirs === 'number' && Number.isInteger(theirs)) {
    const last = session.have[session.local] as number;
    session.confirmed[from] = Math.max(session.confirmed[from] as number, Math.min(theirs, last));
  }

  // The host has waited for this: the other side has its game now.
  if (session.stopped === 'resyncing' && incoming.epoch >= session.epoch) {
    session.stopped = null;
    session.snapshot = null;
  }
  // Checksums are compared within an epoch only: older ones are of a game that has been replaced.
  if (incoming.epoch === session.epoch) {
    const kept = session.checks[from] as Record<number, number>;
    for (const { step: at, sum } of incoming.checks) kept[at] = sum;
    compare(session);
    forgetOldChecks(session);
  }
  return true;
}

/**
 * Takes over the host's game: this side's game is made the same as the
 * host's, a new epoch begins, and the match goes on from there. The orders
 * this side has sealed and sent stand; those given but not yet sealed are
 * dropped, since the game they were given in is gone.
 */
function receiveState(session: Session, incoming: StateMessage, state?: GameState): boolean {
  if (incoming.player !== session.host || !state) return false;
  if (typeof incoming.state !== 'object' || !Number.isInteger(incoming.state?.tick)) return false;
  if (incoming.epoch <= session.epoch) {
    // Seen before. The host may not have heard that it is taken over: say so again.
    session.outbox.push(message(session));
    return true;
  }

  // Where this side's game differed from the host's, if both kept a copy of that step.
  const found = session.divergences[session.divergences.length - 1];
  const theirs = incoming.trace;
  const mine = session.kept.find((copy) => copy.step === theirs?.step);
  if (theirs && mine) {
    const where = firstDifference(mine.state, theirs.state);
    if (found && found.step === theirs.step) found.where = where;
    else session.divergences.push({ step: theirs.step, where });
  } else if (!found || session.stopped !== 'diverged') {
    // The host found it first.
    session.divergences.push({ step: theirs?.step ?? incoming.state.tick });
  }

  adoptState(state, incoming.state);
  session.epoch = incoming.epoch;
  session.stopped = null;
  session.issued = [];
  session.outcomes = [];
  forgetChecks(session);
  // The turns before the one the game is now in are over: any that this
  // side had not sealed, because its game was behind, are sealed empty.
  const own = session.turns[session.local] as Record<number, ScheduledOrder[]>;
  const current = turnOf(session, state.tick);
  for (let turn = (session.have[session.local] as number) + 1; turn < current; turn++) {
    own[turn] = [];
    session.have[session.local] = turn;
  }
  session.outbox.push(message(session));
  return true;
}

/**
 * Makes a game the same as another, in place: whoever holds the game, its
 * map or the lists in its map goes on holding the right thing. The other
 * game is not kept: its parts become parts of this one.
 */
export function adoptState(target: GameState, source: GameState): void {
  const map = target.map;
  const from = source.map;
  for (const key of ['terrain', 'resourceAmount', 'startPositions', 'caves'] as const) {
    const list = map[key] as unknown[];
    list.length = 0;
    for (const item of from[key]) list.push(item);
  }
  map.width = from.width;
  map.height = from.height;
  Object.assign(target, source, { map });
}
