import type { ResourceType } from './resources';

/** What something costs, per resource. Resources left out cost nothing. */
export type Cost = Partial<Record<ResourceType, number>>;

/** Unit types. See GDD section 7. Later phases add combat values. */
export const UNIT_DEFS = {
  samlare: {
    /** Price of training one. */
    cost: { food: 50 } as Cost,
    /** Time to train one, in seconds. */
    trainTime: 12,
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
