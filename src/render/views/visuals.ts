import type { BuildingType } from '../../data/buildings';
import type { UnitType } from '../../data/units';
import { tileToWorld, type Point, type TileSize } from '../../sim/map/iso';
import type { Unit } from '../../sim/state';

/** Placeholder look of things. Shared by drawing and by mouse picking. */

/** Team colours: the player is blue, the opponent red. */
export const PLAYER_COLORS = [0x3b7de0, 0xd0453a] as const;

/** Colour of selection marks, the drag box and move-order rings. */
export const SELECTION_COLOR = 0x35e06a;

export const OUTLINE_COLOR = 0x10141a;

/** Units are drawn as circles of this radius, in pixels. */
export const UNIT_VISUALS: Record<UnitType, { radius: number }> = {
  samlare: { radius: 9 },
};

/** Buildings are drawn as blocks with walls of this height, in pixels, and a letter on the roof. */
export const BUILDING_VISUALS: Record<BuildingType, { wallHeight: number; label: string }> = {
  storide: { wallHeight: 36, label: 'S' },
};

/** Extra distance, in pixels, around a unit's circle that still counts as clicking on it. */
export const UNIT_PICK_MARGIN = 4;

/**
 * World position of the centre of a unit's circle. The unit stands on its
 * ground position, so the circle is drawn slightly above it.
 */
export function unitVisualCentre(
  unit: Pick<Unit, 'type'>,
  tileX: number,
  tileY: number,
  size: TileSize,
): Point {
  const ground = tileToWorld(tileX, tileY, size);
  return { x: ground.x, y: ground.y - UNIT_VISUALS[unit.type].radius / 2 };
}
