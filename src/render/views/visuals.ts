import type { BuildingType } from '../../data/buildings';
import type { ResourceType } from '../../data/resources';
import type { Terrain } from '../../data/terrain';
import type { UnitType } from '../../data/units';
import { tileToWorld, type Point, type TileSize } from '../../sim/map/iso';
import type { Unit } from '../../sim/state';

/** Placeholder look of things. Shared by drawing and by mouse picking. */

/** Team colours: the player is blue, the opponent red. */
export const PLAYER_COLORS = [0x3b7de0, 0xd0453a] as const;

/** Colour of selection marks, the drag box and move-order rings. */
export const SELECTION_COLOR = 0x35e06a;

export const OUTLINE_COLOR = 0x10141a;

/**
 * Units are drawn as a circle or a square in the team colour. `radius` is
 * half the width in pixels, and also how close a click must be to hit the unit.
 */
export const UNIT_VISUALS: Record<UnitType, { shape: 'circle' | 'square'; radius: number }> = {
  samlare: { shape: 'circle', radius: 9 },
  ramkrigare: { shape: 'square', radius: 11 },
};

/**
 * Units drawn as characters (see render/characters). Sizes are in pixels and
 * measured from the point on the ground the unit stands on.
 */
export const CHARACTER_VISUALS: Partial<
  Record<
    UnitType,
    {
      /** From the ground to the top of the helmet: a little more than the figure's height in the size standard. */
      height: number;
      /** Half the width of the body; with `height` it is the area a click hits. */
      halfWidth: number;
      /** Width of the ellipse drawn under the unit when it is selected. */
      selectionWidth: number;
    }
  >
> = {
  ramkrigare: { height: 41, halfWidth: 13, selectionWidth: 40 },
};

/**
 * The soft shadow drawn on the ground under a character: its size in pixels,
 * how far it lies from the unit's ground point (the light comes from the
 * upper left) and how dark it is.
 */
export const CHARACTER_SHADOW = {
  width: 42,
  height: 18,
  offsetX: 5,
  offsetY: 1,
  alpha: 0.4,
  color: '12, 18, 10',
} as const;

/** Buildings are drawn as blocks with walls of this height, in pixels, and a letter on the roof. */
export const BUILDING_VISUALS: Record<BuildingType, { wallHeight: number; label: string }> = {
  storide: { wallHeight: 36, label: 'S' },
  visthus: { wallHeight: 22, label: 'V' },
  krigshall: { wallHeight: 30, label: 'K' },
};

/** Colours of the outline shown while placing a building: where it may stand, and where not. */
export const PLACEMENT_COLORS = { valid: 0x35e06a, invalid: 0xe8384f } as const;

/** How see-through a building under construction is when just placed; it turns solid as it is built. */
export const CONSTRUCTION_START_ALPHA = 0.35;

/**
 * Size in pixels of the things drawn standing on terrain tiles. Each stands
 * with the middle of its lower edge a quarter of a tile below the tile centre.
 */
export const TERRAIN_OBJECT_VISUALS: Partial<Record<Terrain, { width: number; height: number }>> = {
  tree: { width: 38, height: 61 },
  berries: { width: 32, height: 26 },
  rock: { width: 64, height: 48 },
};

/** Colour of the ring shown when units are ordered to attack. */
export const ATTACK_COLOR = 0xe8384f;

/** Life bar colours: more than half left, more than a quarter left, and less. */
export const LIFE_BAR_COLORS = { high: 0x35e06a, medium: 0xf2c53d, low: 0xe8384f } as const;

/** Life bar size in pixels, for units and for buildings. */
export const LIFE_BAR = { unitWidth: 24, buildingWidth: 64, height: 4 } as const;

/** Colour of a cave's mound and of its opening. */
export const CAVE_COLORS = { rock: 0x5b5f66, opening: 0x15171a } as const;

/** Size of a cave as drawn, in pixels. */
export const CAVE_VISUAL = { width: 58, height: 40 } as const;

/**
 * The fog of war: its colour, and how dark it makes tiles that have been
 * seen before but are out of sight now.
 */
export const FOG_VISUAL = {
  color: 0x05070a,
  exploredAlpha: 0.5,
  /** How many pixels each fog diamond reaches past its tile, to close the gaps between them. */
  bleed: 1,
} as const;

/** Colour of the mark on a unit that carries a resource. */
export const RESOURCE_COLORS: Record<ResourceType, number> = {
  food: 0xe8384f,
  wood: 0x9b6a3a,
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
