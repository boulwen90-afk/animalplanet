/** Terrain types and their rules. See GDD section 9. */
export const TERRAIN_DEFS = {
  grass: { walkable: true },
  tree: { walkable: false },
  berries: { walkable: false },
  rock: { walkable: false },
  water: { walkable: false },
} as const;

export type Terrain = keyof typeof TERRAIN_DEFS;
