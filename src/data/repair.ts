/**
 * Repairs: workers give a damaged building its life back, for wood. See GDD
 * section 8.
 */
export const REPAIR_CONFIG = {
  /**
   * What a full repair costs, from no life at all to all of it: this share
   * of the wood in the building's price. A lesser repair costs in
   * proportion to the life it gives back.
   */
  costShare: 0.5,
  /**
   * Life one worker gives back each second. It is less than a worker adds
   * when building any building anew, so repairing is slower than building.
   */
  hpPerSecond: 6,
  /**
   * Each worker beyond the first adds this share of what the one before it
   * added: the second 0.6 of a worker, the third 0.36, and so on. However
   * many they are, they never do the work of more than 2.5.
   */
  workerFalloff: 0.6,
} as const;
