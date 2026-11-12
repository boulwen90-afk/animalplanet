import type { UnitType } from './units';

/** Building types. See GDD section 8. Later phases add costs and more buildings. */
export const BUILDING_DEFS = {
  storide: {
    /** Unit types this building can train. */
    trains: ['samlare'] as readonly UnitType[],
    /** Hit points. */
    hp: 1500,
    /** Side of the square footprint, in tiles. */
    size: 3,
    /** Workers can deliver gathered resources here. */
    dropoff: true,
  },
} as const;

export type BuildingType = keyof typeof BUILDING_DEFS;
