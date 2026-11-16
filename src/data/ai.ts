import type { UpgradeType } from './upgrades';

/** How hard the computer opponent plays. The player picks one on the start screen. */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** The levels in the order they are offered. */
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** The level a match has when nothing else is chosen. */
export const DEFAULT_DIFFICULTY: Difficulty = 'medium';

/** An attack wave: when it may set off, when it sets off at the latest, and how many go. */
export interface AiWave {
  earliest: number;
  latest: number;
  size: number;
}

/** A step in a computer opponent's growth: from `after` seconds on it wants this much. */
export interface AiSize {
  after: number;
  targetWorkers: number;
  maxSoldiers: number;
  barracks: number;
}

/** Everything that steers a computer opponent. `AI_CONFIG` explains each setting. */
export interface AiConfig {
  decisionInterval: number;
  targetWorkers: number;
  woodShare: number;
  surplus: { above: number; below: number; woodShare: number };
  housingMargin: number;
  fields: { startWhenFoodLeft: number; berryRadius: number; max: number };
  fishing: { reach: number; max: number };
  repair: { below: number; workers: number; minWood: number };
  towers: { max: number; whenWood: number; distance: number; spread: number };
  research: { whenWood: number; order: readonly UpgradeType[]; saveAbove: number };
  throwers: { soldiersEach: number; towerMargin: number };
  maxSoldiers: number;
  barracks: number;
  growth: readonly AiSize[];
  defendRadius: number;
  buildSearchRadius: number;
  waves: readonly AiWave[];
  repeat: { interval: number; window: number; size: number; grow: number; maxSize: number };
}

/**
 * The computer opponent on the middle level. See GDD section 10. Times are
 * in seconds of game time. The other levels, in `AI_LEVELS`, are this one
 * with some settings changed.
 */
export const AI_CONFIG = {
  /** How often the opponent makes decisions. */
  decisionInterval: 1,
  /**
   * It trains workers until it has this many. It was 8 until there were
   * javelin throwers: with their price in wood on top of a throwing range,
   * a tower and a smithy, 8 workers left one side or the other without one
   * of those buildings in most games.
   */
  targetWorkers: 10,
  /**
   * The share of its workers it keeps on wood; the rest gather food. With
   * 10 workers this puts 4 on wood, which matches what its soldiers of both
   * kinds and its buildings cost. With 4 of 9 on wood it had 400 unused wood
   * after twelve minutes and no food.
   */
  woodShare: 0.4,
  /**
   * Wood it has no use for. With `above` wood or more in stock it keeps
   * only this smaller share of its workers on wood and moves the others to
   * food; with `below` or less it goes back to the usual share. In between
   * it leaves its workers where they are, so that they do not walk back and
   * forth. Without this rule its wood grew to 3 800 in 45 minutes while its
   * food stood at nothing.
   */
  surplus: { above: 400, below: 150, woodShare: 0.2 },
  /**
   * It builds more housing when it has this little room left, counting the
   * units in its queues, so that training does not have to wait for a house.
   */
  housingMargin: 3,
  /**
   * Fields. It starts on them before the berries near its base run out:
   * when less than `startWhenFoodLeft` is left in the bushes within
   * `berryRadius` tiles of its main building. From then on it wants places
   * to work for food without end for as large a share of its food workers
   * as the bushes have fallen below that: all of them once the bushes are
   * empty, and never more than `max`. (Until 2026-11-16 it was one field
   * for every 150 food the bushes fell, which stopped at four places: with
   * the berries gone, two of its six food workers had nothing to do but
   * chop wood, and its waves shrank to what four could feed.)
   */
  fields: { startWhenFoodLeft: 600, berryRadius: 14, max: 30 },
  /**
   * Fishing. When it wants more food than the berries give, it first builds
   * a fishing hut, if there is a place by water within `reach` tiles of its
   * main building, and never more than `max` huts. A hut counts as one field
   * for each worker it takes.
   */
  fishing: { reach: 18, max: 1 },
  /**
   * Repairs. While no enemy is near its main building it mends its finished
   * buildings that have less than `below` of their life, the worst hurt
   * first and one at a time, with `workers` workers, and keeps at it until
   * the building is whole. It does not start with less than `minWood` wood
   * in stock. When an enemy comes near, or the wood runs out, the repairers
   * go back to gathering.
   */
  repair: { below: 0.9, workers: 2, minWood: 20 },
  /**
   * Watchtowers. Once it has a barracks it builds towers, one at a time and
   * never more than `max` in a game (one that falls is not replaced), when
   * it has at least `whenWood` wood in stock:
   * what its soldiers and houses leave over. They stand `distance` tiles
   * from the middle of its main building, on the side that faces the enemy,
   * `spread` degrees apart as seen from the main building.
   */
  towers: { max: 1, whenWood: 150, distance: 6, spread: 50 },
  /**
   * Upgrades. Once it has a barracks it builds a smithy when it has at
   * least `whenWood` wood in stock. There it works out the upgrades in
   * `order`, the first level of each before the second of any, one at a
   * time, as soon as it can pay for the next. While it has `saveAbove`
   * soldiers or more it trains no new ones until it has paid for that
   * upgrade: otherwise the soldiers would eat the food first, every time.
   */
  research: {
    whenWood: 200,
    order: ['weapons', 'armor', 'gathering'],
    saveAbove: 6,
  },
  /**
   * Javelin throwers. Once it has a finished barracks and a storehouse it
   * builds a throwing range, one, as soon as it can pay for it. There it trains a
   * thrower for every `soldiersEach` soldiers that fight hand to hand, so
   * that a wave has somebody to stand in front of its throwers. A thrower
   * in a wave turns on a watchtower when it comes within `towerMargin`
   * tiles more than its own range of it: before the tower can reach it.
   */
  throwers: { soldiersEach: 2, towerMargin: 2 },
  /** It stops training soldiers at this many, of both kinds together. */
  maxSoldiers: 20,
  /**
   * How many barracks it builds. One trains a soldier every 18 seconds: no
   * more than ten soldiers for a wave every other minute, together with the
   * throwing range, however much food there is.
   */
  barracks: 1,
  /**
   * How it grows. From each time on it trains workers up to the new number
   * and soldiers up to the new most, in the new number of barracks, so that
   * it keeps pace with a player who has survived the first waves and goes
   * on building.
   */
  growth: [
    { after: 600, targetWorkers: 16, maxSoldiers: 30, barracks: 2 },
    { after: 1200, targetWorkers: 22, maxSoldiers: 40, barracks: 2 },
    { after: 1800, targetWorkers: 28, maxSoldiers: 50, barracks: 3 },
  ],
  /** Soldiers at home go for enemy units that come this close to the main building, in tiles. */
  defendRadius: 12,
  /**
   * How far from where it wants a building it looks for a place to put it,
   * in tiles. It takes the nearest place there is. It was 14 until it grew:
   * with twenty fields and fifteen houses the ground that near its base was
   * full, and it never got its third barracks.
   */
  buildSearchRadius: 22,
  /**
   * Attack waves on the enemy's main building, in order. A wave sets off when
   * the earliest time has come and enough soldiers are at home. If the latest
   * time passes first, it sets off with whatever soldiers there are.
   */
  waves: [
    { earliest: 240, latest: 330, size: 4 },
    { earliest: 420, latest: 510, size: 6 },
    { earliest: 600, latest: 690, size: 8 },
  ],
  /**
   * After the listed waves, further waves follow at this spacing. The first
   * of them has `size` soldiers and each one after it `grow` more, up to
   * `maxSize`.
   */
  repeat: { interval: 120, window: 90, size: 10, grow: 2, maxSize: 30 },
} as const satisfies AiConfig;

