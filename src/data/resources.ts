/**
 * What a load is, as it looks in a worker's basket. Food comes as berries,
 * fish or grain, depending on where it was got; it is all the same food
 * once it has been delivered.
 */
export type LoadKind = 'wood' | 'berries' | 'fish' | 'grain';

/** Resources. See GDD section 6. */
export const RESOURCE_DEFS = {
  food: {
    /** Amount in each source when the game starts. */
    amountPerNode: 150,
    /** What a load from a source on the map is: a berry bush. */
    load: 'berries',
  },
  wood: {
    amountPerNode: 100,
    load: 'wood',
  },
} as const satisfies Record<string, { amountPerNode: number; load: LoadKind }>;

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
  /**
   * How many workers can work one source at a time. Each stands on a place
   * of its own: one of the open tiles around the source, at most this many.
   */
  placesPerSource: 4,
} as const;
