import type { Point } from '../../sim/map/iso';

/** The pictures a building has: two while it is raised, one when it stands, and its shadow. */
export type BuildingStage = 'construction_1' | 'construction_2' | 'complete';

/** The name of the shadow's picture in a building's atlas. */
export const SHADOW_FRAME = 'shadow';

/**
 * The looks a piece of wall has pictures of. A piece of palisade is drawn
 * as a row along the x axis, as a row along the y axis, or as a square
 * block where rows meet; a gate stands in a row along one axis or the other.
 */
export type WallVariant = 'x' | 'y' | 'block';

/**
 * Which look fits a piece of wall, by where other pieces of its side stand
 * beside it: along the x axis (on either side), along the y axis, both or
 * neither. A piece of palisade in a row runs with the row; at a corner, a
 * crossing or alone it is a block. A gate turns with the wall it stands in,
 * and stands along x where that does not say.
 */
export function wallVariant(
  kind: 'segment' | 'gate',
  alongX: boolean,
  alongY: boolean,
): WallVariant {
  if (kind === 'gate') return alongY && !alongX ? 'y' : 'x';
  if (alongX && !alongY) return 'x';
  if (alongY && !alongX) return 'y';
  return 'block';
}

/**
 * The name in a building's atlas of the picture of a stage, or of the
 * shadow: for a building that comes in variants, that of the variant.
 */
export function frameOf(part: BuildingStage | typeof SHADOW_FRAME, variant?: string): string {
  return variant ? `${variant}_${part}` : part;
}

/** From this share of the work done, a site shows its walls up; before it, the footing and the frame. */
export const WALLS_UP_AT = 0.5;

/**
 * Which picture shows a building: the finished one when it is complete,
 * otherwise one of the two construction pictures by how far the work has come
 * (0 to 1).
 */
export function stageOf(complete: boolean, built: number): BuildingStage {
  if (complete) return 'complete';
  return built < WALLS_UP_AT ? 'construction_1' : 'construction_2';
}

/**
 * True if a building, as drawn, covers a point of the map: the point is on
 * its footprint or behind it, within its height. Used both for what a click
 * hits and for which units a building hides.
 *
 * On the screen a point `d` tiles further along both tile axes lies straight
 * below, one tile height per tile. So the point is covered if moving it
 * straight down by at most the building's height lands it on the footprint.
 *
 * @param unit The point, in tiles.
 * @param corner The footprint's corner with the lowest x and y, in tiles.
 * @param side Side of the footprint, in tiles.
 * @param heightTiles The building's height on the screen, as that many tile heights.
 */
export function buildingCovers(
  unit: Point,
  corner: Point,
  side: number,
  heightTiles: number,
): boolean {
  const from = Math.max(corner.x - unit.x, corner.y - unit.y, 0);
  const to = Math.min(corner.x + side - unit.x, corner.y + side - unit.y, heightTiles);
  // Standing on the footprint's edge is beside the building, not behind it.
  return to - from > 1e-6;
}
