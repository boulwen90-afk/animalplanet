import type { ResourceType } from './resources';

/** Terrain types and their rules. See GDD section 9. */
export const TERRAIN_DEFS: Record<Terrain, { walkable: boolean; resource?: ResourceType }> = {
  grass: { walkable: true },
  /** A source of wood. Becomes grass when emptied. */
  tree: { walkable: false, resource: 'wood' },
  /** A source of food. Becomes grass when emptied. */
  berries: { walkable: false, resource: 'food' },
  rock: { walkable: false },
  water: { walkable: false },
};

export type Terrain = 'grass' | 'tree' | 'berries' | 'rock' | 'water';
