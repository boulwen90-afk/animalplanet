/** Unit types. See GDD section 7. Later phases add costs and combat values. */
export const UNIT_DEFS = {
  samlare: {
    /** Hit points. */
    hp: 40,
    /** Movement speed in tiles per second. */
    speed: 2.5,
    /** Most resource units carried at once. 0 for units that cannot gather. */
    carryCapacity: 10,
    /** Resource units gathered per second. */
    gatherRate: 1,
  },
} as const;

export type UnitType = keyof typeof UNIT_DEFS;
