/** The computer opponent. See GDD section 10. Times are in seconds of game time. */
export const AI_CONFIG = {
  /** How often the opponent makes decisions. */
  decisionInterval: 1,
  /** It trains workers until it has this many. */
  targetWorkers: 8,
  /**
   * The share of its workers it keeps on wood; the rest gather food. With 8
   * workers this puts 3 on wood, which matches what its soldiers cost. At 0.5
   * it had 1200 unused wood after ten minutes and no food.
   */
  woodShare: 0.375,
  /**
   * It builds more housing when it has this little room left, counting the
   * units in its queues, so that training does not have to wait for a house.
   */
  housingMargin: 3,
  /**
   * Fields. It starts on them before the berries near its base run out:
   * when less than `startWhenFoodLeft` is left in the bushes within
   * `berryRadius` tiles of its main building, and then one more field for
   * every `foodPerField` the bushes fall further, up to `max`.
   */
  fields: { startWhenFoodLeft: 600, foodPerField: 150, berryRadius: 14, max: 5 },
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
  repeat: { interval: 120, window: 90, size: 10 },
} as const;
