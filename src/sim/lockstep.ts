import { LOCKSTEP_CONFIG } from '../data/lockstep';
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

/** What one player sends to the others. */
export interface OrderMessage {
  /** The side that gave these orders. */
  player: PlayerId;
  /**
   * For each other side, the last turn up to which the sender holds all of
   * that side's orders; -1 if none. The receiver need not send those again.
   */
  have: Record<number, number>;
  /** The sender's sealed turns that the receiver has not confirmed, oldest first. */
  turns: TurnOrders[];
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
  outbox: OrderMessage[];
  /** What became of the orders carried out in the latest step, in the order they were carried out. */
  outcomes: OrderOutcome[];
}

export interface SessionOptions {
  /** The sides played by people. Default: the local side alone. */
  humans?: readonly PlayerId[];
  /** The side played on this machine. */
  local: PlayerId;
  /** Turns between an order and its step. Default: 0 alone, the configured delay with others. */
  delayTurns?: number;
  stepsPerTurn?: number;
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
  };
  for (const player of humans) {
    session.turns[player] = {};
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
  if (command.player !== session.local || state.winner !== null) {
    return { ok: false, reason: 'invalid' };
  }
  const delay = delaySteps(session);
  if (delay === 0) return applyCommand(state, command);
  const expected = checkCommand(state, command);
  if (!expected.ok) return expected;
  // A copy: the caller may go on using what it passed in.
  session.issued.push({ step: state.tick + delay, command: structuredClone(command) });
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

  const turn = turnOf(session, now);
  if (turnOf(session, state.tick) === turn) return true;
  // The turn is over. Its orders are sealed, and the turn they were due in is done with.
  (session.turns[session.local] as Record<number, ScheduledOrder[]>)[turn] = session.issued;
  session.have[session.local] = turn;
  session.issued = [];
  forget(session, needed);
  if (session.humans.length > 1) session.outbox.push(message(session));
  return true;
}

/**
 * Drops the turns that are no longer needed: those that have been carried
 * out, and of this side's own, only those the others have confirmed.
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
  return { player: session.local, have, turns };
}

/**
 * Puts the current message in the outbox once more. For when the match
 * stands still waiting for the other player: the message that would have
 * got it going may be the one that was lost.
 */
export function resend(session: Session): void {
  if (session.humans.length > 1) session.outbox.push(message(session));
}

/** Takes the messages to send out of the session. */
export function takeOutbox(session: Session): OrderMessage[] {
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
 * @returns False if the message was refused.
 */
export function receive(session: Session, incoming: OrderMessage): boolean {
  const from = incoming.player;
  if (from === session.local || !session.humans.includes(from)) return false;
  if (!Array.isArray(incoming.turns) || typeof incoming.have !== 'object') return false;
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
  return true;
}
