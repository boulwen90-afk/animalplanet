import { BUILDING_DEFS } from '../../data/buildings';
import { buildingCentre, hasSurrendered, isBuilding, isUnit } from '../../sim/entities';
import type { GameMap } from '../../sim/map/grid';
import {
  tileCenterToWorld,
  tileToWorld,
  worldToTile,
  type Point,
  type TileSize,
} from '../../sim/map/iso';
import { resourceAt } from '../../sim/resources';
import type { Building, Entity, PlayerId, Unit } from '../../sim/state';
import {
  BUILDING_VISUALS,
  CHARACTER_VISUALS,
  TERRAIN_OBJECT_VISUALS,
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
    if (!isOnUnit(unit, world, size)) continue;
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

/** True if a world position is on a unit as it is drawn. */
function isOnUnit(unit: Unit, world: Point, size: TileSize): boolean {
  const character = CHARACTER_VISUALS[unit.type];
  if (character) {
    // A character stands on its ground point: the body is the area above it.
    const ground = tileToWorld(unit.x, unit.y, size);
    return (
      Math.abs(world.x - ground.x) <= character.halfWidth &&
      world.y <= ground.y + UNIT_PICK_MARGIN * 2 &&
      world.y >= ground.y - character.height
    );
  }
  const centre = unitVisualCentre(unit, unit.x, unit.y, size);
  const reach = UNIT_VISUALS[unit.type].radius + UNIT_PICK_MARGIN;
  return Math.hypot(world.x - centre.x, world.y - centre.y) <= reach;
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

/** A player's units, apart from surrendered ones, whose centre is inside a world rectangle. */
export function unitsInRect(
  entities: readonly Entity[],
  rect: WorldRect,
  owner: PlayerId,
  size: TileSize,
): Unit[] {
  return entities.filter(isUnit).filter((unit) => {
    // Units that have surrendered no longer take orders, so the box leaves them out.
    if (unit.owner !== owner || hasSurrendered(unit)) return false;
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

/**
 * The tile of the resource source drawn at a world position, or undefined.
 * Trees are taller than a tile, so the tree under the pointer may stand a
 * few tiles further down the screen than the ground tile under it. Of
 * several overlapping sources the one drawn in front wins.
 */
export function pickResourceTile(map: GameMap, world: Point, size: TileSize): Point | undefined {
  const under = worldToTile(world.x, world.y, size);
  let best: Point | undefined;
  let bestDepth = -Infinity;

  // The tallest object is under two tiles high, so its tile is at most four
  // steps towards the bottom of the screen from the tile under the pointer.
  for (let dy = -1; dy <= 4; dy++) {
    for (let dx = -1; dx <= 4; dx++) {
      const x = under.x + dx;
      const y = under.y + dy;
      if (resourceAt(map, x, y) === undefined) continue;
      const terrain = map.terrain[y * map.width + x];
      const visual = terrain ? TERRAIN_OBJECT_VISUALS[terrain] : undefined;
      if (!visual) continue;

      const centre = tileCenterToWorld(x, y, size);
      const base = centre.y + size.tileHeight / 4;
      const onObject =
        Math.abs(world.x - centre.x) <= visual.width / 2 &&
        world.y <= base &&
        world.y >= base - visual.height;
      const onTile = x === under.x && y === under.y;
      if ((onObject || onTile) && centre.y > bestDepth) {
        best = { x, y };
        bestDepth = centre.y;
      }
    }
  }
  return best;
}
