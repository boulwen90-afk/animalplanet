/**
 * Population. A side has room for as many units as its finished buildings
 * give (`housing` in BUILDING_DEFS), and each unit takes up its `population`
 * (UNIT_DEFS). See GDD section 6.
 */
export const POPULATION_CONFIG = {
  /** The most room a side can ever have, however much housing it builds. */
  hardCap: 50,
} as const;
