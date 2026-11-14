import type { Terrain } from '../../data/terrain';

/**
 * The scenery: what stands on the ground between the buildings, and the
 * ground's water and shore. Which picture goes where is decided here, by
 * pure functions, so that it can be tested without a browser. The pictures
 * themselves are named in assets.ts.
 */

/** The pictures of each kind of thing, so that a forest or a ridge of rock does not look like one thing repeated. */
export const TREE_FRAMES = ['tree_1', 'tree_2', 'tree_3'] as const;
export const ROCK_FRAMES = ['rock_1', 'rock_2', 'rock_3'] as const;
export const WATER_FRAMES = ['water_1', 'water_2', 'water_3'] as const;
export const CAVE_FRAME = 'cave';
export const FISHING_PLACE_FRAME = 'fishing_place';

/** A berry bush shows fewer berries once it holds no more than this share of what it started with. */
export const BUSH_FEW_SHARE = 0.5;

/**
 * Which of `count` pictures a tile gets: always the same for the same tile,
 * and mixed enough that neighbours seldom match.
 */
export function variantOf(x: number, y: number, count: number): number {
  // A small integer hash of the two coordinates.
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h % count) + count) % count;
}

/**
 * The picture of what stands on a tile: a tree, a rock, or a berry bush with
 * as many berries as it has left. Undefined for terrain nothing stands on.
 *
 * @param left What is left in the tile's source, as a share of what it started with.
 */
export function objectFrame(terrain: Terrain, x: number, y: number, left = 1): string | undefined {
  switch (terrain) {
    case 'tree':
      return TREE_FRAMES[variantOf(x, y, TREE_FRAMES.length)];
    case 'rock':
      return ROCK_FRAMES[variantOf(x, y, ROCK_FRAMES.length)];
    case 'berries':
      return left > BUSH_FEW_SHARE ? 'bush_full' : 'bush_few';
    default:
      return undefined;
  }
}

/** What an emptied source leaves on the ground: a stump for a tree, a bare bush for a berry bush. */
export function remainsFrame(terrain: Terrain): string | undefined {
  if (terrain === 'tree') return 'stump';
  if (terrain === 'berries') return 'bush_bare';
  return undefined;
}

/** The four sides of a tile and the four corners between them, as the atlas names them. */
const SIDES = [
  ['x+', 1, 0],
  ['x-', -1, 0],
  ['y+', 0, 1],
  ['y-', 0, -1],
] as const;
const CORNERS = [
  ['x+y+', 1, 1],
  ['x+y-', 1, -1],
  ['x-y+', -1, 1],
  ['x-y-', -1, -1],
] as const;

/**
 * The pictures that make up one tile of water, in the order they are drawn:
 * the water itself, then the pieces of shore where it meets land. A side
 * with land on it gets a piece of shore along it; a corner between two such
 * sides gets a piece that rounds it off on the land; and a corner where only
 * the tile across the corner is land gets a piece round that tile's tip.
 *
 * @param isWater Whether a tile is water. The outside of the map counts as
 * water, so that a lake that runs off the map has no shore there.
 */
export function waterFrames(
  isWater: (x: number, y: number) => boolean,
  x: number,
  y: number,
): string[] {
  const frames: string[] = [WATER_FRAMES[variantOf(x, y, WATER_FRAMES.length)] as string];
  const land = (dx: number, dy: number) => !isWater(x + dx, y + dy);
  for (const [name, dx, dy] of SIDES) {
    if (land(dx, dy)) frames.push(`shore_${name}`);
  }
  for (const [name, dx, dy] of CORNERS) {
    const a = land(dx, 0);
    const b = land(0, dy);
    if (a && b) frames.push(`shore_out_${name}`);
    else if (!a && !b && land(dx, dy)) frames.push(`shore_in_${name}`);
  }
  return frames;
}