/**
 * The three levels. None of them cheats: each plays by the player's rules
 * and pays what the player pays. They differ in how many workers they keep,
 * how large an army, and when and how hard they attack.
 */
export const AI_LEVELS: Record<Difficulty, AiConfig> = {
  /**
   * For someone new to the game: seven workers, the first wave at six
   * minutes with three soldiers, and waves that grow slowly.
   */
  easy: {
    ...AI_CONFIG,
    targetWorkers: 7,
    maxSoldiers: 10,
    growth: [{ after: 900, targetWorkers: 10, maxSoldiers: 14, barracks: 1 }],
    throwers: { soldiersEach: 3, towerMargin: 2 },
    waves: [
      { earliest: 360, latest: 480, size: 3 },
      { earliest: 600, latest: 720, size: 4 },
      { earliest: 840, latest: 960, size: 5 },
    ],
    repeat: { interval: 180, window: 120, size: 6, grow: 1, maxSize: 12 },
  },
  medium: AI_CONFIG,
  /**
   * For someone who beats the middle level: more workers from the start,
   * two towers, earlier and larger waves, and an army that keeps growing.
   */
  hard: {
    ...AI_CONFIG,
    targetWorkers: 14,
    maxSoldiers: 24,
    growth: [
      { after: 420, targetWorkers: 20, maxSoldiers: 36, barracks: 2 },
      { after: 840, targetWorkers: 28, maxSoldiers: 50, barracks: 3 },
      { after: 1500, targetWorkers: 34, maxSoldiers: 70, barracks: 4 },
    ],
    towers: { ...AI_CONFIG.towers, max: 2 },
    waves: [
      { earliest: 210, latest: 300, size: 5 },
      { earliest: 360, latest: 450, size: 8 },
      { earliest: 510, latest: 600, size: 11 },
    ],
    repeat: { interval: 100, window: 80, size: 14, grow: 3, maxSize: 45 },
  },
};
