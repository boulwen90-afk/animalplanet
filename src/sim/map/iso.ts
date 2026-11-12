/**
 * Isometric (diamond) projection between tile coordinates and world pixels.
 *
 * Tile coordinates are continuous: tile (tx, ty) covers [tx, tx+1) x [ty, ty+1).
 * The integer point (tx, ty) is the top corner of that tile's diamond and
 * (tx + 0.5, ty + 0.5) is its centre. World pixels have the top corner of
 * tile (0, 0) at the origin, x growing right and y growing down.
 */

export interface Point {
  x: number;
  y: number;
}

export interface TileSize {
  tileWidth: number;
  tileHeight: number;
}

export interface MapSize {
  width: number;
  height: number;
}

/** Converts (possibly fractional) tile coordinates to world pixels. */
export function tileToWorld(tx: number, ty: number, size: TileSize): Point {
  return {
    x: ((tx - ty) * size.tileWidth) / 2,
    y: ((tx + ty) * size.tileHeight) / 2,
  };
}

/** World position of the centre of tile (tx, ty). */
export function tileCenterToWorld(tx: number, ty: number, size: TileSize): Point {
  return tileToWorld(tx + 0.5, ty + 0.5, size);
}

/** Converts world pixels to fractional tile coordinates. */
export function worldToTileExact(wx: number, wy: number, size: TileSize): Point {
  const a = wx / (size.tileWidth / 2);
  const b = wy / (size.tileHeight / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/** The tile that contains the given world position. May lie outside the map. */
export function worldToTile(wx: number, wy: number, size: TileSize): Point {
  const exact = worldToTileExact(wx, wy, size);
  return { x: Math.floor(exact.x), y: Math.floor(exact.y) };
}

export function isInsideMap(tx: number, ty: number, map: MapSize): boolean {
  return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height;
}

/**
 * The point inside the map diamond closest (in tile space) to a world position.
 * Points already on the map are returned unchanged.
 */
export function clampWorldToMap(wx: number, wy: number, map: MapSize, size: TileSize): Point {
  const tile = worldToTileExact(wx, wy, size);
  const tx = Math.min(Math.max(tile.x, 0), map.width);
  const ty = Math.min(Math.max(tile.y, 0), map.height);
  return tileToWorld(tx, ty, size);
}
