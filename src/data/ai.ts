/** The computer opponent. See GDD section 10. Times are in seconds of game time. */
export const AI_CONFIG = {
  /** How often the opponent makes decisions. */
  decisionInterval: 1,
  /** It trains workers until it has this many. */
  targetWorkers: 8,
  /** The share of its workers it keeps on wood; the rest gather food. */
  woodShare: 0.5,
  /** It stops training soldiers at this many. */
  maxSoldiers: 20,
  /** Soldiers at home go for enemy units that come this close to the main building, in tiles. */
  defendRadius: 12,
  /** How far from where it wants a building it looks for a place to put it, in tiles. */
  buildSearchRadius: 14,
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
  /** After the listed waves, further waves follow at this spacing and of this size. */
  repeat: { interval: 150, window: 90, size: 10 },
} as const;
