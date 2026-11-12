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
