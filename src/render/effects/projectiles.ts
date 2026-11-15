import { UI_CONFIG } from '../../data/ui';
import { tileToWorld, type Point, type TileSize } from '../../sim/map/iso';

/**
 * How something shot through the air is drawn: where on the screen it is
 * and which way it points. Pure functions, so they can be tested without a
 * browser.
 */

/** Where a projectile is drawn, in world pixels, and how it is turned, in radians; 0 points to the right. */
export interface ProjectilePose {
  x: number;
  y: number;
  rotation: number;
}

/** How far along its way a projectile on the ground at `at` is, from 0 where it was shot to 1 at its target. */
export function flightProgress(start: Point, at: Point, target: Point): number {
  const done = Math.hypot(at.x - start.x, at.y - start.y);
  const left = Math.hypot(target.x - at.x, target.y - at.y);
  return done + left <= 0 ? 1 : done / (done + left);
}

/**
 * How high above the ground a projectile is, in pixels, `progress` of the
 * way along a flight of `tiles` tiles: down from where it was let go to the
 * height it lands at, with an arc on top that is highest half-way.
 */
export function flightHeight(progress: number, tiles: number, muzzlePx: number): number {
  const { arcPxPerTile, targetHeightPx } = UI_CONFIG.projectile;
  const straight = muzzlePx + (targetHeightPx - muzzlePx) * progress;
  return straight + Math.sin(Math.PI * progress) * arcPxPerTile * tiles;
}

/**
 * Where a projectile is drawn and which way it points.
 * @param start Where it was shot from, on the ground, in tiles.
 * @param at Where it is now, on the ground, in tiles.
 * @param target Where its target is now, in tiles.
 * @param muzzlePx How far above the ground it was let go, in pixels.
 */
export function projectilePose(
  start: Point,
  at: Point,
  target: Point,
  muzzlePx: number,
  tile: TileSize,
): ProjectilePose {
  const tiles = Math.hypot(target.x - start.x, target.y - start.y);
  const progress = flightProgress(start, at, target);
  const pointAt = (p: number): Point => {
    const ground = tileToWorld(
      start.x + (target.x - start.x) * p,
      start.y + (target.y - start.y) * p,
      tile,
    );
    return { x: ground.x, y: ground.y - flightHeight(p, tiles, muzzlePx) };
  };
  const ground = tileToWorld(at.x, at.y, tile);
  const here = { x: ground.x, y: ground.y - flightHeight(progress, tiles, muzzlePx) };
  // It points the way it is going: from a little behind to a little ahead on its arc.
  const behind = pointAt(Math.max(0, progress - 0.02));
  const ahead = pointAt(Math.min(1, progress + 0.02));
  return { ...here, rotation: Math.atan2(ahead.y - behind.y, ahead.x - behind.x) };
}

/** How the burst where a projectile landed looks `elapsedMs` after it landed, or undefined when it is over. */
export function hitBurstAt(elapsedMs: number): { alpha: number; scale: number } | undefined {
  const { hitMs, hitScale } = UI_CONFIG.projectile;
  if (elapsedMs < 0 || elapsedMs >= hitMs) return undefined;
  const t = elapsedMs / hitMs;
  return { alpha: 1 - t, scale: hitScale.start + (hitScale.end - hitScale.start) * t };
}

/**
 * The half-width and half-height on the screen of a circle on the ground
 * with a radius of `tiles` tiles: seen from the game's angle it is an ellipse.
 */
export function groundCircle(tiles: number, tile: TileSize): { rx: number; ry: number } {
  return {
    rx: (tiles * Math.SQRT2 * tile.tileWidth) / 2,
    ry: (tiles * Math.SQRT2 * tile.tileHeight) / 2,
  };
}
