/** Resources. See GDD section 6. */
export const RESOURCE_DEFS = {
  food: {
    /** Amount in each source when the game starts. */
    amountPerNode: 150,
  },
  wood: {
    amountPerNode: 100,
  },
} as const;

export type ResourceType = keyof typeof RESOURCE_DEFS;

export const RESOURCE_TYPES = Object.keys(RESOURCE_DEFS) as ResourceType[];

/** What something costs, per resource. Resources left out cost nothing. */
export type Cost = Partial<Record<ResourceType, number>>;

export const GATHER_CONFIG = {
  /**
   * When a source runs out, the worker looks for another source of the same
   * kind within this many tiles of itself.
   */
  searchRadius: 8,
} as const;
