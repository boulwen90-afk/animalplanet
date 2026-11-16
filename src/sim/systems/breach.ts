import { BUILDING_DEFS } from '../../data/buildings';
import { UNIT_DEFS } from '../../data/units';
import { buildingTiles, isBuilding, nearestBuildingTile, unitTile } from '../entities';
import type { Point } from '../map/iso';
import { findPath, reachableTiles, type PathGrid } from '../pathfinding/astar';
import { buildBreachGrid, buildPathGrid } from '../pathfinding/passability';
import type { Building, Entity, GameState, Unit } from '../state';
import { attackMode, throwDistance } from './combat';

/**
 * Getting at something that stands behind a wall: whether a unit can get to
 * where it could attack a target from, and if not, which piece of the other
 * side's wall is in its way.
 */

/**
 * True if a unit can walk to a place it could attack the target from: a
 * tile next to it for a unit that strikes, a tile within its range for one
 * that throws. `grid` is the walkable ground of the unit's own side.
 */
export function canGetToAttack(grid: PathGrid, unit: Unit, target: Entity): boolean {
  const reach = reachableTiles(grid, unitTile(unit));
  const ranged = UNIT_DEFS[unit.type].ranged;
  if (ranged && attackMode(unit, target) === 'throw') {
    const size = isBuilding(target) ? BUILDING_DEFS[target.type].size : 0;
    const far = Math.ceil(ranged.range);
    for (let y = Math.floor(target.y) - far; y <= Math.floor(target.y) + size + far; y++) {
      for (let x = Math.floor(target.x) - far; x <= Math.floor(target.x) + size + far; x++) {
        if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
        if (!reach[y * grid.width + x]) continue;
        // The whole tile within range: its middle half a diagonal inside it.
        if (throwDistance({ x: x + 0.5, y: y + 0.5 }, target) <= ranged.range - Math.SQRT1_2) {
          return true;
        }
      }
    }
    return false;
  }
  const tiles = isBuilding(target) ? buildingTiles(target) : [unitTile(target)];
  for (const tile of tiles) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tile.x + dx;
        const y = tile.y + dy;
        if (x < 0 || y < 0 || x >= grid.width || y >= grid.height) continue;
        if (reach[y * grid.width + x]) return true;
      }
    }
  }
  return false;
}

/**
 * The piece of the other side's wall that stands first in a unit's way to
 * a target: the way it would walk if that side's walls and gates were not
 * there, and on that way the first tile a piece of wall stands on.
 * Undefined if no wall of the other side is in the way.
 */
export function wallInTheWay(state: GameState, unit: Unit, target: Entity): Building | undefined {
  const here = unitTile(unit);
  const goal: Point = isBuilding(target)
    ? nearestBuildingTile(target, here.x, here.y)
    : unitTile(target);
  const open = buildBreachGrid(state, unit.owner);
  const real = buildPathGrid(state, unit.owner);
  for (const tile of findPath(open, here, goal)) {
    if (real.blocked[tile.y * real.width + tile.x] === 0) continue;
    return state.entities.find(
      (entity): entity is Building =>
        isBuilding(entity) &&
        entity.owner !== unit.owner &&
        BUILDING_DEFS[entity.type].wall !== undefined &&
        entity.x === tile.x &&
        entity.y === tile.y,
    );
  }
  return undefined;
}
