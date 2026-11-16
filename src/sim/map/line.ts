import type { Point } from './iso';

/**
 * The tiles of a line drawn from one tile to another, both included, in
 * order. Each tile lies side by side with the one before it, never corner
 * to corner, so a wall built on them has no gap to slip through: a line at
 * a slant becomes a staircase. With `max`, the line is cut off after that
 * many tiles.
 */
export function lineTiles(from: Point, to: Point, max = Infinity): Point[] {
  let x = Math.floor(from.x);
  let y = Math.floor(from.y);
  const endX = Math.floor(to.x);
  const endY = Math.floor(to.y);
  const dx = Math.abs(endX - x);
  const dy = Math.abs(endY - y);
  const stepX = Math.sign(endX - x);
  const stepY = Math.sign(endY - y);
  const tiles: Point[] = [{ x, y }];
  let doneX = 0;
  let doneY = 0;
  while ((doneX < dx || doneY < dy) && tiles.length < max) {
    // The step that keeps the staircase closest to the straight line.
    if ((doneX + 0.5) / dx < (doneY + 0.5) / dy) {
      x += stepX;
      doneX++;
    } else {
      y += stepY;
      doneY++;
    }
    tiles.push({ x, y });
  }
  return tiles;
}
