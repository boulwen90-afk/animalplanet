/** Map dimensions and isometric tile size. See GDD section 9. */
export const MAP_CONFIG = {
  /** Map width in tiles. */
  width: 64,
  /** Map height in tiles. */
  height: 64,
  /** Width of one tile diamond in pixels. */
  tileWidth: 64,
  /** Height of one tile diamond in pixels. */
  tileHeight: 32,
} as const;

/**
 * Map generation. Every feature is placed together with its mirror image
 * through the map centre, so counts are per half of the map.
 * Distances are measured in tiles, as straight-line distance.
 */
export const MAP_GEN_CONFIG = {
  /** Seed used when the URL has no ?seed=N. */
  defaultSeed: 1,
  /**
   * Where each side's main building stands. The second position must be the
   * mirror image of the first: (width - 1 - x, height - 1 - y).
   */
  startPositions: [
    { x: 9, y: 54 },
    { x: 54, y: 9 },
  ],
  /** Nothing is placed closer than this to a start position. */
  startClearRadius: 4,
  /** The guaranteed starting resources lie within this distance of the start position. */
  startResourceRadius: 8,
  /** Berry bushes guaranteed near each start position. */
  startBerries: 6,
  /** Trees guaranteed near each start position. */
  startTrees: 14,
  /** Lakes and rocks keep at least this distance from start positions, leaving room to build. */
  obstacleStartDistance: 10,
  forests: { count: 12, minSize: 12, maxSize: 30 },
  berryPatches: { count: 4, minSize: 3, maxSize: 6 },
  rocks: { count: 5, minSize: 3, maxSize: 8 },
  lakes: { count: 2, minSize: 8, maxSize: 20 },
  /**
   * Caves where a side's defeated units take refuge. See GDD section 15.
   * Each side gets `perSide` caves on its own half of the map.
   */
  caves: {
    perSide: 2,
    /** Caves lie between these distances from their side's start position. */
    minStartDistance: 7,
    maxStartDistance: 13,
    /** Two caves of the same side are at least this far apart. */
    minSeparation: 6,
    /** Caves keep this many tiles from the edge of the map. */
    edgeMargin: 2,
  },
  /** How many random layouts to try before falling back to a map with only start resources. */
  maxAttempts: 20,
} as const;

export const CAVE_CONFIG = {
  /** Most units one cave holds. */
  capacity: 12,
  /** Nothing may be built on a cave or within this many tiles of it. */
  noBuildDistance: 1,
} as const;
