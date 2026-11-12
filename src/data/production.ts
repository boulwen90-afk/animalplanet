/** Unit production. See GDD section 8. */
export const PRODUCTION_CONFIG = {
  /** Most units that can wait in one building's queue, including the one being trained. */
  maxQueue: 5,
} as const;
