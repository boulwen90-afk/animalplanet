/** Unit types. See GDD section 7. Later phases add costs and combat values. */
export const UNIT_DEFS = {
  samlare: {
    /** Hit points. */
    hp: 40,
    /** Movement speed in tiles per second. */
    speed: 2.5,
  },
} as const;

export type UnitType = keyof typeof UNIT_DEFS;
