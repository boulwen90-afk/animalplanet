import { BUILDING_DEFS } from '../../data/buildings';
import { buildingCentre, isBuilding, isUnit } from '../../sim/entities';
import { tileToWorld, worldToTile, type Point, type TileSize } from '../../sim/map/iso';
import type { Building, Entity, PlayerId, Unit } from '../../sim/state';
import {
  BUILDING_VISUALS,
  UNIT_PICK_MARGIN,
  UNIT_VISUALS,
  unitVisualCentre,
} from '../views/visuals';

export interface WorldRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The entity drawn at a world position, or undefined. Units win over
 * buildings, and of several overlapping entities the one drawn in front wins.
 */
export function pickEntity(
  entities: readonly Entity[],
  world: Point,
  size: TileSize,
): Entity | undefined {
  let best: Entity | undefined;
  let bestDepth = -Infinity;

  for (const unit of entities.filter(isUnit)) {
    const centre = unitVisualCentre(unit, unit.x, unit.y, size);
    const reach = UNIT_VISUALS[unit.type].radius + UNIT_PICK_MARGIN;
    if (Math.hypot(world.x - centre.x, world.y - centre.y) > reach) continue;
    const depth = tileToWorld(unit.x, unit.y, size).y;
    if (depth > bestDepth) {
      best = unit;
      bestDepth = depth;
    }
  }
  if (best) return best;

  for (const building of entities.filter(isBuilding)) {
    if (!isOnBuilding(building, world, size)) continue;
    const centre = buildingCentre(building);
    const depth = tileToWorld(centre.x, centre.y, size).y;
    if (depth > bestDepth) {
      best = building;
      bestDepth = depth;
    }
  }
  return best;
}

/** True if a world position is on a building's drawn block: its footprint or its walls. */
function isOnBuilding(building: Building, world: Point, size: TileSize): boolean {
  const footprint = BUILDING_DEFS[building.type].size;
  const wallHeight = BUILDING_VISUALS[building.type].wallHeight;
  // The block is the footprint swept upwards by the wall height, so a point
  // is on it if some point up to that far below lies on the footprint.
  for (const below of [0, wallHeight / 2, wallHeight]) {
    const tile = worldToTile(world.x, world.y + below, size);
    if (
      tile.x >= building.x &&
      tile.y >= building.y &&
      tile.x < building.x + footprint &&
      tile.y < building.y + footprint
    ) {
      return true;
    }
  }
  return false;
}

/** A player's units whose circles have their centre inside a world rectangle. */
export function unitsInRect(
  entities: readonly Entity[],
  rect: WorldRect,
  owner: PlayerId,
  size: TileSize,
): Unit[] {
  return entities.filter(isUnit).filter((unit) => {
    if (unit.owner !== owner) return false;
    const centre = unitVisualCentre(unit, unit.x, unit.y, size);
    return (
      centre.x >= rect.x &&
      centre.x <= rect.x + rect.width &&
      centre.y >= rect.y &&
      centre.y <= rect.y + rect.height
    );
  });
}

/** The rectangle spanned by two corner points, in any order. */
export function rectFromPoints(a: Point, b: Point): WorldRect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}
